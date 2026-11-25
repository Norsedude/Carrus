import type { Db } from "@/server/vehicles/repository";

/**
 * Guest checkout: the account a booking is filed under, by email.
 * Bookings must belong to an auth user, so a guest email gets a password-less
 * account (created on first use). Nothing here signs anyone in: the person can
 * later "Create an account" / reset the password with that email to see the
 * booking under Trips. An email that already has an account simply gets the
 * booking added to it.
 */
export async function guestUserId(admin: Db, email: string, displayName: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const created = await admin.auth.admin.createUser({
    email: normalized,
    email_confirm: true,
    user_metadata: { display_name: displayName.slice(0, 80), guest_checkout: true },
  });
  if (created.data.user) return created.data.user.id;

  // Already registered: look the account up (small class-project user base).
  const perPage = 200;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`guest lookup failed: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (match) return match.id;
    if (data.users.length < perPage) break;
  }
  throw new Error(`could not create or find an account for the guest email: ${created.error?.message ?? "unknown"}`);
}
