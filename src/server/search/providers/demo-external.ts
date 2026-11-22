import type { ProviderAdapter } from "@/server/search/gateway";
import { offsetByMiles } from "@/server/search/location";
import type { VehicleListing } from "@/server/search/types";

// MOCK ADAPTER. Represents rental sources Carrus is not integrated with.
// Enabled only when PROVIDER_MODE=native+demo. Listings are fictional, are
// labeled "Demo rental source" in the UI. They support the simulated
// external checkout and link to a Carrus-owned fictional source page.

const SJC = { lat: 37.3639, lng: -121.9289 };

export const DEMO: { id: string; make: string; model: string; year: number; type: VehicleListing["vehicleType"]; seats: number; dailyCents: number; miles: number; bearing: number }[] = [
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
      const feesCents = 3000;
      const totalCents = baseCents + feesCents;
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
        description: "Fictional listing used to test an external-source demo checkout. No vehicle is offered for rent.",
        locationLabel: "Near San José Mineta International Airport",
        coordinates: offsetByMiles(SJC, d.miles, d.bearing),
        timeZone: "America/Los_Angeles",
        distanceMiles: null,
        photoUrl: null,
        dailyRateCents: d.dailyCents,
        pricingPolicyId: null,
        partner: null,
        bookingMode: "instant",
        cancellationPolicy: "Fictional demo policy: no real reservation is created.",
        sourceUrl: `/demo-source/${d.id}`,
        termsUrl: `/demo-source/${d.id}#terms`,
        checkoutDetails: "Carrus demo only. The fictional source has no payment or booking service.",
        price: {
          currency: "USD",
          billableDays: days,
          dailyRateCents: d.dailyCents,
          baseCents,
          mandatoryFeesCents: feesCents,
          protectionCents: 0,
          taxCents: 0,
          totalCents,
          depositCents: 0,
          dueNowCents: totalCents,
          complete: true,
          policyVersion: "fictional-demo",
          lines: [
            { code: "base", label: `${days} day${days === 1 ? "" : "s"} × daily rate`, cents: baseCents },
            { code: "fees", label: "Fictional taxes and fees", cents: feesCents },
          ],
          conditionalCharges: [],
        },
        lastUpdated: new Date().toISOString(),
      };
    });
  },
};
