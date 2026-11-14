"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { applyToFleetAction, saveVehicleAction } from "@/app/actions/partner";
import { Field, Notice, btnDanger, btnPrimary, btnSecondary, inputCls } from "@/components/ui";

function SelectField({ label, name, options, value, error }: { label: string; name: string; options: { value: string; label: string }[]; value?: string; error?: string }) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className="mb-1 block text-sm font-medium text-slate-800">{label}</label>
      <select id={`f-${name}`} name={name} defaultValue={value ?? ""} className={inputCls} aria-invalid={error ? true : undefined} aria-describedby={error ? `f-${name}-error` : undefined}>
        <option value="" disabled>Choose…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p id={`f-${name}-error`} className="mt-1 text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}

export function FleetApplicationForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(applyToFleetAction, { fieldErrors: {}, values: { contactEmail: email, fleetSize: "1" } } as FormState);
  const v = state.values;
  const e = state.fieldErrors;
  return (
    <form action={action} noValidate className="space-y-4">
      {state.message && <Notice tone={state.tone ?? "error"}>{state.message}</Notice>}
      <SelectField label="I am applying as" name="kind" value={v.kind} error={e.kind} options={[{ value: "individual", label: "An individual owner" }, { value: "company", label: "A rental company or fleet operator" }]} />
      <Field label="Name customers will see" name="displayName" defaultValue={v.displayName} error={e.displayName} />
      <Field label="Contact email" name="contactEmail" type="email" defaultValue={v.contactEmail} error={e.contactEmail} />
      <Field label="Contact phone (optional)" name="contactPhone" type="tel" defaultValue={v.contactPhone} error={e.contactPhone} />
      <Field label="Vehicles you plan to list" name="fleetSize" inputMode="numeric" defaultValue={v.fleetSize} error={e.fleetSize} />
      <div>
        <label htmlFor="f-notes" className="mb-1 block text-sm font-medium text-slate-800">Anything we should know (optional)</label>
        <textarea id="f-notes" name="notes" rows={3} defaultValue={v.notes} className={inputCls} />
        {e.notes && <p className="mt-1 text-sm font-medium text-red-700">{e.notes}</p>}
      </div>
      <Notice tone="warning">
        Prototype: do not upload or send real identity documents. Verification here is a manual administrator review of this
        form only.
      </Notice>
      <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Submitting…" : "Submit application"}</button>
    </form>
  );
}

export function VehicleForm({
  vehicleId,
  status,
  approved,
  initial,
  locations,
  types,
}: {
  vehicleId?: string;
  status?: string;
  approved?: boolean;
  initial: Record<string, string>;
  locations: { value: string; label: string }[];
  types: string[];
}) {
  const [state, action, pending] = useActionState(saveVehicleAction, { fieldErrors: {}, values: initial } as FormState);
  const v = state.values;
  const e = state.fieldErrors;
  const isNew = !vehicleId;
  return (
    <form action={action} noValidate className="space-y-5">
      {vehicleId && <input type="hidden" name="vehicleId" value={vehicleId} />}
      {state.message && <Notice tone={state.tone ?? "error"}><span data-testid="form-message">{state.message}</span></Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Make" name="make" defaultValue={v.make} error={e.make} />
        <Field label="Model" name="model" defaultValue={v.model} error={e.model} />
        <Field label="Year" name="year" inputMode="numeric" defaultValue={v.year} error={e.year} />
        <Field label="Color" name="color" defaultValue={v.color} error={e.color} />
        <SelectField label="Vehicle type" name="vehicleType" value={v.vehicleType} error={e.vehicleType} options={types.map((t) => ({ value: t, label: t }))} />
        <Field label="Seats" name="seats" inputMode="numeric" defaultValue={v.seats} error={e.seats} />
        <SelectField label="Transmission" name="transmission" value={v.transmission || "Automatic"} options={[{ value: "Automatic", label: "Automatic" }, { value: "Manual", label: "Manual" }]} />
        <SelectField label="Pickup location" name="locationId" value={v.locationId} error={e.locationId} options={locations} />
        <Field label="Daily rate ($)" name="dailyRate" inputMode="decimal" defaultValue={v.dailyRate} error={e.dailyRate} hint="Before fees. Customers always see the full itemized total." />
        <div />
        <Field label="Available from" name="availableFrom" type="datetime-local" defaultValue={v.availableFrom} error={e.availableFrom} />
        <Field label="Available until" name="availableUntil" type="datetime-local" defaultValue={v.availableUntil} error={e.availableUntil} />
      </div>
      <div>
        <label htmlFor="f-description" className="mb-1 block text-sm font-medium text-slate-800">Description</label>
        <textarea id="f-description" name="description" rows={3} defaultValue={v.description} className={inputCls} />
      </div>
      <Notice>
        Not built yet: photo upload, multiple availability windows, and request-to-book mode. New listings use instant
        booking and the flat-fee pricing policy.
      </Notice>
      <div className="flex flex-wrap gap-2">
        {isNew || status === "draft" ? (
          <>
            <button type="submit" name="intent" value="submit" disabled={pending} className={btnPrimary}>Submit for review</button>
            <button type="submit" name="intent" value="draft" disabled={pending} className={btnSecondary}>Save draft</button>
          </>
        ) : (
          <button type="submit" name="intent" value="save" disabled={pending} className={btnPrimary}>Save changes</button>
        )}
        {status === "published" && <button type="submit" name="intent" value="pause" disabled={pending} className={btnSecondary}>Save and pause listing</button>}
        {status === "paused" && approved && <button type="submit" name="intent" value="resume" disabled={pending} className={btnSecondary}>Save and resume listing</button>}
        {status === "paused" && !approved && <button type="submit" name="intent" value="submit" disabled={pending} className={btnSecondary}>Submit for review</button>}
        {!isNew && status !== "archived" && <button type="submit" name="intent" value="archive" disabled={pending} className={btnDanger}>Archive listing</button>}
        <Link href="/partner" className={btnSecondary}>Cancel</Link>
      </div>
    </form>
  );
}
