import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";

// Fixed-window rate limits stored in Postgres (works across serverless
// instances). On in production, or when RATE_LIMIT_ENABLED=true; local dev
// and the test suites skip it so repeated sign-ins never trip it.

export const LIMITS = {
  login: { limit: 20, windowSeconds: 600 },
  signup: { limit: 8, windowSeconds: 3600 },
  passwordReset: { limit: 6, windowSeconds: 3600 },
  guestCheckout: { limit: 20, windowSeconds: 3600 },
  linkPreview: { limit: 30, windowSeconds: 600 },
  saveSearch: { limit: 40, windowSeconds: 3600 },
  api: { limit: 120, windowSeconds: 60 },
} as const;
export type LimitName = keyof typeof LIMITS;

export function rateLimitEnabled(): boolean {
  return process.env.RATE_LIMIT_ENABLED === "true" || (process.env.NODE_ENV === "production" && process.env.RATE_LIMIT_ENABLED !== "false");
}

/** Best-effort client address from the proxy headers Vercel sets. */
export async function clientAddress(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
}

/**
 * true when the request may proceed. Fails open if the limiter itself is
 * unavailable, so an outage never locks everyone out.
 */
export async function allowRequest(name: LimitName, extraKey = ""): Promise<boolean> {
  if (!rateLimitEnabled()) return true;
  const { limit, windowSeconds } = LIMITS[name];
  const bucket = `${name}:${await clientAddress()}${extraKey ? `:${extraKey.toLowerCase().slice(0, 120)}` : ""}`;
  try {
    const { data, error } = await createAdminClient().rpc("hit_rate_limit", { _bucket: bucket, _limit: limit, _window_seconds: windowSeconds });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

export const RATE_LIMITED_MESSAGE = "Too many attempts. Please wait a few minutes and try again.";
