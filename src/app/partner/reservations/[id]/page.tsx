import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrepareVehicleForm } from "@/components/inspection-forms";
import { InspectionRecord } from "@/components/inspection-record";
import { PriceBreakdownView } from "@/components/price";
import { TripSummary } from "@/components/trip-summary";
import { Notice, PageShell, StateBadge, cardCls, linkCls } from "@/components/ui";
import { requireVerifiedPartner } from "@/lib/auth/partner";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { getInspections } from "@/server/inspections/service";
import type { VehicleSnapshot } from "@/server/booking/service";
import type { PriceBreakdown } from "@/server/pricing/pricing";

export const metadata: Metadata = { title: "Reservation" };

export default async function PartnerReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { partner, db } = await requireVerifiedPartner(`/partner/reservations/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: b } = await db.from("bookings").select("*").eq("id", id).eq("partner_id", partner.id).maybeSingle();
  if (!b) notFound();
  const vehicle = b.vehicle_snapshot as unknown as VehicleSnapshot;
  const inspections = await getInspections(db, createAdminClient(), b.id);

  return (
    <PageShell title={`Reservation ${b.reference}`}>
      <p className="mb-4 text-sm">
        <Link href="/partner" className={linkCls}>Back to the partner dashboard</Link>
      </p>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className={`${cardCls} space-y-4 p-5`}>
            <p className="flex items-center gap-2 text-sm text-gray-700">
              Status: <StateBadge state={b.state} />
            </p>
            <TripSummary vehicle={vehicle} pickupAt={b.pickup_at} returnAt={b.return_at} />
            <p className="text-sm text-gray-700">
              Driver contact: <span className="font-medium text-gray-900">{b.contact_name || "Not provided"}</span>
              {b.contact_phone ? ` · ${b.contact_phone}` : ""}
            </p>
          </div>
          {b.state === "confirmed" && (
            <details className={`${cardCls} p-5`}>
              <summary className="cursor-pointer text-base font-semibold text-brand">Prepare vehicle</summary>
              <div className="mt-3">
                <PrepareVehicleForm bookingId={b.id} />
              </div>
            </details>
          )}
          {b.ready_at && (
            <Notice tone="success" title="Ready for pickup">
              Marked ready on {formatDateTime(b.ready_at, vehicle.timeZone)}.
              {b.state === "ready_for_pickup" && " The customer completes the pickup condition check when they collect the vehicle."}
            </Notice>
          )}
          {inspections.map((inspection) => (
            <InspectionRecord key={inspection.stage} inspection={inspection} timeZone={vehicle.timeZone} />
          ))}
          <Notice title="Not built yet">
            This vehicle uses instant booking, so there is nothing to approve. Approving or declining requests and the
            return inspection are planned for the next milestone.
          </Notice>
        </div>
        <aside className={`${cardCls} h-fit p-5`}>
          <PriceBreakdownView price={b.price_snapshot as unknown as PriceBreakdown} heading="Price charged to the customer" />
        </aside>
      </div>
    </PageShell>
  );
}
