import { z } from "zod";
import { KNOWN_LOCATIONS } from "@/server/search/location";
import { VEHICLE_TYPES } from "@/server/search/types";

// Per-browser display and search preferences, kept in a cookie so the server
// can render the chosen theme on the first paint (no flash) and prefill
// searches. No database change is needed.

export const PREFS_COOKIE = "carrus_prefs";
export const THEMES = ["light", "dark", "system"] as const;
export const ACCENTS = ["cobalt", "sage", "sand", "clay", "graphite"] as const;
export const ACCENT_LABELS: Record<(typeof ACCENTS)[number], { label: string; swatch: string }> = {
  graphite: { label: "Graphite", swatch: "#3d3d3b" },
  sand: { label: "Sand", swatch: "#b8925a" },
  sage: { label: "Sage", swatch: "#6f8f76" },
  cobalt: { label: "Cobalt", swatch: "#4a64d8" },
  clay: { label: "Clay", swatch: "#c06a50" },
};

const locationLabels = KNOWN_LOCATIONS.map((l) => l.label);

export const preferencesSchema = z.object({
  theme: z.enum(THEMES).catch("system"),
  accent: z.enum(ACCENTS).catch("cobalt"),
  density: z.enum(["comfortable", "compact"]).catch("comfortable"),
  motion: z.enum(["full", "reduced"]).catch("full"),
  homeLocation: z.string().refine((v) => v === "" || locationLabels.includes(v)).catch(""),
  radius: z.number().int().min(1).max(100).catch(25),
  types: z.array(z.enum(VEHICLE_TYPES)).max(VEHICLE_TYPES.length).catch([]),
  minSeats: z.number().int().min(1).max(15).catch(1),
});

export type Preferences = z.infer<typeof preferencesSchema>;
export const DEFAULT_PREFERENCES: Preferences = preferencesSchema.parse({});

export function parsePreferences(raw: string | undefined): Preferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    return preferencesSchema.parse(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Server-only: the current request's preferences. */
export async function getPreferences(): Promise<Preferences> {
  const { cookies } = await import("next/headers");
  return parsePreferences((await cookies()).get(PREFS_COOKIE)?.value);
}

/** Search params a preference-aware search should start with. */
export function preferenceSearchParams(prefs: Preferences): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  if (prefs.radius !== 25) params.radius = String(prefs.radius);
  if (prefs.minSeats > 1) params.seats = String(prefs.minSeats);
  if (prefs.types.length) params.type = prefs.types;
  return params;
}
