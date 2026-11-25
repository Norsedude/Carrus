import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VehicleImage } from "@/components/brand";
import { PhotoCredit } from "@/components/photo-credit";
import { Notice, PageShell, cardCls } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { DEMO } from "@/server/search/providers/demo-external";
import { PUBLIC_DEMO_CATALOG, catalogPhoto, publicDemoEnabled } from "@/server/search/providers/public-demo";

export const metadata: Metadata = { title: "Demo source listing" };

export default async function DemoSourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const publicCar = publicDemoEnabled() ? PUBLIC_DEMO_CATALOG.find((item) => item.id === id) : undefined;
  if (publicCar) return <PublicDemoListing car={publicCar} />;
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

async function PublicDemoListing({ car }: { car: (typeof PUBLIC_DEMO_CATALOG)[number] }) {
  const photo = await catalogPhoto(car).catch(() => null);
  const name = `2024 ${car.make} ${car.model}`;
  return (
    <PageShell title="Demo listing" intro="Real vehicle data and freely licensed photos, with a demo price." narrow>
      <div className="space-y-5">
        <Notice tone="warning" title="This is not a real rental offer">
          No rental company is connected. The price, pickup point and availability were generated for the Carrus demo, and demo checkout does not reserve a car or take payment.
        </Notice>
        <section className={`${cardCls} space-y-3 p-5`}>
          <VehicleImage photoUrl={photo?.url} name={name} type={car.type} color="" className="aspect-[3/2] w-full" sizes="40rem" />
          <PhotoCredit credit={photo ?? undefined} className="break-words" />
          <h2 className="text-2xl font-bold">{name} or similar</h2>
          <p>{car.type} · {car.seats} seats · {car.transmission}</p>
          <p>{formatCents(car.dailyCents)}/day demo rate plus 12% demo taxes and fees.</p>
          <p>Listing ID: {car.id}</p>
        </section>
        <section className={`${cardCls} space-y-2 p-5 text-sm`}>
          <h2 className="text-lg font-bold">Where this data comes from</h2>
          <p>
            Make, model and year are checked against the{" "}
            <a className="font-bold text-brand underline" href="https://vpic.nhtsa.dot.gov/api/" target="_blank" rel="noopener noreferrer">NHTSA vPIC vehicle database</a>, a free U.S. government service whose data is in the public domain.
          </p>
          <p>The photo is a freely licensed image from Wikimedia Commons, credited above under its stated license. It shows the model, not a specific rental car.</p>
        </section>
        <section id="terms" className={`${cardCls} p-5`}>
          <h2 className="text-lg font-bold">Demo terms</h2>
          <p className="mt-2 text-sm">This listing has no inventory, booking service, or payment service behind it. A Carrus demo confirmation is not a reservation.</p>
        </section>
      </div>
    </PageShell>
  );
}
