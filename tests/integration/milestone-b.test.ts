import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createQuote, submitCheckout } from "@/server/booking/service";
import { seedMateo } from "../../scripts/seed";
import { MATEO, admin, anon, signIn } from "./helpers";

// Milestone B against the local Supabase stack (Mateo fixture profile).
let fx: Awaited<ReturnType<typeof seedMateo>>;
const contact = { contactName: "Casey Customer", contactPhone: "408-555-0101" };

beforeEach(async () => {
  fx = await seedMateo(false);
});

async function requestBooking(code = "CAR-002") {
  await admin.from("vehicles").update({ booking_mode: "request" }).eq("id", fx.vehicles[code]);
  const q = await createQuote(admin, { vehicleId: fx.vehicles[code], pickupAt: MATEO.pickup, returnAt: MATEO.ret, userId: fx.ids.customer1 });
  if (!q.ok) throw new Error(q.code);
  const outcome = await submitCheckout(admin, { userId: fx.ids.customer1, quoteId: q.quoteId, idempotencyKey: randomUUID(), cardNumber: "4242424242424242", ...contact });
  if (outcome.status !== "confirmed") throw new Error(`checkout ${outcome.status}`);
  return outcome.bookingId;
}
const bookingRow = async (id: string) => (await admin.from("bookings").select("state, respond_by, decline_reason, partner_approved_at").eq("id", id).single()).data!;
const paymentStates = async (id: string) => ((await admin.from("payments").select("state").eq("booking_id", id)).data ?? []).map((p) => p.state);
const kinds = async (userId: string) => ((await admin.from("notifications").select("kind").eq("user_id", userId)).data ?? []).map((n) => n.kind).sort();
const occupied = async (code: string) => ((await anon().rpc("available_vehicle_ids", { _pickup: MATEO.pickup.toISOString(), _return: MATEO.ret.toISOString() })).data as string[]).includes(fx.vehicles[code]) === false;

describe("request to book", () => {
  it("creates a pending request that holds the car, then the partner approves it", async () => {
    const id = await requestBooking();
    const pending = await bookingRow(id);
    expect(pending.state).toBe("pending_partner");
    expect(new Date(pending.respond_by!).getTime()).toBeGreaterThan(Date.now() + 23 * 3600_000);
    expect(await occupied("CAR-002")).toBe(true);
    expect(await kinds(fx.ids.customer1)).toEqual(["booking.requested"]);
    expect(await kinds(fx.ids.partner1)).toEqual(["partner.request"]);

    // Another customer and the other partner cannot answer it.
    const stranger = await signIn("test.partner2");
    expect((await stranger.client.rpc("respond_to_booking", { _booking: id, _approve: true })).error).not.toBeNull();

    const partner = await signIn("test.partner");
    const res = await partner.client.rpc("respond_to_booking", { _booking: id, _approve: true });
    expect(res.data).toEqual({ status: "confirmed" });
    const after = await bookingRow(id);
    expect(after.state).toBe("confirmed");
    expect(after.partner_approved_at).not.toBeNull();
    expect(await occupied("CAR-002")).toBe(true);
    expect(await kinds(fx.ids.customer1)).toEqual(["booking.approved", "booking.requested"]);
    // Answering twice is a no-op.
    expect((await partner.client.rpc("respond_to_booking", { _booking: id, _approve: false })).data).toEqual({ status: "confirmed" });
  });

  it("decline frees the car, refunds the simulated payment and tells the customer why", async () => {
    const id = await requestBooking();
    const partner = await signIn("test.partner");
    expect((await partner.client.rpc("respond_to_booking", { _booking: id, _approve: false, _reason: "In the shop that week" })).data).toEqual({ status: "declined" });
    expect(await bookingRow(id)).toMatchObject({ state: "declined", decline_reason: "In the shop that week" });
    expect(await paymentStates(id)).toEqual(["refunded"]);
    expect(await occupied("CAR-002")).toBe(false);
    const { data } = await admin.from("notifications").select("body").eq("user_id", fx.ids.customer1).eq("kind", "booking.declined").single();
    expect(data?.body).toContain("In the shop that week");
  });

  it("unanswered requests expire, release the car and refund", async () => {
    const id = await requestBooking();
    await admin.from("bookings").update({ respond_by: new Date(Date.now() - 1000).toISOString() }).eq("id", id);
    await admin.from("occupancy").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("booking_id", id);
    expect(await occupied("CAR-002")).toBe(false);
    expect((await admin.rpc("expire_pending_requests")).data).toBe(1);
    expect((await bookingRow(id)).state).toBe("expired");
    expect(await paymentStates(id)).toEqual(["refunded"]);
    // A late approval cannot revive it.
    const partner = await signIn("test.partner");
    expect((await partner.client.rpc("respond_to_booking", { _booking: id, _approve: true })).data).toEqual({ status: "expired" });
  });

  it("instant bookings still confirm immediately and notify both sides", async () => {
    const q = await createQuote(admin, { vehicleId: fx.vehicles["CAR-001"], pickupAt: MATEO.pickup, returnAt: MATEO.ret, userId: fx.ids.customer1 });
    if (!q.ok) throw new Error(q.code);
    const out = await submitCheckout(admin, { userId: fx.ids.customer1, quoteId: q.quoteId, idempotencyKey: randomUUID(), cardNumber: "4242424242424242", ...contact });
    expect(out.status).toBe("confirmed");
    expect(await kinds(fx.ids.customer1)).toEqual(["booking.confirmed"]);
    expect(await kinds(fx.ids.partner1)).toEqual(["partner.booking"]);
  });
});

