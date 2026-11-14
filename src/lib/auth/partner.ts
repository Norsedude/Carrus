import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user's verified partner record, or a redirect to onboarding. */
export async function requireVerifiedPartner(returnTo: string) {
  const user = await requireUser(returnTo);
  const db = await createClient();
  const { data: partner } = await db
    .from("partners")
    .select("id, display_name, kind, verification_status")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!partner || partner.verification_status !== "verified") redirect("/join-the-fleet");
  return { user, partner, db };
}
