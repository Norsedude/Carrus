import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { allowRequest, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getVehicleRow, primaryPhoto } from "@/server/vehicles/repository";

// GET /api/vehicles/:id -> one public listing (row-level security applies).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await allowRequest("api"))) return fail(429, { code: "rate_limited", message: RATE_LIMITED_MESSAGE });
  const { id } = await params;
  const row = await getVehicleRow(await createClient(), id);
  if (!row || row.lifecycle_status !== "published") return fail(404, { code: "not_found", message: "Vehicle not found." });
  return ok({
    id: row.id,
    publicCode: row.public_code,
    make: row.make,
    model: row.model,
    year: row.year,
    color: row.color,
    vehicleType: row.vehicle_type,
    seats: row.seats,
    transmission: row.transmission,
    description: row.description,
    location: { label: row.location_label, lat: row.latitude, lng: row.longitude, timeZone: row.time_zone },
    dailyRateCents: row.daily_rate_cents,
    bookingMode: row.booking_mode,
    cancellationPolicy: row.cancellation_policy,
    partner: { name: row.partner.display_name, kind: row.partner.kind, verified: row.partner.verification_status === "verified" },
    photoUrl: primaryPhoto(row),
    photos: [...row.photos].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position).map((p) => p.storage_path),
  });
}
