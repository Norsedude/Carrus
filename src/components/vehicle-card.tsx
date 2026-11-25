import Link from "next/link";
import { startExternalDemoAction } from "@/app/actions/external-demo";
import { Building2, MapPin, UserRound } from "lucide-react";
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
  return (
    <li className={`${cardCls} flex flex-col gap-5 p-4 md:flex-row`} data-testid="vehicle-card" data-code={listing.publicCode}>
      <div className="w-full shrink-0 md:w-64">
        <VehicleImage
          photoUrl={listing.photoUrl}
          name={name}
          type={listing.vehicleType}
          color={listing.color}
          className="aspect-[3/2] w-full"
          sizes="(min-width: 768px) 16rem, 100vw"
        />
        <PhotoCredit credit={listing.photoCredit} className="mt-1.5 break-words" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <h3 className="text-2xl font-bold text-gray-900">
          {listing.make} {listing.model}
        </h3>
        <p className="text-[0.95rem] text-gray-500">
          {listing.year}
          {listing.color ? ` · ${listing.color}` : ""}
        </p>
        {listing.partner && (
          <p className="flex items-center gap-2 text-[0.95rem] text-gray-600">
            {listing.partner.kind === "company" ? <Building2 className="size-4 text-brand" aria-hidden /> : <UserRound className="size-4 text-brand" aria-hidden />}
            {listing.partner.displayName}
            {listing.partner.verified && " · Verified partner"}
          </p>
        )}
        <p className="flex items-center gap-2 text-[0.95rem] text-gray-600">
          <MapPin className="size-4 text-gray-500" aria-hidden />
          {listing.distanceMiles !== null ? `${listing.distanceMiles.toFixed(1)} mi from ${trip.location}` : listing.locationLabel}
        </p>
        <p className="text-[0.95rem] text-gray-900">
          {listing.seats} seats · {listing.transmission} · {listing.vehicleType}
        </p>
        {!native && listing.sourceUrl && (
          <details className="pt-2 text-sm text-gray-700">
            <summary className="cursor-pointer font-bold text-brand">Photos, price breakdown and rental details</summary>
            <div className="mt-3 space-y-3">
              {listing.photoUrls && listing.photoUrls.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {listing.photoUrls.slice(1).map((url, index) => (
                    <VehicleImage key={url} photoUrl={url} name={`${name}, photo ${index + 2}`} type={listing.vehicleType} color={listing.color} className="aspect-[3/2] w-36" sizes="9rem" />
                  ))}
                </div>
              )}
              {listing.description && <p>{listing.description}</p>}
              <dl className="space-y-1">
                {listing.price.lines.map((line) => (
                  <div key={line.code} className="flex justify-between gap-4"><dt>{line.label}</dt><dd>{formatCents(line.cents)}</dd></div>
                ))}
                <div className="flex justify-between gap-4 border-t pt-1 font-bold"><dt>Total</dt><dd>{formatCents(listing.price.totalCents)}</dd></div>
                <div className="flex justify-between gap-4"><dt>Due at provider checkout</dt><dd>{formatCents(listing.price.dueNowCents)}</dd></div>
                {listing.price.depositCents > 0 && <div className="flex justify-between gap-4"><dt>Deposit</dt><dd>{formatCents(listing.price.depositCents)}</dd></div>}
              </dl>
              <p><strong>Checkout:</strong> {listing.checkoutDetails}</p>
              <p><strong>Cancellation:</strong> {listing.cancellationPolicy}</p>
              {listing.termsUrl && <a href={listing.termsUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-brand underline">Provider terms</a>}
              <p className="text-xs text-gray-500">Price and availability are supplied by {listing.providerName} and must be confirmed on its checkout page.</p>
            </div>
          </details>
        )}
        <p className="flex flex-wrap gap-2 pt-1">
          {listing.cancellationPolicy === "free_24h" && <Badge tone="green">Free cancellation</Badge>}
          {listing.exactMatch ? <Badge tone="blue">Exact vehicle</Badge> : <Badge tone="amber">Or similar</Badge>}
          {listing.isMockSource && <Badge tone="amber">Demo rental source</Badge>}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 md:w-48 md:items-end md:text-right">
        <p className="text-[0.95rem] text-gray-500">{wholeDollars(listing.dailyRateCents)}/day</p>
        <p className="text-2xl font-bold tabular-nums text-gray-900">
          <span className="text-base font-normal text-gray-500">Est. total </span>
          <span data-testid="card-total">{formatCents(listing.price.totalCents)}</span>
        </p>
        <p className="text-sm text-gray-500">
          {listing.price.complete
            ? `${days} day${days === 1 ? "" : "s"}, taxes and fees included`
            : "Estimate: this source does not publish all fees"}
        </p>
        {native ? (
          <>
            <Link href={vehicleHref(listing.id, trip)} className={`${btnPrimary} mt-1 w-full md:w-auto`}>
              View deal<span className="sr-only">: {name}</span>
            </Link>
            <div className="mt-1">
              <CompareToggle id={listing.id} name={`${listing.make} ${listing.model}`} pickup={trip.pickup} ret={trip.ret} location={trip.location} />
            </div>
          </>
        ) : listing.sourceUrl ? (
          <>
            <form action={startExternalDemoAction}>
              <input type="hidden" name="providerKey" value={listing.providerKey} />
              <input type="hidden" name="listingId" value={listing.providerListingId} />
              <input type="hidden" name="location" value={trip.location} />
              <input type="hidden" name="pickup" value={trip.pickup} />
              <input type="hidden" name="return" value={trip.ret} />
              <input type="hidden" name="radius" value={trip.radius ?? 25} />
              <button type="submit" className={`${btnPrimary} mt-1 w-full md:w-auto`}>Try demo checkout</button>
            </form>
            <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-brand underline">
              {listing.isMockSource ? "Demo listing details" : "View original listing"}<span className="sr-only">: {name}</span>
            </a>
            <p className="text-xs text-gray-600">Demo checkout makes no provider reservation or payment. To rent, book with the provider.</p>
          </>
        ) : (
          <p className="text-xs text-gray-600">
            Not bookable on Carrus. A fictional listing showing how an external source would appear; no external site is linked.
          </p>
        )}
      </div>
    </li>
  );
}

/** Compact card for the home page: photo, name, daily rate. */
export function FeaturedCard({ listing, trip }: { listing: VehicleListing; trip: { pickup: string; ret: string; location: string } }) {
  const name = vehicleName(listing);
  return (
    <li className={`${cardCls} group relative p-2.5 transition-shadow hover:shadow-md`}>
      <VehicleImage photoUrl={listing.photoUrl} name={name} type={listing.vehicleType} color={listing.color} className="aspect-[15/8] w-full" />
      <div className="px-1.5 pb-1 pt-3">
        <h3 className="text-xl font-bold text-gray-900">
          <Link href={vehicleHref(listing.id, trip)} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-brand">
            {listing.make} {listing.model}
          </Link>
        </h3>
        <p className="mt-0.5 text-sm text-gray-500">
          {listing.year} · {listing.vehicleType} · {listing.seats} seats
        </p>
        <p className="mt-3 border-t border-gray-200 pt-3 text-base font-bold text-gray-900">{wholeDollars(listing.dailyRateCents)}/day</p>
      </div>
    </li>
  );
}
