import type { Coordinates } from "@/server/search/location";
import type { BookingCapability, UnavailableSource, VehicleListing } from "@/server/search/types";

// RentalProviderGateway: fans a search out to every enabled adapter with a
// bounded timeout. One failed source never discards the others' results.

export type ProviderQuery = {
  pickupAt: Date;
  returnAt: Date;
  coordinates: Coordinates;
  radiusMiles: number;
};

export interface ProviderAdapter {
  key: string;
  name: string;
  isMock: boolean;
  capability: BookingCapability;
  /** Returns normalized listings that are available for the whole interval. */
  search(query: ProviderQuery): Promise<VehicleListing[]>;
}

export type GatewayResult = {
  listings: VehicleListing[];
  unavailableSources: UnavailableSource[];
  allSourcesFailed: boolean;
};

export const PROVIDER_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function fetchListings(
  adapters: ProviderAdapter[],
  query: ProviderQuery,
  timeoutMs = PROVIDER_TIMEOUT_MS,
): Promise<GatewayResult> {
  const settled = await Promise.allSettled(
    adapters.map((adapter) => withTimeout(adapter.search(query), timeoutMs)),
  );
  const listings: VehicleListing[] = [];
  const unavailableSources: UnavailableSource[] = [];
  const seen = new Set<string>();
  settled.forEach((result, index) => {
    const adapter = adapters[index];
    if (result.status === "fulfilled") {
      for (const listing of result.value) {
        if (seen.has(listing.id)) continue; // same provider + listing id only
        seen.add(listing.id);
        listings.push(listing);
      }
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : "unknown error";
      console.warn(`[search] source ${adapter.key} unavailable: ${reason.slice(0, 500)}`);
      unavailableSources.push({
        providerKey: adapter.key,
        providerName: adapter.name,
        reason: reason === "timed out" ? "timed out" : "unavailable",
      });
    }
  });
  return {
    listings,
    unavailableSources,
    allSourcesFailed: adapters.length > 0 && unavailableSources.length === adapters.length,
  };
}
