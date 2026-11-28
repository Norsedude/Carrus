import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceBreakdownView } from "@/components/price";
import { TripSummary } from "@/components/trip-summary";
import { respondToRequestAction } from "@/app/actions/requests";
import { Notice, PageShell, StateBadge, btnPrimary, btnSecondary, cardCls, inputCls, linkCls } from "@/components/ui";
import { requireVerifiedPartner } from "@/lib/auth/partner";
import type { VehicleSnapshot } from "@/server/booking/service";
import type { PriceBreakdown } from "@/server/pricing/pricing";
import { formatDateTime } from "@/lib/time";
import { expirePendingRequests } from "@/server/booking/requests";

const RESULTS: Record<string, { tone: "success" | "warning" | "error"; text: string }> = {
  confirmed: { tone: "success", text: "Request approved. The customer has been notified." },
  declined: { tone: "success", text: "Request declined. The customer was notified and refunded." },
  expired: { tone: "warning", text: "This request had already expired, so it could not be approved." },
  error: { tone: "error", text: "That did not work. Refresh and try again." },
};

export const metadata: Metadata = { title: "Reservation" };

export default async function PartnerReservationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ result?: string }> }) {
  const { id } = await params;
  const { result } = await searchParams;
  await expirePendingRequests();
  const { partner, db } = await requireVerifiedPartner(`/partner/reservations/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: b } = await db.from("bookings").select("*").eq("id", id).eq("partner_id", partner.id).maybeSingle();
  if (!b) notFound();

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
            <TripSummary vehicle={b.vehicle_snapshot as unknown as VehicleSnapshot} pickupAt={b.pickup_at} returnAt={b.return_at} />
            <p className="text-sm text-gray-700">
              Driver contact: <span className="font-medium text-gray-900">{b.contact_name || "Not provided"}</span>
              {b.contact_phone ? ` · ${b.contact_phone}` : ""}
            </p>
          </div>
          {result && RESULTS[result] && <Notice tone={RESULTS[result].tone}><span data-testid="respond-result">{RESULTS[result].text}</span></Notice>}
          {b.state === "pending_partner" && (
            <section className={`${cardCls} space-y-4 p-5`} aria-labelledby="respond-heading">
              <h2 id="respond-heading" className="text-xl">Respond to this request</h2>
              <p className="text-sm text-gray-600">
                Answer by {b.respond_by ? formatDateTime(b.respond_by, (b.vehicle_snapshot as unknown as VehicleSnapshot).timeZone) : "the deadline"}. If you do not answer, the request expires and the customer is refunded.
              </p>
              <div className="flex flex-wrap items-start gap-3">
                <form action={respondToRequestAction}>
                  <input type="hidden" name="bookingId" value={b.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <button type="submit" className={btnPrimary}>Approve request</button>
                </form>
                <form action={respondToRequestAction} className="flex min-w-64 flex-1 flex-wrap gap-2">
                  <input type="hidden" name="bookingId" value={b.id} />
                  <input type="hidden" name="decision" value="decline" />
                  <label htmlFor="decline-reason" className="sr-only">Reason (optional)</label>
                  <input id="decline-reason" name="reason" maxLength={300} placeholder="Reason (optional)" className={`${inputCls} flex-1`} />
                  <button type="submit" className={btnSecondary}>Decline</button>
                </form>
              </div>
            </section>
          )}
          {b.state === "declined" && b.decline_reason && <Notice tone="info">Declined: {b.decline_reason}</Notice>}
        </div>
        <aside className={`${cardCls} h-fit p-5`}>
          <PriceBreakdownView price={b.price_snapshot as unknown as PriceBreakdown} heading="Price charged to the customer" />
        </aside>
      </div>
    </PageShell>
  );
}
