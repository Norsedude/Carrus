/**
 * Deterministic fixture profiles for local/test databases only.
 *
 *   npm run seed:mateo              four SJC vehicles (TC-S / TC-C / TC-B / TC-P)
 *   npm run seed:mateo -- --with-reservation    also creates RES-TEST-001
 *   npm run seed:sanjay             seven San Jose vehicles (TC-FR / TC-PT)
 *   npm run seed:demo               six photographed showcase vehicles, available for the next year
 *   npm run test:reset              remove all app data and fixture users
 *
 * Each seed command resets first, so profiles never mix. The script refuses to
 * run unless the Supabase host is in TEST_DATABASE_ALLOWLIST and APP_ENV is
 * development or test. It is a CLI only; there is no HTTP route for it.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";
import { zonedLocalToUtc } from "../src/lib/time";
import { calculatePrice, type PolicyFormula } from "../src/server/pricing/pricing";
import { offsetByMiles } from "../src/server/search/location";

config({ path: ".env.local", quiet: true });

const TZ = "America/Los_Angeles";
export const FIXTURE_PASSWORD = "Test#1234"; // public demo data from the test plan; never a real password
const FIXTURE_DOMAIN = "@carrus.test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";
const appEnv = process.env.APP_ENV ?? "development";
const allowlist = (process.env.TEST_DATABASE_ALLOWLIST ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function assertSafeTarget() {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing or invalid");
  }
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is missing");
  if (appEnv !== "development" && appEnv !== "test") {
    throw new Error(`Refusing to seed/reset: APP_ENV is "${appEnv}"`);
  }
  if (!allowlist.includes(host)) {
    throw new Error(`Refusing to seed/reset: host "${host}" is not in TEST_DATABASE_ALLOWLIST`);
  }
}

const db = createClient<Database>(url || "http://invalid.local", secret || "invalid", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const local = (s: string) => {
  const d = zonedLocalToUtc(s, TZ);
  if (!d) throw new Error(`bad fixture time ${s}`);
  return d;
};

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

export async function reset() {
  assertSafeTarget();
  const tables = [
    "payments", "booking_attempts", "occupancy", "bookings", "quotes",
    "availability_windows", "vehicle_photos", "vehicles", "partner_applications", "partners",
  ] as const;
  for (const table of tables) {
    await must(db.from(table).delete().not("id", "is", null), `clear ${table}`);
  }
  await must(db.from("audit_events").delete().gt("id", 0), "clear audit_events");
  const users = await db.auth.admin.listUsers({ perPage: 1000 });
  if (users.error) throw new Error(users.error.message);
  for (const u of users.data.users) {
    if (u.email?.endsWith(FIXTURE_DOMAIN)) {
      const res = await db.auth.admin.deleteUser(u.id);
      if (res.error) throw new Error(`delete ${u.email}: ${res.error.message}`);
    }
  }
}

async function createUser(email: string, displayName: string): Promise<string> {
  const res = await db.auth.admin.createUser({
    email,
    password: FIXTURE_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (res.error || !res.data.user) throw new Error(`create ${email}: ${res.error?.message}`);
  return res.data.user.id;
}

type Ids = { customer1: string; customer2: string; partner1: string; partner2: string; admin: string };

/** Separate customer, partner and admin identities (the source data mislabels the partner as test.admin). */
async function seedUsers(): Promise<Ids> {
  const ids: Ids = {
    customer1: await createUser(`test.customer${FIXTURE_DOMAIN}`, "Casey Customer (CUSTOMER-01)"),
    customer2: await createUser(`test.customer2${FIXTURE_DOMAIN}`, "Cameron Customer (CUSTOMER-02)"),
    partner1: await createUser(`test.partner${FIXTURE_DOMAIN}`, "Parker Partner (PARTNER-01)"),
    partner2: await createUser(`test.partner2${FIXTURE_DOMAIN}`, "Peyton Partner (PARTNER-02)"),
    admin: await createUser(`test.admin${FIXTURE_DOMAIN}`, "Avery Admin"),
  };
  await must(db.from("user_roles").insert([
    { user_id: ids.partner1, role: "partner" },
    { user_id: ids.partner2, role: "partner" },
    { user_id: ids.admin, role: "admin" },
  ]), "grant roles");
  return ids;
}

