import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { startBookingAction } from "@/app/actions/booking";
import { VehicleArt } from "@/components/brand";
import { CompareToggle } from "@/components/compare";
import { CANCELLATION_TEXT, PriceBreakdownView } from "@/components/price";
import { Badge, Field, Notice, btnPrimary, btnSecondary, cardCls, linkCls } from "@/components/ui";
import { vehicleName } from "@/components/vehicle-card";
import { getNow } from "@/lib/clock";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { distanceMiles, resolveLocation } from "@/server/search/location";
import { validateDates, type RawParams } from "@/server/search/validator";
import { availableVehicleIds, getVehicleRow, toListing } from "@/server/vehicles/repository";

export const metadata: Metadata = { title: "Vehicle details" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function VehiclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<RawParams> }) {
  const { id } = await params;
  const raw = await searchParams;
  const db = await createClient();
  const row = await getVehicleRow(db, id); // RLS: published + verified, or the owner/admin
  if (!row) notFound();

  const pickup = one(raw.pickup);
  const ret = one(raw.return);
  const locationText = one(raw.location);
  const origin = locationText ? resolveLocation(locationText) : null;
  const hasDates = Boolean(pickup || ret);
  const dates = hasDates ? validateDates(pickup, ret, row.time_zone, getNow()) : null;
  const listing = dates?.ok ? toListing(row, dates.pickupAt, dates.returnAt) : null;
  const available = dates?.ok ? (await availableVehicleIds(db, dates.pickupAt, dates.returnAt)).includes(row.id) : null;
  const name = vehicleName(row);
  const isPublic = row.lifecycle_status === "published";
  const self = `/vehicles/${row.id}?${new URLSearchParams({ pickup, return: ret, location: locationText }).toString()}`;
  const backToSearch = `/search?${new URLSearchParams({ location: locationText || row.location_label, pickup, return: ret }).toString()}`;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      {dates?.ok && (
        <p className="mb-3 text-sm">
          <Link href={backToSearch} className={linkCls}>Back to results</Link>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{name}</h1>
        <Badge tone="blue">Exact vehicle</Badge>
        {!isPublic && <Badge tone="amber">Not public: {row.lifecycle_status.replace("_", " ")}</Badge>}
      </div>
      <p className="mt-1 text-sm text-slate-600">Listing {row.public_code}</p>

      {one(raw.problem) === "unavailable" && (
        <div className="mt-4">
          <Notice tone="error" title="No longer available for these dates">
            Someone else reserved this vehicle, or its availability changed. Nothing was booked. Try other dates or another vehicle.
          </Notice>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className={`${cardCls} p-4`}>
            <VehicleArt type={row.vehicle_type} color={row.color} className="mx-auto h-auto w-full max-w-md" />
            <p className="mt-2 text-center text-xs text-slate-600">
              Illustration only. Photo upload for listings is not built yet, so no photos of this vehicle are shown.
            </p>
          </div>

          <section className={`${cardCls} p-5`} aria-labelledby="specs-heading">
            <h2 id="specs-heading" className="text-base font-semibold text-slate-900">Vehicle</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {[
                ["Make", row.make], ["Model", row.model], ["Year", String(row.year)],
                ["Color", row.color || "Not specified"], ["Type", row.vehicle_type], ["Seats", String(row.seats)],
                ["Transmission", row.transmission], ["Daily rate", formatCents(row.daily_rate_cents)],
                ["Booking", row.booking_mode === "instant" ? "Instant confirmation" : "Partner approval required"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-slate-600">{k}</dt>
                  <dd className="font-medium text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
            {row.description && <p className="mt-4 text-sm text-slate-700">{row.description}</p>}
          </section>

          <section className={`${cardCls} p-5`} aria-labelledby="where-heading">
            <h2 id="where-heading" className="text-base font-semibold text-slate-900">Pickup location and partner</h2>
            <p className="mt-2 text-sm text-slate-700">
              {row.location_label}
              {origin && ` · ${distanceMiles(origin.coordinates, { lat: row.latitude, lng: row.longitude }).toFixed(1)} miles (straight line) from ${origin.label}`}
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Offered by <span className="font-medium text-slate-900">{row.partner.display_name}</span>
              {row.partner.verification_status === "verified" ? " · Verified partner (reviewed by a Carrus administrator)" : " · Not yet verified"}
            </p>
            <p className="mt-2 text-xs text-slate-500">Listing last updated {formatDateTime(row.updated_at, row.time_zone)}.</p>
          </section>

          <section className={`${cardCls} p-5`} aria-labelledby="policy-heading">
            <h2 id="policy-heading" className="text-base font-semibold text-slate-900">Cancellation</h2>
            <p className="mt-2 text-sm text-slate-700">{CANCELLATION_TEXT[row.cancellation_policy] ?? row.cancellation_policy}</p>
          </section>
        </div>

        <aside className={`${cardCls} h-fit space-y-4 p-5`}>
          <form action={`/vehicles/${row.id}`} method="get" noValidate className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Your trip</h2>
            <input type="hidden" name="location" value={locationText} />
            <Field label="Pickup date and time" name="pickup" type="datetime-local" defaultValue={pickup} error={dates && !dates.ok ? dates.fieldErrors.pickup : undefined} />
            <Field label="Return date and time" name="return" type="datetime-local" defaultValue={ret} error={dates && !dates.ok ? dates.fieldErrors.return : undefined} />
            <button type="submit" className={`${btnSecondary} w-full`}>{listing ? "Update dates" : "Check price and availability"}</button>
          </form>

          {listing && dates?.ok && (
            <>
              <hr className="border-slate-200" />
              <PriceBreakdownView price={listing.price} />
              {available ? (
                isPublic ? (
                  <form action={startBookingAction} className="space-y-2">
                    <input type="hidden" name="vehicleId" value={row.id} />
                    <input type="hidden" name="pickup" value={pickup} />
                    <input type="hidden" name="return" value={ret} />
                    <input type="hidden" name="location" value={locationText} />
                    <input type="hidden" name="back" value={self} />
                    <p className="text-sm font-medium text-emerald-800" data-testid="availability">Available for these dates</p>
                    <button type="submit" className={`${btnPrimary} w-full`}>Reserve this vehicle</button>
                    <p className="text-xs text-slate-600">Next you will review the details. Nothing is booked or charged yet.</p>
                  </form>
                ) : (
                  <Notice tone="warning">This listing is not public, so it cannot be reserved.</Notice>
                )
              ) : (
                <Notice tone="warning" title="Not available for these dates">
                  <span data-testid="availability">Choose different dates, or go back to the results for other vehicles.</span>
                </Notice>
              )}
              {isPublic && <CompareToggle id={row.id} name={name} pickup={pickup} ret={ret} location={locationText} />}
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
