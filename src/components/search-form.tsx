import { Field, btnPrimary } from "@/components/ui";
import { KNOWN_LOCATIONS } from "@/server/search/location";
import type { FieldErrors } from "@/server/search/validator";

/**
 * Location + dates search. A plain GET form so the criteria live in the URL
 * and the server is the single place they are validated.
 */
export function SearchForm({
  defaults,
  errors = {},
  submitLabel = "Search vehicles",
}: {
  defaults: { location?: string; pickup?: string; return?: string };
  errors?: FieldErrors;
  submitLabel?: string;
}) {
  return (
    <form action="/search" method="get" noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_1.3fr_auto] lg:items-start">
      <div>
        <Field
          label="Pickup location"
          name="location"
          defaultValue={defaults.location}
          error={errors.location}
          list="known-locations"
          placeholder="City or airport, e.g. SJC"
          autoComplete="off"
        />
        <datalist id="known-locations">
          {KNOWN_LOCATIONS.map((l) => (
            <option key={l.id} value={l.label} />
          ))}
        </datalist>
      </div>
      <Field label="Pickup date and time" name="pickup" type="datetime-local" defaultValue={defaults.pickup} error={errors.pickup} />
      <Field label="Return date and time" name="return" type="datetime-local" defaultValue={defaults.return} error={errors.return} />
      <div className="lg:pt-6">
        <button type="submit" className={`${btnPrimary} w-full`}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
