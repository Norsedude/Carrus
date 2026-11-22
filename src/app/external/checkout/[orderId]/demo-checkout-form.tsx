"use client";

import { useActionState } from "react";
import { confirmExternalDemoAction, type ExternalDemoState } from "@/app/actions/external-demo";
import { Field, Notice, btnPrimary } from "@/components/ui";

export function DemoCheckoutForm({ orderId, initial }: { orderId: string; initial: ExternalDemoState }) {
  const [state, action, pending] = useActionState(confirmExternalDemoAction, initial);
  const e = state.fieldErrors;
  return (
    <form action={action} noValidate className="space-y-5">
      <input type="hidden" name="orderId" value={orderId} />
      {state.message && <Notice tone="error">{state.message}</Notice>}
      <fieldset className="space-y-4">
        <legend className="font-bold">Driver contact</legend>
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
