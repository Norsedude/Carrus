import Form from "next/form";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { KNOWN_LOCATIONS } from "@/server/search/location";
import type { FieldErrors } from "@/server/search/validator";

const segment =
  "group/seg flex min-w-0 flex-1 cursor-text items-center gap-3 rounded-xl px-4 py-3 hover:bg-gray-50 focus-within:bg-gray-50 focus-within:outline-2 focus-within:outline-accent/40";
const input = "block w-full min-w-0 bg-transparent text-[1rem] text-gray-900 placeholder:text-gray-500 focus:outline-none [color-scheme:inherit]";

function Segment({ id, label, icon, invalid, children }: { id: string; label: string; icon: ReactNode; invalid: boolean; children: ReactNode }) {
  return (
    <label htmlFor={id} className={`${segment} ${invalid ? "bg-red-50" : ""}`}>
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gray-300 text-gray-700 transition-colors group-focus-within/seg:border-gray-900 group-focus-within/seg:text-gray-900">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-gray-500">{label}</span>
        {children}
      </span>
    </label>
  );
}

/**
 * The search bar: where, pickup, return. A plain GET form so the criteria
 * live in the URL and the server is the single place they are validated.
 * `hidden` carries saved preferences (radius, seats, types) into the search.
 */
export function SearchForm({
  defaults,
  errors = {},
  hidden = {},
}: {
  defaults: { location?: string; pickup?: string; return?: string };
  errors?: FieldErrors;
  hidden?: Record<string, string | string[]>;
}) {
  const messages = (["location", "pickup", "return"] as const).filter((k) => errors[k]);
  return (
    <Form action="/search" noValidate>
      {Object.entries(hidden).flatMap(([name, value]) =>
        (Array.isArray(value) ? value : [value]).map((v) => <input key={`${name}-${v}`} type="hidden" name={name} value={v} />),
      )}
      <div className="flex flex-col gap-1 rounded-2xl border hairline bg-white p-2 shadow-[var(--shadow-soft)] lg:flex-row lg:items-center">
        <Segment id="sf-location" label="Where" icon={<MapPin className="size-4" />} invalid={Boolean(errors.location)}>
          <input
            id="sf-location"
            name="location"
            defaultValue={defaults.location}
            list="known-locations"
            placeholder="City, airport or campus"
            autoComplete="off"
            aria-invalid={errors.location ? true : undefined}
            aria-describedby={errors.location ? "sf-location-error" : undefined}
            className={input}
          />
          <datalist id="known-locations">
            {KNOWN_LOCATIONS.map((l) => (
              <option key={l.id} value={l.label} />
            ))}
          </datalist>
        </Segment>
        <span aria-hidden className="hidden h-10 w-px bg-gray-200 lg:block" />
        <Segment id="sf-pickup" label="Pickup" icon={<CalendarDays className="size-4" />} invalid={Boolean(errors.pickup)}>
          <input
            id="sf-pickup"
            name="pickup"
            type="datetime-local"
            defaultValue={defaults.pickup}
            aria-invalid={errors.pickup ? true : undefined}
            aria-describedby={errors.pickup ? "sf-pickup-error" : undefined}
            className={input}
          />
        </Segment>
        <span aria-hidden className="hidden h-10 w-px bg-gray-200 lg:block" />
        <Segment id="sf-return" label="Return" icon={<CalendarDays className="size-4" />} invalid={Boolean(errors.return)}>
          <input
            id="sf-return"
            name="return"
            type="datetime-local"
            defaultValue={defaults.return}
            aria-invalid={errors.return ? true : undefined}
            aria-describedby={errors.return ? "sf-return-error" : undefined}
            className={input}
          />
        </Segment>
        <button
          type="submit"
          className="group inline-flex h-[3.4rem] shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-8 text-[1rem] font-medium text-brand-contrast transition-[background-color,transform] duration-300 hover:bg-brand-dark active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Search
          <ArrowRight className="size-4 transition-transform duration-500 group-hover:translate-x-1" aria-hidden />
        </button>
      </div>
      {messages.length > 0 && (
        <ul className="mt-3 space-y-1 text-[0.95rem] font-medium text-red-700">
          {messages.map((k) => (
            <li key={k} id={`sf-${k}-error`}>{errors[k]}</li>
          ))}
        </ul>
      )}
    </Form>
  );
}
