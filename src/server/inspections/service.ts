import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  PHOTO_CATEGORIES,
  checkConditionValues,
  checkPhoto,
  missingPhotosMessage,
  photoPath,
  type ConditionValues,
  type PhotoCategory,
  type PhotoContentType,
} from "@/server/inspections/rules";

// InspectionService. Like BookingService, callers pass the privileged
// (service-role) client and an already-authenticated user id. The service-role
// client is the only thing that can read or write the private photo bucket.

type Db = SupabaseClient<Database>;

export const INSPECTION_BUCKET = "inspection-photos";
/** Signed photo links last ten minutes; the page creates new ones on each load. */
const SIGNED_URL_SECONDS = 600;

export type PickupCheckInput = ConditionValues & {
  acknowledged: boolean;
  photos: Partial<Record<PhotoCategory, File>>;
};

export type PickupCheckResult =
  | { ok: true }
  | { ok: false; message?: string; fieldErrors: Partial<Record<string, string>> };

type Accepted = { category: PhotoCategory; file: File; contentType: PhotoContentType };

/**
 * Validates and saves a customer's pickup condition check (F6, TC-PC02 to TC-PC04).
 *
 * The caller must already have authenticated the customer. Order of work:
 * 1. Check the three selections, the acknowledgment and every photo (type by
 *    file bytes, size, one per category). Nothing is uploaded if any check fails.
 * 2. Upload the photos to the private bucket under this booking's folder.
 * 3. Save the record through record_pickup_inspection, which re-checks the
 *    customer, the booking state and that every photo exists, all in one
 *    transaction. If that fails, the uploaded photos are deleted again.
 */
export async function recordPickupCheck(admin: Db, customerId: string, bookingId: string, input: PickupCheckInput): Promise<PickupCheckResult> {
  const fieldErrors: Partial<Record<string, string>> = { ...checkConditionValues(input) };
  if (!input.acknowledged) fieldErrors.acknowledged = "Confirm that this record matches the vehicle";

  const accepted: Accepted[] = [];
  const missing: PhotoCategory[] = [];
  for (const category of PHOTO_CATEGORIES) {
    const file = input.photos[category];
    if (!file || file.size === 0) {
      missing.push(category);
      continue;
    }
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const check = checkPhoto({ size: file.size, head });
    if (!check.ok) fieldErrors[category] = check.message;
    else accepted.push({ category, file, contentType: check.contentType });
  }
  const message = missing.length > 0 ? missingPhotosMessage(missing) : undefined;
  if (message || Object.keys(fieldErrors).length > 0) return { ok: false, message, fieldErrors };

  // Check the caller and booking state before writing anything to storage, so
  // nobody can place files in another booking's folder. The database function
  // re-checks both in the same transaction as the save.
  const { data: booking } = await admin.from("bookings").select("customer_id, state").eq("id", bookingId).maybeSingle();
  if (!booking || booking.customer_id !== customerId) return { ok: false, message: "Reservation not found.", fieldErrors: {} };
  if (booking.state !== "ready_for_pickup") {
    return { ok: false, message: "This reservation is not ready for pickup, or its condition check was already saved.", fieldErrors: {} };
  }

  const uploaded: { category: PhotoCategory; path: string; contentType: PhotoContentType; sizeBytes: number }[] = [];
  let cleanedUp = false;
  const cleanUp = async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    await removePhotos(admin, uploaded.map((u) => u.path));
  };
  try {
    for (const p of accepted) {
      const path = photoPath(bookingId, "pickup", p.category, p.contentType, randomUUID());
      const { error } = await admin.storage
        .from(INSPECTION_BUCKET)
        .upload(path, p.file, { contentType: p.contentType, upsert: false });
      if (error) throw new Error(`upload ${p.category}: ${error.message}`);
      uploaded.push({ category: p.category, path, contentType: p.contentType, sizeBytes: p.file.size });
    }
    const { error } = await admin.rpc("record_pickup_inspection", {
      _actor: customerId,
      _booking: bookingId,
      _exterior_damage: input.exteriorDamage,
      _fuel_level: input.fuelLevel,
      _cleanliness: input.cleanliness,
      _photos: uploaded,
    });
    if (error) {
      await cleanUp();
      if (error.message.includes("not ready for pickup")) {
        return { ok: false, message: "This reservation is not ready for pickup, or its condition check was already saved.", fieldErrors: {} };
      }
      if (error.message.includes("Reservation not found")) {
        return { ok: false, message: "Reservation not found.", fieldErrors: {} };
      }
      return { ok: false, message: "We could not save the condition check. Try again.", fieldErrors: {} };
    }
    return { ok: true };
  } catch {
    await cleanUp();
    return { ok: false, message: "We could not upload the photos. Try again.", fieldErrors: {} };
  }
}

/** Best-effort removal of photos from a failed save. Never throws; failures are logged with the paths left behind. */
async function removePhotos(admin: Db, paths: string[]) {
  if (paths.length === 0) return;
  try {
    const { error } = await admin.storage.from(INSPECTION_BUCKET).remove(paths);
    if (error) console.error(`[inspections] could not remove ${paths.length} orphaned photo(s): ${error.message}`, paths);
  } catch (e) {
    console.error("[inspections] photo cleanup failed", e instanceof Error ? e.message : e, paths);
  }
}

export type InspectionView = {
  stage: "pickup" | "return";
  performedRole: "customer" | "partner";
  exteriorDamage: string;
  fuelLevel: string;
  cleanliness: string;
  acknowledgedAt: string;
  photos: { category: PhotoCategory; url: string | null; uploadedAt: string }[];
};

/**
 * Inspection records for a booking, read with the viewer's own client (viewer)
 * so row-level security decides what they may see. Photo links are signed with
 * the privileged client (admin) only for rows that query returned.
 */
export async function getInspections(viewer: Db, admin: Db, bookingId: string): Promise<InspectionView[]> {
  const { data: rows } = await viewer
    .from("inspections")
    .select("id, stage, performed_role, exterior_damage, fuel_level, cleanliness, acknowledged_at, inspection_photos (category, storage_path, uploaded_at)")
    .eq("booking_id", bookingId)
    .order("created_at");
  if (!rows || rows.length === 0) return [];

  const paths = rows.flatMap((r) => r.inspection_photos.map((p) => p.storage_path));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await admin.storage.from(INSPECTION_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const s of data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  const order = (c: string) => PHOTO_CATEGORIES.indexOf(c as PhotoCategory);
  return rows.map((r) => ({
    stage: r.stage as InspectionView["stage"],
    performedRole: r.performed_role as InspectionView["performedRole"],
    exteriorDamage: r.exterior_damage,
    fuelLevel: r.fuel_level,
    cleanliness: r.cleanliness,
    acknowledgedAt: r.acknowledged_at,
    photos: [...r.inspection_photos]
      .sort((a, b) => order(a.category) - order(b.category))
      .map((p) => ({ category: p.category as PhotoCategory, url: urls.get(p.storage_path) ?? null, uploadedAt: p.uploaded_at })),
  }));
}