describe("notifications, saved searches and calendar", () => {
  it("each user reads and marks only their own notifications", async () => {
    await requestBooking();
    const customer = await signIn("test.customer");
    const other = await signIn("test.customer2");
    expect((await other.client.from("notifications").select("id")).data).toHaveLength(0);
    const mine = await customer.client.from("notifications").select("id, read_at");
    expect(mine.data).toHaveLength(1);
    await customer.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", mine.data![0].id);
    expect((await customer.client.from("notifications").select("read_at").single()).data?.read_at).not.toBeNull();
    // Users cannot create notifications themselves.
    expect((await customer.client.from("notifications").insert({ user_id: customer.userId, kind: "x.y", title: "spoof" })).error).not.toBeNull();
  });

  it("saved searches are private to their owner", async () => {
    const customer = await signIn("test.customer");
    const saved = await customer.client.from("saved_searches").insert({ user_id: customer.userId, name: "SJC SUVs", query: "location=SJC&type=SUV" }).select("id").single();
    expect(saved.error).toBeNull();
    const other = await signIn("test.customer2");
    expect((await other.client.from("saved_searches").select("id")).data).toHaveLength(0);
    expect((await other.client.from("saved_searches").insert({ user_id: customer.userId, name: "x", query: "location=SJC" })).error).not.toBeNull();
    expect((await customer.client.from("saved_searches").insert({ user_id: customer.userId, name: "bad", query: "https://evil.example" })).error).not.toBeNull();
  });

  it("busy periods show booked time without customer details", async () => {
    await requestBooking();
    const { data, error } = await anon().rpc("vehicle_busy_periods", { _vehicle: fx.vehicles["CAR-002"], _from: "2026-12-01T00:00:00Z", _to: "2026-12-31T00:00:00Z" });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(Object.keys((data as object[])[0]).sort()).toEqual(["end_at", "start_at"]);
  });

  it("rate limiter allows up to the limit per window and is server-only", async () => {
    const bucket = `test:${randomUUID()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await admin.rpc("hit_rate_limit", { _bucket: bucket, _limit: 3, _window_seconds: 600 })).data);
    expect(results).toEqual([true, true, true, false]);
    expect((await anon().rpc("hit_rate_limit", { _bucket: bucket, _limit: 3, _window_seconds: 600 })).error).not.toBeNull();
  });
});

describe("listing photos", () => {
  it("the public photo bucket stores an upload and serves it", async () => {
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4b20000000049454e44ae426082", "hex");
    const path = `${fx.vehicles["CAR-001"]}/${randomUUID()}.png`;
    const up = await admin.storage.from("vehicle-photos").upload(path, png, { contentType: "image/png" });
    expect(up.error).toBeNull();
    const url = admin.storage.from("vehicle-photos").getPublicUrl(path).data.publicUrl;
    const res = await fetch(url);
    expect(res.status).toBe(200);
    // Owner can attach it; another partner cannot.
    const owner = await signIn("test.partner");
    expect((await owner.client.from("vehicle_photos").insert({ vehicle_id: fx.vehicles["CAR-001"], storage_path: url, position: 0, is_primary: true })).error).toBeNull();
    const other = await signIn("test.partner2");
    expect((await other.client.from("vehicle_photos").insert({ vehicle_id: fx.vehicles["CAR-001"], storage_path: url, position: 1 })).error).not.toBeNull();
    await admin.storage.from("vehicle-photos").remove([path]);
  });
});
