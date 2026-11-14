// SIMULATED PaymentAdapter. No money moves and no card network is contacted.
// It accepts only the documented demo test cards so a real card number is
// never accepted, and card details are never stored or logged.

export type CardInput = { number: string; expiry: string; cvc: string; zip: string };
export type CardFieldErrors = Partial<Record<"cardNumber" | "cardExpiry" | "cardCvc" | "cardZip", string>>;

export type PaymentResult =
  | { ok: true; providerRef: string; detail: string }
  | { ok: false; providerRef: string; detail: string };

export const DEMO_CARDS = {
  "4242424242424242": { outcome: "succeed", label: "Approves" },
  "4000000000000002": { outcome: "decline", label: "Declines" },
  "4000000000000077": { outcome: "delayed", label: "Approves after a short delay" },
} as const;

const digits = (s: string) => s.replace(/[\s-]/g, "");

export function validateCard(card: CardInput, now: Date): CardFieldErrors {
  const errors: CardFieldErrors = {};
  const number = digits(card.number);
  if (!number) errors.cardNumber = "Enter a card number";
  else if (!(number in DEMO_CARDS)) {
    errors.cardNumber = "Use one of the demo test cards listed above. Never enter a real card.";
  }
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(card.expiry.trim());
  if (!card.expiry.trim()) errors.cardExpiry = "Enter the expiry date";
  else if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) errors.cardExpiry = "Use MM/YY";
  else {
    const endOfMonth = Date.UTC(2000 + Number(m[2]), Number(m[1]), 1);
    if (endOfMonth <= now.getTime()) errors.cardExpiry = "This card has expired";
  }
  if (!card.cvc.trim()) errors.cardCvc = "Enter the security code";
  else if (!/^\d{3}$/.test(card.cvc.trim())) errors.cardCvc = "Enter the 3-digit security code";
  if (!card.zip.trim()) errors.cardZip = "Enter the billing ZIP code";
  else if (!/^\d{5}$/.test(card.zip.trim())) errors.cardZip = "Enter a 5-digit ZIP code";
  return errors;
}

/**
 * Charge is idempotent per attempt: the reference is derived from the attempt
 * id, and the payments table enforces its uniqueness.
 */
export async function chargeSimulated(input: {
  attemptId: string;
  amountCents: number;
  cardNumber: string;
  delayMs?: number;
}): Promise<PaymentResult> {
  const providerRef = `sim_${input.attemptId}`;
  const card = DEMO_CARDS[digits(input.cardNumber) as keyof typeof DEMO_CARDS];
  if (!card) return { ok: false, providerRef, detail: "invalid_card" };
  if (card.outcome === "decline") return { ok: false, providerRef, detail: "card_declined" };
  if (card.outcome === "delayed") {
    await new Promise((resolve) => setTimeout(resolve, input.delayMs ?? 1500));
  }
  return { ok: true, providerRef, detail: "simulated_approval" };
}
