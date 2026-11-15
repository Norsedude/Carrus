import { describe, expect, it } from "vitest";
import { parseDollarsToCents } from "@/lib/money";
import { billableDays, utcToZonedLocal, zonedLocalToUtc } from "@/lib/time";
import { validateCard } from "@/server/payments/simulated";
import { calculatePrice, type PricingPolicy } from "@/server/pricing/pricing";

const TZ = "America/Los_Angeles";
const at = (s: string) => zonedLocalToUtc(s, TZ)!;

const flatFees: PricingPolicy = {
  id: "p1", key: "flat-fees", version: 1,
  formula: {
    flatFees: [
      { code: "service_fee", label: "Service fee", cents: 3000 },
      { code: "taxes_flat", label: "Taxes and surcharges", cents: 3000 },
    ],
    protectionCents: 0, taxRateBps: 0,
  },
};
const protectionTax: PricingPolicy = {
  id: "p2", key: "protection-tax", version: 1,
  formula: { flatFees: [], protectionCents: 5200, taxRateBps: 1000 },
};

describe("time", () => {
  it("interprets wall-clock times in the location zone (PST and PDT)", () => {
    expect(at("2026-12-10T10:00").toISOString()).toBe("2026-12-10T18:00:00.000Z");
    expect(at("2026-07-01T10:00").toISOString()).toBe("2026-07-01T17:00:00.000Z");
  });
  it("round-trips local strings", () => {
    expect(utcToZonedLocal(at("2027-01-15T10:00"), TZ)).toBe("2027-01-15T10:00");
  });
  it("rejects malformed and impossible dates", () => {
    expect(zonedLocalToUtc("2026-02-31T10:00", TZ)).toBeNull();
    expect(zonedLocalToUtc("tomorrow", TZ)).toBeNull();
  });
  it("bills ceil(elapsed hours / 24) with a one-day minimum", () => {
    expect(billableDays(at("2026-12-10T10:00"), at("2026-12-13T10:00"))).toBe(3);
    expect(billableDays(at("2026-12-10T10:00"), at("2026-12-10T12:00"))).toBe(1);
    expect(billableDays(at("2026-12-10T10:00"), at("2026-12-13T10:01"))).toBe(4);
  });
  it("S1 discrepancy: Jan 15 10:00 to Jan 19 18:00 is five billable days, not four", () => {
    expect(billableDays(at("2027-01-15T10:00"), at("2027-01-19T18:00"))).toBe(5);
    expect(billableDays(at("2027-01-15T10:00"), at("2027-01-19T10:00"))).toBe(4);
  });
  it("does not add a day across the spring daylight-saving change", () => {
    // Mar 14 2027 is 23 hours long in Los Angeles.
    expect(billableDays(at("2027-03-13T10:00"), at("2027-03-15T10:00"))).toBe(2);
  });
  it("throws when return is not after pickup", () => {
    expect(() => billableDays(at("2026-12-13T10:00"), at("2026-12-10T10:00"))).toThrow(RangeError);
  });
});

describe("pricing: Mateo profile (flat-fees@v1)", () => {
  const price = (daily: number) =>
    calculatePrice({ dailyRateCents: daily * 100, pickupAt: at("2026-12-10T10:00"), returnAt: at("2026-12-13T10:00"), policy: flatFees });
  it("CAR-001 Camry: $180 + $30 + $30 = $240", () => {
    const p = price(60);
    expect(p.baseCents).toBe(18000);
    expect(p.mandatoryFeesCents).toBe(6000);
    expect(p.totalCents).toBe(24000);
    expect(p.lines.reduce((s, l) => s + l.cents, 0)).toBe(p.totalCents);
    expect(p.policyVersion).toBe("flat-fees@v1");
    expect(p.complete).toBe(true);
  });
  it.each([[70, 27000], [50, 21000], [90, 33000]])("daily $%i totals %i cents", (daily, total) => {
    expect(price(daily).totalCents).toBe(total);
  });
});

describe("pricing: Sanjay profile (protection-tax@v1), four days", () => {
  it.each([
    ["Civic", 41, 23760], ["Equinox", 63, 33440], ["RAV4", 68, 35640], ["CR-V", 72, 37400],
    ["Sienna", 81, 41360], ["F-150", 95, 47520], ["Transit", 120, 58520],
  ])("%s at $%i/day totals %i cents", (_name, daily, total) => {
    const p = calculatePrice({ dailyRateCents: daily * 100, pickupAt: at("2027-01-15T10:00"), returnAt: at("2027-01-19T10:00"), policy: protectionTax });
    expect(p.billableDays).toBe(4);
    expect(p.totalCents).toBe(total);
    expect(p.lines.reduce((s, l) => s + l.cents, 0)).toBe(p.totalCents);
  });
  it("rejects non-positive or fractional rates", () => {
    const args = { pickupAt: at("2027-01-15T10:00"), returnAt: at("2027-01-19T10:00"), policy: protectionTax };
    expect(() => calculatePrice({ ...args, dailyRateCents: 0 })).toThrow();
    expect(() => calculatePrice({ ...args, dailyRateCents: -100 })).toThrow();
    expect(() => calculatePrice({ ...args, dailyRateCents: 10.5 })).toThrow();
  });
});

describe("money parsing", () => {
  it("parses dollars and rejects negatives and junk", () => {
    expect(parseDollarsToCents("65")).toBe(6500);
    expect(parseDollarsToCents("$65.50")).toBe(6550);
    expect(parseDollarsToCents("-5")).toBeNull();
    expect(parseDollarsToCents("")).toBeNull();
    expect(parseDollarsToCents("abc")).toBeNull();
  });
});

describe("simulated payment field validation (TC-CK01, TC-CK03)", () => {
  const now = new Date("2026-11-14T00:00:00Z");
  const good = { number: "4242 4242 4242 4242", expiry: "12/30", cvc: "123", zip: "95123" };
  it("accepts the documented demo card fields", () => {
    expect(validateCard(good, now)).toEqual({});
  });
  it("blocks each missing required field", () => {
    expect(validateCard({ ...good, number: "" }, now).cardNumber).toBeTruthy();
    expect(validateCard({ ...good, expiry: "" }, now).cardExpiry).toBeTruthy();
    expect(validateCard({ ...good, cvc: "" }, now).cardCvc).toBeTruthy();
    expect(validateCard({ ...good, zip: "" }, now).cardZip).toBeTruthy();
  });
  it("refuses numbers that are not demo test cards, and expired cards", () => {
    expect(validateCard({ ...good, number: "5555555555554444" }, now).cardNumber).toMatch(/demo test cards/);
    expect(validateCard({ ...good, expiry: "10/26" }, now).cardExpiry).toMatch(/expired/);
  });
});
