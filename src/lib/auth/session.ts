import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "customer" | "partner" | "admin";
export type SessionUser = { id: string; email: string; displayName: string; roles: Role[] };

/**
 * The signed-in user, verified with the Auth server (not just a decoded
 * cookie), plus roles read from the protected user_roles table. Roles never
 * come from the browser, the email address, or user-editable metadata.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", data.user.id),
    supabase.from("profiles").select("display_name").eq("id", data.user.id).maybeSingle(),
  ]);
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    displayName: profile?.display_name ?? "",
    roles: (roles ?? []).map((r) => r.role as Role),
  };
});

/** Only same-site relative paths are allowed as post-login destinations. */
export function safeReturnPath(next: string | undefined | null, fallback = "/account"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeReturnPath(returnTo, "/"))}`);
  return user;
}

export async function requireRole(role: Role, returnTo: string): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!user.roles.includes(role)) redirect("/account?denied=1");
  return user;
}
