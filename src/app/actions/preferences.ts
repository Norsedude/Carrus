"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { PREFS_COOKIE, THEMES, getPreferences, preferencesSchema, type Preferences } from "@/lib/preferences";

const ONE_YEAR = 60 * 60 * 24 * 365;

async function write(prefs: Preferences) {
  (await cookies()).set(PREFS_COOKIE, JSON.stringify(prefs), {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}

/** Header toggle: change only the theme. */
export async function setThemeAction(theme: string) {
  if (!(THEMES as readonly string[]).includes(theme)) return;
  const current = await getPreferences();
  await write({ ...current, theme: theme as Preferences["theme"] });
}

export type PreferencesState = { message?: string; saved?: boolean };

/** Account page: save every preference at once. */
export async function savePreferencesAction(_prev: PreferencesState, form: FormData): Promise<PreferencesState> {
  const parsed = preferencesSchema.safeParse({
    theme: form.get("theme"),
    accent: form.get("accent"),
    density: form.get("density"),
    motion: form.get("motion"),
    homeLocation: String(form.get("homeLocation") ?? ""),
    radius: Number(form.get("radius")),
    types: form.getAll("types").map(String),
    minSeats: Number(form.get("minSeats")),
  });
  if (!parsed.success) return { message: "Some preferences could not be saved. Check the values and try again." };
  await write(parsed.data);
  revalidatePath("/", "layout");
  return { saved: true, message: "Preferences saved on this device." };
}
