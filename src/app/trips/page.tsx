import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, StateBadge, btnPrimary, cardCls } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getNow } from "@/lib/clock";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import type { VehicleSnapshot } from "@/server/booking/service";
import { expirePendingRequests } from "@/server/booking/requests";
import type { VehicleListing } from "@/server/search/types";

export const metadata: Metadata = { title: "My trips" };

export default async function TripsPage() {
  const user = await requireUser("/trips");
  await expirePendingRequests();
  const db = await createClient();
  const [{ data }, { data: demoData }] = await Promise.all([
    db.from("bookings").select("id, reference, state, pickup_at, return_at, total_cents, vehicle_snapshot").eq("customer_id", user.id).order("pickup_at", { ascending: true }),
    db.from("external_demo_orders").select("id, state, demo_reference, pickup_at, return_at, total_cents, listing_snapshot, provider_name").eq("customer_id", user.id).eq("state", "confirmed").order("pickup_at", { ascending: true }),
  ]);
  const bookings = data ?? [];
  const demos = demoData ?? [];
  const now = getNow().getTime();
  const upcoming = bookings.filter((b) => new Date(b.return_at).getTime() >= now);
  const past = bookings.filter((b) => new Date(b.return_at).getTime() < now);

  const list = (rows: typeof bookings) => (
    <ul className="space-y-3">
      {rows.map((b) => {
        const v = b.vehicle_snapshot as unknown as VehicleSnapshot;
        return (
          <li key={b.id} className={`${cardCls} flex flex-wrap items-center justify-between gap-3 p-4`} data-testid="trip-row" data-reference={b.reference}>
            <div className="text-sm text-gray-700">
              <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-gray-900">
                <Link href={`/trips/${b.id}`} className="underline-offset-2 hover:underline">{v.year} {v.make} {v.model}</Link>
                <StateBadge state={b.state} />
              </p>
              <p>{formatDateTime(b.pickup_at, v.timeZone)} to {formatDateTime(b.return_at, v.timeZone)}</p>
              <p>{v.locationLabel} · Reservation {b.reference}</p>
            </div>
            <p className="text-lg font-bold tabular-nums text-gray-900">{formatCents(b.total_cents)}</p>
          </li>
        );
      })}
    </ul>
  );

  return (
    <PageShell title="My trips">
      {bookings.length === 0 && demos.length === 0 ? (
        <div className={`${cardCls} p-6`}>
          <p className="text-sm text-gray-700">You have no reservations yet.</p>
          <Link href="/#search" className={`${btnPrimary} mt-4`}>Search vehicles</Link>
        </div>
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" className="mb-3 text-lg font-semibold text-gray-900">Upcoming and current</h2>
            {upcoming.length ? list(upcoming) : <p className="text-sm text-gray-700">Nothing upcoming.</p>}
          </section>
          {past.length > 0 && (
            <section aria-labelledby="past-heading">
              <h2 id="past-heading" className="mb-3 text-lg font-semibold text-gray-900">Past</h2>
              {list(past)}
            </section>
          )}
          {demos.length > 0 && (
            <section aria-labelledby="demo-heading">
              <h2 id="demo-heading" className="mb-2 text-lg font-semibold text-gray-900">External demo checkouts</h2>
              <p className="mb-3 text-sm text-gray-600">These are Carrus simulations. No provider car was reserved and no payment was made.</p>
              <ul className="space-y-3">
                {demos.map((demo) => {
                  const listing = demo.listing_snapshot as unknown as VehicleListing;
                  return (
                    <li key={demo.id} className={`${cardCls} flex flex-wrap items-center justify-between gap-3 p-4`}>
                      <div>
                        <Link href={`/external/confirmation/${demo.id}`} className="font-bold text-brand underline">{listing.year} {listing.make} {listing.model}</Link>
                        <p className="text-sm text-gray-600">{demo.provider_name} · {formatDateTime(demo.pickup_at, listing.timeZone)} · {demo.demo_reference}</p>
                      </div>
                      <span className="font-bold">{formatCents(demo.total_cents)} demo total</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </PageShell>
  );
}
