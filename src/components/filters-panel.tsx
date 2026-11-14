"use client";

import Link from "next/link";
import { useState } from "react";
import { btnPrimary, btnSecondary, inputCls } from "@/components/ui";

const TYPES = ["Sedan", "SUV", "Minivan", "Van", "Truck"];
const SEATS_ERROR = "Enter a whole number from 1 to 15";
const MIN_DAILY = 30;
const MAX_DAILY = 300;

export type FilterValues = {
  types: string[];
  maxDaily: number;
  seats: number;
  radius: number;
  make: string;
  model: string;
  year: string;
  maxTotal: string;
  sort: string;
};

/**
 * Result filters. Submits as a GET form so filters stay in the URL; the
 * server re-validates everything. The seats control restores the last valid
 * value when given 0, 16, 2.5 or other invalid input (TC-FR04).
 */
export function FiltersPanel({
  base,
  values,
  errors,
  sortOptions,
}: {
  base: { location: string; pickup: string; ret: string };
  values: FilterValues;
  errors: Partial<Record<string, string>>;
  sortOptions: { value: string; label: string }[];
}) {
  const [seatsText, setSeatsText] = useState(String(values.seats));
  const [lastValidSeats, setLastValidSeats] = useState(values.seats);
  const [seatsError, setSeatsError] = useState(errors.seats ?? "");
  const [maxDaily, setMaxDaily] = useState(values.maxDaily);

  function commitSeats(text: string) {
    if (/^\d+$/.test(text.trim()) && Number(text) >= 1 && Number(text) <= 15) {
      setLastValidSeats(Number(text));
      setSeatsText(String(Number(text)));
      setSeatsError("");
    } else {
      setSeatsText(String(lastValidSeats));
      setSeatsError(SEATS_ERROR);
    }
  }
  function stepSeats(delta: number) {
    const next = Math.min(15, Math.max(1, lastValidSeats + delta));
    setLastValidSeats(next);
    setSeatsText(String(next));
    setSeatsError("");
  }

  const clearHref = `/search?${new URLSearchParams({ location: base.location, pickup: base.pickup, return: base.ret }).toString()}`;

  return (
    <form action="/search" method="get" noValidate aria-label="Filters" className="space-y-5">
      <input type="hidden" name="location" value={base.location} />
      <input type="hidden" name="pickup" value={base.pickup} />
      <input type="hidden" name="return" value={base.ret} />

      <div>
        <label htmlFor="sort" className="mb-1 block text-sm font-semibold text-slate-900">Sort by</label>
        <select id="sort" name="sort" defaultValue={values.sort} className={inputCls}>
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-900">Vehicle type</legend>
        <p className="text-xs text-slate-600">None checked shows all types.</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5 lg:grid-cols-1">
          {TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" name="type" value={t} defaultChecked={values.types.includes(t)} className="size-4 accent-blue-700" />
              {t}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="maxDaily" className="block text-sm font-semibold text-slate-900">
          Maximum daily rate: <output htmlFor="maxDaily" className="tabular-nums">${maxDaily}{maxDaily === MAX_DAILY ? " (no limit)" : ""}</output>
        </label>
        <input
          id="maxDaily" name="maxDaily" type="range" min={MIN_DAILY} max={MAX_DAILY} step={10}
          value={maxDaily} onChange={(e) => setMaxDaily(Number(e.target.value))}
          className="mt-2 w-full accent-blue-700"
          aria-describedby="maxDaily-hint"
        />
        <p id="maxDaily-hint" className="text-xs text-slate-600">Per day, before fees. Separate from the trip budget below.</p>
        {errors.maxDaily && <p className="mt-1 text-sm font-medium text-red-700">{errors.maxDaily}</p>}
      </div>

      <div>
        <label htmlFor="seats" className="mb-1 block text-sm font-semibold text-slate-900">Minimum seats</label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => stepSeats(-1)} disabled={lastValidSeats <= 1} className={`${btnSecondary} px-3`} aria-label="Fewer seats">−</button>
          <input
            id="seats" name="seats" inputMode="numeric" value={seatsText}
            onChange={(e) => setSeatsText(e.target.value)}
            onBlur={(e) => commitSeats(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitSeats(e.currentTarget.value);
              }
            }}
            aria-invalid={seatsError ? true : undefined}
            aria-describedby="seats-error"
            className={`${inputCls} w-20 text-center`}
          />
          <button type="button" onClick={() => stepSeats(1)} disabled={lastValidSeats >= 15} className={`${btnSecondary} px-3`} aria-label="More seats">+</button>
        </div>
        <p id="seats-error" role="status" className="mt-1 min-h-5 text-sm font-medium text-red-700">{seatsError}</p>
      </div>

      <div>
        <label htmlFor="maxTotal" className="mb-1 block text-sm font-semibold text-slate-900">Trip budget (total, $)</label>
        <input id="maxTotal" name="maxTotal" inputMode="numeric" defaultValue={values.maxTotal} placeholder="No limit" className={inputCls} aria-invalid={errors.maxTotal ? true : undefined} />
        {errors.maxTotal && <p className="mt-1 text-sm font-medium text-red-700">{errors.maxTotal}</p>}
      </div>

      <div>
        <label htmlFor="radius" className="mb-1 block text-sm font-semibold text-slate-900">Search radius (miles)</label>
        <input id="radius" name="radius" inputMode="numeric" defaultValue={values.radius} className={inputCls} aria-invalid={errors.radius ? true : undefined} />
        <p className="text-xs text-slate-600">Straight-line distance from the pickup location.</p>
        {errors.radius && <p className="mt-1 text-sm font-medium text-red-700">{errors.radius}</p>}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-900">Specific vehicle (optional)</legend>
        <input name="make" defaultValue={values.make} placeholder="Make, e.g. Toyota" aria-label="Make" className={inputCls} />
        <input name="model" defaultValue={values.model} placeholder="Model, e.g. Camry" aria-label="Model" className={inputCls} />
        <input name="year" inputMode="numeric" defaultValue={values.year} placeholder="Year, e.g. 2024" aria-label="Year" className={inputCls} aria-invalid={errors.year ? true : undefined} />
        {errors.year && <p className="text-sm font-medium text-red-700">{errors.year}</p>}
      </fieldset>

      <div className="flex gap-2">
        <button type="submit" className={`${btnPrimary} flex-1`}>Apply</button>
        <Link href={clearHref} className={`${btnSecondary} flex-1`}>Clear all</Link>
      </div>
    </form>
  );
}
