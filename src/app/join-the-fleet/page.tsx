import type { Metadata } from "next";
import Link from "next/link";
import { FleetApplicationForm } from "@/components/partner-forms";
import { Notice, PageShell, StateBadge, btnPrimary, btnSecondary, cardCls } from "@/components/ui";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Join the Fleet" };

const BENEFITS = [
  { title: "For individual owners", body: "List the specific car you own, choose when it is available, and set a daily rate. Renters reserve that exact vehicle." },
  { title: "For rental companies", body: "List individual units from your fleet so customers know precisely what they will drive, with one schedule per vehicle." },
  { title: "Fewer disputes", body: "Carrus shows customers the full price before they book and prevents two reservations for the same vehicle and dates." },
];

const STEPS = ["Create a Carrus account", "Submit a partner application", "An administrator reviews and verifies you", "List vehicles; each listing is reviewed before it goes public"];

export default async function JoinTheFleetPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const { submitted } = await searchParams;
  const user = await getSessionUser();
  const db = await createClient();
  const partner = user
    ? (await db.from("partners").select("id, display_name, verification_status").eq("owner_user_id", user.id).maybeSingle()).data
    : null;
  const application = partner
    ? (await db.from("partner_applications").select("submitted_at, decision_reason").eq("partner_id", partner.id).maybeSingle()).data
    : null;

  return (
    <PageShell title="Join the Fleet" intro="Become a verified Carrus Rental Partner and list specific vehicles for renters to book.">
      <ul className="grid gap-4 md:grid-cols-3">
        {BENEFITS.map((b) => (
          <li key={b.title} className={`${cardCls} p-5`}>
            <h2 className="text-base font-semibold text-slate-900">{b.title}</h2>
            <p className="mt-2 text-sm text-slate-700">{b.body}</p>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className={`${cardCls} h-fit p-5`} aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="text-base font-semibold text-slate-900">How onboarding works</h2>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-slate-700">
            {STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>

        <section className={`${cardCls} p-5`} aria-labelledby="apply-heading">
          <h2 id="apply-heading" className="mb-3 text-base font-semibold text-slate-900">
            {partner ? "Your application" : "Apply"}
          </h2>
          {!user && (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">Sign in or create an account to apply. Applying does not change how you rent as a customer.</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/signup?next=/join-the-fleet" className={btnPrimary}>Create an account</Link>
                <Link href="/login?next=/join-the-fleet" className={btnSecondary}>Sign in</Link>
              </div>
            </div>
          )}
          {user && !partner && <FleetApplicationForm email={user.email} />}
          {partner && (
            <div className="space-y-3 text-sm text-slate-700" data-testid="application-status">
              {submitted && <Notice tone="success">Application submitted. An administrator will review it.</Notice>}
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-900">{partner.display_name}</span>
                <StateBadge state={partner.verification_status} />
              </p>
              {partner.verification_status === "pending" && <p>Your application is waiting for an administrator. You cannot list vehicles until it is approved.</p>}
              {partner.verification_status === "verified" && (
                <>
                  <p>You are a verified Rental Partner.</p>
                  <Link href="/partner" className={btnPrimary}>Go to the partner dashboard</Link>
                </>
              )}
              {partner.verification_status === "rejected" && (
                <p>Your application was not approved.{application?.decision_reason ? ` Reason given: ${application.decision_reason}` : ""}</p>
              )}
              {partner.verification_status === "suspended" && <p>This partner account is suspended.</p>}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
