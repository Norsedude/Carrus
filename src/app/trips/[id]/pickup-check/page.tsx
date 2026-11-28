import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PickupCheckForm } from "@/components/inspection-forms";
import { TripSummary } from "@/components/trip-summary";
import { PageShell, cardCls, linkCls } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { VehicleSnapshot } from "@/server/booking/service";

export const metadata: Metadata = { title: "Pickup condition check" };

/** TC-PC02 to TC-PC04. Only the booking's customer, and only while it is ready for pickup. */
export default async function PickupCheckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/trips/${id}/pickup-check`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createClient();
  const { data: b } = await db.from("bookings").select("*").eq("id", id).eq("customer_id", user.id).maybeSingle();
  if (!b) notFound();
  // Not ready yet, or already checked: the trip page explains the current state.
  if (b.state !== "ready_for_pickup") redirect(`/trips/${b.id}`);

  return (
    <PageShell
      title="Pickup condition check"
      intro="Record the vehicle's condition before you drive away. This record protects you from being charged for damage or dirt that was already there."
    >
      <p className="mb-4 text-sm"><Link href={`/trips/${b.id}`} className={linkCls}>Back to reservation {b.reference}</Link></p>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className={`${cardCls} p-5`}>
          <PickupCheckForm bookingId={b.id} />
        </div>
        <aside className={`${cardCls} h-fit p-5`}>
          <TripSummary vehicle={b.vehicle_snapshot as unknown as VehicleSnapshot} pickupAt={b.pickup_at} returnAt={b.return_at} />
        </aside>
      </div>
    </PageShell>
  );
}
