import Link from "next/link";
import { startExternalDemoAction } from "@/app/actions/external-demo";
import { ArrowUpRight, BadgeCheck, Building2, MapPin } from "lucide-react";
import { VehicleImage } from "@/components/brand";
import { CompareToggle } from "@/components/compare";
import { PhotoCredit } from "@/components/photo-credit";
import { Badge, btnPrimary, cardCls } from "@/components/ui";
import { formatCents } from "@/lib/money";
import type { VehicleListing } from "@/server/search/types";

export function vehicleName(l: { year: number; make: string; model: string }): string {
  return `${l.year} ${l.make} ${l.model}`;
}

export function vehicleHref(id: string, trip: { pickup: string; ret: string; location: string }): string {
  const params = new URLSearchParams({ pickup: trip.pickup, return: trip.ret, location: trip.location });
  return `/vehicles/${id}?${params.toString()}`;
}

const wholeDollars = (cents: number) => (cents % 100 === 0 ? `$${cents / 100}` : formatCents(cents));

/** Search result row: photo, the exact vehicle, who offers it, and the all-in total. */
export function VehicleCard({ listing, trip }: { listing: VehicleListing; trip: { pickup: string; ret: string; location: string; radius?: number } }) {
  const name = vehicleName(listing);
  const native = listing.bookingCapability === "native_booking";
  const days = listing.price.billableDays;
  const specs = [listing.year, `${listing.seats} seats`, listing.transmission, listing.vehicleType].join(" · ");
  return (
    <li className={`${cardCls} lift group flex flex-col gap-5 p-4 md:flex-row md:p-5`} data-testid="vehicle-card" data-code={listing.publicCode}>
      <div className="relative w-full shrink-0 md:w-64">
        <VehicleImage
          photoUrl={listing.photoUrl}
          name={name}
          type={listing.vehicleType}
          color={listing.color}
          className="photo-luxe aspect-[3/2] w-full rounded-xl"
          sizes="(min-width: 768px) 16rem, 100vw"
        />
        {/* Every result can be compared: Carrus cars, demo listings and partner offers. */}
        <div className="absolute left-2.5 top-2.5">
          <CompareToggle variant="overlay" id={listing.id} name={`${listing.make} ${listing.model}`} pickup={trip.pickup} ret={trip.ret} location={trip.location} />
        </div>
        <PhotoCredit credit={listing.photoCredit} className="mt-1.5" />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <h3 className="text-[1.6rem] text-gray-900">
          {listing.make} {listing.model}
        </h3>
        <p className="text-[0.95rem] text-gray-600">{specs}</p>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.9rem] text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden />
            {listing.distanceMiles !== null ? `${listing.distanceMiles.toFixed(1)} mi away` : listing.locationLabel}
          </span>
          {listing.partner && (
            <span className="inline-flex items-center gap-1.5">
              {listing.partner.verified ? <BadgeCheck className="size-4 text-accent" aria-hidden /> : <Building2 className="size-4" aria-hidden />}
              {listing.partner.displayName}
              {listing.partner.verified && <span className="sr-only">, verified partner</span>}
            </span>
          )}
        </p>
        <p className="flex flex-wrap gap-1.5 pt-1">
          {listing.cancellationPolicy === "free_24h" && <Badge tone="green">Free cancellation</Badge>}
          {listing.exactMatch ? <Badge tone="blue">Exact vehicle</Badge> : <Badge tone="amber">Or similar</Badge>}
          {listing.isMockSource && <Badge tone="amber">Demo</Badge>}
        </p>
        {!native && listing.sourceUrl && (
          <details className="pt-1 text-sm text-gray-700">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900 [&::-webkit-details-marker]:hidden">
              Price breakdown
            </summary>
            <div className="mt-3 space-y-2 rounded-xl bg-gray-50 p-4">
              <dl className="space-y-1">
                {listing.price.lines.map((line) => (
                  <div key={line.code} className="flex justify-between gap-4"><dt>{line.label}</dt><dd className="tabular-nums">{formatCents(line.cents)}</dd></div>
                ))}
                <div className="flex justify-between gap-4 border-t hairline pt-1 font-semibold text-gray-900"><dt>Total</dt><dd className="tabular-nums">{formatCents(listing.price.totalCents)}</dd></div>
                {listing.price.depositCents > 0 && <div className="flex justify-between gap-4"><dt>Deposit</dt><dd>{formatCents(listing.price.depositCents)}</dd></div>}
              </dl>
              <p className="text-xs text-gray-500">{listing.cancellationPolicy}</p>
              {listing.termsUrl && <a href={listing.termsUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-gray-900 underline underline-offset-4">Terms</a>}
            </div>
          </details>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-1 border-t hairline pt-4 md:w-48 md:items-end md:border-l md:border-t-0 md:pl-5 md:pt-0 md:text-right">
        <p className="text-sm text-gray-500">{wholeDollars(listing.dailyRateCents)}/day</p>
        <p className="font-display text-[1.65rem] font-semibold tabular-nums tracking-[-0.02em] text-gray-900">
          <span className="sr-only">Estimated total </span>
          <span data-testid="card-total">{formatCents(listing.price.totalCents)}</span>
        </p>
        <p className="text-sm text-gray-500">
          {listing.price.complete ? `${days} day${days === 1 ? "" : "s"} · all-in` : "Estimate"}
        </p>
        {native ? (
          <Link href={vehicleHref(listing.id, trip)} className={`${btnPrimary} mt-3 w-full md:w-auto`}>
            View deal<span className="sr-only">: {name}</span>
          </Link>
        ) : listing.sourceUrl ? (
          <>
            <form action={startExternalDemoAction} className="mt-3 w-full md:w-auto">
              <input type="hidden" name="providerKey" value={listing.providerKey} />
              <input type="hidden" name="listingId" value={listing.providerListingId} />
              <input type="hidden" name="location" value={trip.location} />
              <input type="hidden" name="pickup" value={trip.pickup} />
              <input type="hidden" name="return" value={trip.ret} />
              <input type="hidden" name="radius" value={trip.radius ?? 25} />
              <button type="submit" className={`${btnPrimary} w-full whitespace-nowrap md:w-auto`}>Demo checkout</button>
            </form>
            <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900">
              {listing.isMockSource ? "About this listing" : "Original listing"}<span className="sr-only">: {name}</span>
            </a>
          </>
        ) : (
          <p className="mt-2 text-xs text-gray-500">Not bookable on Carrus.</p>
        )}
      </div>
    </li>
  );
}

/** Compact card for the home page: photo, name, daily rate. */
export function FeaturedCard({ listing, trip }: { listing: VehicleListing; trip: { pickup: string; ret: string; location: string } }) {
  const name = vehicleName(listing);
  return (
    <div className="lift group relative rounded-2xl">
      <VehicleImage photoUrl={listing.photoUrl} name={name} type={listing.vehicleType} color={listing.color} className="photo-luxe aspect-[4/3] w-full rounded-2xl" />
      <div className="px-1 pb-1 pt-4">
        <h3 className="text-[1.45rem] text-gray-900">
          <Link href={vehicleHref(listing.id, trip)} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-brand">
            {listing.make} {listing.model}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {listing.year} · {listing.vehicleType} · {listing.seats} seats
        </p>
        <p className="mt-3 flex items-baseline justify-between border-t hairline pt-3">
          <span className="font-display text-xl font-semibold text-gray-900">{wholeDollars(listing.dailyRateCents)}<span className="font-sans text-sm font-normal text-gray-500">/day</span></span>
          <ArrowUpRight className="size-5 text-gray-400 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gray-900" aria-hidden />
        </p>
      </div>
    </div>
  );
}
