import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CheckoutForm } from "@/app/checkout/[quoteId]/checkout-form";
import { PriceBreakdownView } from "@/components/price";
import { TripSummary } from "@/components/trip-summary";
import { PageShell, cardCls } from "@/components/ui";
import { getSessionUser } from "@/lib/auth/session";
import { formatCents } from "@/lib/money";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getQuoteView } from "@/server/booking/service";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  // No account needed: guests enter an email in the form below.
  const user = await getSessionUser();
  const view = await getQuoteView(createAdminClient(), quoteId, user?.id ?? null);
  if (!view) notFound();
  if (view.kind === "booked") redirect(`/bookings/${view.bookingId}/confirmation`);
  // Stale price or availability is explained on the review page.
  if (view.status !== "ok") redirect(`/booking/${quoteId}`);

  const { quote } = view;
  const db = await createClient();
  const { data: profile } = user ? await db.from("profiles").select("display_name, phone").eq("id", user.id).maybeSingle() : { data: null };
  const fixtureSuffix = / \((CUSTOMER|PARTNER)-\d+\)$/;

  return (
    <PageShell title="Checkout" intro={user ? "Confirm your details and pay with a demo card." : "No account needed. Add your email and pay with a demo card."}>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className={`${cardCls} p-5`}>
          <CheckoutForm
            quoteId={quote.id}
            amountLabel={formatCents(quote.breakdown.dueNowCents)}
            backHref={`/booking/${quote.id}`}
            guest={!user}
            requestMode={quote.vehicle.bookingMode === "request"}
            initial={{
              idempotencyKey: randomUUID(),
              fieldErrors: {},
              values: {
                contactName: (profile?.display_name ?? "").replace(fixtureSuffix, ""),
                contactPhone: profile?.phone ?? "",
                cardExpiry: "",
                cardZip: "",
                guestEmail: "",
              },
            }}
          />
        </div>
        <aside className={`${cardCls} h-fit space-y-5 p-5`}>
          <TripSummary vehicle={quote.vehicle} pickupAt={quote.pickupAt} returnAt={quote.returnAt} compact />
          <hr className="border-gray-200" />
          <PriceBreakdownView price={quote.breakdown} heading="Amount due" />
        </aside>
      </div>
    </PageShell>
  );
}
