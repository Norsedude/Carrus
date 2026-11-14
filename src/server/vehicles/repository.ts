import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { calculatePrice, type PolicyFormula, type PricingPolicy } from "@/server/pricing/pricing";
import type { VehicleListing, VehicleType } from "@/server/search/types";

export type Db = SupabaseClient<Database>;

const VEHICLE_SELECT = `
  id, public_code, make, model, year, color, vehicle_type, seats, transmission,
  description, location_label, latitude, longitude, time_zone, daily_rate_cents,
  booking_mode, cancellation_policy, lifecycle_status, updated_at, partner_id,
  partner:partners!inner (id, display_name, kind, verification_status),
  policy:pricing_policies!inner (id, key, version, formula),
  provider:providers!inner (adapter_key, name, capability, is_mock)
`;

export type VehicleRow = {
  id: string;
  public_code: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vehicle_type: string;
  seats: number;
  transmission: string;
  description: string;
  location_label: string;
  latitude: number;
  longitude: number;
  time_zone: string;
  daily_rate_cents: number;
  booking_mode: string;
  cancellation_policy: string;
  lifecycle_status: string;
  updated_at: string;
  partner_id: string;
  partner: { id: string; display_name: string; kind: string; verification_status: string };
  policy: { id: string; key: string; version: number; formula: unknown };
  provider: { adapter_key: string; name: string; capability: string; is_mock: boolean };
};

export function policyFromRow(row: VehicleRow["policy"]): PricingPolicy {
  return { id: row.id, key: row.key, version: row.version, formula: row.formula as PolicyFormula };
}

/** ListNormalizer for native inventory: database row -> VehicleListing with a fresh price. */
export function toListing(row: VehicleRow, pickupAt: Date, returnAt: Date): VehicleListing {
  return {
    id: row.id,
    providerKey: row.provider.adapter_key,
    providerName: row.provider.name,
    providerListingId: row.public_code,
    isMockSource: row.provider.is_mock,
    bookingCapability: row.provider.capability === "native_booking" ? "native_booking" : "redirect",
    exactMatch: true,
    publicCode: row.public_code,
    make: row.make,
    model: row.model,
    year: row.year,
    color: row.color,
    vehicleType: row.vehicle_type as VehicleType,
    seats: row.seats,
    transmission: row.transmission,
    description: row.description,
    locationLabel: row.location_label,
    coordinates: { lat: row.latitude, lng: row.longitude },
    timeZone: row.time_zone,
    distanceMiles: null,
    dailyRateCents: row.daily_rate_cents,
    pricingPolicyId: row.policy.id,
    partner: {
      id: row.partner.id,
      displayName: row.partner.display_name,
      kind: row.partner.kind,
      verified: row.partner.verification_status === "verified",
    },
    bookingMode: row.booking_mode === "request" ? "request" : "instant",
    cancellationPolicy: row.cancellation_policy,
    price: calculatePrice({
      dailyRateCents: row.daily_rate_cents,
      pickupAt,
      returnAt,
      policy: policyFromRow(row.policy),
    }),
    lastUpdated: row.updated_at,
  };
}

/** IDs of published, verified vehicles free for the whole interval (database-enforced view). */
export async function availableVehicleIds(db: Db, pickupAt: Date, returnAt: Date): Promise<string[]> {
  const { data, error } = await db.rpc("available_vehicle_ids", {
    _pickup: pickupAt.toISOString(),
    _return: returnAt.toISOString(),
  });
  if (error) throw new Error(`availability lookup failed: ${error.message}`);
  return (data ?? []) as string[];
}

export async function getVehicleRows(db: Db, ids: string[]): Promise<VehicleRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db.from("vehicles").select(VEHICLE_SELECT).in("id", ids);
  if (error) throw new Error(`vehicle lookup failed: ${error.message}`);
  return (data ?? []) as unknown as VehicleRow[];
}

/** One vehicle as visible to the given client (RLS decides), or null. */
export async function getVehicleRow(db: Db, id: string): Promise<VehicleRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await getVehicleRows(db, [id]);
  return rows[0] ?? null;
}
