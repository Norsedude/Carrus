"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireVerifiedPartner } from "@/lib/auth/partner";
import { createAdminClient } from "@/lib/supabase/server";
import { MAX_PHOTOS_PER_LISTING, PHOTO_BUCKET, checkPhoto } from "@/server/vehicles/photos";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;

export type PhotoState = { message?: string; tone?: "error" | "success" };

/** Ownership is checked with the partner's own (RLS) client before any storage write. */
async function ownedVehicle(vehicleId: string) {
  if (!UUID.test(vehicleId)) redirect("/partner");
  const { partner, db } = await requireVerifiedPartner(`/partner/vehicles/${vehicleId}/edit`);
  const { data: vehicle } = await db.from("vehicles").select("id").eq("id", vehicleId).eq("partner_id", partner.id).maybeSingle();
  if (!vehicle) redirect("/partner");
  return { db, vehicleId: vehicle.id };
}

export async function uploadPhotosAction(_prev: PhotoState, form: FormData): Promise<PhotoState> {
  const { db, vehicleId } = await ownedVehicle(text(form, "vehicleId"));
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { tone: "error", message: "Choose at least one photo." };
  const { data: existing } = await db.from("vehicle_photos").select("id, is_primary, position").eq("vehicle_id", vehicleId);
  const current = existing ?? [];
  if (current.length + files.length > MAX_PHOTOS_PER_LISTING) {
    return { tone: "error", message: `A listing can have up to ${MAX_PHOTOS_PER_LISTING} photos. Remove some first.` };
  }

  // Validate every file before storing any, so a bad file uploads nothing.
  const checked: { bytes: Uint8Array; ext: string; mime: string }[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = checkPhoto(file.name || "That file", bytes.length, bytes.subarray(0, 16));
    if (!result.ok) return { tone: "error", message: `${result.message} Nothing was uploaded.` };
    checked.push({ bytes, ext: result.kind.ext, mime: result.kind.mime });
  }

  const storage = createAdminClient().storage.from(PHOTO_BUCKET);
  let position = current.reduce((max, p) => Math.max(max, p.position + 1), 0);
  let needsPrimary = !current.some((p) => p.is_primary);
  for (const file of checked) {
    const path = `${vehicleId}/${randomUUID()}.${file.ext}`;
    const { error } = await storage.upload(path, file.bytes, { contentType: file.mime, upsert: false });
    if (error) return { tone: "error", message: "A photo could not be stored. Try again." };
    const publicUrl = storage.getPublicUrl(path).data.publicUrl;
    const { error: rowError } = await db.from("vehicle_photos").insert({ vehicle_id: vehicleId, storage_path: publicUrl, position, is_primary: needsPrimary });
    if (rowError) {
      await storage.remove([path]);
      return { tone: "error", message: "A photo could not be saved. Try again." };
    }
    position += 1;
    needsPrimary = false;
  }
  revalidatePath(`/partner/vehicles/${vehicleId}/edit`);
  revalidatePath(`/vehicles/${vehicleId}`);
  return { tone: "success", message: `${checked.length} photo${checked.length === 1 ? "" : "s"} added.` };
}

/** Storage object path for a public URL in our bucket, or null for other photos. */
function bucketPath(url: string): string | null {
  const marker = `/storage/v1/object/public/${PHOTO_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

export async function deletePhotoAction(form: FormData) {
  const { db, vehicleId } = await ownedVehicle(text(form, "vehicleId"));
  const photoId = text(form, "photoId");
  const { data: photo } = await db.from("vehicle_photos").select("id, storage_path, is_primary").eq("id", photoId).eq("vehicle_id", vehicleId).maybeSingle();
  if (photo) {
    await db.from("vehicle_photos").delete().eq("id", photo.id);
    const path = bucketPath(photo.storage_path);
    if (path) await createAdminClient().storage.from(PHOTO_BUCKET).remove([path]);
    if (photo.is_primary) {
      const { data: next } = await db.from("vehicle_photos").select("id").eq("vehicle_id", vehicleId).order("position").limit(1);
      if (next?.[0]) await db.from("vehicle_photos").update({ is_primary: true }).eq("id", next[0].id);
    }
  }
  revalidatePath(`/partner/vehicles/${vehicleId}/edit`);
  revalidatePath(`/vehicles/${vehicleId}`);
  redirect(`/partner/vehicles/${vehicleId}/edit#photos`);
}

export async function makePrimaryPhotoAction(form: FormData) {
  const { db, vehicleId } = await ownedVehicle(text(form, "vehicleId"));
  const photoId = text(form, "photoId");
  // One primary per listing (unique index): clear first, then set.
  await db.from("vehicle_photos").update({ is_primary: false }).eq("vehicle_id", vehicleId).eq("is_primary", true);
  await db.from("vehicle_photos").update({ is_primary: true }).eq("id", photoId).eq("vehicle_id", vehicleId);
  revalidatePath(`/partner/vehicles/${vehicleId}/edit`);
  revalidatePath(`/vehicles/${vehicleId}`);
  redirect(`/partner/vehicles/${vehicleId}/edit#photos`);
}
