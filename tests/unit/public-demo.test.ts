import { afterEach, describe, expect, it, vi } from "vitest";
import { freshExternalListing } from "@/server/booking/external-demo";
import { distanceMiles } from "@/server/search/location";
import { PUBLIC_DEMO_CATALOG, commonsCredit, publicDemoAdapter } from "@/server/search/providers/public-demo";

const query = {
  pickupAt: new Date("2026-12-10T18:00:00Z"),
  returnAt: new Date("2026-12-13T18:00:00Z"),
  coordinates: { lat: 37.7749, lng: -122.4194 },
  radiusMiles: 25,
  timeZone: "America/Los_Angeles",
};

const commonsPage = (title: string, license: string, extra: Record<string, unknown> = {}) => ({
  title,
  imageinfo: [{
    thumburl: `https://upload.wikimedia.org/thumb/${encodeURIComponent(title)}.jpg`,
    descriptionurl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
    mime: "image/jpeg",
    extmetadata: { LicenseShortName: { value: license }, Artist: { value: "<a href=\"x\">Jane Photographer</a>" }, LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0" } },
    ...extra,
  }],
});

function stubFetch(models: string[] = ["Corolla", "Civic", "Camry", "Elantra", "Model 3", "RAV4", "CR-V", "Grand Cherokee", "Tahoe", "Pacifica", "Mustang", "F-150"]) {
  const fetchMock = vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.hostname === "vpic.nhtsa.dot.gov") {
      return new Response(JSON.stringify({ Results: models.map((Model_Name) => ({ Model_Name })) }));
    }
    const titles = (url.searchParams.get("titles") ?? "").split("|");
    return new Response(JSON.stringify({ query: { pages: titles.map((title) => commonsPage(title, "CC BY 4.0")) } }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PUBLIC_DEMO_LISTINGS;
});

describe("open-data public demo listings", () => {
  it("builds labeled demo offers near the searched location with credited photos and consistent prices", async () => {
    const fetchMock = stubFetch();
    const listings = await publicDemoAdapter.search(query);
    expect(listings).toHaveLength(PUBLIC_DEMO_CATALOG.length);
    for (const l of listings) {
      expect(l).toMatchObject({ isMockSource: true, bookingCapability: "redirect", providerKey: "public-demo", price: { complete: true } });
      expect(l.price.lines.reduce((sum, line) => sum + line.cents, 0)).toBe(l.price.totalCents);
      expect(distanceMiles(query.coordinates, l.coordinates)).toBeLessThan(7);
      expect(l.photoCredit).toMatchObject({ author: "Jane Photographer", license: "CC BY 4.0" });
      expect(l.sourceUrl).toBe(`/demo-source/${l.providerListingId}`);
    }
    // Only free public APIs are contacted, and Commons only once for all photos.
    expect(fetchMock.mock.calls.filter(([input]) => new URL(String(input)).hostname === "commons.wikimedia.org")).toHaveLength(1);
    const hosts = new Set(fetchMock.mock.calls.map(([input]) => new URL(String(input)).hostname));
    expect([...hosts].sort()).toEqual(["commons.wikimedia.org", "vpic.nhtsa.dot.gov"]);
  });

  it("supports demo checkout rechecks with a stable price", async () => {
    stubFetch();
    process.env.PUBLIC_DEMO_LISTINGS = "true";
    const [offer] = await publicDemoAdapter.search(query);
    const fresh = await freshExternalListing("public-demo", offer.providerListingId, { ...query, timeZone: undefined });
    expect(fresh).toMatchObject({ id: offer.id, sourceUrl: offer.sourceUrl, price: { totalCents: offer.price.totalCents } });
  });

  it("only uses freely licensed photos hosted by Wikimedia", () => {
    expect(commonsCredit(commonsPage("File:A.jpg", "CC0"))).toMatchObject({ title: "A.jpg", license: "CC0", author: "Jane Photographer" });
    expect(commonsCredit(commonsPage("File:A.jpg", "Public domain"))).not.toBeNull();
    expect(commonsCredit(commonsPage("File:A.jpg", "All rights reserved"))).toBeNull();
    expect(commonsCredit(commonsPage("File:A.jpg", "Fair use"))).toBeNull();
    expect(commonsCredit(commonsPage("File:A.jpg", "CC BY 4.0", { thumburl: "https://evil.example/a.jpg" }))).toBeNull();
    expect(commonsCredit({ title: "File:A.jpg", missing: true })).toBeNull();
  });
});
