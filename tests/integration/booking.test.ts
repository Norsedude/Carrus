import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { validateSearch } from "@/server/search/validator";
import { nativeAdapter, runSearch } from "@/server/search/service";
import { createQuote, getQuoteView, submitCheckout } from "@/server/booking/service";
import { seedMateo } from "../../scripts/seed";
import { MATEO, admin, anon, at, signIn } from "./helpers";

// Runs against the local Supabase stack with the Mateo fixture profile.
const NOW = new Date("2026-11-14T20:00:00Z");
const OK_CARD = "4242424242424242";
const DECLINE_CARD = "4000000000000002";

let fx: Awaited<ReturnType<typeof seedMateo>>;
const contact = { contactName: "Casey Customer", contactPhone: "408-555-0101" };

async function quoteFor(code: string, userId: string | null, pickup = MATEO.pickup, ret = MATEO.ret) {
  const q = await createQuote(admin, { vehicleId: fx.vehicles[code], pickupAt: pickup, returnAt: ret, userId });
  if (!q.ok) throw new Error(`quote failed: ${q.code}`);
  return q.quoteId;
}
const checkout = (userId: string, quoteId: string, cardNumber = OK_CARD, key = randomUUID(), options = {}) =>
  submitCheckout(admin, { userId, quoteId, idempotencyKey: key, cardNumber, ...contact }, options);

async function searchCodes(pickup: string, ret: string) {
  const v = validateSearch({ location: "SJC", pickup, return: ret }, NOW);
  if (!v.ok) throw new Error(JSON.stringify(v.fieldErrors));
  const res = await runSearch(v.criteria, [nativeAdapter(anon())]);
  return res.listings.map((l) => [l.publicCode, l.price.totalCents] as const);
}
const bookingsFor = async (code: string) =>
  (await admin.from("bookings").select("id, reference, state, total_cents, customer_id").eq("vehicle_id", fx.vehicles[code])).data ?? [];

beforeEach(async () => {
  fx = await seedMateo(false);
});

describe("search against the database (anonymous visitor)", () => {
  it("TC-S01: standard dates return the four vehicles with expected totals", async () => {
    const results = await searchCodes("2026-12-10T10:00", "2026-12-13T10:00");
    expect(results).toEqual([["CAR-003", 21000], ["CAR-001", 24000], ["CAR-002", 27000], ["CAR-004", 33000]]);
  });
  it("TC-S02: revised dates Dec 14-17 return only CAR-002", async () => {
    expect(await searchCodes("2026-12-14T10:00", "2026-12-17T10:00")).toEqual([["CAR-002", 27000]]);
  });
});

