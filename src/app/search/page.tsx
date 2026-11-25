import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { CompareHint, CompareTray } from "@/components/compare";
import { FilterSidebar } from "@/components/filter-sidebar";
import { FiltersPanel } from "@/components/filters-panel";
import { EmptySearchArt } from "@/components/illustrations";
import { SearchForm } from "@/components/search-form";
import { Notice, btnSecondary, cardCls, eyebrowCls } from "@/components/ui";
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <p className={eyebrowCls}>Search</p>
        <h1 className="mt-4 text-5xl text-gray-900">Search vehicles</h1>
        <div className="mt-8">
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
  const trip = { pickup: criteria.pickupLocal, ret: criteria.returnLocal, location: criteria.locationLabel, radius: criteria.radiusMiles };

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
  const activeCount =
    criteria.vehicleTypes.length +
    [criteria.maxDailyCents, criteria.maxTotalCents, criteria.make, criteria.model, criteria.year].filter((v) => v !== undefined && v !== "").length +
    (criteria.minPassengers > 1 ? 1 : 0) +
    (criteria.radiusMiles !== 25 ? 1 : 0);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="sr-only">Vehicles near {criteria.locationLabel}</h1>
      <SearchForm defaults={{ location: criteria.locationLabel, pickup: criteria.pickupLocal, return: criteria.returnLocal }} />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[0.92rem]">
        <p className="flex items-center gap-2 text-gray-900">
          <MapPin className="size-4 shrink-0 text-gray-500" aria-hidden />
          <span>
            {criteria.locationLabel} · {formatDateTime(criteria.pickupAt, criteria.timeZone)} to {formatDateTime(criteria.returnAt, criteria.timeZone)}
            {days ? ` · ${days} day${days === 1 ? "" : "s"}` : ""}
          </span>
        </p>

      </div>

      <div className="mt-8 flex flex-col gap-6 lg:grid lg:grid-cols-[auto_1fr] lg:gap-8">
        <FilterSidebar activeCount={activeCount}>
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
        </FilterSidebar>

        <section key={JSON.stringify(raw)} aria-labelledby="results-heading" className="page-enter min-w-0 space-y-4">
          <div>
            <h2 id="results-heading" className="text-4xl text-gray-900 sm:text-5xl" data-testid="result-count">
              {result.resultCount} vehicle{result.resultCount === 1 ? "" : "s"} found
            </h2>
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Applied filters">
              {applied.map((a) => (
                <li key={a} className="rounded-full bg-accent-soft px-3 py-1 text-[0.8rem] text-accent">{a}</li>
              ))}
            </ul>
          </div>

          <nav aria-label="Sort results" className="flex flex-wrap items-center gap-2.5">
            <span className="text-sm text-gray-500">Sort</span>
            {SORT_OPTIONS.map((option) => {
              const active = criteria.sort === option;
              return (
                <Link
                  key={option}
                  href={hrefWith({ sort: option })}
                  aria-current={active ? "true" : undefined}
                  className={`rounded-full border px-4 py-1.5 text-[0.88rem] focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    active ? "border-accent bg-accent font-medium text-accent-contrast" : "border-gray-300 text-gray-700 hover:border-gray-900 hover:text-gray-900"
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
          {one(raw.external) === "unavailable" && (
            <Notice tone="warning">That provider offer could not be checked right now. No demo checkout was started.</Notice>
          )}

          {!result.allSourcesFailed && result.resultCount === 0 && (
            <div className={`${cardCls} flex flex-col items-center p-10 text-center`} data-testid="empty-results">
              <EmptySearchArt className="h-32 w-56 text-gray-900" />
              <h3 className="mt-6 text-2xl text-gray-900">No vehicles match your filters</h3>
              <p className="mt-2 max-w-md text-gray-600">
                Try different dates, a wider radius, or fewer filters. Vehicles already reserved for these dates are not shown.
              </p>
            </div>
          )}

          {result.resultCount > 0 && <CompareHint />}
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
