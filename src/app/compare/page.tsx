import type { Metadata } from "next";
import Link from "next/link";
import { startBookingAction } from "@/app/actions/booking";
import { startExternalDemoAction } from "@/app/actions/external-demo";
import { VehicleImage } from "@/components/brand";
import { CompareRemove, CompareSync } from "@/components/compare";
import { EmptySearchArt } from "@/components/illustrations";
import { Badge, Notice, PageShell, btnPrimary, btnSecondary, cardCls } from "@/components/ui";
import { vehicleHref, vehicleName } from "@/components/vehicle-card";
import { getNow } from "@/lib/clock";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { freshExternalListing } from "@/server/booking/external-demo";
import { distanceMiles, resolveLocation } from "@/server/search/location";
import type { VehicleListing } from "@/server/search/types";
import { validateDates, type RawParams } from "@/server/search/validator";
import { availableVehicleIds, getVehicleRows, toListing } from "@/server/vehicles/repository";

export const metadata: Metadata = { title: "Compare vehicles" };

const MAX = 3;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** External listings are compared by "providerKey:providerListingId". */
const EXTERNAL = /^([a-z0-9-]{2,40}):([A-Za-z0-9._~-]{1,150})$/;

type Column = { id: string; listing: VehicleListing; available: boolean; distance: number | null; native: boolean };

