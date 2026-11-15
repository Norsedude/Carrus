"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { getSessionUser } from "@/lib/auth/session";
import { parseDollarsToCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { zonedLocalToUtc } from "@/lib/time";
import { KNOWN_LOCATIONS } from "@/server/search/location";
import { VEHICLE_TYPES } from "@/server/search/types";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function applyToFleetAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/join-the-fleet");
  const values = {
    kind: text(form, "kind"),
    displayName: text(form, "displayName"),
    contactEmail: text(form, "contactEmail"),
    contactPhone: text(form, "contactPhone"),
    fleetSize: text(form, "fleetSize"),
    notes: text(form, "notes"),
  };
  const parsed = z
    .object({
      kind: z.enum(["individual", "company"], "Choose individual or company"),
      displayName: z.string().min(2, "Enter the name customers will see").max(80, "Name is too long"),
      contactEmail: z.email("Enter a valid contact email"),
      contactPhone: z.string().regex(/^$|^[0-9+() .-]{7,20}$/, "Enter a phone number, for example 408-555-0101"),
      fleetSize: z.string().regex(/^\d{1,5}$/, "Enter how many vehicles you plan to list").refine((s) => Number(s) >= 1, "Enter at least 1"),
      notes: z.string().max(2000, "Notes are too long"),
    })
    .safeParse(values);
  if (!parsed.success) {
    const fieldErrors: FormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors, values };
  }
  const supabase = await createClient();
  // Creates a pending application only. It grants no partner privileges.
  const { error } = await supabase.rpc("submit_partner_application", {
    _kind: parsed.data.kind,
    _display_name: parsed.data.displayName,
    _contact_email: parsed.data.contactEmail,
    _contact_phone: parsed.data.contactPhone,
    _fleet_size: Number(parsed.data.fleetSize),
    _notes: parsed.data.notes,
  });
  if (error) {
    return {
      tone: "error",
      message: error.code === "23505" ? "You have already applied with this account." : "We could not submit your application. Try again.",
      fieldErrors: {},
      values,
    };
  }
  revalidatePath("/join-the-fleet");
  redirect("/join-the-fleet?submitted=1");
}

const INTENTS = ["draft", "submit", "save", "pause", "resume", "archive"] as const;
type Intent = (typeof INTENTS)[number];

