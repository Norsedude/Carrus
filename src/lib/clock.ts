import { serverEnv } from "@/lib/env";

/**
 * Application clock for validation rules (for example "pickup must be in the
 * future"). CARRUS_FIXED_NOW pins it for deterministic fixtures, and is
 * honored only in development and test, never in preview or production.
 * Database hold expiry always uses the real database clock.
 */
export function getNow(): Date {
  const env = serverEnv();
  if (env.CARRUS_FIXED_NOW && (env.APP_ENV === "development" || env.APP_ENV === "test")) {
    return new Date(env.CARRUS_FIXED_NOW);
  }
  return new Date();
}
