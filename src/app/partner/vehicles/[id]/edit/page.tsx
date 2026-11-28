import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhotoManager, VehicleForm } from "@/components/partner-forms";
import { PageShell, StateBadge, cardCls } from "@/components/ui";
import { requireVerifiedPartner } from "@/lib/auth/partner";
import { utcToZonedLocal } from "@/lib/time";
import { KNOWN_LOCATIONS } from "@/server/search/location";
import { VEHICLE_TYPES } from "@/server/search/types";
import { MAX_PHOTOS_PER_LISTING } from "@/server/vehicles/photos";

export const metadata: Metadata = { title: "Edit vehicle" };

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { partner, db } = await requireVerifiedPartner(`/partner/vehicles/${id}/edit`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // Scoped to the caller's own partner; RLS enforces the same rule.
  const { data: v } = await db.from("vehicles").select("*").eq("id", id).eq("partner_id", partner.id).maybeSingle();
  if (!v) notFound();
  const { data: windows } = await db
    .from("availability_windows")
    .select("start_at, end_at")
    .eq("vehicle_id", v.id)
    .order("start_at");
  const { data: photoRows } = await db.from("vehicle_photos").select("id, storage_path, is_primary, position").eq("vehicle_id", v.id).order("position");
  const w = windows?.[0];
  const rest = (windows ?? []).slice(1).map((x) => [utcToZonedLocal(new Date(x.start_at), v.time_zone), utcToZonedLocal(new Date(x.end_at), v.time_zone)]);
  const location = KNOWN_LOCATIONS.find((l) => l.label === v.location_label);

  return (
    <PageShell
      title={`Edit ${v.year} ${v.make} ${v.model}`}
      intro={
        <span className="flex items-center gap-2">
          Listing {v.public_code} <StateBadge state={v.lifecycle_status} />
        </span>
      }
    >
      <div className={`${cardCls} p-5`}>
        <VehicleForm
          vehicleId={v.id}
          status={v.lifecycle_status}
          approved={Boolean(v.approved_at)}
          initial={{
            make: v.make,
            model: v.model,
            year: String(v.year),
            color: v.color,
            vehicleType: v.vehicle_type,
            seats: String(v.seats),
            transmission: v.transmission,
            description: v.description,
            locationId: location?.id ?? "",
            dailyRate: (v.daily_rate_cents / 100).toFixed(2),
            availableFrom: w ? utcToZonedLocal(new Date(w.start_at), v.time_zone) : "",
            availableUntil: w ? utcToZonedLocal(new Date(w.end_at), v.time_zone) : "",
            windows: JSON.stringify(rest),
            bookingMode: v.booking_mode,
          }}
          locations={KNOWN_LOCATIONS.map((l) => ({ value: l.id, label: l.label }))}
          types={[...VEHICLE_TYPES]}
        />
      </div>
      <section id="photos" aria-labelledby="photos-heading" className={`${cardCls} mt-6 scroll-mt-28 p-5`}>
        <h2 id="photos-heading" className="mb-4 text-2xl">Photos</h2>
        <PhotoManager
          vehicleId={v.id}
          max={MAX_PHOTOS_PER_LISTING}
          photos={(photoRows ?? []).map((p) => ({ id: p.id, url: p.storage_path, isPrimary: p.is_primary }))}
        />
      </section>
    </PageShell>
  );
}
