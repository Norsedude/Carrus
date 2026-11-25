"use client";

import { useActionState } from "react";
import { confirmExternalDemoAction, type ExternalDemoState } from "@/app/actions/external-demo";
import { Field, Notice, btnPrimary } from "@/components/ui";

export function DemoCheckoutForm({
  orderId,
  guest,
  initial,
}: {
  orderId?: string;
  /** Guest checkout: the offer to create the order from (no account needed). */
  guest?: Record<string, string>;
  initial: ExternalDemoState;
}) {
  const [state, action, pending] = useActionState(confirmExternalDemoAction, initial);
  const e = state.fieldErrors;
  return (
    <form action={action} noValidate className="space-y-5">
      {orderId && <input type="hidden" name="orderId" value={orderId} />}
      {guest && (
        <>
          <input type="hidden" name="guest" value="1" />
          {Object.entries(guest).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        </>
      )}
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <fieldset className="space-y-4">
        <legend className="font-bold">Driver contact</legend>
        {guest && (
          <Field label="Email" name="guestEmail" type="email" autoComplete="email" defaultValue={state.values.guestEmail} error={e.guestEmail} hint="Your confirmation is saved to this email. No account needed." />
        )}
        <Field label="Full name" name="contactName" autoComplete="name" defaultValue={state.values.contactName} error={e.contactName} />
        <Field label="Mobile phone" name="contactPhone" type="tel" autoComplete="tel" defaultValue={state.values.contactPhone} error={e.contactPhone} />
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="font-bold">Demo card</legend>
        <Notice tone="warning" title="No real payment or provider booking">
          Use only demo cards: 4242 4242 4242 4242 approves; 4000 0000 0000 0002 declines. Any future expiry, 3-digit code and 5-digit ZIP work. Card details are never stored.
        </Notice>
        <Field label="Card number" name="cardNumber" inputMode="numeric" autoComplete="off" error={e.cardNumber} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Expiry (MM/YY)" name="cardExpiry" placeholder="12/30" autoComplete="off" defaultValue={state.values.cardExpiry} error={e.cardExpiry} />
          <Field label="Security code" name="cardCvc" inputMode="numeric" autoComplete="off" error={e.cardCvc} />
          <Field label="Billing ZIP" name="cardZip" inputMode="numeric" autoComplete="off" defaultValue={state.values.cardZip} error={e.cardZip} />
        </div>
      </fieldset>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="terms" className="mt-0.5 size-4 accent-brand" aria-invalid={Boolean(e.terms)} />
        <span>I understand this is a Carrus demo checkout. It does not reserve a car with the provider or charge a card. I must use the original listing to make a real booking.</span>
      </label>
      {e.terms && <p className="text-sm font-bold text-red-700">{e.terms}</p>}
      <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Processing demo…" : "Complete demo checkout"}</button>
    </form>
  );
}
