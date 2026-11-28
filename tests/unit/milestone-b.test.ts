import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { isPrivateAddress, parsePublicUrl, LinkFetchError } = await import("@/server/links/fetch");
const { parseListing, toCents } = await import("@/server/links/parse");
const { checkPhoto, sniffImage, MAX_PHOTO_BYTES } = await import("@/server/vehicles/photos");
const { buildCalendar } = await import("@/server/vehicles/calendar");

describe("link import: address safety", () => {
  it("blocks loopback, private, link-local and cloud metadata addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "93.184.216.34", "2606:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("only accepts public http(s) URLs on standard ports", () => {
    expect(parsePublicUrl("https://example.com/car#photos").toString()).toBe("https://example.com/car");
    for (const bad of ["ftp://example.com", "file:///etc/passwd", "http://localhost:3000", "http://127.0.0.1/", "http://169.254.169.254/latest", "https://user:pw@example.com", "https://example.com:8443/", "not a url", "http://intranet.local/"]) {
      expect(() => parsePublicUrl(bad), bad).toThrow(LinkFetchError);
    }
  });
});

describe("link import: parsing a listing page", () => {
  it("reads schema.org JSON-LD for a car offer", () => {
    const html = `<html><head><title>Rent this</title>
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Car","name":"2023 Tesla Model Y Long Range","brand":{"@type":"Brand","name":"Tesla"},"model":"Model Y","vehicleModelDate":"2023","seatingCapacity":5,"vehicleTransmission":"Automatic","bodyType":"SUV","image":["/img/y.jpg"],
      "offers":{"@type":"Offer","price":"89.00","priceCurrency":"USD","priceSpecification":{"@type":"UnitPriceSpecification","unitText":"DAY"}}}</script></head></html>`;
    const p = parseListing(html, "https://cars.example.com/listing/42");
    expect(p).toMatchObject({ make: "Tesla", model: "Model Y", year: 2023, seats: 5, transmission: "Automatic", vehicleType: "SUV", dailyCents: 8900, currency: "USD", imageUrl: "https://cars.example.com/img/y.jpg", site: "cars.example.com" });
    expect(p.found).toEqual(expect.arrayContaining(["make", "model", "year", "dailyRate", "photo"]));
  });

  it("falls back to Open Graph tags and a $/day price in the page text", () => {
    const html = `<head><meta property="og:title" content="2022 Honda Civic &amp; more"><meta property="og:site_name" content="Neighbor Cars">
      <meta property="og:image" content="https://cdn.example.com/civic.jpg"></head><body><span>$45 / day</span> · 5 seats · automatic sedan</body>`;
    const p = parseListing(html, "https://neighbor.example/civic");
    expect(p).toMatchObject({ title: "2022 Honda Civic & more", site: "Neighbor Cars", make: "Honda", model: "Civic", year: 2022, dailyCents: 4500, imageUrl: "https://cdn.example.com/civic.jpg" });
  });

  it("returns blanks (not guesses) for a page without listing data", () => {
    const p = parseListing("<html><head><title>Hello</title></head></html>", "https://example.org/");
    expect(p).toMatchObject({ title: "Hello", make: "", model: "", dailyCents: null, totalCents: null, imageUrl: null });
  });

  it("rejects silly prices", () => {
    expect(toCents("$1,234.50")).toBe(123450);
    expect(toCents("0")).toBeNull();
    expect(toCents("9999999")).toBeNull();
  });
});

describe("listing photos", () => {
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);
  it("identifies images by content, not by name", () => {
    expect(sniffImage(jpg)?.ext).toBe("jpg");
    expect(sniffImage(png)?.ext).toBe("png");
    expect(sniffImage(webp)?.ext).toBe("webp");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
  it("enforces the 10,000,000-byte limit and rejects empty files", () => {
    expect(checkPhoto("a.jpg", MAX_PHOTO_BYTES, jpg).ok).toBe(true);
    expect(checkPhoto("a.jpg", MAX_PHOTO_BYTES + 1, jpg)).toMatchObject({ ok: false });
    expect(checkPhoto("a.jpg", 0, jpg)).toMatchObject({ ok: false });
    expect(checkPhoto("evil.jpg", 10, new TextEncoder().encode("GIF89a.."))).toMatchObject({ ok: false });
  });
});

describe("availability calendar", () => {
  it("marks available, booked, not-offered and past days in the listing's time zone", () => {
    const tz = "America/Los_Angeles";
    const months = buildCalendar({
      from: new Date("2026-12-05T18:00:00Z"),
      months: 2,
      timeZone: tz,
      now: new Date("2026-12-03T18:00:00Z"),
      windows: [{ start: new Date("2026-12-01T08:00:00Z"), end: new Date("2026-12-20T08:00:00Z") }],
      busy: [{ start: new Date("2026-12-10T18:00:00Z"), end: new Date("2026-12-13T18:00:00Z") }],
    });
    expect(months.map((m) => m.label)).toEqual(["December 2026", "January 2027"]);
    expect(months[0].leadingBlanks).toBe(2); // Dec 1, 2026 is a Tuesday
    const status = (d: number) => months[0].days[d - 1].status;
    expect(status(2)).toBe("past");
    expect(status(5)).toBe("available");
    expect([status(10), status(11), status(13)]).toEqual(["booked", "booked", "booked"]);
    expect(status(14)).toBe("available");
    expect(status(25)).toBe("unavailable");
    expect(months[1].days).toHaveLength(31);
  });
});
