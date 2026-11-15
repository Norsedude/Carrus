import { VehicleImage } from "@/components/brand";
import { CANCELLATION_TEXT } from "@/components/price";
import { formatDateTime } from "@/lib/time";
import type { VehicleSnapshot } from "@/server/booking/service";

/** The specific vehicle, dates and policy for a quote or booking (from its stored snapshot). */
export function TripSummary({ vehicle, pickupAt, returnAt, compact }: { vehicle: VehicleSnapshot; pickupAt: string; returnAt: string; compact?: boolean }) {
  const name = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  return (
    <section aria-label="Trip summary" className={`flex flex-col gap-5 ${compact ? "" : "sm:flex-row"}`}>
      <VehicleImage
        photoUrl={vehicle.photoUrl}
        name={name}
        type={vehicle.vehicleType}
        color={vehicle.color}
        className={`aspect-[3/2] w-full ${compact ? "" : "sm:w-64"}`}
        sizes="(min-width: 640px) 24rem, 100vw"
      />
      <div className="text-[0.95rem] text-gray-600">
        <h2 className="text-2xl font-bold text-gray-900" data-testid="trip-vehicle">
          {name}
        </h2>
        <p>
          {vehicle.color ? `${vehicle.color} · ` : ""}
          {vehicle.vehicleType} · {vehicle.seats} seats · {vehicle.transmission} · Listing {vehicle.publicCode}
        </p>
        <p className="mt-1 font-bold text-gray-900">This reservation is for this exact vehicle.</p>
        <dl className="mt-3 space-y-1">
          <div><dt className="inline text-gray-500">Pickup: </dt><dd className="inline text-gray-900">{formatDateTime(pickupAt, vehicle.timeZone)}</dd></div>
          <div><dt className="inline text-gray-500">Return: </dt><dd className="inline text-gray-900">{formatDateTime(returnAt, vehicle.timeZone)}</dd></div>
          <div><dt className="inline text-gray-500">Where: </dt><dd className="inline">{vehicle.locationLabel}</dd></div>
          <div><dt className="inline text-gray-500">Hosted by: </dt><dd className="inline">{vehicle.partnerName}</dd></div>
          <div><dt className="inline text-gray-500">Cancellation: </dt><dd className="inline">{CANCELLATION_TEXT[vehicle.cancellationPolicy] ?? vehicle.cancellationPolicy}</dd></div>
        </dl>
      </div>
    </section>
  );
}
