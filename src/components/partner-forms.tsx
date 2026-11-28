"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions/auth";
import { deletePhotoAction, makePrimaryPhotoAction, uploadPhotosAction, type PhotoState } from "@/app/actions/listing";
import { applyToFleetAction, saveVehicleAction } from "@/app/actions/partner";
import { Field, Notice, btnDanger, btnPrimary, btnSecondary, inputCls } from "@/components/ui";

function SelectField({ label, name, options, value, error }: { label: string; name: string; options: { value: string; label: string }[]; value?: string; error?: string }) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className="mb-1 block text-sm font-medium text-gray-800">{label}</label>
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
        <label htmlFor="f-notes" className="mb-1 block text-sm font-medium text-gray-800">Anything we should know (optional)</label>
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
  const [extra, setExtra] = useState<{ key: number; from: string; until: string }[]>(() => {
    try {
      return (JSON.parse(v.windows || "[]") as [string, string][]).map(([from, until], i) => ({ key: i, from, until }));
    } catch {
      return [];
    }
  });
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
        <SelectField
          label="Booking mode"
          name="bookingMode"
          value={v.bookingMode || "instant"}
          options={[
            { value: "instant", label: "Instant: confirmed at checkout" },
            { value: "request", label: "Request to book: I approve each booking" },
          ]}
        />
      </div>

      <fieldset className="space-y-3 rounded-2xl border hairline p-4">
        <legend className="px-1 text-sm font-semibold text-gray-900">Availability</legend>
        <p className="text-xs text-gray-500">Add one window per period the car can be rented. Times are in the pickup location&apos;s time zone.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Available from" name="availableFrom" type="datetime-local" defaultValue={v.availableFrom} error={e.availableFrom} />
          <Field label="Available until" name="availableUntil" type="datetime-local" defaultValue={v.availableUntil} error={e.availableUntil} />
        </div>
        {extra.map((w, i) => (
          <div key={w.key} className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]" data-testid="window-row">
            <Field id={`f-window-${w.key}-from`} label={`Window ${i + 2} from`} name="availableFrom" type="datetime-local" defaultValue={w.from} />
            <Field id={`f-window-${w.key}-until`} label={`Window ${i + 2} until`} name="availableUntil" type="datetime-local" defaultValue={w.until} />
            <button type="button" onClick={() => setExtra((rows) => rows.filter((r) => r.key !== w.key))} className={`${btnSecondary} px-3`} aria-label={`Remove window ${i + 2}`}>
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        ))}
        {e.windows && <p className="text-sm font-medium text-red-700">{e.windows}</p>}
        {extra.length < 11 && (
          <button type="button" onClick={() => setExtra((rows) => [...rows, { key: Date.now(), from: "", until: "" }])} className={`${btnSecondary} text-sm`}>
            <Plus className="size-4" aria-hidden /> Add another window
          </button>
        )}
      </fieldset>
      <div>
        <label htmlFor="f-description" className="mb-1 block text-sm font-medium text-gray-800">Description</label>
        <textarea id="f-description" name="description" rows={3} defaultValue={v.description} className={inputCls} />
      </div>
      {isNew && <Notice>Save the listing first, then add photos on its edit page. New listings use the flat-fee pricing policy.</Notice>}
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

/** Shrinks a photo to at most 1920px as a JPEG so uploads stay small (Vercel caps request size). */
async function prepareForUpload(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (blob) return blob;
  } catch {
    // Not decodable here (e.g. HEIC): send as-is and let the server decide.
  }
  return file;
}

/** Upload, choose the cover, and remove listing photos. */
export function PhotoManager({ vehicleId, photos, max }: { vehicleId: string; photos: { id: string; url: string; isPrimary: boolean }[]; max: number }) {
  const router = useRouter();
  const [state, setState] = useState<PhotoState>({});
  const [pending, setPending] = useState(false);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("photos") as HTMLInputElement;
    const files = [...(input.files ?? [])];
    if (files.length === 0) return setState({ tone: "error", message: "Choose at least one photo." });
    if (photos.length + files.length > max) return setState({ tone: "error", message: `A listing can have up to ${max} photos. Remove some first.` });
    const tooBig = files.find((f) => f.size > 10_000_000);
    if (tooBig) return setState({ tone: "error", message: `${tooBig.name} is larger than 10 MB. Nothing was uploaded.` });
    setPending(true);
    let added = 0;
    for (const file of files) {
      const blob = await prepareForUpload(file);
      const fd = new FormData();
      fd.set("vehicleId", vehicleId);
      fd.append("photos", blob, file.name.replace(/\.[^.]+$/, "") + (blob.type === "image/jpeg" ? ".jpg" : ""));
      const result = await uploadPhotosAction({}, fd);
      if (result.tone !== "success") {
        setState({ tone: "error", message: `${added ? `${added} photo${added === 1 ? "" : "s"} added. ` : ""}${result.message ?? "Upload failed."}` });
        setPending(false);
        router.refresh();
        return;
      }
      added += 1;
    }
    input.value = "";
    setState({ tone: "success", message: `${added} photo${added === 1 ? "" : "s"} added.` });
    setPending(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {state.message && <Notice tone={state.tone === "success" ? "success" : "error"}>{state.message}</Notice>}
      {photos.length === 0 ? (
        <p className="text-sm text-gray-600">No photos yet. Listings with photos get more bookings.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="photo-list">
          {photos.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-xl border hairline bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="aspect-[4/3] w-full object-cover" />
              <div className="flex flex-wrap items-center justify-between gap-1 p-2 text-xs">
                {p.isPrimary ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">Cover photo</span>
                ) : (
                  <form action={makePrimaryPhotoAction}>
                    <input type="hidden" name="vehicleId" value={vehicleId} />
                    <input type="hidden" name="photoId" value={p.id} />
                    <button type="submit" className="font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900">Make cover</button>
                  </form>
                )}
                <form action={deletePhotoAction}>
                  <input type="hidden" name="vehicleId" value={vehicleId} />
                  <input type="hidden" name="photoId" value={p.id} />
                  <button type="submit" className="font-medium text-red-700 underline underline-offset-2">Remove</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      {photos.length < max && (
        <form onSubmit={upload} className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 max-w-full flex-1">
            <label htmlFor="f-photos" className="mb-1 block text-sm font-medium text-gray-800">Add photos</label>
            <input id="f-photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="block w-full max-w-full text-sm text-gray-700 file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-contrast" />
            <p className="mt-1 text-xs text-gray-500">JPG, PNG or WebP, up to 10 MB each, {max} photos per listing.</p>
          </div>
          <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Uploading…" : "Upload"}</button>
        </form>
      )}
    </div>
  );
}
