"use client";

import Form from "next/form";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { btnPrimary, btnSecondary, inputCls } from "@/components/ui";

const TYPES = ["Sedan", "SUV", "Sports", "Luxury", "Minivan", "Van", "Truck"];
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

/** Collapsible filter group. Open by default so every control is reachable. */
function Section({ title, summary, children }: { title: string; summary?: string; children: ReactNode }) {
  return (
    <details open className="group/section border-b hairline py-4 first:pt-0 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md text-[0.95rem] font-semibold text-gray-900 marker:hidden focus-visible:outline-2 focus-visible:outline-offset-4 [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="flex items-center gap-2 font-normal">
          {summary && <span className="text-[0.78rem] text-gray-500">{summary}</span>}
          <ChevronDown className="size-4 text-gray-500 transition-transform duration-500 ease-[var(--ease-luxe)] group-open/section:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}

/**
 * Result filters. Submits as a GET form so filters stay in the URL; the
 * server re-validates everything. The seats control restores the last valid
 * value when given 0, 16, 2.5 or other invalid input (TC-FR04).
 */
export function FiltersPanel({
  base,
  values,
  errors,
}: {
  base: { location: string; pickup: string; ret: string };
  values: FilterValues;
  errors: Partial<Record<string, string>>;
}) {
  const [seatsText, setSeatsText] = useState(String(values.seats));
  const [lastValidSeats, setLastValidSeats] = useState(values.seats);
  const [seatsError, setSeatsError] = useState(errors.seats ?? "");
  const [maxDaily, setMaxDaily] = useState(values.maxDaily);
  const [types, setTypes] = useState<string[]>(values.types);
  // True right after an invalid seats value was rejected, so Apply shows the
  // message instead of reloading the page and losing it.
  const rejectedSeats = useRef(false);

  function commitSeats(text: string) {
    if (/^\d+$/.test(text.trim()) && Number(text) >= 1 && Number(text) <= 15) {
      setLastValidSeats(Number(text));
      setSeatsText(String(Number(text)));
      setSeatsError("");
      rejectedSeats.current = false;
    } else {
      rejectedSeats.current = true;
      setSeatsText(String(lastValidSeats));
      setSeatsError(SEATS_ERROR);
    }
  }
  function stepSeats(delta: number) {
    const next = Math.min(15, Math.max(1, lastValidSeats + delta));
    setLastValidSeats(next);
    setSeatsText(String(next));
    setSeatsError("");
    rejectedSeats.current = false;
  }

  const clearHref = `/search?${new URLSearchParams({ location: base.location, pickup: base.pickup, return: base.ret }).toString()}`;
  const stepBtn = "flex size-10 items-center justify-center rounded-full border border-gray-300 text-lg text-gray-900 hover:border-gray-900 disabled:opacity-40";

  return (
    <Form
      action="/search"
      noValidate
      aria-label="Filters"
      onSubmit={(e) => {
        if (rejectedSeats.current) {
          e.preventDefault();
          rejectedSeats.current = false;
        }
      }}
    >
      <input type="hidden" name="location" value={base.location} />
      <input type="hidden" name="pickup" value={base.pickup} />
      <input type="hidden" name="return" value={base.ret} />
      <input type="hidden" name="sort" value={values.sort} />

      <Section title="Vehicle type" summary={types.length ? `${types.length} selected` : "All"}>
        <fieldset>
          <legend className="sr-only">Vehicle type</legend>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <label key={t} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="type"
                  value={t}
                  checked={types.includes(t)}
                  onChange={(e) => setTypes((cur) => (e.target.checked ? [...cur, t] : cur.filter((x) => x !== t)))}
                  className="peer sr-only"
                />
                <span className="inline-block rounded-full border border-gray-300 px-3.5 py-1.5 text-sm text-gray-700 transition-all duration-300 hover:border-gray-900 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-contrast peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                  {t}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section title="Price" summary={maxDaily === MAX_DAILY ? "Any" : `≤ $${maxDaily}/day`}>
        <label htmlFor="maxDaily" className="flex items-baseline justify-between text-sm text-gray-700">
          Max per day
          <output htmlFor="maxDaily" className="font-display text-lg tabular-nums text-gray-900">
            ${maxDaily}{maxDaily === MAX_DAILY ? "+" : ""}
          </output>
        </label>
        <input
          id="maxDaily" name="maxDaily" type="range" min={MIN_DAILY} max={MAX_DAILY} step={10}
          value={maxDaily} onChange={(e) => setMaxDaily(Number(e.target.value))}
          className="mt-2 w-full"
          aria-describedby="maxDaily-hint"
        />
        <p id="maxDaily-hint" className="sr-only">Per day, before fees.{maxDaily === MAX_DAILY ? " No limit." : ""}</p>
        {errors.maxDaily && <p className="mt-1 text-sm font-medium text-red-700">{errors.maxDaily}</p>}

        <label htmlFor="maxTotal" className="mb-1.5 mt-4 block text-sm text-gray-700">Trip budget (total, $)</label>
        <input id="maxTotal" name="maxTotal" inputMode="numeric" defaultValue={values.maxTotal} placeholder="No limit" className={inputCls} aria-invalid={errors.maxTotal ? true : undefined} />
        {errors.maxTotal && <p className="mt-1 text-sm font-medium text-red-700">{errors.maxTotal}</p>}
      </Section>

      <Section title="Seats" summary={lastValidSeats > 1 ? `${lastValidSeats}+` : "Any"}>
        <label htmlFor="seats" className="mb-1.5 block text-sm text-gray-700">Minimum seats</label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => stepSeats(-1)} disabled={lastValidSeats <= 1} className={stepBtn} aria-label="Fewer seats">−</button>
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
            className={`${inputCls} w-20 text-center font-display text-lg`}
          />
          <button type="button" onClick={() => stepSeats(1)} disabled={lastValidSeats >= 15} className={stepBtn} aria-label="More seats">+</button>
        </div>
        <p id="seats-error" role="status" className="mt-1 min-h-5 text-sm font-medium text-red-700">{seatsError}</p>
      </Section>

      <Section title="Distance" summary={`${values.radius} mi`}>
        <label htmlFor="radius" className="mb-1.5 block text-sm text-gray-700">Search radius (miles)</label>
        <input id="radius" name="radius" inputMode="numeric" defaultValue={values.radius} className={inputCls} aria-invalid={errors.radius ? true : undefined} />
        {errors.radius && <p className="mt-1 text-sm font-medium text-red-700">{errors.radius}</p>}
      </Section>

      <Section title="Specific vehicle" summary={[values.make, values.model, values.year].filter(Boolean).join(" ") || "Optional"}>
        <fieldset className="space-y-2">
          <legend className="sr-only">Specific vehicle (optional)</legend>
          <input name="make" defaultValue={values.make} placeholder="Make, e.g. Toyota" aria-label="Make" className={inputCls} />
          <input name="model" defaultValue={values.model} placeholder="Model, e.g. Camry" aria-label="Model" className={inputCls} />
          <input name="year" inputMode="numeric" defaultValue={values.year} placeholder="Year, e.g. 2024" aria-label="Year" className={inputCls} aria-invalid={errors.year ? true : undefined} />
          {errors.year && <p className="text-sm font-medium text-red-700">{errors.year}</p>}
        </fieldset>
      </Section>

      <div className="sticky bottom-0 -mx-1 flex gap-2 border-t hairline bg-surface px-1 pb-1 pt-4 lg:bg-white">
        <button type="submit" className={`${btnPrimary} flex-1`}>Apply</button>
        <Link href={clearHref} className={`${btnSecondary} flex-1`}>Clear all</Link>
      </div>
    </Form>
  );
}
