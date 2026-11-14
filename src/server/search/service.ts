import { randomUUID } from "node:crypto";
import { applyFilters, sortListings } from "@/server/search/filter";
import { fetchListings, type ProviderAdapter } from "@/server/search/gateway";
import { demoExternalAdapter } from "@/server/search/providers/demo-external";
import { PAGE_SIZE, type SearchCriteria, type SearchResponse } from "@/server/search/types";
import { availableVehicleIds, getVehicleRows, toListing, type Db } from "@/server/vehicles/repository";

/** Native Carrus inventory: database-backed, bookable on Carrus. */
export function nativeAdapter(db: Db): ProviderAdapter {
  return {
    key: "carrus",
    name: "Carrus Rental Partners",
    isMock: false,
    capability: "native_booking",
    async search(query) {
      const ids = await availableVehicleIds(db, query.pickupAt, query.returnAt);
      const rows = await getVehicleRows(db, ids);
      return rows.map((row) => toListing(row, query.pickupAt, query.returnAt));
    },
  };
}

export function enabledAdapters(db: Db, providerMode: "native" | "native+demo"): ProviderAdapter[] {
  const adapters = [nativeAdapter(db)];
  if (providerMode === "native+demo") adapters.push(demoExternalAdapter);
  return adapters;
}

/** VehicleSearchController: gateway -> normalize -> filter -> sort -> paginate. */
export async function runSearch(criteria: SearchCriteria, adapters: ProviderAdapter[]): Promise<SearchResponse> {
  const started = Date.now();
  const gateway = await fetchListings(adapters, {
    pickupAt: criteria.pickupAt,
    returnAt: criteria.returnAt,
    coordinates: criteria.coordinates,
    radiusMiles: criteria.radiusMiles,
  });
  const matches = sortListings(applyFilters(gateway.listings, criteria), criteria.sort);
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = Math.min(criteria.page, pageCount);
  const warnings: string[] = [];
  if (matches.some((l) => !l.price.complete)) {
    warnings.push("Some totals are estimates because the source does not publish every mandatory fee.");
  }
  return {
    searchId: randomUUID(),
    listings: matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    resultCount: matches.length,
    page,
    pageCount,
    searchedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    unavailableSources: gateway.unavailableSources,
    allSourcesFailed: gateway.allSourcesFailed,
    warnings,
  };
}
