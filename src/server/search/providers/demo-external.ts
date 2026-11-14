import type { ProviderAdapter } from "@/server/search/gateway";
import { offsetByMiles } from "@/server/search/location";
import type { VehicleListing } from "@/server/search/types";

// MOCK ADAPTER. Represents rental sources Carrus is not integrated with.
// Enabled only when PROVIDER_MODE=native+demo. Listings are fictional, are
// labeled "Demo rental source" in the UI, cannot be booked on Carrus, and
// carry an incomplete price because the source's mandatory fees are unknown.

const SJC = { lat: 37.3639, lng: -121.9289 };

const DEMO: { id: string; make: string; model: string; year: number; type: VehicleListing["vehicleType"]; seats: number; dailyCents: number; miles: number; bearing: number }[] = [
  { id: "DEMO-EXT-1", make: "Nissan", model: "Altima", year: 2023, type: "Sedan", seats: 5, dailyCents: 5500, miles: 0.4, bearing: 40 },
  { id: "DEMO-EXT-2", make: "Jeep", model: "Compass", year: 2023, type: "SUV", seats: 5, dailyCents: 7400, miles: 0.6, bearing: 200 },
];

export const demoExternalAdapter: ProviderAdapter = {
  key: "demo-external",
  name: "Demo rental source",
  isMock: true,
  capability: "redirect",
  async search(query) {
    const days = Math.max(1, Math.ceil((query.returnAt.getTime() - query.pickupAt.getTime()) / 86_400_000));
    return DEMO.map((d): VehicleListing => {
      const baseCents = d.dailyCents * days;
      return {
        id: `demo-external:${d.id}`,
        providerKey: "demo-external",
        providerName: "Demo rental source",
        providerListingId: d.id,
        isMockSource: true,
        bookingCapability: "redirect",
        exactMatch: false,
        publicCode: d.id,
        make: d.make,
        model: d.model,
        year: d.year,
        color: "",
        vehicleType: d.type,
        seats: d.seats,
        transmission: "Automatic",
        description: "Fictional listing used to demonstrate how an external rental source would appear.",
        locationLabel: "Near San José Mineta International Airport",
        coordinates: offsetByMiles(SJC, d.miles, d.bearing),
        timeZone: "America/Los_Angeles",
        distanceMiles: null,
        dailyRateCents: d.dailyCents,
        pricingPolicyId: null,
        partner: null,
        bookingMode: "instant",
        cancellationPolicy: "unknown",
        price: {
          currency: "USD",
          billableDays: days,
          dailyRateCents: d.dailyCents,
          baseCents,
          mandatoryFeesCents: 0,
          protectionCents: 0,
          taxCents: 0,
          totalCents: baseCents,
          depositCents: 0,
          dueNowCents: 0,
          complete: false,
          policyVersion: "external-unknown",
          lines: [{ code: "base", label: `${days} day${days === 1 ? "" : "s"} × daily rate`, cents: baseCents }],
          conditionalCharges: [],
        },
        lastUpdated: new Date().toISOString(),
      };
    });
  },
};