async function seedPartner(owner: string, displayName: string, kind: "individual" | "company", email: string) {
  const partner = await must(
    db.from("partners").insert({ owner_user_id: owner, kind, display_name: displayName, verification_status: "verified" }).select("id").single(),
    "partner",
  );
  await must(db.from("partner_applications").insert({ partner_id: partner!.id, contact_email: email, fleet_size: 4, reviewed_at: new Date().toISOString() }), "application");
  return partner!.id;
}

async function lookups() {
  const provider = await must(db.from("providers").select("id").eq("adapter_key", "carrus").single(), "provider");
  const policies = await must(db.from("pricing_policies").select("id, key, version, formula"), "policies");
  const byKey = (key: string) => {
    const p = policies!.find((x) => x.key === key);
    if (!p) throw new Error(`pricing policy ${key} missing`);
    return p;
  };
  return { providerId: provider!.id, flat: byKey("flat-fees"), protection: byKey("protection-tax") };
}

type VehicleSeed = {
  code: string; make: string; model: string; year: number; color: string;
  type: "Sedan" | "SUV" | "Sports" | "Luxury" | "Minivan" | "Van" | "Truck"; seats: number; daily: number;
  miles: number; bearing: number; windowEnd: string; description: string;
  /** Public path under /public, e.g. /vehicles/ford-mustang.jpg */
  photo?: string; transmission?: "Automatic" | "Manual";
};

async function insertVehicles(
  partnerId: string, providerId: string, policyId: string, label: string,
  origin: { lat: number; lng: number }, windowStart: string, vehicles: VehicleSeed[],
  windowStartAt?: Date, windowEndAt?: Date,
) {
  const out: Record<string, string> = {};
  for (const v of vehicles) {
    const at = offsetByMiles(origin, v.miles, v.bearing);
    const row = await must(
      db.from("vehicles").insert({
        public_code: v.code, partner_id: partnerId, provider_id: providerId,
        make: v.make, model: v.model, year: v.year, color: v.color, vehicle_type: v.type,
        seats: v.seats, transmission: v.transmission ?? "Automatic", description: v.description, location_label: label,
        latitude: at.lat, longitude: at.lng, time_zone: TZ, daily_rate_cents: v.daily * 100,
        pricing_policy_id: policyId, booking_mode: "instant", lifecycle_status: "published",
        approved_at: new Date().toISOString(),
      }).select("id").single(),
      `vehicle ${v.code}`,
    );
    out[v.code] = row!.id;
    await must(db.from("availability_windows").insert({
      vehicle_id: row!.id,
      start_at: (windowStartAt ?? local(windowStart)).toISOString(),
      end_at: (windowEndAt ?? local(v.windowEnd)).toISOString(),
    }), `window ${v.code}`);
    if (v.photo) {
      await must(db.from("vehicle_photos").insert({ vehicle_id: row!.id, storage_path: v.photo, position: 0, is_primary: true }), `photo ${v.code}`);
    }
  }
  return out;
}

