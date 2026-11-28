import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Cog, MapPin, Palette, ShieldCheck, Tag, UserRound, Users } from "lucide-react";
import { startBookingAction } from "@/app/actions/booking";
import { AvailabilityCalendar } from "@/components/availability-calendar";
import { VehicleImage } from "@/components/brand";
import { CompareToggle } from "@/components/compare";
import { CANCELLATION_TEXT, PriceBreakdownView } from "@/components/price";
import { Badge, Field, Notice, btnPrimary, btnSecondary, cardCls } from "@/components/ui";
import { vehicleName } from "@/components/vehicle-card";
import { getNow } from "@/lib/clock";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, utcToZonedLocal } from "@/lib/time";
import { buildCalendar } from "@/server/vehicles/calendar";
import { distanceMiles, resolveLocation } from "@/server/search/location";
import { validateDates, type RawParams } from "@/server/search/validator";
import { availableVehicleIds, getVehicleRow, primaryPhoto, toListing } from "@/server/vehicles/repository";

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
  const verified = row.partner.verification_status === "verified";
  const photo = primaryPhoto(row);
  const gallery = [...(row.photos ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position).map((p) => p.storage_path);
  const isRequest = row.booking_mode === "request";
  const calendarFrom = dates?.ok ? dates.pickupAt : getNow();
  const calendarTo = new Date(calendarFrom.getTime() + 70 * 86_400_000);
  const [{ data: windowRows }, { data: busyRows }] = await Promise.all([
    db.from("availability_windows").select("start_at, end_at").eq("vehicle_id", row.id),
    db.rpc("vehicle_busy_periods", { _vehicle: row.id, _from: new Date(calendarFrom.getTime() - 40 * 86_400_000).toISOString(), _to: calendarTo.toISOString() }),
  ]);
  const months = buildCalendar({
    from: calendarFrom,
    months: 2,
    timeZone: row.time_zone,
    now: getNow(),
    windows: (windowRows ?? []).map((w) => ({ start: new Date(w.start_at), end: new Date(w.end_at) })),
    busy: ((busyRows ?? []) as { start_at: string; end_at: string }[]).map((b) => ({ start: new Date(b.start_at), end: new Date(b.end_at) })),
  });
  const tripDays = dates?.ok
    ? { from: utcToZonedLocal(dates.pickupAt, row.time_zone).slice(0, 10), to: utcToZonedLocal(new Date(dates.returnAt.getTime() - 1), row.time_zone).slice(0, 10) }
    : undefined;
  const self = `/vehicles/${row.id}?${new URLSearchParams({ pickup, return: ret, location: locationText }).toString()}`;
  const backToSearch = `/search?${new URLSearchParams({ location: locationText || row.location_label, pickup, return: ret }).toString()}`;
  const glance = [
    { icon: Users, label: `${row.seats} seats` },
    { icon: Tag, label: row.vehicle_type },
    { icon: Cog, label: row.transmission },
    { icon: Palette, label: row.color || "Color not listed" },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      {dates?.ok && (
        <p className="mb-5">
          <Link href={backToSearch} className="group inline-flex items-center gap-2 text-[0.95rem] font-medium text-gray-700 hover:text-gray-900">
            <ArrowLeft className="size-4 transition-transform duration-500 group-hover:-translate-x-1" aria-hidden /> Back to search results
          </Link>
        </p>
      )}
      <h1 className="text-4xl text-gray-900 sm:text-5xl">
        {row.make} {row.model}
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.95rem] text-gray-500">
        <span>{row.year}</span>
        <span className="inline-flex items-center gap-1.5">
          {row.partner.kind === "company" ? <Building2 className="size-4 text-accent" aria-hidden /> : <UserRound className="size-4 text-accent" aria-hidden />}
          {row.partner.display_name}
        </span>
        {verified && isPublic && <Badge tone="green">Verified listing</Badge>}
        <Badge tone="blue">Exact vehicle</Badge>
        {isRequest && <Badge tone="amber">Host approval required</Badge>}
        {!isPublic && <Badge tone="amber">Not public: {row.lifecycle_status.replace("_", " ")}</Badge>}
        <span>Listing {row.public_code}</span>
      </p>

      {one(raw.problem) === "unavailable" && (
        <div className="mt-5">
          <Notice tone="error" title="No longer available for these dates">
            Someone else reserved this vehicle, or its availability changed. Nothing was booked. Try other dates or another vehicle.
          </Notice>
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="min-w-0 space-y-6">
          <div>
            <VehicleImage photoUrl={photo} name={name} type={row.vehicle_type} color={row.color} className="photo-luxe clip-reveal aspect-[16/10] w-full rounded-2xl" sizes="(min-width: 1024px) 50rem, 100vw" priority />
            {!photo && <p className="mt-2 text-sm text-gray-500">Illustration only. The host has not added photos of this vehicle yet.</p>}
            {gallery.length > 1 && (
              <ul className="mt-3 flex gap-3 overflow-x-auto pb-1" aria-label="More photos">
                {gallery.slice(1).map((url, i) => (
                  <li key={url} className="shrink-0">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                      <VehicleImage photoUrl={url} name={`${name}, photo ${i + 2}`} type={row.vehicle_type} color={row.color} className="photo-luxe aspect-[4/3] w-36 rounded-xl" sizes="9rem" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <section aria-labelledby="glance-heading">
            <h2 id="glance-heading" className="text-2xl text-gray-900">At a glance</h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {glance.map(({ icon: Icon, label }) => (
                <li key={label} className={`${cardCls} p-4`}>
                  <Icon className="size-5 text-accent" aria-hidden />
                  <p className="mt-2 font-semibold text-gray-900">{label}</p>
                </li>
              ))}
            </ul>
            {row.description && <p className="mt-4 leading-relaxed text-gray-600">{row.description}</p>}
          </section>

          <section className={`${cardCls} flex items-center gap-4 p-5`} aria-label="Host">
            <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-xl font-semibold text-accent">
              {row.partner.display_name[0]}
            </span>
            <div>
              <h2 className="text-xl text-gray-900">
                {row.partner.kind === "company" ? "Rented from" : "Hosted by"} {row.partner.display_name}
              </h2>
              <p className="text-[0.95rem] text-gray-500">
                {verified ? "Verified Rental Partner, reviewed by a Carrus administrator" : "Not yet verified"} ·{" "}
                {row.booking_mode === "instant" ? "Instant confirmation" : "Host approval required"}
              </p>
            </div>
          </section>

          {listing && (
            <section className={`${cardCls} p-6`}>
              <PriceBreakdownView price={listing.price} heading="Full price for your dates" />
            </section>
          )}

          <section className={`${cardCls} p-6`} aria-labelledby="calendar-heading">
            <h2 id="calendar-heading" className="mb-4 text-2xl text-gray-900">Availability</h2>
            <AvailabilityCalendar months={months} selected={tripDays} />
          </section>

          <section className={`${cardCls} p-6`} aria-labelledby="where-heading">
            <h2 id="where-heading" className="text-2xl text-gray-900">Pickup and return location</h2>
            <p className="mt-3 flex items-start gap-2 text-gray-900">
              <MapPin className="mt-1 size-4 shrink-0 text-gray-500" aria-hidden />
              <span>
                {row.location_label}
                {origin && ` · ${distanceMiles(origin.coordinates, { lat: row.latitude, lng: row.longitude }).toFixed(1)} mi (straight line) from ${origin.label}`}
              </span>
            </p>
            <p className="mt-2 text-sm text-gray-500">Listing last updated {formatDateTime(row.updated_at, row.time_zone)}.</p>
          </section>
        </div>

        <aside className={`${cardCls} h-fit space-y-5 p-6 lg:sticky lg:top-24`}>
          {listing ? (
            <div className="border-b border-gray-200 pb-5">
              <p className="font-display text-4xl font-semibold tabular-nums text-gray-900">
                <span data-testid="headline-total">{formatCents(listing.price.totalCents)}</span> total
              </p>
              <p className="mt-1 text-[0.95rem] text-gray-500">
                {formatCents(row.daily_rate_cents)}/day · {listing.price.billableDays} day{listing.price.billableDays === 1 ? "" : "s"} · taxes and fees included
              </p>
            </div>
          ) : (
            <div className="border-b border-gray-200 pb-5">
              <p className="font-display text-4xl font-semibold tabular-nums text-gray-900">{formatCents(row.daily_rate_cents)}/day</p>
              <p className="mt-1 text-[0.95rem] text-gray-500">Choose dates to see the full total.</p>
            </div>
          )}

          <form action={`/vehicles/${row.id}`} method="get" noValidate className="space-y-3">
            <h2 className="text-xl text-gray-900">Your trip</h2>
            <input type="hidden" name="location" value={locationText} />
            <Field label="Pickup date and time" name="pickup" type="datetime-local" defaultValue={pickup} error={dates && !dates.ok ? dates.fieldErrors.pickup : undefined} />
            <Field label="Return date and time" name="return" type="datetime-local" defaultValue={ret} error={dates && !dates.ok ? dates.fieldErrors.return : undefined} />
            <button type="submit" className={`${btnSecondary} w-full`}>{listing ? "Update dates" : "Check price and availability"}</button>
          </form>

          {listing && dates?.ok && (
            <div className="space-y-3 border-t border-gray-200 pt-5">
              {available ? (
                isPublic ? (
                  <form action={startBookingAction} className="space-y-3">
                    <input type="hidden" name="vehicleId" value={row.id} />
                    <input type="hidden" name="pickup" value={pickup} />
                    <input type="hidden" name="return" value={ret} />
                    <input type="hidden" name="location" value={locationText} />
                    <input type="hidden" name="back" value={self} />
                    <button type="submit" className={`${btnPrimary} w-full py-3 text-base`}>{isRequest ? "Request to book" : "Reserve this vehicle"}</button>
                    <p className="flex items-center gap-2 text-[0.95rem] text-emerald-700" data-testid="availability">
                      <ShieldCheck className="size-4" aria-hidden /> Available for these dates · {CANCELLATION_TEXT[row.cancellation_policy] ?? ""}
                    </p>
                    <p className="text-sm text-gray-500">
                      {isRequest ? "The host approves each booking within 24 hours. Nothing is booked or charged yet." : "Next you review the details. Nothing is booked or charged yet."}
                    </p>
                  </form>
                ) : (
                  <Notice tone="warning">This listing is not public, so it cannot be reserved.</Notice>
                )
              ) : (
                <Notice tone="warning" title="Not available for these dates">
                  <span data-testid="availability">Choose different dates, or go back to the results for other vehicles.</span>
                </Notice>
              )}
              {isPublic && <CompareToggle id={row.id} name={`${row.make} ${row.model}`} pickup={pickup} ret={ret} location={locationText} />}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
