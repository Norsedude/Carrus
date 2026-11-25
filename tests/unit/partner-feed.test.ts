import { afterEach, describe, expect, it, vi } from "vitest";
import { parsePartnerFeedConfig, partnerFeedAdapter } from "@/server/search/providers/partner-feed";

const rawConfig = JSON.stringify([{
  key: "supplier", name: "Example Rentals", url: "https://api.example.com/search", token: "private-token",
  allowedHosts: ["example.com"], imageHosts: ["images.example.com"],
}]);
const feed = parsePartnerFeedConfig(rawConfig)[0];
const query = {
  pickupAt: new Date("2026-12-10T18:00:00Z"), returnAt: new Date("2026-12-13T18:00:00Z"),
  coordinates: { lat: 37.3639, lng: -121.9289 }, radiusMiles: 25,
};
const offer = {
  id: "offer-123", make: "Toyota", model: "Corolla", year: 2025, color: "Silver",
  vehicleType: "Sedan", seats: 5, transmission: "Automatic", description: "Airport pickup",
  locationLabel: "SJC", coordinates: query.coordinates, timeZone: "America/Los_Angeles",
  exactMatch: false, photoUrls: ["https://images.example.com/car.jpg"],
  sourceUrl: "https://example.com/checkout/offer-123", termsUrl: "https://example.com/terms",
  checkoutDetails: "Pay on the provider site", cancellationPolicy: "Free until 24 hours before pickup",
  price: { currency: "USD", billableDays: 3, dailyRateCents: 5000, totalCents: 18000,
    dueNowCents: 18000, depositCents: 0, lines: [
      { code: "base", label: "Base", cents: 15000 }, { code: "fees", label: "Taxes and fees", cents: 3000 },
    ] },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("authorized partner feed", () => {
  it("fetches live offers and keeps them redirect-only", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ searchedAt: new Date().toISOString(), listings: [offer] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const listings = await partnerFeedAdapter(feed).search(query);
    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      id: "supplier:offer-123", bookingCapability: "redirect", photoUrl: offer.photoUrls[0],
      sourceUrl: offer.sourceUrl, termsUrl: offer.termsUrl, price: { totalCents: 18000, complete: true },
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.searchParams.get("pickupAt")).toBe(query.pickupAt.toISOString());
    expect(options.headers.Authorization).toBe("Bearer private-token");
  });

  it("rejects incomplete prices and links outside the approved provider", async () => {
    const invalid = [{ ...offer, price: { ...offer.price, totalCents: 17000 } }, { ...offer, sourceUrl: "https://other.example/checkout" }];
    for (const listing of invalid) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ searchedAt: new Date().toISOString(), listings: [listing] }), { status: 200 })));
      await expect(partnerFeedAdapter(feed).search(query)).rejects.toThrow();
    }
  });

  it("keeps valid offers when other offers in the same feed are invalid", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const bad = [
      { ...offer, id: "bad-total", price: { ...offer.price, totalCents: 1 } },
      { ...offer, id: "bad-link", sourceUrl: "https://other.example/checkout" },
      { id: "bad-shape" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ searchedAt: new Date().toISOString(), listings: [...bad, offer] }), { status: 200 })));
    const listings = await partnerFeedAdapter(feed).search(query);
    expect(listings.map((l) => l.providerListingId)).toEqual(["offer-123"]);
  });

  it("accepts null optional fields, offset timestamps, and drops unapproved photos", async () => {
    const loose = { ...offer, color: null, description: null, photoUrls: ["https://cdn.other.example/x.jpg", offer.photoUrls[0]] };
    const searchedAt = new Date().toISOString().replace("Z", "+00:00");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ searchedAt, listings: [loose] }), { status: 200 })));
    const [listing] = await partnerFeedAdapter(feed).search(query);
    expect(listing).toMatchObject({ color: "", description: "", photoUrl: offer.photoUrls[0], photoUrls: [offer.photoUrls[0]] });
  });

  it("disables feeds instead of crashing search when the config is invalid", async () => {
    const { configuredPartnerAdapters } = await import("@/server/search/providers/partner-feed");
    const original = process.env.PARTNER_FEEDS_JSON;
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.PARTNER_FEEDS_JSON = "[{not json";
    try {
      expect(configuredPartnerAdapters()).toEqual([]);
    } finally {
      if (original === undefined) delete process.env.PARTNER_FEEDS_JSON;
      else process.env.PARTNER_FEEDS_JSON = original;
    }
  });

  it("rejects stale feed data and duplicate source keys", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ searchedAt: "2020-01-01T00:00:00Z", listings: [offer] }), { status: 200 })));
    await expect(partnerFeedAdapter(feed).search(query)).rejects.toThrow("stale");
    expect(() => parsePartnerFeedConfig(JSON.stringify([JSON.parse(rawConfig)[0], JSON.parse(rawConfig)[0]]))).toThrow("unique");
  });
});
