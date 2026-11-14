import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { ProfileForm } from "@/components/auth-forms";
import { Badge, Notice, PageShell, btnSecondary, cardCls, linkCls } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ notice?: string; denied?: string }> }) {
  const user = await requireUser("/account");
  const { notice, denied } = await searchParams;
  const db = await createClient();
  const [{ data: profile }, { data: partner }] = await Promise.all([
    db.from("profiles").select("display_name, phone").eq("id", user.id).maybeSingle(),
    db.from("partners").select("display_name, verification_status").eq("owner_user_id", user.id).maybeSingle(),
  ]);

  return (
    <PageShell title="Account">
      <div className="space-y-4">
        {notice === "password-changed" && <Notice tone="success">Your password was changed.</Notice>}
        {denied && <Notice tone="error">Your account does not have access to that page.</Notice>}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className={`${cardCls} p-5`} aria-labelledby="profile-heading">
            <h2 id="profile-heading" className="text-base font-semibold text-slate-900">Profile</h2>
            <p className="mb-4 mt-1 text-sm text-slate-700">
              Signed in as <span className="font-medium" data-testid="account-email">{user.email}</span>
            </p>
            <ProfileForm displayName={profile?.display_name ?? ""} phone={profile?.phone ?? ""} />
          </section>
          <div className="space-y-6">
            <section className={`${cardCls} p-5`} aria-labelledby="access-heading">
              <h2 id="access-heading" className="text-base font-semibold text-slate-900">Access</h2>
              <p className="mt-2 flex flex-wrap gap-1.5">
                {user.roles.map((r) => (
                  <Badge key={r} tone="blue">{r}</Badge>
                ))}
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li><Link href="/trips" className={linkCls}>My trips</Link></li>
                {partner ? (
                  <li>
                    <Link href={partner.verification_status === "verified" ? "/partner" : "/join-the-fleet"} className={linkCls}>
                      Rental Partner: {partner.display_name} ({partner.verification_status})
                    </Link>
                  </li>
                ) : (
                  <li><Link href="/join-the-fleet" className={linkCls}>Join the Fleet as a Rental Partner</Link></li>
                )}
                {user.roles.includes("admin") && <li><Link href="/admin" className={linkCls}>Administration</Link></li>}
              </ul>
            </section>
            <section className={`${cardCls} p-5`} aria-labelledby="security-heading">
              <h2 id="security-heading" className="text-base font-semibold text-slate-900">Security</h2>
              <p className="mt-2 text-sm"><Link href="/forgot-password" className={linkCls}>Send me a password reset link</Link></p>
              <form action={logoutAction} className="mt-4">
                <button type="submit" className={btnSecondary}>Sign out</button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
