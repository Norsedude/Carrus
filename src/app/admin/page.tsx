import type { Metadata } from "next";
import { reviewListingAction, reviewPartnerAction } from "@/app/actions/partner";
import { Notice, PageShell, btnDanger, btnPrimary, cardCls, inputCls } from "@/components/ui";
import { requireRole } from "@/lib/auth/session";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Administration" };

const TZ = "America/Los_Angeles";

function ReviewButtons({
  idName,
  id,
  action,
  label,
}: {
  idName: string;
  id: string;
  action: (form: FormData) => Promise<void>;
  label: string;
}) {
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name={idName} value={id} />
      <div className="min-w-48 flex-1">
        <label htmlFor={`reason-${id}`} className="mb-1 block text-xs font-medium text-slate-700">
          Reason (required to reject)
        </label>
        <input id={`reason-${id}`} name="reason" className={inputCls} />
      </div>
      <button type="submit" name="decision" value="approve" className={btnPrimary}>
        Approve<span className="sr-only"> {label}</span>
      </button>
      <button type="submit" name="decision" value="reject" className={btnDanger}>
        Reject<span className="sr-only"> {label}</span>
      </button>
    </form>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ result?: string; detail?: string }> }) {
  // Page gate; every action below is also authorized inside the database.
  await requireRole("admin", "/admin");
  const { result, detail } = await searchParams;
  const db = await createClient();
  const [{ data: partners }, { data: listings }, { data: audit }] = await Promise.all([
    db
      .from("partners")
      .select("id, display_name, kind, created_at, partner_applications (contact_email, contact_phone, fleet_size, notes)")
      .eq("verification_status", "pending")
      .order("created_at"),
    db
      .from("vehicles")
      .select("id, public_code, make, model, year, color, vehicle_type, seats, daily_rate_cents, location_label, partner:partners (display_name)")
      .eq("lifecycle_status", "pending_review")
      .order("created_at"),
    db.from("audit_events").select("id, action, target_type, reason, created_at").order("id", { ascending: false }).limit(15),
  ]);

  return (
    <PageShell title="Administration" intro="Verify Rental Partners and review listings before they become public.">
      <div className="space-y-8">
        {result === "partner" && <Notice tone="success">Partner application updated.</Notice>}
        {result === "listing" && <Notice tone="success">Listing review recorded.</Notice>}
        {result === "error" && (
          <Notice tone="error" title="That action was not completed">
            {detail}
          </Notice>
        )}

        <section aria-labelledby="partners-heading">
          <h2 id="partners-heading" className="mb-3 text-lg font-semibold text-slate-900">
            Partner applications awaiting review ({partners?.length ?? 0})
          </h2>
          {partners?.length ? (
            <ul className="space-y-3">
              {partners.map((p) => {
                const app = Array.isArray(p.partner_applications) ? p.partner_applications[0] : p.partner_applications;
                return (
                  <li key={p.id} className={`${cardCls} p-4 text-sm text-slate-700`} data-testid="pending-partner" data-name={p.display_name}>
                    <p className="text-base font-semibold text-slate-900">{p.display_name}</p>
                    <p>
                      {p.kind === "company" ? "Company" : "Individual"} · applied {formatDateTime(p.created_at, TZ)}
                    </p>
                    {app && (
                      <p>
                        {app.contact_email}
                        {app.contact_phone ? ` · ${app.contact_phone}` : ""} · plans {app.fleet_size} vehicle
                        {app.fleet_size === 1 ? "" : "s"}
                      </p>
                    )}
                    {app?.notes && <p className="mt-1">Notes: {app.notes}</p>}
                    <ReviewButtons idName="partnerId" id={p.id} action={reviewPartnerAction} label={p.display_name} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={`${cardCls} p-4 text-sm text-slate-700`}>No applications are waiting.</p>
          )}
        </section>

        <section aria-labelledby="listings-heading">
          <h2 id="listings-heading" className="mb-3 text-lg font-semibold text-slate-900">
            Listings awaiting review ({listings?.length ?? 0})
          </h2>
          {listings?.length ? (
            <ul className="space-y-3">
              {listings.map((v) => {
                const partner = Array.isArray(v.partner) ? v.partner[0] : v.partner;
                return (
                  <li key={v.id} className={`${cardCls} p-4 text-sm text-slate-700`} data-testid="pending-listing" data-code={v.public_code}>
                    <p className="text-base font-semibold text-slate-900">
                      {v.year} {v.make} {v.model}
                    </p>
                    <p>
                      {v.public_code} · {v.color || "Color not given"} · {v.vehicle_type} · {v.seats} seats ·{" "}
                      {formatCents(v.daily_rate_cents)} / day
                    </p>
                    <p>
                      {v.location_label} · {partner?.display_name}
                    </p>
                    <ReviewButtons idName="vehicleId" id={v.id} action={reviewListingAction} label={`${v.year} ${v.make} ${v.model}`} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={`${cardCls} p-4 text-sm text-slate-700`}>No listings are waiting.</p>
          )}
        </section>

        <section aria-labelledby="audit-heading">
          <h2 id="audit-heading" className="mb-3 text-lg font-semibold text-slate-900">Recent audit events</h2>
          {audit?.length ? (
            <ul className={`${cardCls} divide-y divide-slate-100 text-sm text-slate-700`}>
              {audit.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                  <span>
                    <span className="font-medium text-slate-900">{a.action}</span> on {a.target_type}
                    {a.reason ? `: ${a.reason}` : ""}
                  </span>
                  <span className="text-slate-600">{formatDateTime(a.created_at, TZ)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`${cardCls} p-4 text-sm text-slate-700`}>No events recorded yet.</p>
          )}
        </section>

        <Notice title="Not built yet">
          Disputes and evidence review, account moderation, fee policy versions, payouts and transaction reports are not
          available yet. Administrator multi-factor sign-in must be set up before any public use.
        </Notice>
      </div>
    </PageShell>
  );
}
