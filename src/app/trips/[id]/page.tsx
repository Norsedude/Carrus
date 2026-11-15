import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceBreakdownView } from "@/components/price";
import { TripSummary } from "@/components/trip-summary";
import { Notice, PageShell, StateBadge, cardCls, linkCls } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import type { VehicleSnapshot } from "@/server/booking/service";
import type { PriceBreakdown } from "@/server/pricing/pricing";

export const metadata: Metadata = { title: "Trip details" };

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/trips/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createClient();
  const { data: b } = await db.from("bookings").select("*").eq("id", id).eq("customer_id", user.id).maybeSingle();
  if (!b) notFound();
  const v = b.vehicle_snapshot as unknown as VehicleSnapshot;

  return (
    <PageShell title={`Reservation ${b.reference}`}>
      <p className="mb-4 text-sm"><Link href="/trips" className={linkCls}>Back to my trips</Link></p>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className={`${cardCls} space-y-4 p-5`}>
            <p className="flex items-center gap-2 text-sm text-gray-700">Status: <StateBadge state={b.state} /></p>
            <TripSummary vehicle={v} pickupAt={b.pickup_at} returnAt={b.return_at} />
            <p className="text-sm text-gray-700">Driver: {b.contact_name} · {b.contact_phone}</p>
          </div>
          <section className={`${cardCls} p-5`} aria-labelledby="timeline-heading">
            <h2 id="timeline-heading" className="text-base font-semibold text-gray-900">Timeline</h2>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-gray-700">
              <li>Reservation created on {formatDateTime(b.created_at, v.timeZone)}</li>
            </ol>
          </section>
          <Notice title="Not built yet">
            Cancelling a reservation, pickup and return inspections, and disputing a charge are planned for the next milestone.
            They are not available on this page yet.
          </Notice>
        </div>
        <aside className={`${cardCls} h-fit p-5`}>
          <PriceBreakdownView price={b.price_snapshot as unknown as PriceBreakdown} heading="Price you agreed to" />
        </aside>
      </div>
    </PageShell>
  );
}
