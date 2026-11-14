import type { Metadata } from "next";
import Link from "next/link";
import { startBookingAction } from "@/app/actions/booking";
import { VehicleArt } from "@/components/brand";
import { CompareRemove, CompareSync } from "@/components/compare";
import { Notice, PageShell, btnPrimary, btnSecondary, cardCls } from "@/components/ui";
import { vehicleHref, vehicleName } from "@/components/vehicle-card";
import { getNow } from "@/lib/clock";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { distanceMiles, resolveLocation } from "@/server/search/location";
import { validateDates, type RawParams } from "@/server/search/validator";
import { availableVehicleIds, getVehicleRows, toListing } from "@/server/vehicles/repository";

export const metadata: Metadata = { title: "Compare vehicles" };

const MAX = 3;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ComparePage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const raw = await searchParams;
  const requested = [...new Set(one(raw.ids).split(",").map((s) => s.trim()).filter((s) => UUID.test(s)))];
  const tooMany = requested.length > MAX;
  const ids = requested.slice(0, MAX);
  const pickup = one(raw.pickup);
  const ret = one(raw.return);
  const location = one(raw.location);
  const searchHref = pickup && ret && location ? `/search?${new URLSearchParams({ location, pickup, return: ret }).toString()}` : "/#search";

  if (ids.length === 0) {
    return (
      <PageShell title="Compare vehicles" intro="Put up to three vehicles side by side for the same rental dates.">
        <div className={`${cardCls} p-6`}>
          <p className="text-sm text-slate-700">
            You have not added any vehicles yet. Run a search, then choose “Add to compare” on up to three results.
          </p>
          <Link href="/#search" className={`${btnPrimary} mt-4`}>Search vehicles</Link>
        </div>
      </PageShell>
    );
  }

  const db = await createClient();
  const rows = await getVehicleRows(db, ids);
  const ordered = ids.map((id) => rows.find((r) => r.id === id)).filter((r) => r !== undefined);
  const tz = ordered[0]?.time_zone ?? "America/Los_Angeles";
  const dates = validateDates(pickup, ret, tz, getNow());
  const origin = location ? resolveLocation(location) : null;

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
  const availableIds = await availableVehicleIds(db, dates.pickupAt, dates.returnAt);
  const columns = ordered.map((row) => ({
    row,
    listing: toListing(row, dates.pickupAt, dates.returnAt),
    available: availableIds.includes(row.id),
    distance: origin ? distanceMiles(origin.coordinates, { lat: row.latitude, lng: row.longitude }) : null,
  }));
  const shownIds = columns.map((c) => c.row.id);
  const self = `/compare?${new URLSearchParams({ ids: shownIds.join(","), pickup, return: ret, location }).toString()}`;
  const trip = { pickup, ret, location };
  const lineCodes = [...new Set(columns.flatMap((c) => c.listing.price.lines.map((l) => l.code)))];
  const flagged = one(raw.problem) === "unavailable" ? one(raw.vehicle) : "";

  const attr: [string, (c: (typeof columns)[number]) => string][] = [
    ["Type", (c) => c.row.vehicle_type],
    ["Seats", (c) => String(c.row.seats)],
    ["Transmission", (c) => c.row.transmission],
    ["Color", (c) => c.row.color || "Not specified"],
    ["Distance", (c) => (c.distance === null ? "Unknown" : `${c.distance.toFixed(1)} mi`)],
    ["Partner", (c) => `${c.row.partner.display_name}${c.row.partner.verification_status === "verified" ? " (verified)" : ""}`],
    ["Daily rate", (c) => formatCents(c.row.daily_rate_cents)],
  ];

  return (
    <PageShell
      title="Compare vehicles"
      intro={`${formatDateTime(dates.pickupAt, tz)} to ${formatDateTime(dates.returnAt, tz)}${origin ? ` · near ${origin.label}` : ""}`}
    >
      <CompareSync ids={shownIds} pickup={pickup} ret={ret} location={location} />
      <div className="space-y-3">
        {tooMany && (
          <Notice tone="warning" title="Only three vehicles can be compared">
            Showing the first three. Remove one to add another.
          </Notice>
        )}
        {ordered.length < ids.length && (
          <Notice tone="warning">One or more selected vehicles are no longer listed and were left out.</Notice>
        )}
        {flagged && (
          <Notice tone="error" title="That vehicle is no longer available for these dates">
            Nothing was booked. Its column is marked below; choose another vehicle or change your dates.
          </Notice>
        )}
      </div>

      <div className={`${cardCls} relative mt-4 overflow-x-auto`}>
        <table className="w-full border-collapse text-sm" style={{ minWidth: `${9 + columns.length * 11}rem` }}>
          <caption className="sr-only">Side-by-side comparison of selected vehicles</caption>
          <thead>
            <tr>
              <td className="w-36 p-3" />
              {columns.map((c) => (
                <th key={c.row.id} scope="col" className="sticky top-0 border-l border-slate-200 bg-white p-3 text-left align-top" data-testid="compare-column" data-code={c.row.public_code}>
                  <VehicleArt type={c.row.vehicle_type} color={c.row.color} className="mb-2 h-auto w-full max-w-40" />
                  <Link href={vehicleHref(c.row.id, trip)} className="text-base font-semibold text-slate-900 underline-offset-2 hover:underline">
                    {vehicleName(c.row)}
                  </Link>
                  <p className={`mt-1 text-xs font-semibold ${c.available ? "text-emerald-800" : "text-red-700"}`}>
                    {c.available ? "Available for these dates" : "No longer available for these dates"}
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attr.map(([label, get]) => (
              <tr key={label} className="border-t border-slate-200">
                <th scope="row" className="p-3 text-left font-medium text-slate-600">{label}</th>
                {columns.map((c) => (
                  <td key={c.row.id} className="border-l border-slate-200 p-3 text-slate-900">{get(c)}</td>
                ))}
              </tr>
            ))}
            {lineCodes.map((code) => (
              <tr key={code} className="border-t border-slate-200">
                <th scope="row" className="p-3 text-left font-medium text-slate-600">
                  {columns.map((c) => c.listing.price.lines.find((l) => l.code === code)?.label).find(Boolean)}
                </th>
                {columns.map((c) => {
                  const line = c.listing.price.lines.find((l) => l.code === code);
                  return (
                    <td key={c.row.id} className="border-l border-slate-200 p-3 tabular-nums text-slate-900">
                      {line ? formatCents(line.cents) : "Not charged"}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 bg-slate-50">
              <th scope="row" className="p-3 text-left font-semibold text-slate-900">Trip total</th>
              {columns.map((c) => (
                <td key={c.row.id} className="border-l border-slate-200 p-3 text-lg font-bold tabular-nums text-slate-900" data-testid="compare-total">
                  {formatCents(c.listing.price.totalCents)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-200">
              <td className="p-3" />
              {columns.map((c) => (
                <td key={c.row.id} className="space-y-2 border-l border-slate-200 p-3 align-top">
                  {c.available ? (
                    <form action={startBookingAction}>
                      <input type="hidden" name="vehicleId" value={c.row.id} />
                      <input type="hidden" name="pickup" value={pickup} />
                      <input type="hidden" name="return" value={ret} />
                      <input type="hidden" name="location" value={location} />
                      <input type="hidden" name="back" value={self} />
                      <button type="submit" className={`${btnPrimary} w-full`}>
                        Continue<span className="sr-only"> with {vehicleName(c.row)}</span>
                      </button>
                    </form>
                  ) : (
                    <button type="button" disabled className={`${btnPrimary} w-full`}>Unavailable</button>
                  )}
                  <CompareRemove id={c.row.id} name={vehicleName(c.row)} ids={shownIds} pickup={pickup} ret={ret} location={location} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-600">
        Totals include every mandatory fee. Cleaning, fuel and damage charges apply only if something happens at return; see
        each vehicle’s page. Prices and availability are re-checked each time this page loads.
      </p>
      {columns.length < MAX && (
        <Link href={searchHref} className={`${btnSecondary} mt-4`}>Add another vehicle from search</Link>
      )}
    </PageShell>
  );
}
