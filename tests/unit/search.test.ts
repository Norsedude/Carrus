import { describe, expect, it } from "vitest";
import { zonedLocalToUtc } from "@/lib/time";
import { calculatePrice, type PricingPolicy } from "@/server/pricing/pricing";
import { applyFilters, sortListings } from "@/server/search/filter";
import { fetchListings, type ProviderAdapter } from "@/server/search/gateway";
import { distanceMiles, offsetByMiles, resolveLocation } from "@/server/search/location";
import { runSearch } from "@/server/search/service";
import type { VehicleListing, VehicleType } from "@/server/search/types";
import { SEATS_ERROR, validateSearch } from "@/server/search/validator";

const TZ = "America/Los_Angeles";
const NOW = new Date("2026-11-14T20:00:00Z");
const SAN_JOSE = { lat: 37.3382, lng: -121.8863 };
const pickupAt = zonedLocalToUtc("2027-01-15T10:00", TZ)!;
const returnAt = zonedLocalToUtc("2027-01-19T10:00", TZ)!;
const policy: PricingPolicy = {
  id: "p2", key: "protection-tax", version: 1,
  formula: { flatFees: [], protectionCents: 5200, taxRateBps: 1000 },
};

function listing(name: string, type: VehicleType, seats: number, daily: number, miles: number): VehicleListing {
  const [year, make, ...model] = name.split(" ");
  return {
    id: `carrus:${name}`, providerKey: "carrus", providerName: "Carrus Rental Partners", providerListingId: name,
    isMockSource: false, bookingCapability: "native_booking", exactMatch: true, publicCode: name,
    make, model: model.join(" "), year: Number(year), color: "", vehicleType: type, seats, transmission: "Automatic",
    description: "", locationLabel: "San Jose, CA", coordinates: offsetByMiles(SAN_JOSE, miles, 45), timeZone: TZ,
    distanceMiles: null, dailyRateCents: daily * 100, pricingPolicyId: "p2", partner: null, bookingMode: "instant",
    cancellationPolicy: "free_24h",
    price: calculatePrice({ dailyRateCents: daily * 100, pickupAt, returnAt, policy }),
    lastUpdated: NOW.toISOString(),
  };
}

// Sanjay fixture inventory (handoff section 12).
const SANJAY = [
  listing("2019 Honda Civic", "Sedan", 5, 41, 2.0),
  listing("2022 Chevrolet Equinox", "SUV", 5, 63, 4.4),
  listing("2024 Toyota RAV4", "SUV", 5, 68, 3.2),
  listing("2023 Honda CR-V", "SUV", 5, 72, 5.8),
  listing("2024 Toyota Sienna", "Minivan", 8, 81, 8.1),
  listing("2021 Ford F-150", "Truck", 5, 95, 12.0),
  listing("2023 Ford Transit", "Van", 15, 120, 9.5),
];

const base = { location: "San Jose, CA", pickup: "2027-01-15T10:00", return: "2027-01-19T10:00" };
function search(extra: Record<string, string | string[]> = {}) {
  const v = validateSearch({ ...base, sort: "daily_asc", ...extra }, NOW);
  if (!v.ok) throw new Error(JSON.stringify(v.fieldErrors));
  return sortListings(applyFilters(SANJAY, v.criteria), v.criteria.sort).map((l) => l.model);
}

describe("SearchValidator", () => {
  it("TC-S03: empty location is blocked", () => {
    const v = validateSearch({ ...base, location: "" }, NOW);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.fieldErrors.location).toBe("Enter a pickup location");
  });
  it("TC-S04: return before pickup is blocked", () => {
    const v = validateSearch({ ...base, return: "2027-01-14T10:00" }, NOW);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.fieldErrors.return).toBe("Return must be after pickup");
  });
  it("TC-PT03a: a 30-day rental is accepted", () => {
    expect(validateSearch({ ...base, return: "2027-02-14T10:00" }, NOW).ok).toBe(true);
  });
  it("TC-PT03b: a 31-day rental is rejected", () => {
    const v = validateSearch({ ...base, return: "2027-02-15T10:00" }, NOW);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.fieldErrors.return).toMatch(/at most 30 days/);
  });
  it.each(["0", "16", "2.5", "abc"])("TC-FR04: seats %s is rejected with the standard message", (seats) => {
    const v = validateSearch({ ...base, seats }, NOW);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.fieldErrors.seats).toBe(SEATS_ERROR);
  });
  it("rejects a pickup in the past and unknown locations", () => {
    const past = validateSearch({ ...base, pickup: "2026-01-01T10:00", return: "2026-01-03T10:00" }, NOW);
    expect(past.ok).toBe(false);
    const unknown = validateSearch({ ...base, location: "Atlantis" }, NOW);
    expect(unknown.ok).toBe(false);
  });
  it("defaults radius to 25 miles and treats the $300 top of range as no daily limit", () => {
    const v = validateSearch({ ...base, maxDaily: "300" }, NOW);
    expect(v.ok && v.criteria.radiusMiles).toBe(25);
    expect(v.ok && v.criteria.maxDailyCents).toBeUndefined();
  });
  it("resolves SJC and San Jose to different places", () => {
    expect(resolveLocation("SJC")?.id).toBe("sjc");
    expect(resolveLocation("san jose, ca")?.id).toBe("san-jose");
    expect(resolveLocation("")).toBeNull();
  });
});

