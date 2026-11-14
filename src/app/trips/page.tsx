import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, StateBadge, btnPrimary, cardCls } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getNow } from "@/lib/clock";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import type { VehicleSnapshot } from "@/server/booking/service";

export const metadata: Metadata = { title: "My trips" };

export default async function TripsPage() {
  const user = await requireUser("/trips");
  const db = await createClient();
  const { data } = await db
    .from("bookings")
    .select("id, reference, state, pickup_at, return_at, total_cents, vehicle_snapshot")
    .eq("customer_id", user.id)
    .order("pickup_at", { ascending: true });
  const bookings = data ?? [];
  const now = getNow().getTime();
  const upcoming = bookings.filter((b) => new Date(b.return_at).getTime() >= now);
  const past = bookings.filter((b) => new Date(b.return_at).getTime() < now);

  const list = (rows: typeof bookings) => (
    <ul className="space-y-3">
      {rows.map((b) => {
        const v = b.vehicle_snapshot as unknown as VehicleSnapshot;
        return (
          <li key={b.id} className={`${cardCls} flex flex-wrap items-center justify-between gap-3 p-4`} data-testid="trip-row" data-reference={b.reference}>
            <div className="text-sm text-slate-700">
              <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
                <Link href={`/trips/${b.id}`} className="underline-offset-2 hover:underline">{v.year} {v.make} {v.model}</Link>
                <StateBadge state={b.state} />
              </p>
              <p>{formatDateTime(b.pickup_at, v.timeZone)} to {formatDateTime(b.return_at, v.timeZone)}</p>
              <p>{v.locationLabel} · Reservation {b.reference}</p>
            </div>
            <p className="text-lg font-bold tabular-nums text-slate-900">{formatCents(b.total_cents)}</p>
          </li>
        );
      })}
    </ul>
  );

  return (
    <PageShell title="My trips">
      {bookings.length === 0 ? (
        <div className={`${cardCls} p-6`}>
          <p className="text-sm text-slate-700">You have no reservations yet.</p>
          <Link href="/#search" className={`${btnPrimary} mt-4`}>Search vehicles</Link>
        </div>
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" className="mb-3 text-lg font-semibold text-slate-900">Upcoming and current</h2>
            {upcoming.length ? list(upcoming) : <p className="text-sm text-slate-700">Nothing upcoming.</p>}
          </section>
          {past.length > 0 && (
            <section aria-labelledby="past-heading">
              <h2 id="past-heading" className="mb-3 text-lg font-semibold text-slate-900">Past</h2>
              {list(past)}
            </section>
          )}
        </div>
      )}
    </PageShell>
  );
}
