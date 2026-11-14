import { billableDays } from "@/lib/time";

// PricingService: the single place prices are calculated. Pure and unit tested.
// A booking is priced under exactly one versioned policy (never a mix).

export type PolicyFormula = {
  flatFees: { code: string; label: string; cents: number }[];
  protectionCents: number;
  taxRateBps: number;
};

export type PricingPolicy = {
  id: string;
  key: string;
  version: number;
  formula: PolicyFormula;
};

export type PriceLine = { code: string; label: string; cents: number };

export type ConditionalCharge = { code: string; label: string; description: string };

export type PriceBreakdown = {
  currency: "USD";
  billableDays: number;
  dailyRateCents: number;
  baseCents: number;
  mandatoryFeesCents: number;
  protectionCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
  dueNowCents: number;
  /** False when a source cannot tell us every mandatory fee; the total is then an estimate. */
  complete: boolean;
  policyVersion: string;
  lines: PriceLine[];
  conditionalCharges: ConditionalCharge[];
};

/**
 * Charges that apply only if something happens at return. Shown before
 * checkout, never included in the total. Amounts follow the demo fee policy
 * in the handoff (section 11); damage has no automatic price.
 */
export const CONDITIONAL_CHARGES: ConditionalCharge[] = [
  {
    code: "cleaning",
    label: "Cleaning fee: $50",
    description: "Only if the vehicle is returned Dirty. Light dirt is not charged.",
  },
  {
    code: "fuel",
    label: "Fuel: $20 per quarter tank",
    description: "Only for each quarter tank below the level recorded at pickup.",
  },
  {
    code: "damage",
    label: "Damage",
    description:
      "Not priced automatically. Any damage claim is reviewed against pickup and return photos.",
  },
];

export function policyVersionLabel(policy: Pick<PricingPolicy, "key" | "version">): string {
  return `${policy.key}@v${policy.version}`;
}

export function calculatePrice(input: {
  dailyRateCents: number;
  pickupAt: Date;
  returnAt: Date;
  policy: PricingPolicy;
}): PriceBreakdown {
  const { dailyRateCents, policy } = input;
  if (!Number.isInteger(dailyRateCents) || dailyRateCents <= 0) {
    throw new RangeError("dailyRateCents must be a positive integer");
  }
  const days = billableDays(input.pickupAt, input.returnAt);
  const f = policy.formula;
  const baseCents = dailyRateCents * days;
  const mandatoryFeesCents = f.flatFees.reduce((sum, fee) => sum + fee.cents, 0);
  const protectionCents = f.protectionCents;
  const subtotal = baseCents + mandatoryFeesCents + protectionCents;
  const taxCents = Math.round((subtotal * f.taxRateBps) / 10000);
  const totalCents = subtotal + taxCents;

  const lines: PriceLine[] = [
    { code: "base", label: `${days} day${days === 1 ? "" : "s"} × daily rate`, cents: baseCents },
    ...f.flatFees.map((fee) => ({ code: fee.code, label: fee.label, cents: fee.cents })),
  ];
  if (protectionCents > 0) {
    lines.push({ code: "protection", label: "Protection plan", cents: protectionCents });
  }
  if (f.taxRateBps > 0) {
    lines.push({ code: "tax", label: `Tax (${f.taxRateBps / 100}%)`, cents: taxCents });
  }

  return {
    currency: "USD",
    billableDays: days,
    dailyRateCents,
    baseCents,
    mandatoryFeesCents,
    protectionCents,
    taxCents,
    totalCents,
    depositCents: 0,
    dueNowCents: totalCents,
    complete: true,
    policyVersion: policyVersionLabel(policy),
    lines,
    conditionalCharges: CONDITIONAL_CHARGES,
  };
}
