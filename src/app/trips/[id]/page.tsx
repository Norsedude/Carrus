import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InspectionRecord } from "@/components/inspection-record";
import { PriceBreakdownView } from "@/components/price";
import { TripSummary } from "@/components/trip-summary";
import { Notice, PageShell, StateBadge, btnPrimary, cardCls, linkCls } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import type { VehicleSnapshot } from "@/server/booking/service";
import { getInspections } from "@/server/inspections/service";
import type { PriceBreakdown } from "@/server/pricing/pricing";

export const metadata: Metadata = { title: "Trip details" };

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checked?: string }>;
}) {
  const { id } = await params;
  const { checked } = await searchParams;
  const user = await requireUser(`/trips/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createClient();
  const { data: b } = await db.from("bookings").select("*").eq("id", id).eq("customer_id", user.id).maybeSingle();
  if (!b) notFound();
  const v = b.vehicle_snapshot as unknown as VehicleSnapshot;
  const inspections = await getInspections(db, createAdminClient(), b.id);
  const pickup = inspections.find((i) => i.stage === "pickup");

  return (
    <PageShell title={`Reservation ${b.reference}`}>
      <p className="mb-4 text-sm"><Link href="/trips" className={linkCls}>Back to my trips</Link></p>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {checked === "1" && pickup && <Notice tone="success">Condition check saved.</Notice>}
          {b.state === "ready_for_pickup" && (
            <Notice tone="success" title="Your vehicle is ready for pickup">
              <p>
                The partner confirmed the vehicle is clean and fully fueled
                {b.ready_at ? ` on ${formatDateTime(b.ready_at, v.timeZone)}` : ""}. When you collect it, record its
                condition with a photo of the exterior, the fuel gauge and the interior.
              </p>
              <p className="mt-3">
                <Link href={`/trips/${b.id}/pickup-check`} className={btnPrimary}>Start condition check</Link>
              </p>
            </Notice>
          )}
          <div className={`${cardCls} space-y-4 p-5`}>
            <p className="flex items-center gap-2 text-sm text-gray-700">Status: <StateBadge state={b.state} /></p>
            <TripSummary vehicle={v} pickupAt={b.pickup_at} returnAt={b.return_at} />
            <p className="text-sm text-gray-700">Driver: {b.contact_name} · {b.contact_phone}</p>
          </div>
          <section className={`${cardCls} p-5`} aria-labelledby="timeline-heading">
            <h2 id="timeline-heading" className="text-base font-semibold text-gray-900">Timeline</h2>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-gray-700">
              <li>Reservation created on {formatDateTime(b.created_at, v.timeZone)}</li>
              {b.ready_at && <li>Vehicle marked ready for pickup on {formatDateTime(b.ready_at, v.timeZone)}</li>}
              {pickup && <li>Pickup condition check saved on {formatDateTime(pickup.acknowledgedAt, v.timeZone)}</li>}
            </ol>
          </section>
          {inspections.map((inspection) => (
            <InspectionRecord key={inspection.stage} inspection={inspection} timeZone={v.timeZone} />
          ))}
          <Notice title="Not built yet">
            Cancelling a reservation, the return inspection, and disputing a charge are planned for the next milestone.
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
