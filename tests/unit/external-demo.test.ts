import { afterEach, describe, expect, it } from "vitest";
import { freshExternalListing } from "@/server/booking/external-demo";
import { demoExternalAdapter } from "@/server/search/providers/demo-external";

const originalMode = process.env.PROVIDER_MODE;
afterEach(() => {
  if (originalMode === undefined) delete process.env.PROVIDER_MODE;
  else process.env.PROVIDER_MODE = originalMode;
});

describe("fictional external demo source", () => {
  it("supplies a complete example price and original source link for checkout rechecks", async () => {
    process.env.PROVIDER_MODE = "native+demo";
    const query = {
      pickupAt: new Date("2026-12-10T18:00:00Z"),
      returnAt: new Date("2026-12-13T18:00:00Z"),
      coordinates: { lat: 37.3639, lng: -121.9289 }, radiusMiles: 25,
    };
    const results = await demoExternalAdapter.search(query);
    const offer = results[0];
    expect(offer).toMatchObject({
      isMockSource: true, bookingCapability: "redirect", sourceUrl: "/demo-source/DEMO-EXT-1",
      price: { complete: true, totalCents: 19500 },
    });
    expect(offer.price.lines.reduce((sum, line) => sum + line.cents, 0)).toBe(offer.price.totalCents);
    expect(await freshExternalListing(offer.providerKey, offer.providerListingId, query)).toMatchObject({ id: offer.id });
  });
});
