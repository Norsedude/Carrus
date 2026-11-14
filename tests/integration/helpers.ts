import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { zonedLocalToUtc } from "@/lib/time";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const options = { auth: { persistSession: false, autoRefreshToken: false } };

export type Db = SupabaseClient<Database>;

/** Privileged client, as used by server services. */
export const admin: Db = createClient<Database>(url, secret, options);

/** Anonymous visitor: publishable key, no session. Subject to RLS. */
export function anon(): Db {
  return createClient<Database>(url, publishable, options);
}

/** A signed-in fixture user. Subject to RLS exactly like the website. */
export async function signIn(name: "test.customer" | "test.customer2" | "test.partner" | "test.partner2" | "test.admin") {
  const client = createClient<Database>(url, publishable, options);
  const { data, error } = await client.auth.signInWithPassword({ email: `${name}@carrus.test`, password: "Test#1234" });
  if (error || !data.user) throw new Error(`sign in ${name}: ${error?.message}`);
  return { client, userId: data.user.id };
}

export const at = (local: string) => zonedLocalToUtc(local, "America/Los_Angeles")!;
export const MATEO = { pickup: at("2026-12-10T10:00"), ret: at("2026-12-13T10:00") };
