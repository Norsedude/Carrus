"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { allowRequest } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const MAX_SAVED_SEARCHES = 20;

/** Keeps only the search parameters the search page understands. */
const SEARCH_KEYS = new Set(["location", "pickup", "return", "radius", "type", "maxDaily", "seats", "maxTotal", "make", "model", "year", "sort"]);
export async function cleanSearchQuery(query: string): Promise<string> {
  const input = new URLSearchParams(query.replace(/^\?/, ""));
  const out = new URLSearchParams();
  for (const [k, v] of input) if (SEARCH_KEYS.has(k) && v.length <= 200) out.append(k, v);
  return out.toString();
}

export async function saveSearchAction(form: FormData) {
  const query = await cleanSearchQuery(text(form, "query"));
  const back = `/search?${query}`;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);
  if (!query.includes("location=") || !(await allowRequest("saveSearch", user.id))) redirect(`${back}&saved=error`);
  const db = await createClient();
  const { count } = await db.from("saved_searches").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if ((count ?? 0) >= MAX_SAVED_SEARCHES) redirect(`${back}&saved=full`);
  const name = (text(form, "name") || new URLSearchParams(query).get("location") || "Saved search").slice(0, 80);
  const { error } = await db.from("saved_searches").insert({ user_id: user.id, name, query });
  revalidatePath("/account");
  redirect(`${back}&saved=${error ? "error" : "yes"}`);
}

export async function deleteSavedSearchAction(form: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");
  const db = await createClient();
  await db.from("saved_searches").delete().eq("id", text(form, "id")).eq("user_id", user.id);
  revalidatePath("/account");
  redirect("/account#saved");
}

export async function markNotificationsReadAction() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/inbox");
  const db = await createClient();
  await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  revalidatePath("/", "layout");
  redirect("/inbox");
}