describe("VehicleFilter: Sanjay cases", () => {
  it("TC-FR02: no filters returns all seven, ascending daily rate", () => {
    expect(search()).toEqual(["Civic", "Equinox", "RAV4", "CR-V", "Sienna", "F-150", "Transit"]);
  });
  it("TC-FR01: SUV returns Equinox, RAV4, CR-V", () => {
    expect(search({ type: ["SUV"] })).toEqual(["Equinox", "RAV4", "CR-V"]);
  });
  it("TC-FR03: max $100/day and seven seats returns Sienna", () => {
    expect(search({ maxDaily: "100", seats: "7" })).toEqual(["Sienna"]);
  });
  it("TC-FR04: 15 seats and max $100/day returns nothing", () => {
    expect(search({ maxDaily: "100", seats: "15" })).toEqual([]);
  });
  it("keeps daily budget and trip-total budget distinct", () => {
    // $240 trip budget keeps only the Civic ($237.60 total, $41/day).
    expect(search({ maxTotal: "240" })).toEqual(["Civic"]);
    // $240 is not a valid daily limit step target here; $40/day excludes everything.
    expect(search({ maxDaily: "40" })).toEqual([]);
  });
  it("radius is inclusive straight-line miles", () => {
    expect(search({ radius: "5" })).toEqual(["Civic", "Equinox", "RAV4"]);
    const twelve = SANJAY.find((l) => l.model === "F-150")!;
    expect(distanceMiles(SAN_JOSE, twelve.coordinates)).toBeCloseTo(12.0, 3);
    expect(search({ radius: "12" })).toContain("F-150");
    expect(search({ radius: "11" })).not.toContain("F-150");
  });
  it("filters by make, model and year case-insensitively", () => {
    expect(search({ make: "toyota" })).toEqual(["RAV4", "Sienna"]);
    expect(search({ make: "honda", model: "cr-v", year: "2023" })).toEqual(["CR-V"]);
  });
});

describe("RentalProviderGateway", () => {
  const query = { pickupAt, returnAt, coordinates: SAN_JOSE, radiusMiles: 25 };
  const ok: ProviderAdapter = { key: "carrus", name: "Carrus", isMock: false, capability: "native_booking", search: async () => SANJAY };
  const broken: ProviderAdapter = { key: "demo-external", name: "Demo rental source", isMock: true, capability: "redirect", search: async () => { throw new Error("boom"); } };
  const slow: ProviderAdapter = { ...broken, key: "slow", name: "Slow source", search: () => new Promise(() => {}) };

  it("keeps successful results when another source fails", async () => {
    const r = await fetchListings([ok, broken], query);
    expect(r.listings).toHaveLength(7);
    expect(r.unavailableSources).toEqual([{ providerKey: "demo-external", providerName: "Demo rental source", reason: "unavailable" }]);
    expect(r.allSourcesFailed).toBe(false);
  });
  it("reports all-failed separately from zero matches", async () => {
    const failed = await fetchListings([broken], query);
    expect(failed.allSourcesFailed).toBe(true);
    const empty = await fetchListings([{ ...ok, search: async () => [] }], query);
    expect(empty.allSourcesFailed).toBe(false);
    expect(empty.listings).toEqual([]);
  });
  it("bounds a hanging source with a timeout", async () => {
    const r = await fetchListings([ok, slow], query, 50);
    expect(r.listings).toHaveLength(7);
    expect(r.unavailableSources[0].reason).toBe("timed out");
  });
  it("does not merge listings from different providers with the same local id", async () => {
    const other: ProviderAdapter = { ...ok, key: "other", search: async () => SANJAY.map((l) => ({ ...l, id: `other:${l.providerListingId}` })) };
    const r = await fetchListings([ok, other], query);
    expect(r.listings).toHaveLength(14);
  });
  it("runSearch paginates and counts all matches", async () => {
    const v = validateSearch({ ...base, type: ["SUV"] }, NOW);
    if (!v.ok) throw new Error("invalid");
    const res = await runSearch(v.criteria, [ok, broken]);
    expect(res.resultCount).toBe(3);
    expect(res.listings.map((l) => l.price.totalCents)).toEqual([33440, 35640, 37400]);
    expect(res.unavailableSources).toHaveLength(1);
  });
});
