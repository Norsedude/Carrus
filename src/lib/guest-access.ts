import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Guest checkout access. A guest has no session, so after a guest checkout the
// server adds that booking (or demo order) id to a signed, http-only cookie.
// It lets this browser re-open only the confirmations it created; it never
// grants access to an account's other trips.

const COOKIE = "carrus_guest";
const MAX_IDS = 20;

type Access = { bookings: string[]; orders: string[] };
const EMPTY: Access = { bookings: [], orders: [] };

function secret(): string {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is required for guest checkout");
  return key;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(`carrus-guest:${payload}`).digest("base64url");
}

function decode(raw: string | undefined): Access {
  if (!raw) return EMPTY;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return EMPTY;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return EMPTY;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<Access>;
    const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)) : []);
    return { bookings: ids(parsed.bookings), orders: ids(parsed.orders) };
  } catch {
    return EMPTY;
  }
}

export async function readGuestAccess(): Promise<Access> {
  return decode((await cookies()).get(COOKIE)?.value);
}

/** Server actions only: remember that this browser made this booking/order. */
export async function grantGuestAccess(kind: "booking" | "order", id: string): Promise<void> {
  const jar = await cookies();
  const current = decode(jar.get(COOKIE)?.value);
  const key = kind === "booking" ? "bookings" : "orders";
  const next: Access = { ...current, [key]: [id, ...current[key].filter((x) => x !== id)].slice(0, MAX_IDS) };
  const payload = Buffer.from(JSON.stringify(next)).toString("base64url");
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
