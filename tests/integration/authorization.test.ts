import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { seedMateo } from "../../scripts/seed";
import { admin, anon, signIn } from "./helpers";

// Negative authorization tests: run as real signed-in users through RLS,
// with two customers and two partners (never only as admin).

let fx: Awaited<ReturnType<typeof seedMateo>>;
let bookingId: string;
let draftId: string;

beforeAll(async () => {
  fx = await seedMateo(true);
  bookingId = (await admin.from("bookings").select("id").eq("reference", "RES-TEST-001").single()).data!.id;
  const car = (await admin.from("vehicles").select("*").eq("id", fx.vehicles["CAR-004"]).single()).data!;
  const { id: _id, created_at: _c, updated_at: _u, ...rest } = car;
  void _id; void _c; void _u;
  draftId = (await admin.from("vehicles").insert({ ...rest, public_code: "CAR-DRAFT", lifecycle_status: "draft", approved_at: null }).select("id").single()).data!.id;
});

describe("anonymous visitors", () => {
  it("see published listings but not drafts, bookings, quotes or applications", async () => {
    const db = anon();
    expect((await db.from("vehicles").select("public_code")).data?.map((v) => v.public_code).sort()).toEqual(["CAR-001", "CAR-002", "CAR-003", "CAR-004"]);
    expect((await db.from("bookings").select("id")).data ?? []).toEqual([]);
    expect((await db.from("partner_applications").select("id")).data ?? []).toEqual([]);
    expect((await db.from("occupancy").select("id")).data ?? []).toEqual([]);
  });
  it("cannot call booking functions", async () => {
    const r = await anon().rpc("begin_booking", { _user: fx.ids.customer1, _quote: randomUUID(), _key: "12345678", _hash: "x", _contact_name: "", _contact_phone: "" });
    expect(r.error).not.toBeNull();
  });
});

describe("customers", () => {
  it("TC-BC04: CUSTOMER-02 cannot read CUSTOMER-01's booking; CUSTOMER-01 can", async () => {
    const c1 = await signIn("test.customer");
    const c2 = await signIn("test.customer2");
    expect((await c1.client.from("bookings").select("reference").eq("id", bookingId)).data).toEqual([{ reference: "RES-TEST-001" }]);
    expect((await c2.client.from("bookings").select("reference").eq("id", bookingId)).data).toEqual([]);
    expect((await c2.client.from("bookings").select("id")).data).toEqual([]);
  });
  it("cannot escalate: roles, verification, bookings, payments and booking functions are not writable", async () => {
    const { client, userId } = await signIn("test.customer2");
    expect((await client.from("user_roles").insert({ user_id: userId, role: "admin" })).error).not.toBeNull();
    expect((await client.from("partners").insert({ owner_user_id: userId, kind: "individual", display_name: "Sneaky", verification_status: "verified" })).error).not.toBeNull();
    expect((await client.from("bookings").update({ state: "cancelled" }).eq("id", bookingId).select()).data ?? []).toEqual([]);
    expect((await client.from("bookings").insert({ reference: "X", customer_id: userId, partner_id: fx.partnerId, vehicle_id: fx.vehicles["CAR-002"], pickup_at: new Date().toISOString(), return_at: new Date(Date.now() + 1e7).toISOString(), state: "confirmed", total_cents: 1, price_snapshot: {}, vehicle_snapshot: {} })).error).not.toBeNull();
    expect((await client.rpc("finalize_booking", { _attempt: randomUUID(), _payment_ok: true, _provider_ref: "x" })).error).not.toBeNull();
    expect((await client.rpc("review_partner", { _partner: fx.partnerId, _approve: true, _reason: "" })).error?.message).toMatch(/Administrator/);
    expect((await client.from("profiles").update({ account_status: "suspended" }).eq("id", userId)).error).not.toBeNull();
    // Still only a customer afterwards.
    expect((await admin.from("user_roles").select("role").eq("user_id", userId)).data).toEqual([{ role: "customer" }]);
  });
  it("can update only their own profile name and phone", async () => {
    const { client, userId } = await signIn("test.customer2");
    expect((await client.from("profiles").update({ display_name: "Cam" }).eq("id", userId).select("display_name")).data).toEqual([{ display_name: "Cam" }]);
    expect((await client.from("profiles").update({ display_name: "Hacked" }).eq("id", fx.ids.customer1).select()).data).toEqual([]);
  });
  it("cannot edit a partner's listing or see its draft", async () => {
    const { client } = await signIn("test.customer");
    expect((await client.from("vehicles").update({ daily_rate_cents: 100 }).eq("id", fx.vehicles["CAR-001"]).select()).data ?? []).toEqual([]);
    expect((await client.from("vehicles").select("id").eq("id", draftId)).data).toEqual([]);
  });
});

