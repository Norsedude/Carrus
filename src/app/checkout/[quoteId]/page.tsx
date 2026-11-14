import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CheckoutForm } from "@/app/checkout/[quoteId]/checkout-form";
import { PriceBreakdownView } from "@/components/price";
import { TripSummary } from "@/components/trip-summary";
import { PageShell, cardCls } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatCents } from "@/lib/money";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getQuoteView } from "@/server/booking/service";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  // Signing in returns here, so the selected vehicle and dates are retained.
  const user = await requireUser(`/checkout/${quoteId}`);
  const view = await getQuoteView(createAdminClient(), quoteId, user.id);
  if (!view) notFound();
  if (view.kind === "booked") redirect(`/bookings/${view.bookingId}/confirmation`);
  // Stale price or availability is explained on the review page.
  if (view.status !== "ok") redirect(`/booking/${quoteId}`);

  const { quote } = view;
  const db = await createClient();
  const { data: profile } = await db.from("profiles").select("display_name, phone").eq("id", user.id).maybeSingle();
  const fixtureSuffix = / \((CUSTOMER|PARTNER)-\d+\)$/;

  return (
    <PageShell title="Checkout" intro="Confirm your contact details and pay with a demo test card to reserve this exact vehicle.">
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className={`${cardCls} p-5`}>
          <CheckoutForm
            quoteId={quote.id}
            amountLabel={formatCents(quote.breakdown.dueNowCents)}
            backHref={`/booking/${quote.id}`}
            initial={{
              idempotencyKey: randomUUID(),
              fieldErrors: {},
              values: {
                contactName: (profile?.display_name ?? "").replace(fixtureSuffix, ""),
                contactPhone: profile?.phone ?? "",
                cardExpiry: "",
                cardZip: "",
              },
            }}
          />
        </div>
        <aside className={`${cardCls} h-fit space-y-5 p-5`}>
          <TripSummary vehicle={quote.vehicle} pickupAt={quote.pickupAt} returnAt={quote.returnAt} compact />
          <hr className="border-slate-200" />
          <PriceBreakdownView price={quote.breakdown} heading="Amount due" />
        </aside>
      </div>
    </PageShell>
  );
}