export default async function ComparePage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const raw = await searchParams;
  const requested = [...new Set(one(raw.ids).split(",").map((s) => s.trim()).filter((s) => UUID.test(s) || EXTERNAL.test(s)))];
  const tooMany = requested.length > MAX;
  const ids = requested.slice(0, MAX);
  const pickup = one(raw.pickup);
  const ret = one(raw.return);
  const location = one(raw.location);
  const searchHref = pickup && ret && location ? `/search?${new URLSearchParams({ location, pickup, return: ret }).toString()}` : "/#search";

  if (ids.length === 0) {
    return (
      <PageShell title="Compare vehicles" intro="Up to three cars, side by side.">
        <div className={`${cardCls} flex flex-col items-center p-10 text-center`}>
          <EmptySearchArt className="h-28 w-48 text-gray-900" />
          <p className="mt-5 text-gray-600">Tick “Compare” on any search result to add it here.</p>
          <Link href="/#search" className={`${btnPrimary} mt-5`}>Search vehicles</Link>
        </div>
      </PageShell>
    );
  }

  const origin = location ? resolveLocation(location) : null;
  const tz = origin?.timeZone ?? "America/Los_Angeles";
  const dates = validateDates(pickup, ret, tz, getNow());
  if (!dates.ok) {
    return (
      <PageShell title="Compare vehicles">
        <Notice tone="error" title="These comparison dates are not valid">
          {Object.values(dates.fieldErrors).join(" ")} Start a new search to compare vehicles for your trip.
        </Notice>
        <Link href="/#search" className={`${btnPrimary} mt-4`}>Search vehicles</Link>
      </PageShell>
    );
  }

  // Fresh availability and price on every load; nothing here is cached.
  const nativeIds = ids.filter((id) => UUID.test(id));
  const db = await createClient();
  const [rows, availableIds] = nativeIds.length
    ? await Promise.all([getVehicleRows(db, nativeIds), availableVehicleIds(db, dates.pickupAt, dates.returnAt)])
    : [[], [] as string[]];
  const query = origin
    ? { pickupAt: dates.pickupAt, returnAt: dates.returnAt, coordinates: origin.coordinates, radiusMiles: 100, timeZone: origin.timeZone }
    : null;

  const resolved = await Promise.all(
    ids.map(async (id): Promise<Column | null> => {
      if (UUID.test(id)) {
        const row = rows.find((r) => r.id === id);
        if (!row) return null;
        const listing = toListing(row, dates.pickupAt, dates.returnAt);
        return { id, listing, available: availableIds.includes(id), distance: origin ? distanceMiles(origin.coordinates, listing.coordinates) : null, native: true };
      }
      const [, providerKey, listingId] = EXTERNAL.exec(id)!;
      if (!query) return null;
      const listing = await freshExternalListing(providerKey, listingId, query).catch(() => null);
      if (!listing) return null;
      return { id, listing, available: true, distance: distanceMiles(query.coordinates, listing.coordinates), native: false };
    }),
  );
  const columns = resolved.filter((c): c is Column => c !== null);
  const shownIds = columns.map((c) => c.id);
  const self = `/compare?${new URLSearchParams({ ids: shownIds.join(","), pickup, return: ret, location }).toString()}`;
  const trip = { pickup, ret, location };
  const lineCodes = [...new Set(columns.flatMap((c) => c.listing.price.lines.map((l) => l.code)))];
  const flagged = one(raw.problem) === "unavailable" ? one(raw.vehicle) : "";
  const cheapest = Math.min(...columns.filter((c) => c.available).map((c) => c.listing.price.totalCents));

  const attr: [string, (c: Column) => string][] = [
    ["Type", (c) => c.listing.vehicleType],
    ["Seats", (c) => String(c.listing.seats)],
    ["Transmission", (c) => c.listing.transmission],
    ["Match", (c) => (c.listing.exactMatch ? "Exact vehicle" : "Or similar")],
    ["Distance", (c) => (c.distance === null ? "Unknown" : `${c.distance.toFixed(1)} mi`)],
    ["Offered by", (c) => (c.listing.partner ? `${c.listing.partner.displayName}${c.listing.partner.verified ? " (verified)" : ""}` : c.listing.providerName)],
    ["Daily rate", (c) => formatCents(c.listing.dailyRateCents)],
  ];

  return (
    <PageShell
      title="Compare vehicles"
      intro={`${formatDateTime(dates.pickupAt, tz)} to ${formatDateTime(dates.returnAt, tz)}${origin ? ` · near ${origin.label}` : ""}`}
    >
      <CompareSync ids={shownIds} names={Object.fromEntries(columns.map((c) => [c.id, `${c.listing.make} ${c.listing.model}`]))} pickup={pickup} ret={ret} location={location} />
      <div key={self} className="page-enter">
      <div className="space-y-3">
        {tooMany && (
          <Notice tone="warning" title="Only three vehicles can be compared">
            Showing the first three. Remove one to add another.
          </Notice>
        )}
        {columns.length < ids.length && (
          <Notice tone="warning">One or more selected vehicles are no longer listed and were left out.</Notice>
        )}
        {flagged && (
          <Notice tone="error" title="That vehicle is no longer available for these dates">
            Nothing was booked. Its column is marked below; choose another vehicle or change your dates.
          </Notice>
        )}
      </div>

      <div className={`${cardCls} relative mt-4 overflow-x-auto`}>
        <table className="w-full border-collapse text-sm" style={{ minWidth: `${9 + columns.length * 13}rem` }}>
          <caption className="sr-only">Side-by-side comparison of selected vehicles</caption>
          <thead>
            <tr>
              <td className="w-36 p-4" />
              {columns.map((c) => {
                const name = vehicleName(c.listing);
                const href = c.native ? vehicleHref(c.id, trip) : (c.listing.sourceUrl ?? "#");
                return (
                  <th key={c.id} scope="col" className="group border-l hairline bg-white p-4 text-left align-top" data-testid="compare-column" data-code={c.listing.publicCode}>
                    <VehicleImage photoUrl={c.listing.photoUrl} name={name} type={c.listing.vehicleType} color={c.listing.color} className="photo-luxe mb-3 aspect-[3/2] w-full max-w-60 rounded-xl" sizes="15rem" />
                    <Link href={href} className="text-lg font-semibold text-gray-900 underline-offset-4 hover:underline">
                      {name}
                    </Link>
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      {c.listing.price.totalCents === cheapest && columns.length > 1 && <Badge tone="green">Lowest total</Badge>}
                      {c.listing.isMockSource && <Badge tone="amber">Demo</Badge>}
                    </p>
                    <p className={`mt-1.5 text-xs font-medium ${c.available ? "text-emerald-800" : "text-red-700"}`}>
                      {c.available ? "Available for these dates" : "No longer available for these dates"}
                    </p>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {attr.map(([label, get]) => (
              <tr key={label} className="border-t hairline">
                <th scope="row" className="p-4 text-left font-medium text-gray-500">{label}</th>
                {columns.map((c) => (
                  <td key={c.id} className="border-l hairline p-4 text-gray-900">{get(c)}</td>
                ))}
              </tr>
            ))}
            {lineCodes.map((code) => (
              <tr key={code} className="border-t hairline">
                <th scope="row" className="p-4 text-left font-medium text-gray-500">
                  {columns.map((c) => c.listing.price.lines.find((l) => l.code === code)?.label).find(Boolean)}
                </th>
                {columns.map((c) => {
                  const line = c.listing.price.lines.find((l) => l.code === code);
                  return (
                    <td key={c.id} className="border-l hairline p-4 tabular-nums text-gray-900">
                      {line ? formatCents(line.cents) : "Not charged"}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t-2 border-gray-300 bg-accent-soft/60">
              <th scope="row" className="p-4 text-left font-semibold text-gray-900">Trip total</th>
              {columns.map((c) => (
                <td key={c.id} className="border-l hairline p-4 font-display text-xl font-semibold tabular-nums text-gray-900" data-testid="compare-total">
                  {formatCents(c.listing.price.totalCents)}
                </td>
              ))}
            </tr>
            <tr className="border-t hairline">
              <td className="p-4" />
              {columns.map((c) => {
                const name = vehicleName(c.listing);
                return (
                  <td key={c.id} className="space-y-2 border-l hairline p-4 align-top">
                    {!c.available ? (
                      <button type="button" disabled className={`${btnPrimary} w-full`}>Unavailable</button>
                    ) : c.native ? (
                      <form action={startBookingAction}>
                        <input type="hidden" name="vehicleId" value={c.id} />
                        <input type="hidden" name="pickup" value={pickup} />
                        <input type="hidden" name="return" value={ret} />
                        <input type="hidden" name="location" value={location} />
                        <input type="hidden" name="back" value={self} />
                        <button type="submit" className={`${btnPrimary} w-full`}>
                          Continue<span className="sr-only"> with {name}</span>
                        </button>
                      </form>
                    ) : (
                      <form action={startExternalDemoAction}>
                        <input type="hidden" name="providerKey" value={c.listing.providerKey} />
                        <input type="hidden" name="listingId" value={c.listing.providerListingId} />
                        <input type="hidden" name="location" value={location} />
                        <input type="hidden" name="pickup" value={pickup} />
                        <input type="hidden" name="return" value={ret} />
                        <button type="submit" className={`${btnPrimary} w-full whitespace-nowrap`}>
                          Demo checkout<span className="sr-only"> for {name}</span>
                        </button>
                      </form>
                    )}
                    <CompareRemove id={c.id} name={name} ids={shownIds} pickup={pickup} ret={ret} location={location} />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-500">All mandatory fees included. Prices re-checked on every load.</p>
      {columns.length < MAX && (
        <Link href={searchHref} className={`${btnSecondary} mt-5`}>Add another vehicle</Link>
      )}
      </div>
    </PageShell>
  );
}