describe("booking flow", () => {
  it("TC-B01 / TC-B02: one successful $240 booking that persists and can be re-read", async () => {
    const quoteId = await quoteFor("CAR-001", fx.ids.customer1);
    const outcome = await checkout(fx.ids.customer1, quoteId);
    expect(outcome.status).toBe("confirmed");
    const rows = await bookingsFor("CAR-001");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ state: "confirmed", total_cents: 24000, customer_id: fx.ids.customer1 });
    // Read back as the customer through RLS (what the confirmation page does).
    const { client } = await signIn("test.customer");
    const again = await client.from("bookings").select("reference, total_cents").eq("id", rows[0].id).single();
    expect(again.data?.total_cents).toBe(24000);
    // The vehicle no longer appears in search for those dates.
    const codes = (await searchCodes("2026-12-10T10:00", "2026-12-13T10:00")).map(([c]) => c);
    expect(codes).not.toContain("CAR-001");
    const pay = await admin.from("payments").select("state, amount_cents, provider").eq("booking_id", rows[0].id);
    expect(pay.data).toEqual([{ state: "succeeded", amount_cents: 24000, provider: "simulated" }]);
  });

  it("TC-B03: CUSTOMER-02 overlapping Dec 11-14 is denied", async () => {
    await checkout(fx.ids.customer1, await quoteFor("CAR-001", fx.ids.customer1));
    // A fresh quote for the overlap cannot even be created...
    const blocked = await createQuote(admin, { vehicleId: fx.vehicles["CAR-001"], pickupAt: at("2026-12-11T10:00"), returnAt: at("2026-12-14T10:00"), userId: fx.ids.customer2 });
    expect(blocked).toEqual({ ok: false, code: "unavailable" });
    expect(await bookingsFor("CAR-001")).toHaveLength(1);
  });

  it("stale quote: a quote made before someone else booked is refused at checkout (TC-PR02, TC-C04)", async () => {
    const stale = await quoteFor("CAR-001", fx.ids.customer2, at("2026-12-11T10:00"), at("2026-12-14T10:00"));
    await checkout(fx.ids.customer1, await quoteFor("CAR-001", fx.ids.customer1));
    const view = await getQuoteView(admin, stale, fx.ids.customer2);
    expect(view).toMatchObject({ kind: "quote", status: "unavailable" });
    expect(await checkout(fx.ids.customer2, stale)).toEqual({ status: "unavailable" });
    expect(await bookingsFor("CAR-001")).toHaveLength(1);
  });

  it("TC-B04 / TC-BC02 / TC-BC03: duplicate submit with the same key yields one booking", async () => {
    const quoteId = await quoteFor("CAR-001", fx.ids.customer1);
    const key = randomUUID();
    const [a, b] = await Promise.all([
      checkout(fx.ids.customer1, quoteId, OK_CARD, key),
      checkout(fx.ids.customer1, quoteId, OK_CARD, key),
    ]);
    const c = await checkout(fx.ids.customer1, quoteId, OK_CARD, key);
    expect([a.status, b.status, c.status]).toEqual(["confirmed", "confirmed", "confirmed"]);
    const ids = new Set([a, b, c].map((o) => (o.status === "confirmed" ? o.bookingId : "x")));
    expect(ids.size).toBe(1);
    expect(await bookingsFor("CAR-001")).toHaveLength(1);
    const payments = await admin.from("payments").select("id").eq("state", "succeeded");
    expect(payments.data).toHaveLength(1);
  });

  it("the same key with different input is rejected", async () => {
    const quoteId = await quoteFor("CAR-001", fx.ids.customer1);
    const key = randomUUID();
    await checkout(fx.ids.customer1, quoteId, OK_CARD, key);
    const other = await submitCheckout(admin, { userId: fx.ids.customer1, quoteId, idempotencyKey: key, cardNumber: OK_CARD, contactName: "Someone Else", contactPhone: "408-555-0199" });
    expect(other).toEqual({ status: "idempotency_mismatch" });
  });

  it("true simultaneous requests from two customers: exactly one wins", async () => {
    const q1 = await quoteFor("CAR-003", fx.ids.customer1);
    const q2 = await quoteFor("CAR-003", fx.ids.customer2);
    const outcomes = await Promise.all([checkout(fx.ids.customer1, q1), checkout(fx.ids.customer2, q2)]);
    expect(outcomes.map((o) => o.status).sort()).toEqual(["confirmed", "unavailable"]);
    expect(await bookingsFor("CAR-003")).toHaveLength(1);
  });

  it("TC-PT04 / TC-CK02: declined payment creates no booking or charge and releases availability", async () => {
    const quoteId = await quoteFor("CAR-002", fx.ids.customer1);
    const outcome = await checkout(fx.ids.customer1, quoteId, DECLINE_CARD);
    expect(outcome).toEqual({ status: "payment_failed", code: "card_declined" });
    expect(await bookingsFor("CAR-002")).toHaveLength(0);
    const pay = await admin.from("payments").select("state");
    expect(pay.data).toEqual([{ state: "failed" }]); // failed attempt kept for audit, nothing succeeded
    const codes = (await searchCodes("2026-12-10T10:00", "2026-12-13T10:00")).map(([c]) => c);
    expect(codes).toContain("CAR-002");
    // The customer can retry with a new key and succeed.
    expect((await checkout(fx.ids.customer1, quoteId)).status).toBe("confirmed");
  });

  it("payment that succeeds after the hold expired is refunded, never double-booked", async () => {
    const quoteId = await quoteFor("CAR-004", fx.ids.customer1);
    const outcome = await checkout(fx.ids.customer1, quoteId, OK_CARD, randomUUID(), { holdSeconds: 0 });
    expect(outcome).toEqual({ status: "expired_refunded" });
    expect(await bookingsFor("CAR-004")).toHaveLength(0);
    const pay = await admin.from("payments").select("state");
    expect(pay.data).toEqual([{ state: "refunded" }]);
  });

  it("adjacent rentals are allowed; a quote for another user or an expired quote is refused", async () => {
    await checkout(fx.ids.customer1, await quoteFor("CAR-002", fx.ids.customer1));
    const next = await quoteFor("CAR-002", fx.ids.customer2, at("2026-12-13T10:00"), at("2026-12-15T10:00"));
    expect((await checkout(fx.ids.customer2, next)).status).toBe("confirmed");

    const mine = await quoteFor("CAR-003", fx.ids.customer1);
    expect(await getQuoteView(admin, mine, fx.ids.customer2)).toBeNull();
    expect(await checkout(fx.ids.customer2, mine)).toEqual({ status: "rejected", code: "quote_not_found" });

    await admin.from("quotes").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", mine);
    expect(await checkout(fx.ids.customer1, mine)).toEqual({ status: "rejected", code: "quote_expired" });
  });

  it("a price change after quoting blocks checkout (TC-P02 persists the edit)", async () => {
    const quoteId = await quoteFor("CAR-001", fx.ids.customer1);
    const { client } = await signIn("test.partner");
    const edit = await client.from("vehicles").update({ daily_rate_cents: 6500 }).eq("id", fx.vehicles["CAR-001"]).select("daily_rate_cents, lifecycle_status").single();
    expect(edit.data).toEqual({ daily_rate_cents: 6500, lifecycle_status: "published" });
    expect(await getQuoteView(admin, quoteId, fx.ids.customer1)).toMatchObject({ status: "price_changed" });
    expect(await checkout(fx.ids.customer1, quoteId)).toEqual({ status: "rejected", code: "price_changed" });
  });

  it("the database itself rejects overlapping occupancy, including a block racing a booking", async () => {
    await checkout(fx.ids.customer1, await quoteFor("CAR-001", fx.ids.customer1));
    const block = await admin.from("occupancy").insert({
      vehicle_id: fx.vehicles["CAR-001"], kind: "block",
      period: `[${at("2026-12-12T00:00").toISOString()},${at("2026-12-12T12:00").toISOString()})`,
    });
    expect(block.error?.code).toBe("23P01"); // exclusion_violation

    const quoteId = await quoteFor("CAR-003", fx.ids.customer1);
    const [book, blockRace] = await Promise.all([
      checkout(fx.ids.customer1, quoteId),
      admin.from("occupancy").insert({ vehicle_id: fx.vehicles["CAR-003"], kind: "block", period: `[${MATEO.pickup.toISOString()},${MATEO.ret.toISOString()})` }),
    ]);
    const bookingWon = book.status === "confirmed";
    expect(bookingWon !== (blockRace.error === null)).toBe(true); // exactly one of them holds the unit
  });
});

describe("RES-TEST-001 fixture", () => {
  beforeAll(() => {});
  it("exists only when requested and blocks the overlap", async () => {
    fx = await seedMateo(true);
    const rows = await bookingsFor("CAR-001");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reference: "RES-TEST-001", state: "confirmed", total_cents: 24000 });
    const blocked = await createQuote(admin, { vehicleId: fx.vehicles["CAR-001"], pickupAt: at("2026-12-11T10:00"), returnAt: at("2026-12-14T10:00"), userId: fx.ids.customer2 });
    expect(blocked).toEqual({ ok: false, code: "unavailable" });
  });
});