export async function seedMateo(withReservation: boolean) {
  await reset();
  const ids = await seedUsers();
  const { providerId, flat } = await lookups();
  const partnerId = await seedPartner(ids.partner1, "Bay Area Rides (PARTNER-01)", "company", `test.partner${FIXTURE_DOMAIN}`);
  await seedPartner(ids.partner2, "Second Street Cars (PARTNER-02)", "individual", `test.partner2${FIXTURE_DOMAIN}`);
  const sjc = { lat: 37.3639, lng: -121.9289 };
  // CAR-001/003/004 are available through Dec 14 10:00; only CAR-002 covers Dec 14-17 (TC-S02).
  const early = "2026-12-14T10:00";
  const vehicles = await insertVehicles(partnerId, providerId, flat.id, "San José Mineta International Airport (SJC)", sjc, "2026-12-01T00:00", [
    { code: "CAR-001", make: "Toyota", model: "Camry", year: 2024, color: "Silver", type: "Sedan", seats: 5, daily: 60, miles: 0.3, bearing: 20, windowEnd: early, description: "Silver sedan. Comfortable for five with room for luggage." },
    { code: "CAR-002", make: "Honda", model: "CR-V", year: 2024, color: "White", type: "SUV", seats: 5, daily: 70, miles: 0.5, bearing: 110, windowEnd: "2027-01-31T10:00", description: "Compact SUV with a large cargo area." },
    { code: "CAR-003", make: "Toyota", model: "Corolla", year: 2024, color: "Blue", type: "Sedan", seats: 5, daily: 50, miles: 0.7, bearing: 200, windowEnd: early, description: "Efficient compact sedan." },
    { code: "CAR-004", make: "Ford", model: "Explorer", year: 2024, color: "Black", type: "SUV", seats: 7, daily: 90, miles: 0.9, bearing: 290, windowEnd: early, description: "Three-row SUV that seats seven." },
  ]);

  if (withReservation) {
    const pickupAt = local("2026-12-10T10:00");
    const returnAt = local("2026-12-13T10:00");
    const price = calculatePrice({
      dailyRateCents: 6000, pickupAt, returnAt,
      policy: { id: flat.id, key: flat.key, version: flat.version, formula: flat.formula as PolicyFormula },
    });
    if (price.totalCents !== 24000) throw new Error("RES-TEST-001 fixture should total $240.00");
    const snapshot = {
      vehicleId: vehicles["CAR-001"], publicCode: "CAR-001", make: "Toyota", model: "Camry", year: 2024,
      color: "Silver", vehicleType: "Sedan", seats: 5, transmission: "Automatic",
      locationLabel: "San José Mineta International Airport (SJC)", timeZone: TZ, dailyRateCents: 6000,
      pricingPolicyId: flat.id, partnerId, partnerName: "Bay Area Rides (PARTNER-01)",
      bookingMode: "instant", cancellationPolicy: "free_24h",
    };
    const booking = await must(db.from("bookings").insert({
      reference: "RES-TEST-001", customer_id: ids.customer1, partner_id: partnerId,
      vehicle_id: vehicles["CAR-001"], pickup_at: pickupAt.toISOString(), return_at: returnAt.toISOString(),
      state: "confirmed", total_cents: price.totalCents,
      price_snapshot: JSON.parse(JSON.stringify(price)), vehicle_snapshot: snapshot,
      contact_name: "Casey Customer", contact_phone: "408-555-0101",
    }).select("id").single(), "RES-TEST-001");
    await must(db.from("occupancy").insert({
      vehicle_id: vehicles["CAR-001"], kind: "booking", booking_id: booking!.id,
      period: `[${pickupAt.toISOString()},${returnAt.toISOString()})`,
    }), "RES-TEST-001 occupancy");
  }
  return { ids, partnerId, vehicles };
}

export async function seedSanjay() {
  await reset();
  const ids = await seedUsers();
  const { providerId, protection } = await lookups();
  const partnerId = await seedPartner(ids.partner1, "South Bay Fleet (PARTNER-01)", "company", `test.partner${FIXTURE_DOMAIN}`);
  await seedPartner(ids.partner2, "Second Street Cars (PARTNER-02)", "individual", `test.partner2${FIXTURE_DOMAIN}`);
  const sanJose = { lat: 37.3382, lng: -121.8863 };
  const end = "2027-02-28T23:00";
  const vehicles = await insertVehicles(partnerId, providerId, protection.id, "San Jose, CA", sanJose, "2027-01-01T00:00", [
    { code: "SJ-CIVIC", make: "Honda", model: "Civic", year: 2019, color: "Gray", type: "Sedan", seats: 5, daily: 41, miles: 2.0, bearing: 30, windowEnd: end, description: "Reliable compact sedan." },
    { code: "SJ-EQUINOX", make: "Chevrolet", model: "Equinox", year: 2022, color: "Red", type: "SUV", seats: 5, daily: 63, miles: 4.4, bearing: 80, windowEnd: end, description: "Mid-size SUV." },
    { code: "SJ-RAV4", make: "Toyota", model: "RAV4", year: 2024, color: "White", type: "SUV", seats: 5, daily: 68, miles: 3.2, bearing: 130, windowEnd: end, description: "Popular compact SUV." },
    { code: "SJ-CRV", make: "Honda", model: "CR-V", year: 2023, color: "Blue", type: "SUV", seats: 5, daily: 72, miles: 5.8, bearing: 180, windowEnd: end, description: "Compact SUV with a large cargo area." },
    { code: "SJ-SIENNA", make: "Toyota", model: "Sienna", year: 2024, color: "Silver", type: "Minivan", seats: 8, daily: 81, miles: 8.1, bearing: 230, windowEnd: end, description: "Eight-seat minivan for families and groups." },
    { code: "SJ-F150", make: "Ford", model: "F-150", year: 2021, color: "Black", type: "Truck", seats: 5, daily: 95, miles: 12.0, bearing: 280, windowEnd: end, description: "Full-size pickup truck." },
    { code: "SJ-TRANSIT", make: "Ford", model: "Transit", year: 2023, color: "White", type: "Van", seats: 15, daily: 120, miles: 9.5, bearing: 330, windowEnd: end, description: "Fifteen-passenger van." },
  ]);
  return { ids, partnerId, vehicles };
}

