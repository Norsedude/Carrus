import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, RefreshCw, SlidersHorizontal } from "lucide-react";
import { CompareTray } from "@/components/compare";
import { FiltersPanel } from "@/components/filters-panel";
import { SearchForm } from "@/components/search-form";
import { Notice, btnSecondary, cardCls } from "@/components/ui";
import { VehicleCard } from "@/components/vehicle-card";
import { getNow } from "@/lib/clock";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { enabledAdapters, runSearch } from "@/server/search/service";
import { SORT_OPTIONS, type SortOption } from "@/server/search/types";
import { validateSearch, type RawParams } from "@/server/search/validator";

export const metadata: Metadata = { title: "Search results" };

const SORT_CHIPS: Record<SortOption, string> = { total_asc: "Lowest total", daily_asc: "Lowest daily rate", distance_asc: "Closest" };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const raw = await searchParams;
  const validation = validateSearch(raw, getNow());
  const entered = { location: one(raw.location), pickup: one(raw.pickup), return: one(raw.return) };
  const filterErrors = validation.ok ? {} : validation.fieldErrors;
  const coreInvalid = !validation.ok && (filterErrors.location || filterErrors.pickup || filterErrors.return);

  if (!validation.ok && coreInvalid) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900">Search vehicles</h1>
        <div className="mt-5">
          <SearchForm defaults={entered} errors={filterErrors} />
        </div>
      </main>
    );
  }

  // Filter-only errors: fall back to the valid core search so results stay visible.
  const effective = validation.ok
    ? validation
    : validateSearch({ location: raw.location, pickup: raw.pickup, return: raw.return }, getNow());
  if (!effective.ok) return null;
  const criteria = effective.criteria;

  const db = await createClient();
  const result = await runSearch(criteria, enabledAdapters(db, serverEnv().PROVIDER_MODE));
  const trip = { pickup: criteria.pickupLocal, ret: criteria.returnLocal, location: criteria.locationLabel };

  const hrefWith = (changes: Record<string, string>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (key in changes || key === "page" || value === undefined) continue;
      for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
    }
    for (const [key, value] of Object.entries(changes)) params.set(key, value);
    return `/search?${params.toString()}`;
  };

  const applied: string[] = [];
  if (criteria.vehicleTypes.length) applied.push(criteria.vehicleTypes.join(", "));
  if (criteria.maxDailyCents !== undefined) applied.push(`Up to $${criteria.maxDailyCents / 100}/day`);
  if (criteria.minPassengers > 1) applied.push(`${criteria.minPassengers}+ seats`);
  if (criteria.maxTotalCents !== undefined) applied.push(`Trip total up to $${criteria.maxTotalCents / 100}`);
  if (criteria.make) applied.push(`Make: ${criteria.make}`);
  if (criteria.model) applied.push(`Model: ${criteria.model}`);
  if (criteria.year) applied.push(`Year: ${criteria.year}`);
  applied.push(`Within ${criteria.radiusMiles} miles`);
  const days = result.listings[0]?.price.billableDays;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="sr-only">Vehicles near {criteria.locationLabel}</h1>
      <SearchForm defaults={{ location: criteria.locationLabel, pickup: criteria.pickupLocal, return: criteria.returnLocal }} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[0.95rem]">
        <p className="flex items-center gap-2 text-gray-900">
          <MapPin className="size-4 shrink-0 text-gray-500" aria-hidden />
          <span>
            {criteria.locationLabel} · {formatDateTime(criteria.pickupAt, criteria.timeZone)} to {formatDateTime(criteria.returnAt, criteria.timeZone)}
            {days ? ` · ${days} day${days === 1 ? "" : "s"}` : ""}
          </span>
        </p>
        <p className="flex items-center gap-2 italic text-gray-500">
          <RefreshCw className="size-3.5" aria-hidden />
          Checked {formatDateTime(result.searchedAt, criteria.timeZone)} in {result.durationMs} ms
        </p>
      </div>

      <div className="mt-6 grid gap-7 lg:grid-cols-[17rem_1fr]">
        <aside className={`${cardCls} h-fit p-5`}>
          <h2 className="mb-4 flex items-center gap-2 border-b border-gray-200 pb-4 text-xl font-bold text-gray-900">
            <SlidersHorizontal className="size-5" aria-hidden /> Filters
          </h2>
          <FiltersPanel
            key={JSON.stringify(raw)}
            base={{ location: criteria.locationLabel, pickup: criteria.pickupLocal, ret: criteria.returnLocal }}
            values={{
              types: criteria.vehicleTypes,
              maxDaily: criteria.maxDailyCents !== undefined ? criteria.maxDailyCents / 100 : 300,
              seats: criteria.minPassengers,
              radius: criteria.radiusMiles,
              make: criteria.make ?? "",
              model: criteria.model ?? "",
              year: criteria.year ? String(criteria.year) : "",
              maxTotal: criteria.maxTotalCents !== undefined ? String(criteria.maxTotalCents / 100) : "",
              sort: criteria.sort,
            }}
            errors={filterErrors}
          />
        </aside>

        <section aria-labelledby="results-heading" className="min-w-0 space-y-4">
          <div>
            <h2 id="results-heading" className="text-3xl font-bold text-gray-900" data-testid="result-count">
              {result.resultCount} vehicle{result.resultCount === 1 ? "" : "s"} found
            </h2>
            <p className="mt-1 text-[0.95rem] text-gray-500">{applied.join(" · ")}</p>
          </div>

          <nav aria-label="Sort results" className="flex flex-wrap items-center gap-2.5">
            <span className="text-[0.95rem] text-gray-500">Sort by</span>
            {SORT_OPTIONS.map((option) => {
              const active = criteria.sort === option;
              return (
                <Link
                  key={option}
                  href={hrefWith({ sort: option })}
                  aria-current={active ? "true" : undefined}
                  className={`rounded-lg border px-4 py-2 text-[0.95rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    active ? "border-brand bg-brand font-bold text-white" : "border-gray-200 bg-white text-gray-900 hover:border-brand"
                  }`}
                >
                  {SORT_CHIPS[option]}
                </Link>
              );
            })}
          </nav>

          {!validation.ok && (
            <Notice tone="warning" title="Some filters were not applied">
              {Object.values(filterErrors).join(" ")}
            </Notice>
          )}
          {result.allSourcesFailed && (
            <Notice tone="error" title="We couldn't reach any rental source">
              This is a problem on our side, not an empty result. Please try the search again in a moment.
            </Notice>
          )}
          {!result.allSourcesFailed && result.unavailableSources.length > 0 && (
            <Notice tone="warning" title="Some sources did not respond">
              Results below are complete for the sources that answered. Not included:{" "}
              {result.unavailableSources.map((s) => s.providerName).join(", ")}.
            </Notice>
          )}
          {result.warnings.map((w) => (
            <Notice key={w} tone="info">{w}</Notice>
          ))}

          {!result.allSourcesFailed && result.resultCount === 0 && (
            <div className={`${cardCls} p-8`} data-testid="empty-results">
              <h3 className="text-xl font-bold text-gray-900">No vehicles match your filters</h3>
              <p className="mt-1 text-gray-600">
                Try different dates, a wider radius, or fewer filters. Vehicles already reserved for these dates are not shown.
              </p>
            </div>
          )}

          <ul className="space-y-4">
            {result.listings.map((listing) => (
              <VehicleCard key={listing.id} listing={listing} trip={trip} />
            ))}
          </ul>

          {result.pageCount > 1 && (
            <nav aria-label="Result pages" className="flex items-center justify-between">
              {result.page > 1 ? <Link className={btnSecondary} href={hrefWith({ page: String(result.page - 1) })}>Previous</Link> : <span />}
              <span className="text-[0.95rem] text-gray-600">Page {result.page} of {result.pageCount}</span>
              {result.page < result.pageCount ? <Link className={btnSecondary} href={hrefWith({ page: String(result.page + 1) })}>Next</Link> : <span />}
            </nav>
          )}

          <CompareTray />
        </section>
      </div>
    </main>
  );
}
