import { beforeEach, describe, expect, it } from "vitest";
import { INSPECTION_BUCKET, getInspections, recordPickupCheck, type PickupCheckInput } from "@/server/inspections/service";
import { seedSanjay } from "../../scripts/seed";
import { admin, signIn } from "./helpers";

// F6 pickup condition check, against the local Supabase stack with the Sanjay
// fixture profile (reservations #1001-#1003 from test data Table 4).

let fx: Awaited<ReturnType<typeof seedSanjay>>;

// Smallest valid file headers; the service checks the bytes, not the name.
const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];
const jpg = (name: string, size = 2048) => {
  const bytes = new Uint8Array(size);
  bytes.set(JPEG_HEAD);
  return new File([bytes], name, { type: "image/jpeg" });
};
const pdf = (name: string) => new File([new TextEncoder().encode("%PDF-1.7\n%%EOF")], name, { type: "application/pdf" });

const fullCheck = (): PickupCheckInput => ({
  exteriorDamage: "None",
  fuelLevel: "Full",
  cleanliness: "Clean",
  acknowledged: true,
  photos: { exterior: jpg("front.jpg"), fuel_gauge: jpg("fuel.jpg"), interior: jpg("interior.jpg") },
});

const booking = async (ref: string) =>
  (await admin.from("bookings").select("id, state, ready_at").eq("reference", ref).single()).data!;
const filesFor = async (bookingId: string) =>
  (await admin.storage.from(INSPECTION_BUCKET).list(`${bookingId}/pickup`)).data ?? [];

beforeEach(async () => {
  fx = await seedSanjay();
});

describe("TC-PC01: partner prepares the vehicle", () => {
  it("marks #1001 ready for pickup with a saved timestamp", async () => {
    const { client } = await signIn("test.partner");
    const { error } = await client.rpc("mark_ready_for_pickup", { _booking: fx.reservations["#1001"], _vehicle_clean: true, _fuel_full: true });
    expect(error).toBeNull();
    const b = await booking("#1001");
    expect(b.state).toBe("ready_for_pickup");
    expect(b.ready_at).not.toBeNull();
  });
  it("requires both confirmations and only works once", async () => {
    const { client } = await signIn("test.partner");
    const id = fx.reservations["#1001"];
    expect((await client.rpc("mark_ready_for_pickup", { _booking: id, _vehicle_clean: true, _fuel_full: false })).error?.message)
      .toMatch(/clean and the fuel level is Full/);
    expect((await booking("#1001")).state).toBe("confirmed");
    expect((await client.rpc("mark_ready_for_pickup", { _booking: id, _vehicle_clean: true, _fuel_full: true })).error).toBeNull();
    expect((await client.rpc("mark_ready_for_pickup", { _booking: id, _vehicle_clean: true, _fuel_full: true })).error?.message)
      .toMatch(/Only a confirmed/);
  });
  it("cannot be done by another partner or by the customer", async () => {
    const id = fx.reservations["#1001"];
    for (const name of ["test.partner2", "test.customer"] as const) {
      const { client } = await signIn(name);
      expect((await client.rpc("mark_ready_for_pickup", { _booking: id, _vehicle_clean: true, _fuel_full: true })).error?.message)
        .toMatch(/Reservation not found/);
    }
    expect((await booking("#1001")).state).toBe("confirmed");
  });
});