describe("partners", () => {
  it("see reservations on their own vehicles only", async () => {
    const p1 = await signIn("test.partner");
    const p2 = await signIn("test.partner2");
    expect((await p1.client.from("bookings").select("reference")).data).toEqual([{ reference: "RES-TEST-001" }]);
    expect((await p2.client.from("bookings").select("reference")).data).toEqual([]);
  });
  it("cannot edit another partner's listing, change protected fields, or self-publish a draft", async () => {
    const p1 = await signIn("test.partner");
    const p2 = await signIn("test.partner2");
    expect((await p2.client.from("vehicles").update({ daily_rate_cents: 100 }).eq("id", fx.vehicles["CAR-001"]).select()).data ?? []).toEqual([]);
    expect((await p1.client.from("vehicles").select("id").eq("id", draftId)).data).toHaveLength(1);
    const publish = await p1.client.from("vehicles").update({ lifecycle_status: "published" }).eq("id", draftId);
    expect(publish.error?.message).toMatch(/approved before/);
    const steal = await p1.client.from("vehicles").update({ approved_at: new Date().toISOString() }).eq("id", draftId);
    expect(steal.error?.message).toMatch(/Protected/);
  });
  it("TC-P03 / TC-P04: the database rejects a missing or negative daily rate", async () => {
    const { client } = await signIn("test.partner");
    const neg = await client.from("vehicles").update({ daily_rate_cents: -500 }).eq("id", fx.vehicles["CAR-001"]);
    expect(neg.error?.code).toBe("23514");
    const car = (await admin.from("vehicles").select("*").eq("id", fx.vehicles["CAR-001"]).single()).data!;
    const { id: _i, daily_rate_cents: _d, created_at: _c, updated_at: _u, ...rest } = car;
    void _i; void _d; void _c; void _u;
    // @ts-expect-error daily_rate_cents is required
    const missing = await client.from("vehicles").insert({ ...rest, public_code: "CAR-NORATE", lifecycle_status: "pending_review" });
    expect(missing.error?.code).toBe("23502");
  });
});

describe("partner onboarding and admin review", () => {
  it("an application is pending and grants nothing until an admin approves it", async () => {
    const email = `applicant.${Date.now()}@carrus.test`;
    const created = await admin.auth.admin.createUser({ email, password: "Test#1234", email_confirm: true });
    const applicant = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await applicant.auth.signInWithPassword({ email, password: "Test#1234" });
    const uid = created.data.user!.id;

    const applied = await applicant.rpc("submit_partner_application", { _kind: "individual", _display_name: "New Host", _contact_email: email, _contact_phone: "", _fleet_size: 1, _notes: "" });
    expect(applied.error).toBeNull();
    const partnerId = applied.data as string;
    expect((await admin.from("partners").select("verification_status").eq("id", partnerId).single()).data).toEqual({ verification_status: "pending" });
    expect((await admin.from("user_roles").select("role").eq("user_id", uid)).data).toEqual([{ role: "customer" }]);

    const listing = { public_code: `NEW-${Date.now()}`, partner_id: partnerId, provider_id: (await admin.from("providers").select("id").eq("adapter_key", "carrus").single()).data!.id, make: "Kia", model: "Soul", year: 2022, vehicle_type: "SUV", seats: 5, location_label: "San Jose, CA", latitude: 37.33, longitude: -121.88, daily_rate_cents: 4500, pricing_policy_id: (await admin.from("pricing_policies").select("id").eq("key", "flat-fees").single()).data!.id, lifecycle_status: "pending_review" };
    // Unverified partners cannot list (unverified publication is impossible).
    expect((await applicant.from("vehicles").insert(listing)).error).not.toBeNull();
    // The applicant cannot approve themselves.
    expect((await applicant.rpc("review_partner", { _partner: partnerId, _approve: true, _reason: "" })).error).not.toBeNull();

    const adminUser = await signIn("test.admin");
    expect((await adminUser.client.rpc("review_partner", { _partner: partnerId, _approve: true, _reason: "Synthetic documents checked" })).error).toBeNull();
    expect((await admin.from("user_roles").select("role").eq("user_id", uid).order("role")).data).toEqual([{ role: "customer" }, { role: "partner" }]);

    // TC-P01: now a listing can be submitted; it is pending review and not public.
    const submitted = await applicant.from("vehicles").insert(listing).select("id, lifecycle_status").single();
    expect(submitted.data?.lifecycle_status).toBe("pending_review");
    expect((await anon().from("vehicles").select("id").eq("id", submitted.data!.id)).data).toEqual([]);
    expect((await adminUser.client.rpc("review_listing", { _vehicle: submitted.data!.id, _approve: true, _reason: "" })).error).toBeNull();
    expect((await anon().from("vehicles").select("lifecycle_status").eq("id", submitted.data!.id)).data).toEqual([{ lifecycle_status: "published" }]);

    const audit = await adminUser.client.from("audit_events").select("action").in("action", ["partner.verified", "listing.approved"]);
    expect(audit.data?.map((a) => a.action).sort()).toEqual(["listing.approved", "partner.verified"]);
    expect((await applicant.from("audit_events").select("id")).data ?? []).toEqual([]);
  });
});
