import { distanceMiles } from "@/server/search/location";
import type { SearchCriteria, SortOption, VehicleListing } from "@/server/search/types";

// VehicleFilter: applies distance and attribute filters, then sorts.
// Radius rule (proposed, D-008): inclusive, straight-line miles.

/** Tolerance so a vehicle exactly on the radius boundary is included despite float rounding. */
const RADIUS_EPSILON_MILES = 1e-6;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function applyFilters(
  listings: VehicleListing[],
  criteria: Pick<
    SearchCriteria,
    | "coordinates"
    | "radiusMiles"
    | "make"
    | "model"
    | "year"
    | "vehicleTypes"
    | "minPassengers"
    | "maxDailyCents"
    | "maxTotalCents"
  >,
): VehicleListing[] {
  return listings
    .map((l) => ({ ...l, distanceMiles: distanceMiles(criteria.coordinates, l.coordinates) }))
    .filter((l) => {
      if ((l.distanceMiles ?? Infinity) > criteria.radiusMiles + RADIUS_EPSILON_MILES) return false;
      if (criteria.make && !same(l.make, criteria.make)) return false;
      if (criteria.model && !same(l.model, criteria.model)) return false;
      if (criteria.year && l.year !== criteria.year) return false;
      if (criteria.vehicleTypes.length > 0 && !criteria.vehicleTypes.includes(l.vehicleType)) return false;
      if (l.seats < criteria.minPassengers) return false;
      // Daily budget and trip-total budget are separate filters.
      if (criteria.maxDailyCents !== undefined && l.dailyRateCents > criteria.maxDailyCents) return false;
      if (criteria.maxTotalCents !== undefined && l.price.totalCents > criteria.maxTotalCents) return false;
      return true;
    });
}

export function sortListings(listings: VehicleListing[], sort: SortOption): VehicleListing[] {
  const by: Record<SortOption, (l: VehicleListing) => number> = {
    total_asc: (l) => l.price.totalCents,
    daily_asc: (l) => l.dailyRateCents,
    distance_asc: (l) => l.distanceMiles ?? Infinity,
  };
  const key = by[sort];
  // Stable tie-break on id keeps ordering deterministic across requests.
  return [...listings].sort((a, b) => key(a) - key(b) || a.id.localeCompare(b.id));
}
