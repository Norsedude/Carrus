import { formatCents } from "@/lib/money";
import type { PriceBreakdown } from "@/server/pricing/pricing";

/** Itemized price: every mandatory line, the total, then conditional charges kept visibly separate. */
export function PriceBreakdownView({ price, heading = "Price breakdown" }: { price: PriceBreakdown; heading?: string }) {
  return (
    <section aria-label={heading}>
      <h2 className="text-base font-semibold text-gray-900">{heading}</h2>
      <p className="mt-0.5 text-sm text-gray-600">
        {formatCents(price.dailyRateCents)} per day · {price.billableDays} billable day{price.billableDays === 1 ? "" : "s"} (each
        started 24 hours counts as a day)
      </p>
      <dl className="mt-3 divide-y divide-gray-100 text-sm">
        {price.lines.map((line) => (
          <div key={line.code} className="flex justify-between gap-4 py-1.5">
            <dt className="text-gray-700">{line.label}</dt>
            <dd className="tabular-nums text-gray-900">{formatCents(line.cents)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 py-2 text-base font-bold">
          <dt>{price.complete ? "Trip total" : "Estimated total"}</dt>
          <dd className="tabular-nums" data-testid="price-total">{formatCents(price.totalCents)}</dd>
        </div>
      </dl>
      {price.complete ? (
        <p className="text-sm text-gray-700">
          Due now: <span className="font-semibold tabular-nums">{formatCents(price.dueNowCents)}</span> · Security deposit:{" "}
          <span className="tabular-nums">{formatCents(price.depositCents)}</span>
        </p>
      ) : (
        <p className="text-sm font-medium text-amber-800">
          This is an estimate. This source does not publish all mandatory fees, so the final price may be higher.
        </p>
      )}
      {price.conditionalCharges.length > 0 && (
        <div className="mt-4 rounded-lg bg-gray-50 p-3">
          <h3 className="text-sm font-semibold text-gray-900">Charges that apply only if something happens</h3>
          <p className="text-xs text-gray-600">Not included in the total above.</p>
          <ul className="mt-2 space-y-1.5 text-sm text-gray-700">
            {price.conditionalCharges.map((c) => (
              <li key={c.code}>
                <span className="font-medium text-gray-900">{c.label}.</span> {c.description}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-xs text-gray-500">Pricing policy {price.policyVersion}</p>
    </section>
  );
}

export const CANCELLATION_TEXT: Record<string, string> = {
  free_24h: "Free cancellation up to 24 hours before pickup.",
  unknown: "Cancellation terms are set by the external source and are not known to Carrus.",
};
