"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import type { FormState } from "@/app/actions/auth";
import { markReadyAction, pickupCheckAction } from "@/app/actions/inspection";
import { Notice, btnPrimary, inputCls } from "@/components/ui";
import {
  CATEGORY_FIELD_LABELS,
  CLEANLINESS,
  EXTERIOR_DAMAGE,
  FUEL_LEVELS,
  PHOTO_CATEGORIES,
  quickCheckPhoto,
  type PhotoCategory,
} from "@/server/inspections/rules";

const empty: FormState = { fieldErrors: {}, values: {} };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="mt-1 text-sm font-medium text-red-700">{message}</p>;
}

/** TC-PC01: the partner's two preparation confirmations and "Confirm ready". */
export function PrepareVehicleForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(markReadyAction, empty);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      {state.message && <Notice tone={state.tone ?? "error"}>{state.message}</Notice>}
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm text-gray-700">Before handing over the keys, confirm both:</legend>
        <label className="flex items-center gap-2 text-sm text-gray-900">
          <input type="checkbox" name="vehicleClean" defaultChecked={state.values.vehicleClean === "on"} className="size-4" />
          Vehicle is clean
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-900">
          <input type="checkbox" name="fuelFull" defaultChecked={state.values.fuelFull === "on"} className="size-4" />
          Fuel level is Full
        </label>
      </fieldset>
      <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Confirm ready"}</button>
    </form>
  );
}

function ChoiceField({ label, name, options, value, error }: { label: string; name: string; options: readonly string[]; value?: string; error?: string }) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className="mb-1 block text-sm font-medium text-gray-800">{label}</label>
      <select
        id={`f-${name}`}
        name={name}
        defaultValue={value ?? ""}
        className={inputCls}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `f-${name}-error` : undefined}
      >
        <option value="" disabled>Choose…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <FieldError id={`f-${name}-error`} message={error} />
    </div>
  );
}

/**
 * TC-PC02 to TC-PC04: the customer's pickup condition check. Each photo is
 * checked as soon as it is chosen, so a PDF or an oversized file is refused
 * before anything is uploaded; the server checks every file again.
 */
export function PickupCheckForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(pickupCheckAction, empty);
  const [photoErrors, setPhotoErrors] = useState<Partial<Record<PhotoCategory, string>>>({});
  const v = state.values;
  const e = state.fieldErrors;

  function onPhotoChange(category: PhotoCategory, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const problem = file ? quickCheckPhoto(file) : null;
    if (problem) event.target.value = ""; // the refused file is not kept or uploaded
    setPhotoErrors((prev) => ({ ...prev, [category]: problem ?? undefined }));
  }

  return (
    <form action={action} noValidate className="space-y-5">
      <input type="hidden" name="bookingId" value={bookingId} />
      {state.message && <Notice tone={state.tone ?? "error"}>{state.message}</Notice>}
      <div className="grid gap-4 sm:grid-cols-3">
        <ChoiceField label="Exterior damage" name="exteriorDamage" options={EXTERIOR_DAMAGE} value={v.exteriorDamage} error={e.exteriorDamage} />
        <ChoiceField label="Fuel level" name="fuelLevel" options={FUEL_LEVELS} value={v.fuelLevel} error={e.fuelLevel} />
        <ChoiceField label="Cleanliness" name="cleanliness" options={CLEANLINESS} value={v.cleanliness} error={e.cleanliness} />
      </div>
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-gray-800">Photos (one for each, JPG or PNG, up to 10 MB each)</legend>
        {PHOTO_CATEGORIES.map((category) => {
          const error = photoErrors[category] ?? e[category];
          return (
            <div key={category}>
              <label htmlFor={`f-${category}`} className="mb-1 block text-sm font-medium text-gray-800">{CATEGORY_FIELD_LABELS[category]}</label>
              <input
                id={`f-${category}`}
                name={category}
                type="file"
                accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                onChange={(event) => onPhotoChange(category, event)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `f-${category}-error` : undefined}
                className="block w-full text-sm text-gray-900 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold"
              />
              <FieldError id={`f-${category}-error`} message={error} />
            </div>
          );
        })}
      </fieldset>
      <div>
        <label className="flex items-start gap-2 text-sm text-gray-900">
          <input type="checkbox" name="acknowledged" className="mt-0.5 size-4" aria-describedby={e.acknowledged ? "f-acknowledged-error" : undefined} />
          I confirm this record matches the vehicle at pickup. It cannot be changed after it is saved.
        </label>
        <FieldError id="f-acknowledged-error" message={e.acknowledged} />
      </div>
      <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Submit"}</button>
    </form>
  );
}