/**
 * Showcase profile for demos. Original mock listings modeled on the vehicles
 * in the team's Figma mockup, with that file's photos. Hosts are fictional.
 * Available from today for one year so the home page's default dates work.
 */
export async function seedDemo() {
  await reset();
  const ids = await seedUsers();
  const { providerId, protection } = await lookups();
  const fleet = await seedPartner(ids.partner1, "Bay Area Rides", "company", `test.partner${FIXTURE_DOMAIN}`);
  const host = await seedPartner(ids.partner2, "Second Street Cars", "individual", `test.partner2${FIXTURE_DOMAIN}`);
  const sanJose = { lat: 37.3382, lng: -121.8863 };
  const start = new Date(new Date().setUTCHours(0, 0, 0, 0));
  const end = new Date(start.getTime() + 365 * 86_400_000);
  const base = { windowEnd: "" };
  const hostCars = await insertVehicles(host, providerId, protection.id, "San Jose, CA", sanJose, "", [
    { ...base, code: "CR-MUSTANG", make: "Ford", model: "Mustang", year: 2024, color: "Gray", type: "Sports", seats: 4, daily: 46, miles: 0.7, bearing: 35, photo: "/vehicles/ford-mustang.jpg", description: "Dark Horse trim in carbonized gray. A weekend coupe with a usable trunk and Apple CarPlay." },
    { ...base, code: "CR-720S", make: "McLaren", model: "720S", year: 2026, color: "White", type: "Luxury", seats: 2, daily: 561, miles: 4.8, bearing: 150, photo: "/vehicles/mclaren-720s.jpg", description: "Two-seat supercar in pearl white. Delivered with a walkthrough of the controls at pickup." },
    { ...base, code: "CR-DEFENDER", make: "Land Rover", model: "Defender", year: 2025, color: "Green", type: "SUV", seats: 5, daily: 189, miles: 3.2, bearing: 250, photo: "/vehicles/land-rover-defender.jpg", description: "Defender 110 with all-terrain tires and a roof rack. Suited to mountain and coast trips." },
  ], start, end);
  const fleetCars = await insertVehicles(fleet, providerId, protection.id, "San Jose, CA", sanJose, "", [
    { ...base, code: "CR-M2", make: "BMW", model: "M2", year: 2025, color: "Blue", type: "Sports", seats: 4, daily: 129, miles: 2.1, bearing: 95, photo: "/vehicles/bmw-m2.jpg", description: "Compact performance coupe in Portimao blue with an automatic gearbox." },
    { ...base, code: "CR-LANDCRUISER", make: "Toyota", model: "Land Cruiser", year: 2024, color: "Silver", type: "SUV", seats: 7, daily: 98, miles: 1.4, bearing: 200, photo: "/vehicles/toyota-land-cruiser.jpg", description: "Three-row SUV with four-wheel drive. Room for seven and their luggage." },
    { ...base, code: "CR-EXPLORER", make: "Ford", model: "Explorer", year: 2024, color: "White", type: "SUV", seats: 7, daily: 84, miles: 2.0, bearing: 310, photo: "/vehicles/ford-explorer.jpg", description: "Seven-seat family SUV with a power liftgate and adaptive cruise control." },
  ], start, end);
  return { ids, vehicles: { ...hostCars, ...fleetCars } };
}

async function main() {
  const [command, ...flags] = process.argv.slice(2);
  if (command === "mateo") {
    await seedMateo(flags.includes("--with-reservation"));
    console.log(`Seeded Mateo profile${flags.includes("--with-reservation") ? " with RES-TEST-001" : ""}.`);
  } else if (command === "sanjay") {
    await seedSanjay();
    console.log("Seeded Sanjay profile (search inventory; reservations #1001-#1011 are not implemented yet).");
  } else if (command === "demo") {
    await seedDemo();
    console.log("Seeded demo showcase profile (six photographed vehicles in San Jose, available for one year).");
  } else if (command === "reset") {
    await reset();
    console.log("Removed app data and fixture users.");
  } else {
    console.error("Usage: tsx scripts/seed.ts <demo | mateo [--with-reservation] | sanjay | reset>");
    process.exit(2);
  }
  if (command !== "reset") {
    console.log(`Fixture sign-ins (password ${FIXTURE_PASSWORD}): test.customer, test.customer2, test.partner, test.partner2, test.admin ${FIXTURE_DOMAIN}`);
  }
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/seed.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
