import type { Metadata } from "next";
import Link from "next/link";
import { FiltersPanel } from "@/components/filters-panel";
import { SearchForm } from "@/components/search-form";
import { Notice, btnSecondary, cardCls } from "@/components/ui";
import { VehicleCard } from "@/components/vehicle-card";
import { getNow } from "@/lib/clock";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { enabledAdapters, runSearch } from "@/server/search/service";
import { SORT_LABELS, SORT_OPTIONS } from "@/server/search/types";
import { validateSearch, type RawParams } from "@/server/search/validator";

export const metadata: Metadata = { title: "Search results" };

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
        <h1 className="text-2xl font-bold text-slate-900">Search vehicles</h1>
        <div className="mt-4">
          <Notice tone="error" title="Check your search">Fix the highlighted fields to see vehicles.</Notice>
        </div>
        <div className={`${cardCls} mt-4 p-5`}>
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

  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (key === "page" || value === undefined) continue;
      for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
    }
    params.set("page", String(page));
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

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Vehicles near {criteria.locationLabel}</h1>
      <p className="mt-1 text-sm text-slate-700">
        {formatDateTime(criteria.pickupAt, criteria.timeZone)} to {formatDateTime(criteria.returnAt, criteria.timeZone)}
      </p>
      <details className={`${cardCls} mt-4 p-4`}>
        <summary className="cursor-pointer text-sm font-semibold text-blue-800">Change location or dates</summary>
        <div className="mt-4">
          <SearchForm defaults={{ location: criteria.locationLabel, pickup: criteria.pickupLocal, return: criteria.returnLocal }} submitLabel="Update search" />
        </div>
      </details>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className={`${cardCls} h-fit p-4`}>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Filters</h2>
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
            sortOptions={SORT_OPTIONS.map((value) => ({ value, label: SORT_LABELS[value] }))}
          />
        </aside>

        <section aria-labelledby="results-heading" className="min-w-0 space-y-4">
          <div>
            <h2 id="results-heading" className="text-lg font-semibold text-slate-900" data-testid="result-count">
              {result.resultCount} vehicle{result.resultCount === 1 ? "" : "s"} available
            </h2>
            <p className="text-sm text-slate-600">
              {applied.join(" · ")} · Sorted by {SORT_LABELS[criteria.sort].toLowerCase()} · Checked{" "}
              {formatDateTime(result.searchedAt, criteria.timeZone)} in {result.durationMs} ms
            </p>
          </div>

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
            <div className={`${cardCls} p-6`} data-testid="empty-results">
              <h3 className="text-base font-semibold text-slate-900">No vehicles match this search</h3>
              <p className="mt-1 text-sm text-slate-700">
                Try different dates, a wider radius, or fewer filters. Vehicles already reserved for these dates are not shown.
              </p>
            </div>
          )}

          <ul className="space-y-3">
            {result.listings.map((listing) => (
              <VehicleCard key={listing.id} listing={listing} trip={trip} />
            ))}
          </ul>

          {result.pageCount > 1 && (
            <nav aria-label="Result pages" className="flex items-center justify-between">
              {result.page > 1 ? <Link className={btnSecondary} href={pageHref(result.page - 1)}>Previous</Link> : <span />}
              <span className="text-sm text-slate-700">Page {result.page} of {result.pageCount}</span>
              {result.page < result.pageCount ? <Link className={btnSecondary} href={pageHref(result.page + 1)}>Next</Link> : <span />}
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
