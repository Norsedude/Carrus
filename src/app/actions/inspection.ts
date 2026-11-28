"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/actions/auth";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { recordPickupCheck } from "@/server/inspections/service";
import { MESSAGES, PHOTO_CATEGORIES, type PhotoCategory } from "@/server/inspections/rules";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/**
 * TC-PC01. The partner confirms the vehicle is clean and fully fueled, which
 * moves a confirmed reservation to "Ready for pickup". Runs as the signed-in
 * partner; the database function checks that they own the reservation.
 */
export async function markReadyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const bookingId = text(form, "bookingId");
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/partner/reservations/${bookingId}`)}`);
  if (!isUuid(bookingId)) return { tone: "error", message: "Reservation not found.", fieldErrors: {}, values: {} };

  const vehicleClean = form.get("vehicleClean") === "on";
  const fuelFull = form.get("fuelFull") === "on";
  const values = { vehicleClean: vehicleClean ? "on" : "", fuelFull: fuelFull ? "on" : "" };
  if (!vehicleClean || !fuelFull) {
    return { tone: "error", message: MESSAGES.prepare, fieldErrors: {}, values };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_ready_for_pickup", { _booking: bookingId, _vehicle_clean: true, _fuel_full: true });
  if (error) {
    const message = error.message.includes("Only a confirmed")
      ? "Only a confirmed reservation can be marked ready for pickup."
      : error.message.includes("Reservation not found")
        ? "Reservation not found."
        : "We could not update the reservation. Try again.";
    return { tone: "error", message, fieldErrors: {}, values };
  }
  revalidatePath(`/partner/reservations/${bookingId}`);
  revalidatePath("/partner");
  revalidatePath(`/trips/${bookingId}`);
  return { tone: "success", message: "Vehicle marked ready for pickup.", fieldErrors: {}, values: {} };
}

/**
 * TC-PC02 to TC-PC04. The customer's pickup condition check: three selections,
 * one photo per category and an acknowledgment. All validation and saving
 * happens in recordPickupCheck; this action only reads the form.
 */
export async function pickupCheckAction(_prev: FormState, form: FormData): Promise<FormState> {
  const bookingId = text(form, "bookingId");
  const returnTo = `/trips/${bookingId}/pickup-check`;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!isUuid(bookingId)) return { tone: "error", message: "Reservation not found.", fieldErrors: {}, values: {} };

  const values = {
    exteriorDamage: text(form, "exteriorDamage"),
    fuelLevel: text(form, "fuelLevel"),
    cleanliness: text(form, "cleanliness"),
  };
  const photos: Partial<Record<PhotoCategory, File>> = {};
  for (const category of PHOTO_CATEGORIES) {
    const file = form.get(category);
    if (file instanceof File) photos[category] = file;
  }

  const result = await recordPickupCheck(createAdminClient(), user.id, bookingId, {
    ...values,
    acknowledged: form.get("acknowledged") === "on",
    photos,
  });
  if (!result.ok) {
    return { tone: "error", message: result.message, fieldErrors: result.fieldErrors, values: { ...values, acknowledged: form.get("acknowledged") === "on" ? "on" : "" } };
  }
  revalidatePath(`/trips/${bookingId}`);
  revalidatePath(`/partner/reservations/${bookingId}`);
  redirect(`/trips/${bookingId}?checked=1`);
}
