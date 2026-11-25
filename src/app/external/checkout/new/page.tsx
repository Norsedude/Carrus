import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DemoCheckoutForm } from "../[orderId]/demo-checkout-form";
import { VehicleImage } from "@/components/brand";
import { PhotoCredit } from "@/components/photo-credit";
import { Notice, PageShell, cardCls } from "@/components/ui";
import { getSessionUser } from "@/lib/auth/session";
import { getNow } from "@/lib/clock";
import { formatCents } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { freshExternalListing } from "@/server/booking/external-demo";
import { validateSearch, type RawParams } from "@/server/search/validator";

export const metadata: Metadata = { title: "Demo checkout" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Guest demo checkout for an external offer: no account, just an email. */
export default async function GuestExternalCheckoutPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const raw = await searchParams;
  const offer = {
    providerKey: one(raw.providerKey),
    listingId: one(raw.listingId),
    location: one(raw.location),
    pickup: one(raw.pickup),
    return: one(raw.return),
    radius: one(raw.radius) || "25",
  };
  const searchUrl = `/search?${new URLSearchParams({ location: offer.location, pickup: offer.pickup, return: offer.return, radius: offer.radius })}`;
  const validated = validateSearch({ location: offer.location, pickup: offer.pickup, return: offer.return, radius: offer.radius }, getNow());
  if (!validated.ok || !offer.providerKey || !offer.listingId) redirect(searchUrl);
  const { criteria } = validated;
  const listing = await freshExternalListing(offer.providerKey, offer.listingId, {
    pickupAt: criteria.pickupAt,
    returnAt: criteria.returnAt,
    coordinates: criteria.coordinates,
    radiusMiles: criteria.radiusMiles,
    timeZone: criteria.timeZone,
  }).catch(() => null);
  if (!listing || !listing.sourceUrl || !listing.price.complete) redirect(`${searchUrl}&external=unavailable`);

  const user = await getSessionUser();
  return (
    <PageShell title="Demo checkout" intro="No account needed. Add your email and use a demo card.">
      <Notice tone="warning" title="This does not reserve a real car">
        Carrus will not contact {listing.providerName} to create a booking or take a payment.
      </Notice>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className={`${cardCls} p-6`}>
          <DemoCheckoutForm
            guest={offer}
            initial={{ fieldErrors: {}, values: { contactName: user?.displayName ?? "", contactPhone: "", cardExpiry: "", cardZip: "", guestEmail: user?.email ?? "" } }}
          />
        </section>
        <aside className={`${cardCls} h-fit space-y-4 p-5`}>
          <VehicleImage photoUrl={listing.photoUrl} name={`${listing.make} ${listing.model}`} type={listing.vehicleType} color={listing.color} className="aspect-[3/2] w-full rounded-xl" />
          <PhotoCredit credit={listing.photoCredit} className="-mt-2" />
          <h2 className="text-xl">{listing.year} {listing.make} {listing.model}</h2>
          <p className="text-sm text-gray-600">{listing.exactMatch ? "Exact vehicle" : "Or similar"} · {listing.seats} seats · {listing.transmission}</p>
          <p className="text-sm text-gray-600">{formatDateTime(criteria.pickupAt, criteria.timeZone)} to {formatDateTime(criteria.returnAt, criteria.timeZone)}</p>
          <dl className="space-y-1 border-t hairline pt-3 text-sm">
            {listing.price.lines.map((line) => (
              <div key={line.code} className="flex justify-between gap-3"><dt>{line.label}</dt><dd className="tabular-nums">{formatCents(line.cents)}</dd></div>
            ))}
            <div className="flex justify-between gap-3 border-t hairline pt-2 font-semibold text-gray-900"><dt>Total</dt><dd className="tabular-nums">{formatCents(listing.price.totalCents)}</dd></div>
          </dl>
          <p className="text-xs text-gray-500">{listing.cancellationPolicy}</p>
        </aside>
      </div>
    </PageShell>
  );
}
