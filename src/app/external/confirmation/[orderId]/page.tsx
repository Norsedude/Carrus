import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice, PageShell, btnPrimary, cardCls } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import type { VehicleListing } from "@/server/search/types";

export const metadata: Metadata = { title: "Demo checkout complete" };

export default async function ExternalDemoConfirmationPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound();
  const user = await requireUser(`/external/confirmation/${orderId}`);
  const db = await createClient();
  const { data: order } = await db.from("external_demo_orders").select("*").eq("id", orderId).eq("customer_id", user.id).eq("state", "confirmed").maybeSingle();
  if (!order) notFound();
  const listing = order.listing_snapshot as unknown as VehicleListing;
  return (
    <PageShell title="Demo checkout complete" intro={`Carrus demo reference ${order.demo_reference}`} narrow>
      <div className="space-y-5">
        <Notice tone="warning" title="No provider booking was made">
          This confirms only the Carrus simulation. No real payment was taken, and {order.provider_name} has not reserved a vehicle. Visit the original listing to book for real.
        </Notice>
        <section className={`${cardCls} space-y-3 p-5`}>
          <h2 className="text-xl font-bold">{listing.year} {listing.make} {listing.model}</h2>
          <p>{formatDateTime(order.pickup_at, listing.timeZone)} to {formatDateTime(order.return_at, listing.timeZone)}</p>
          <p>{listing.locationLabel} · {order.provider_name}</p>
          <p>Provider&apos;s stated total: <strong>{formatCents(order.total_cents)}</strong></p>
          <p className="text-sm">Driver: {order.contact_name}</p>
          <a href={order.source_url} target="_blank" rel="noopener noreferrer" className={btnPrimary}>Open original listing to book</a>
        </section>
        <Link href="/trips" className="font-bold text-brand underline">View my trips and demos</Link>
      </div>
    </PageShell>
  );
}
