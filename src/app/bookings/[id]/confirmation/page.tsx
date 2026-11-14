import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceBreakdownView } from "@/components/price";
import { TripSummary } from "@/components/trip-summary";
import { Notice, PageShell, StateBadge, btnPrimary, btnSecondary, cardCls } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { VehicleSnapshot } from "@/server/booking/service";
import type { PriceBreakdown } from "@/server/pricing/pricing";

export const metadata: Metadata = { title: "Reservation confirmed" };

/**
 * Read-only: shows a persisted booking. Refreshing or revisiting never
 * creates anything. Row-level security returns the row only to the customer
 * who made it (or the partner/admin); anyone else gets "not found".
 */
export default async function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/bookings/${id}/confirmation`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createClient();
  const { data: booking } = await db.from("bookings").select("*").eq("id", id).eq("customer_id", user.id).maybeSingle();
  if (!booking) notFound();
  const { data: payments } = await db.from("payments").select("state, amount_cents, provider_ref").eq("booking_id", booking.id);
  const paid = payments?.find((p) => p.state === "succeeded");

  return (
    <PageShell title="Your reservation is confirmed">
      <div className="space-y-4">
        <Notice tone="success" title={`Reservation ${booking.reference}`}>
          <span data-testid="booking-reference" className="sr-only">{booking.reference}</span>
          This exact vehicle is reserved for you. Keep this reference for pickup.
        </Notice>
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className={`${cardCls} space-y-4 p-5`}>
            <p className="flex items-center gap-2 text-sm text-slate-700">Status: <StateBadge state={booking.state} /></p>
            <TripSummary vehicle={booking.vehicle_snapshot as unknown as VehicleSnapshot} pickupAt={booking.pickup_at} returnAt={booking.return_at} />
            <p className="text-sm text-slate-700">Driver: {booking.contact_name} · {booking.contact_phone}</p>
          </div>
          <aside className={`${cardCls} h-fit space-y-4 p-5`}>
            <PriceBreakdownView price={booking.price_snapshot as unknown as PriceBreakdown} heading="Price you agreed to" />
            <p className="text-sm text-slate-700" data-testid="payment-line">
              {paid
                ? `Simulated payment of ${formatCents(paid.amount_cents)} recorded (demo, no real charge). Reference ${paid.provider_ref}.`
                : "No payment is recorded for this reservation (fixture data)."}
            </p>
          </aside>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/trips" className={btnPrimary}>View my trips</Link>
          <Link href="/" className={btnSecondary}>Back to home</Link>
        </div>
      </div>
    </PageShell>
  );
}