/** Create or edit a listing as its owner. RLS and the listing trigger enforce ownership and review rules. */
export async function saveVehicleAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/partner");
  const supabase = await createClient();
  const { data: partner } = await supabase.from("partners").select("id, verification_status").eq("owner_user_id", user.id).maybeSingle();
  if (!partner || partner.verification_status !== "verified") redirect("/join-the-fleet");

  const vehicleId = text(form, "vehicleId");
  const intent = (INTENTS as readonly string[]).includes(text(form, "intent")) ? (text(form, "intent") as Intent) : "draft";
  const values: Record<string, string> = {};
  for (const key of ["make", "model", "year", "color", "vehicleType", "seats", "transmission", "description", "locationId", "dailyRate", "availableFrom", "availableUntil", "bookingMode"]) {
    values[key] = text(form, key);
  }

  const fieldErrors: FormState["fieldErrors"] = {};
  if (!values.make) fieldErrors.make = "Enter the make";
  if (!values.model) fieldErrors.model = "Enter the model";
  const year = /^\d{4}$/.test(values.year) ? Number(values.year) : NaN;
  if (!(year >= 1980 && year <= 2100)) fieldErrors.year = "Enter a four-digit model year";
  if (!(VEHICLE_TYPES as readonly string[]).includes(values.vehicleType)) fieldErrors.vehicleType = "Choose a vehicle type";
  const seats = /^\d{1,2}$/.test(values.seats) ? Number(values.seats) : NaN;
  if (!(seats >= 1 && seats <= 15)) fieldErrors.seats = "Enter a whole number from 1 to 15";
  const location = KNOWN_LOCATIONS.find((l) => l.id === values.locationId);
  if (!location) fieldErrors.locationId = "Choose a pickup location";
  // TC-P03 / TC-P04: missing and negative daily rates are rejected.
  const rateCents = parseDollarsToCents(values.dailyRate);
  if (!values.dailyRate) fieldErrors.dailyRate = "Enter a daily rate";
  else if (rateCents === null || rateCents <= 0) fieldErrors.dailyRate = "Daily rate must be a positive dollar amount";
  const tz = location?.timeZone ?? "America/Los_Angeles";
  const from = values.availableFrom ? zonedLocalToUtc(values.availableFrom, tz) : null;
  const until = values.availableUntil ? zonedLocalToUtc(values.availableUntil, tz) : null;
  if (!from) fieldErrors.availableFrom = "Enter when the vehicle becomes available";
  if (!until) fieldErrors.availableUntil = "Enter when availability ends";
  if (from && until && until.getTime() <= from.getTime()) fieldErrors.availableUntil = "Availability must end after it starts";
  if (Object.keys(fieldErrors).length > 0 || !location || !from || !until || rateCents === null) {
    return { tone: "error", message: "Fix the highlighted fields. Nothing was saved.", fieldErrors, values };
  }

  const fields = {
    make: values.make,
    model: values.model,
    year,
    color: values.color,
    vehicle_type: values.vehicleType,
    seats,
    transmission: values.transmission === "Manual" ? "Manual" : "Automatic",
    description: values.description,
    location_label: location.label,
    latitude: location.coordinates.lat,
    longitude: location.coordinates.lng,
    time_zone: location.timeZone,
    daily_rate_cents: rateCents,
    booking_mode: "instant",
  };

  let id = vehicleId;
  if (!id) {
    const [{ data: provider }, { data: policy }] = await Promise.all([
      supabase.from("providers").select("id").eq("adapter_key", "carrus").single(),
      supabase.from("pricing_policies").select("id").eq("key", "flat-fees").eq("version", 1).single(),
    ]);
    if (!provider || !policy) return { tone: "error", message: "Listing setup data is missing. Contact an administrator.", fieldErrors: {}, values };
    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        ...fields,
        public_code: `CR-${randomBytes(4).toString("hex").toUpperCase()}`,
        partner_id: partner.id,
        provider_id: provider.id,
        pricing_policy_id: policy.id,
        lifecycle_status: intent === "submit" ? "pending_review" : "draft",
      })
      .select("id")
      .single();
    if (error || !data) return { tone: "error", message: "We could not save this listing. Try again.", fieldErrors: {}, values };
    id = data.id;
  } else {
    const { data: current } = await supabase.from("vehicles").select("lifecycle_status, approved_at").eq("id", id).eq("partner_id", partner.id).maybeSingle();
    if (!current) return { tone: "error", message: "That listing was not found in your fleet.", fieldErrors: {}, values };
    let status = current.lifecycle_status;
    if (intent === "submit" && (status === "draft" || status === "paused") && !current.approved_at) status = "pending_review";
    if (intent === "pause" && status === "published") status = "paused";
    if (intent === "resume" && status === "paused" && current.approved_at) status = "published";
    if (intent === "archive") status = "archived";
    const { data, error } = await supabase.from("vehicles").update({ ...fields, lifecycle_status: status }).eq("id", id).select("id");
    if (error || !data?.length) return { tone: "error", message: "We could not save this listing. Try again.", fieldErrors: {}, values };
  }

  // One availability window per listing in this version of the form.
  await supabase.from("availability_windows").delete().eq("vehicle_id", id);
  const { error: windowError } = await supabase
    .from("availability_windows")
    .insert({ vehicle_id: id, start_at: from.toISOString(), end_at: until.toISOString() });
  if (windowError) return { tone: "error", message: "The listing was saved, but its availability could not be saved. Try again.", fieldErrors: {}, values };

  revalidatePath("/partner");
  redirect(`/partner?saved=${intent}`);
}

export async function reviewPartnerAction(form: FormData) {
  const supabase = await createClient();
  // The database function checks the admin role; a non-admin call fails there.
  const { error } = await supabase.rpc("review_partner", {
    _partner: text(form, "partnerId"),
    _approve: text(form, "decision") === "approve",
    _reason: text(form, "reason"),
  });
  revalidatePath("/admin");
  redirect(`/admin?result=${error ? "error" : "partner"}${error ? `&detail=${encodeURIComponent(error.message)}` : ""}`);
}

export async function reviewListingAction(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_listing", {
    _vehicle: text(form, "vehicleId"),
    _approve: text(form, "decision") === "approve",
    _reason: text(form, "reason"),
  });
  revalidatePath("/admin");
  redirect(`/admin?result=${error ? "error" : "listing"}${error ? `&detail=${encodeURIComponent(error.message)}` : ""}`);
}
