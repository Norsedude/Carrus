"use client";

import Link from "next/link";
import { useActionState } from "react";
import { checkoutAction, type CheckoutState } from "@/app/actions/booking";
import { Field, Notice, btnPrimary, btnSecondary } from "@/components/ui";

export function CheckoutForm({
  quoteId,
  initial,
  amountLabel,
  backHref,
  guest = false,
  requestMode = false,
}: {
  quoteId: string;
  initial: CheckoutState;
  amountLabel: string;
  backHref: string;
  guest?: boolean;
  requestMode?: boolean;
}) {
  const [state, action, pending] = useActionState(checkoutAction, initial);
  const e = state.fieldErrors;

  if (state.blocked) {
    return (
      <div className="space-y-3" data-testid="checkout-blocked">
        <Notice tone={state.tone ?? "error"} title="Booking not completed">{state.message}</Notice>
        <Link href={backHref} className={btnPrimary}>Back to the vehicle</Link>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-6">
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="idempotencyKey" value={state.idempotencyKey} />
      {state.message && (
        <Notice tone={state.tone ?? "error"}>
          <span data-testid="checkout-message">{state.message}</span>
        </Notice>
      )}

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-gray-900">Driver contact</legend>
        {guest && (
          <Field
            label="Email"
            name="guestEmail"
            type="email"
            autoComplete="email"
            defaultValue={state.values.guestEmail}
            error={e.guestEmail}
            hint="Your confirmation is saved to this email. No account or password needed."
          />
        )}
        <Field label="Full name" name="contactName" autoComplete="name" defaultValue={state.values.contactName} error={e.contactName} />
        <Field label="Mobile phone" name="contactPhone" type="tel" autoComplete="tel" defaultValue={state.values.contactPhone} error={e.contactPhone} hint="Shared with the rental partner for this reservation." />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-gray-900">Payment (demo)</legend>
        <Notice tone="warning" title="Simulated payment. No real charge is made.">
          Do not enter a real card. Use a test card: <code className="font-mono">4242 4242 4242 4242</code> approves,{" "}
          <code className="font-mono">4000 0000 0000 0002</code> declines,{" "}
          <code className="font-mono">4000 0000 0000 0077</code> approves after a short delay. Any future expiry, any 3-digit
          code and any 5-digit ZIP work. Card details are not stored.
        </Notice>
        <Field label="Card number" name="cardNumber" inputMode="numeric" autoComplete="off" error={e.cardNumber} />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Expiry (MM/YY)" name="cardExpiry" autoComplete="off" placeholder="12/30" defaultValue={state.values.cardExpiry} error={e.cardExpiry} />
          <Field label="Security code" name="cardCvc" inputMode="numeric" autoComplete="off" error={e.cardCvc} />
          <Field label="Billing ZIP" name="cardZip" inputMode="numeric" autoComplete="off" defaultValue={state.values.cardZip} error={e.cardZip} />
        </div>
      </fieldset>

      <div>
        <label className="flex items-start gap-2 text-sm text-gray-800">
          <input type="checkbox" name="terms" className="mt-0.5 size-4 accent-brand" aria-invalid={e.terms ? true : undefined} aria-describedby={e.terms ? "terms-error" : undefined} />
          <span>
            I have reviewed the price, the cancellation policy and the charges that can apply at return, and I agree to the
            rental terms for this prototype.
          </span>
        </label>
        {e.terms && <p id="terms-error" className="mt-1 text-sm font-medium text-red-700">{e.terms}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Processing…" : `Pay ${amountLabel} and ${requestMode ? "request" : "reserve"}`}
        </button>
        <Link href={backHref} className={btnSecondary}>Cancel</Link>
      </div>
      <p role="status" className="text-sm text-gray-600">{pending ? "Processing your simulated payment. Please do not close this page." : ""}</p>
    </form>
  );
}
