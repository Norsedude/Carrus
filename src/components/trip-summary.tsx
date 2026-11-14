import { VehicleArt } from "@/components/brand";
import { CANCELLATION_TEXT } from "@/components/price";
import { formatDateTime } from "@/lib/time";
import type { VehicleSnapshot } from "@/server/booking/service";

/** The specific vehicle, dates and policy for a quote or booking (from its stored snapshot). */
export function TripSummary({ vehicle, pickupAt, returnAt, compact }: { vehicle: VehicleSnapshot; pickupAt: string; returnAt: string; compact?: boolean }) {
  return (
    <section aria-label="Trip summary" className={`flex flex-col gap-4 ${compact ? "" : "sm:flex-row"}`}>
      <VehicleArt type={vehicle.vehicleType} color={vehicle.color} className={`h-auto w-full shrink-0 ${compact ? "max-w-48" : "sm:w-40"}`} />
      <div className="text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900" data-testid="trip-vehicle">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </h2>
        <p>
          {vehicle.color ? `${vehicle.color} · ` : ""}{vehicle.vehicleType} · {vehicle.seats} seats · {vehicle.transmission} · Listing {vehicle.publicCode}
        </p>
        <p className="mt-1 font-medium text-slate-900">This reservation is for this exact vehicle.</p>
        <dl className="mt-3 space-y-1">
          <div><dt className="inline text-slate-600">Pickup: </dt><dd className="inline font-medium text-slate-900">{formatDateTime(pickupAt, vehicle.timeZone)}</dd></div>
          <div><dt className="inline text-slate-600">Return: </dt><dd className="inline font-medium text-slate-900">{formatDateTime(returnAt, vehicle.timeZone)}</dd></div>
          <div><dt className="inline text-slate-600">Where: </dt><dd className="inline">{vehicle.locationLabel}</dd></div>
          <div><dt className="inline text-slate-600">Partner: </dt><dd className="inline">{vehicle.partnerName}</dd></div>
          <div><dt className="inline text-slate-600">Cancellation: </dt><dd className="inline">{CANCELLATION_TEXT[vehicle.cancellationPolicy] ?? vehicle.cancellationPolicy}</dd></div>
        </dl>
      </div>
    </section>
  );
}
