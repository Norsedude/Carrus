import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PriceBreakdownView } from "@/components/price";
import { TripSummary } from "@/components/trip-summary";
import { Notice, PageShell, btnPrimary, btnSecondary, cardCls } from "@/components/ui";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDateTime, utcToZonedLocal } from "@/lib/time";
import { getQuoteView, type QuoteStatus } from "@/server/booking/service";

export const metadata: Metadata = { title: "Review your reservation" };

const BLOCKED: Record<Exclude<QuoteStatus, "ok">, { title: string; body: string }> = {
  unavailable: {
    title: "This vehicle is no longer available for these dates",
    body: "It was reserved or its availability changed after you selected it. Nothing was booked and you were not charged.",
  },
  expired: {
    title: "This price quote has expired",
    body: "Quotes are held for a short time so the price you see is current. Open the vehicle again for a fresh price.",
  },
  price_changed: {
    title: "The price changed after this quote was made",
    body: "Open the vehicle again to see the current price before you continue.",
  },
};

/** Preconfirmation. Loading this page never creates a booking or a hold. */
export default async function BookingReviewPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const user = await getSessionUser();
  const view = await getQuoteView(createAdminClient(), quoteId, user?.id ?? null);
  if (!view) notFound();
  if (view.kind === "booked") redirect(`/bookings/${view.bookingId}/confirmation`);

  const { quote, status } = view;
  const v = quote.vehicle;
  const tripParams = new URLSearchParams({
    pickup: utcToZonedLocal(new Date(quote.pickupAt), v.timeZone),
    return: utcToZonedLocal(new Date(quote.returnAt), v.timeZone),
    location: v.locationLabel,
  }).toString();
  const vehicleHref = `/vehicles/${quote.vehicleId}?${tripParams}`;

  return (
    <PageShell title="Review your reservation" intro="Check the vehicle, dates and price. Nothing is booked or charged on this page.">
      {status !== "ok" && (
        <div className="mb-4 space-y-3" data-testid="quote-blocked">
          <Notice tone="error" title={BLOCKED[status].title}>{BLOCKED[status].body}</Notice>
          <div className="flex flex-wrap gap-2">
            <Link href={vehicleHref} className={btnPrimary}>View this vehicle again</Link>
            <Link href={`/search?${tripParams}`} className={btnSecondary}>See other vehicles</Link>
          </div>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className={`${cardCls} p-5`}>
          <TripSummary vehicle={v} pickupAt={quote.pickupAt} returnAt={quote.returnAt} />
        </div>
        <aside className={`${cardCls} h-fit space-y-4 p-5`}>
          <PriceBreakdownView price={quote.breakdown} />
          {status === "ok" && (
            <>
              <Link href={`/checkout/${quote.id}`} className={`${btnPrimary} w-full`}>Continue to checkout</Link>
              <p className="text-xs text-gray-600">
                {user ? "" : "No account needed: checkout only asks for your email. "}
                Price confirmed just now and held until {formatDateTime(quote.expiresAt, v.timeZone)}. Availability is
                checked again when you pay.
              </p>
            </>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
