import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DemoCheckoutForm } from "./demo-checkout-form";
import { VehicleImage } from "@/components/brand";
import { Notice, PageShell, cardCls } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getNow } from "@/lib/clock";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import type { VehicleListing } from "@/server/search/types";

export const metadata: Metadata = { title: "External demo checkout" };

export default async function ExternalDemoCheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound();
  const user = await requireUser(`/external/checkout/${orderId}`);
  const db = await createClient();
  const { data: order } = await db.from("external_demo_orders").select("*").eq("id", orderId).eq("customer_id", user.id).maybeSingle();
  if (!order) notFound();
  if (order.state === "confirmed") redirect(`/external/confirmation/${order.id}`);
  const listing = order.listing_snapshot as unknown as VehicleListing;
  const expired = new Date(order.expires_at).getTime() <= getNow().getTime();
  const { data: profile } = await db.from("profiles").select("display_name, phone").eq("id", user.id).maybeSingle();
  return (
    <PageShell title="Demo checkout" intro={`Review this ${order.provider_name} offer and simulate a Carrus checkout.`}>
      <Notice tone="warning" title="This does not reserve the provider's vehicle">
        Carrus will not contact {order.provider_name} to create a booking or take a payment. For a real rental, use the <a href={order.source_url} target="_blank" rel="noopener noreferrer" className="font-bold underline">original listing</a>.
      </Notice>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className={`${cardCls} p-5`}>
          {expired ? <Notice tone="error">This demo quote has expired. Return to search for a fresh offer.</Notice> : (
            <DemoCheckoutForm orderId={order.id} initial={{ fieldErrors: {}, values: { contactName: (profile?.display_name ?? "").replace(/ \((CUSTOMER|PARTNER)-\d+\)$/, ""), contactPhone: profile?.phone ?? "", cardExpiry: "", cardZip: "" } }} />
          )}
        </section>
        <aside className={`${cardCls} h-fit space-y-4 p-5`}>
          <VehicleImage photoUrl={listing.photoUrl} name={`${listing.make} ${listing.model}`} type={listing.vehicleType} color={listing.color} className="aspect-[3/2] w-full" />
          <h2 className="text-xl font-bold">{listing.year} {listing.make} {listing.model}</h2>
          <p className="text-sm">{listing.exactMatch ? "Exact vehicle" : "Or similar"} · {listing.seats} seats · {listing.transmission}</p>
          <p className="text-sm">{formatDateTime(order.pickup_at, listing.timeZone)} to {formatDateTime(order.return_at, listing.timeZone)}</p>
          <p className="text-sm">{listing.locationLabel}</p>
          <dl className="space-y-1 border-t pt-3 text-sm">
            {listing.price.lines.map((line) => <div key={line.code} className="flex justify-between gap-3"><dt>{line.label}</dt><dd>{formatCents(line.cents)}</dd></div>)}
            <div className="flex justify-between gap-3 border-t pt-2 font-bold"><dt>Provider&apos;s stated total</dt><dd>{formatCents(order.total_cents)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Due at provider checkout</dt><dd>{formatCents(listing.price.dueNowCents)}</dd></div>
            {listing.price.depositCents > 0 && <div className="flex justify-between gap-3"><dt>Deposit</dt><dd>{formatCents(listing.price.depositCents)}</dd></div>}
          </dl>
          <p className="text-sm"><strong>Checkout:</strong> {listing.checkoutDetails}</p>
          <p className="text-sm"><strong>Cancellation:</strong> {listing.cancellationPolicy}</p>
          <div className="flex flex-wrap gap-4 text-sm font-bold text-brand underline">
            <a href={order.source_url} target="_blank" rel="noopener noreferrer">Original listing</a>
            {listing.termsUrl && <a href={listing.termsUrl} target="_blank" rel="noopener noreferrer">Provider terms</a>}
          </div>
          <p className="text-xs text-gray-500">The provider&apos;s live price and availability may change. This Carrus checkout is a simulation.</p>
        </aside>
      </div>
      <p className="mt-5"><Link href="/search" className="font-bold text-brand underline">Back to search</Link></p>
    </PageShell>
  );
}
