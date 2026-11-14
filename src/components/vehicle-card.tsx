import Link from "next/link";
import { VehicleArt } from "@/components/brand";
import { CompareToggle } from "@/components/compare";
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

export function VehicleCard({ listing, trip }: { listing: VehicleListing; trip: { pickup: string; ret: string; location: string } }) {
  const name = vehicleName(listing);
  const native = listing.bookingCapability === "native_booking";
  return (
    <li className={`${cardCls} flex flex-col gap-4 p-4 sm:flex-row`} data-testid="vehicle-card" data-code={listing.publicCode}>
      <VehicleArt type={listing.vehicleType} color={listing.color} className="h-auto w-full shrink-0 sm:w-44" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900">{name}</h3>
          {listing.exactMatch ? <Badge tone="blue">Exact vehicle</Badge> : <Badge tone="amber">Or similar</Badge>}
          {listing.isMockSource && <Badge tone="amber">Demo rental source</Badge>}
        </div>
        <p className="mt-1 text-sm text-slate-700">
          {listing.vehicleType} · {listing.seats} seats · {listing.transmission}
          {listing.color ? ` · ${listing.color}` : ""}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {listing.locationLabel}
          {listing.distanceMiles !== null && ` · ${listing.distanceMiles.toFixed(1)} mi away`}
        </p>
        {listing.partner && (
          <p className="mt-1 text-sm text-slate-600">
            Offered by {listing.partner.displayName}
            {listing.partner.verified && " · Verified partner"}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:w-52 sm:items-end sm:text-right">
        <p className="text-sm text-slate-700">
          <span className="tabular-nums">{formatCents(listing.dailyRateCents)}</span> / day
        </p>
        <p className="text-xl font-bold tabular-nums text-slate-900" data-testid="card-total">
          {formatCents(listing.price.totalCents)}
        </p>
        <p className="text-xs text-slate-600">
          {listing.price.complete
            ? `Trip total for ${listing.price.billableDays} day${listing.price.billableDays === 1 ? "" : "s"}, all mandatory fees included`
            : "Estimate only: mandatory fees not published by this source"}
        </p>
        {native ? (
          <>
            <Link href={vehicleHref(listing.id, trip)} className={`${btnPrimary} w-full sm:w-auto`}>
              View details<span className="sr-only">: {name}</span>
            </Link>
            <CompareToggle id={listing.id} name={name} pickup={trip.pickup} ret={trip.ret} location={trip.location} />
          </>
        ) : (
          <p className="text-xs text-slate-600">
            Not bookable on Carrus. This is a fictional listing showing how an external source would appear; no external site
            is linked.
          </p>
        )}
      </div>
    </li>
  );
}
