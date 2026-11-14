import type { Metadata } from "next";
import Link from "next/link";
import { Notice, PageShell, StateBadge, btnPrimary, cardCls, linkCls } from "@/components/ui";
import { requireVerifiedPartner } from "@/lib/auth/partner";
import { getNow } from "@/lib/clock";
import { formatCents } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import type { VehicleSnapshot } from "@/server/booking/service";

export const metadata: Metadata = { title: "Partner dashboard" };

const SAVED: Record<string, string> = {
  draft: "Draft saved.",
  submit: "Listing submitted for administrator review. It is not public until approved.",
  save: "Changes saved.",
  pause: "Listing paused. It no longer appears in search.",
  resume: "Listing resumed.",
  archive: "Listing archived.",
};

export default async function PartnerDashboardPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const { partner, db } = await requireVerifiedPartner("/partner");
  const [{ data: vehicleRows }, { data: bookingRows }] = await Promise.all([
    db.from("vehicles").select("id, public_code, make, model, year, daily_rate_cents, lifecycle_status, location_label").eq("partner_id", partner.id).order("public_code"),
    db.from("bookings").select("id, reference, state, pickup_at, return_at, total_cents, vehicle_id, vehicle_snapshot, contact_name").eq("partner_id", partner.id).order("pickup_at"),
  ]);
  const vehicles = vehicleRows ?? [];
  const bookings = bookingRows ?? [];
  const now = getNow().getTime();
  const out = new Set(
    bookings
      .filter((b) => b.state === "active" || (b.state === "confirmed" && new Date(b.pickup_at).getTime() <= now && new Date(b.return_at).getTime() > now))
      .map((b) => b.vehicle_id),
  );
  const booked = bookings.filter((b) => ["confirmed", "ready_for_pickup", "active", "completed"].includes(b.state));
  const revenue = booked.reduce((sum, b) => sum + b.total_cents, 0);

  return (
    <PageShell title="Partner dashboard" intro={`${partner.display_name} · Verified Rental Partner`}>
      <div className="space-y-6">
        {saved && SAVED[saved] && <Notice tone="success"><span data-testid="partner-notice">{SAVED[saved]}</span></Notice>}

        <dl className="grid gap-4 sm:grid-cols-3">
          {[
            ["Listings", String(vehicles.length)],
            ["Out on rental now", String(out.size)],
            ["Booked revenue", formatCents(revenue)],
          ].map(([k, v]) => (
            <div key={k} className={`${cardCls} p-4`}>
              <dt className="text-sm text-slate-600">{k}</dt>
              <dd className="text-2xl font-bold tabular-nums text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-slate-600">
          Booked revenue is the total of reservations paid with simulated payments. Payouts and the earnings ledger are not
          built yet; no money is owed or transferred.
        </p>

        <section aria-labelledby="fleet-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="fleet-heading" className="text-lg font-semibold text-slate-900">Your vehicles</h2>
            <Link href="/partner/vehicles/new" className={btnPrimary}>Add a vehicle</Link>
          </div>
          {vehicles.length === 0 ? (
            <p className={`${cardCls} p-5 text-sm text-slate-700`}>You have not listed a vehicle yet.</p>
          ) : (
            <ul className="space-y-2">
              {vehicles.map((v) => (
                <li key={v.id} className={`${cardCls} flex flex-wrap items-center justify-between gap-3 p-4`} data-testid="fleet-row" data-code={v.public_code}>
                  <div className="text-sm text-slate-700">
                    <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
                      {v.year} {v.make} {v.model}
                      <StateBadge state={v.lifecycle_status} />
                      {out.has(v.id) && <StateBadge state="active" />}
                    </p>
                    <p>{v.public_code} · {v.location_label} · <span className="tabular-nums" data-testid="fleet-rate">{formatCents(v.daily_rate_cents)}</span> / day</p>
                  </div>
                  <Link href={`/partner/vehicles/${v.id}/edit`} className={linkCls}>Edit<span className="sr-only"> {v.public_code}</span></Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="reservations-heading">
          <h2 id="reservations-heading" className="mb-3 text-lg font-semibold text-slate-900">Reservations</h2>
          {bookings.length === 0 ? (
            <p className={`${cardCls} p-5 text-sm text-slate-700`}>No reservations yet.</p>
          ) : (
            <ul className="space-y-2">
              {bookings.map((b) => {
                const v = b.vehicle_snapshot as unknown as VehicleSnapshot;
                return (
                  <li key={b.id} className={`${cardCls} flex flex-wrap items-center justify-between gap-3 p-4`} data-testid="reservation-row" data-reference={b.reference}>
                    <div className="text-sm text-slate-700">
                      <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
                        <Link href={`/partner/reservations/${b.id}`} className="underline-offset-2 hover:underline">{b.reference}</Link>
                        <StateBadge state={b.state} />
                      </p>
                      <p>{v.year} {v.make} {v.model} ({v.publicCode}) · {b.contact_name || "Customer"}</p>
                      <p>{formatDateTime(b.pickup_at, v.timeZone)} to {formatDateTime(b.return_at, v.timeZone)}</p>
                    </div>
                    <p className="text-lg font-bold tabular-nums text-slate-900">{formatCents(b.total_cents)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}
