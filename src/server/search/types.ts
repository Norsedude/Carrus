import type { PriceBreakdown } from "@/server/pricing/pricing";
import type { Coordinates } from "@/server/search/location";

export const VEHICLE_TYPES = ["Sedan", "SUV", "Sports", "Luxury", "Minivan", "Van", "Truck"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const SORT_OPTIONS = ["total_asc", "daily_asc", "distance_asc"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  total_asc: "Trip total: low to high",
  daily_asc: "Daily rate: low to high",
  distance_asc: "Distance: nearest first",
};

export type SearchCriteria = {
  locationId: string;
  locationLabel: string;
  coordinates: Coordinates;
  timeZone: string;
  /** Wall-clock values as entered, in the location time zone. */
  pickupLocal: string;
  returnLocal: string;
  pickupAt: Date;
  returnAt: Date;
  radiusMiles: number;
  make?: string;
  model?: string;
  year?: number;
  vehicleTypes: VehicleType[];
  minPassengers: number;
  /** Daily-rate budget. Distinct from the trip-total budget. */
  maxDailyCents?: number;
  maxTotalCents?: number;
  sort: SortOption;
  page: number;
};

export type BookingCapability = "native_booking" | "redirect";

export type VehicleListing = {
  /** Provider identity + provider listing id, so unrelated cars are never merged. */
  id: string;
  providerKey: string;
  providerName: string;
  providerListingId: string;
  isMockSource: boolean;
  bookingCapability: BookingCapability;
  /** True when this is one specific physical vehicle, false for "or similar". */
  exactMatch: boolean;
  publicCode: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vehicleType: VehicleType;
  seats: number;
  transmission: string;
  description: string;
  locationLabel: string;
  coordinates: Coordinates;
  timeZone: string;
  distanceMiles: number | null;
  /** Public path of the primary photo, or null when the listing has none. */
  photoUrl: string | null;
  dailyRateCents: number;
  pricingPolicyId: string | null;
  partner: { id: string; displayName: string; kind: string; verified: boolean } | null;
  bookingMode: "instant" | "request";
  cancellationPolicy: string;
  price: PriceBreakdown;
  sourceUrl?: string;
  termsUrl?: string;
  photoUrls?: string[];
  checkoutDetails?: string;
  lastUpdated: string;
};

export type UnavailableSource = { providerKey: string; providerName: string; reason: string };

export type SearchResponse = {
  searchId: string;
  listings: VehicleListing[];
  /** Total matches across all pages. */
  resultCount: number;
  page: number;
  pageCount: number;
  searchedAt: string;
  durationMs: number;
  unavailableSources: UnavailableSource[];
  /** True when every enabled source failed (different from zero matches). */
  allSourcesFailed: boolean;
  warnings: string[];
};

export const PAGE_SIZE = 12;