describe("TC-PC02: customer completes the condition check", () => {
  it("saves the three values and three photos, and moves #1002 to active", async () => {
    const id = fx.reservations["#1002"];
    expect(await recordPickupCheck(admin, fx.ids.customer1, id, fullCheck())).toEqual({ ok: true });
    expect((await booking("#1002")).state).toBe("active");
    expect(await filesFor(id)).toHaveLength(3);

    const customer = await signIn("test.customer");
    const [record] = await getInspections(customer.client, admin, id);
    expect(record).toMatchObject({ stage: "pickup", performedRole: "customer", exteriorDamage: "None", fuelLevel: "Full", cleanliness: "Clean" });
    expect(record.photos.map((p) => p.category)).toEqual(["exterior", "fuel_gauge", "interior"]);
    expect(record.photos.every((p) => p.url && p.uploadedAt)).toBe(true);
    expect((await fetch(record.photos[0].url!)).status).toBe(200);

    // The partner sees the same record.
    const partner = await signIn("test.partner");
    expect((await getInspections(partner.client, admin, id)).map((r) => r.photos.length)).toEqual([3]);
  });
  it("is visible only to the booking's customer, its partner and admins", async () => {
    const id = fx.reservations["#1002"];
    await recordPickupCheck(admin, fx.ids.customer1, id, fullCheck());
    for (const name of ["test.customer2", "test.partner2"] as const) {
      const { client } = await signIn(name);
      expect(await getInspections(client, admin, id)).toEqual([]);
      expect((await client.from("inspection_photos").select("id")).data).toEqual([]);
    }
    const adminUser = await signIn("test.admin");
    expect(await getInspections(adminUser.client, admin, id)).toHaveLength(1);
  });
  it("cannot be submitted twice, by another customer, or straight from the browser", async () => {
    const id = fx.reservations["#1002"];
    expect((await recordPickupCheck(admin, fx.ids.customer2, id, fullCheck())).ok).toBe(false);
    expect(await recordPickupCheck(admin, fx.ids.customer1, id, fullCheck())).toEqual({ ok: true });
    expect((await recordPickupCheck(admin, fx.ids.customer1, id, fullCheck())).ok).toBe(false);
    expect(await filesFor(id)).toHaveLength(3); // the rejected attempts left no extra files

    const { client } = await signIn("test.customer");
    const direct = await client.rpc("record_pickup_inspection", {
      _actor: fx.ids.customer1, _booking: id, _exterior_damage: "None", _fuel_level: "Full", _cleanliness: "Clean", _photos: [],
    });
    expect(direct.error).not.toBeNull();
    expect((await client.from("inspections").update({ fuel_level: "Empty" }).eq("booking_id", id).select()).data ?? []).toEqual([]);
  });
  it("keeps the photo bucket private", async () => {
    const id = fx.reservations["#1002"];
    await recordPickupCheck(admin, fx.ids.customer1, id, fullCheck());
    const [file] = await filesFor(id);
    const { client } = await signIn("test.customer");
    expect((await client.storage.from(INSPECTION_BUCKET).download(`${id}/pickup/${file.name}`)).error).not.toBeNull();
    expect((await client.storage.from(INSPECTION_BUCKET).upload(`${id}/pickup/extra.jpg`, jpg("extra.jpg"))).error).not.toBeNull();
  });
});

describe("TC-PC03 and TC-PC04: rejected uploads save nothing", () => {
  it("TC-PC03: a missing interior photo blocks the whole check", async () => {
    const id = fx.reservations["#1003"];
    const input = fullCheck();
    delete input.photos.interior;
    expect(await recordPickupCheck(admin, fx.ids.customer1, id, input)).toEqual({
      ok: false,
      message: "Add a photo for each category: interior is missing.",
      fieldErrors: {},
    });
    expect((await booking("#1003")).state).toBe("ready_for_pickup");
    expect(await filesFor(id)).toHaveLength(0);
  });
  it("TC-PC04: notes.pdf and big.jpg are refused with their messages", async () => {
    const id = fx.reservations["#1003"];
    const withPdf = fullCheck();
    withPdf.photos.exterior = pdf("notes.pdf");
    expect(await recordPickupCheck(admin, fx.ids.customer1, id, withPdf)).toMatchObject({
      ok: false, fieldErrors: { exterior: "Only JPG or PNG files are allowed." },
    });
    const withBig = fullCheck();
    withBig.photos.exterior = jpg("big.jpg", 12 * 1024 * 1024);
    expect(await recordPickupCheck(admin, fx.ids.customer1, id, withBig)).toMatchObject({
      ok: false, fieldErrors: { exterior: "File must be 10 MB or smaller." },
    });
    expect((await booking("#1003")).state).toBe("ready_for_pickup");
    expect(await filesFor(id)).toHaveLength(0);
  });
});

describe("Sanjay seed", () => {
  it("keeps the TST units out of search and leaves #1001 confirmed", async () => {
    const codes = (await admin.from("vehicles").select("public_code, lifecycle_status").like("public_code", "TST-%")).data ?? [];
    expect(codes.map((c) => c.lifecycle_status)).toEqual(["archived", "archived", "archived"]);
    expect((await booking("#1001")).state).toBe("confirmed");
  });
});
