import { CalendarDays, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { KNOWN_LOCATIONS } from "@/server/search/location";
import type { FieldErrors } from "@/server/search/validator";

const segment =
  "flex min-w-0 flex-1 cursor-text items-center gap-3 rounded-lg px-4 py-2.5 focus-within:bg-gray-50 focus-within:outline-2 focus-within:outline-brand";
const input = "block w-full min-w-0 bg-transparent text-[1.02rem] text-gray-900 placeholder:text-gray-500 focus:outline-none";

function Segment({ id, label, icon, invalid, children }: { id: string; label: string; icon: ReactNode; invalid: boolean; children: ReactNode }) {
  return (
    <label htmlFor={id} className={`${segment} ${invalid ? "bg-red-50" : ""}`}>
      <span aria-hidden className="text-gray-700">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.78rem] font-bold text-gray-500">{label}</span>
        {children}
      </span>
    </label>
  );
}

/**
 * The search bar: where, pickup, return. A plain GET form so the criteria
 * live in the URL and the server is the single place they are validated.
 */
export function SearchForm({
  defaults,
  errors = {},
}: {
  defaults: { location?: string; pickup?: string; return?: string };
  errors?: FieldErrors;
}) {
  const messages = (["location", "pickup", "return"] as const).filter((k) => errors[k]);
  return (
    <form action="/search" method="get" noValidate>
      <div className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-[0_4px_8px_rgba(0,0,0,0.04)] lg:flex-row lg:items-center">
        <Segment id="sf-location" label="Where" icon={<MapPin className="size-5" />} invalid={Boolean(errors.location)}>
          <input
            id="sf-location"
            name="location"
            defaultValue={defaults.location}
            list="known-locations"
            placeholder="Search location"
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
        <span aria-hidden className="hidden h-9 w-px bg-gray-200 lg:block" />
        <Segment id="sf-pickup" label="Pickup" icon={<CalendarDays className="size-5" />} invalid={Boolean(errors.pickup)}>
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
        <span aria-hidden className="hidden h-9 w-px bg-gray-200 lg:block" />
        <Segment id="sf-return" label="Return" icon={<CalendarDays className="size-5" />} invalid={Boolean(errors.return)}>
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
          className="h-[3.1rem] shrink-0 rounded-lg bg-brand px-10 text-[1.02rem] font-bold text-white transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Search
        </button>
      </div>
      {messages.length > 0 && (
        <ul className="mt-3 space-y-1 text-[0.95rem] font-bold text-red-700">
          {messages.map((k) => (
            <li key={k} id={`sf-${k}-error`}>{errors[k]}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
