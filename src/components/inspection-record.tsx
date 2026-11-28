import { cardCls } from "@/components/ui";
import { formatDateTime } from "@/lib/time";
import { CATEGORY_FIELD_LABELS } from "@/server/inspections/rules";
import type { InspectionView } from "@/server/inspections/service";

/** A saved condition check: the three selections and the timestamped photos. Read-only. */
export function InspectionRecord({ inspection, timeZone }: { inspection: InspectionView; timeZone: string }) {
  const title = inspection.stage === "pickup" ? "Pickup condition check" : "Return inspection";
  const by = inspection.performedRole === "customer" ? "the customer" : "the partner";
  return (
    <section className={`${cardCls} p-5`} aria-labelledby={`inspection-${inspection.stage}`}>
      <h2 id={`inspection-${inspection.stage}`} className="text-base font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-700">Saved by {by} on {formatDateTime(inspection.acknowledgedAt, timeZone)}</p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div><dt className="text-gray-600">Exterior damage</dt><dd className="font-medium text-gray-900">{inspection.exteriorDamage}</dd></div>
        <div><dt className="text-gray-600">Fuel level</dt><dd className="font-medium text-gray-900">{inspection.fuelLevel}</dd></div>
        <div><dt className="text-gray-600">Cleanliness</dt><dd className="font-medium text-gray-900">{inspection.cleanliness}</dd></div>
      </dl>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {inspection.photos.map((p) => (
          <li key={p.category} className="text-sm">
            {p.url ? (
              <a href={p.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-gray-200">
                {/* Short-lived signed link to a private file, so the Next.js image optimizer is not used. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`${CATEGORY_FIELD_LABELS[p.category]} at ${inspection.stage}`} className="aspect-[4/3] w-full object-cover" />
              </a>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600">Photo unavailable</div>
            )}
            <p className="mt-1 font-medium text-gray-900">{CATEGORY_FIELD_LABELS[p.category]}</p>
            <p className="text-gray-600">Uploaded {formatDateTime(p.uploadedAt, timeZone)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
