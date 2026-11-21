import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Notice, PageShell, cardCls } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { DEMO } from "@/server/search/providers/demo-external";

export const metadata: Metadata = { title: "Fictional source listing" };

export default async function DemoSourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (process.env.PROVIDER_MODE !== "native+demo") notFound();
  const vehicle = DEMO.find((item) => item.id === id);
  if (!vehicle) notFound();
  return (
    <PageShell title="Fictional source listing" intro="A local test page for Carrus external demo checkout." narrow>
      <div className="space-y-5">
        <Notice tone="warning" title="No car is available here">
          This is a Carrus-owned fixture, not an outside rental company. The listing, price, and checkout are fictional. Do not use this page to make travel plans.
        </Notice>
        <section className={`${cardCls} space-y-3 p-5`}>
          <h2 className="text-2xl font-bold">{vehicle.year} {vehicle.make} {vehicle.model} or similar</h2>
          <p>{vehicle.type} · {vehicle.seats} seats · automatic transmission</p>
          <p>Near San José Mineta International Airport</p>
          <p>{formatCents(vehicle.dailyCents)}/day plus fictional taxes and fees. The Carrus search result calculates the example trip total.</p>
          <p>Listing ID: {vehicle.id}</p>
        </section>
        <section id="terms" className={`${cardCls} p-5`}>
          <h2 className="text-lg font-bold">Fictional terms</h2>
          <p className="mt-2 text-sm">This source has no inventory, booking service, or payment service. The Carrus demo confirmation is not a reservation.</p>
        </section>
      </div>
    </PageShell>
  );
}
