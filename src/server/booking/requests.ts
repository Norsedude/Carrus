import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/** Expires unanswered booking requests (refund + notify). Safe to call often; never throws. */
export async function expirePendingRequests(): Promise<void> {
  try {
    await createAdminClient().rpc("expire_pending_requests");
  } catch {
    // Best effort: pages still render; the next call catches up.
  }
}
