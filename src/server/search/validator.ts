import { MAX_RENTAL_DAYS, billableDays, zonedLocalToUtc } from "@/lib/time";
import { resolveLocation } from "@/server/search/location";
import {
  SORT_OPTIONS,
  VEHICLE_TYPES,
  type SearchCriteria,
  type SortOption,
  type VehicleType,
} from "@/server/search/types";

// SearchValidator: turns raw URL/form input into validated criteria or
// field-level errors. Shared by the search page, compare and quote creation.

export type RawParams = Record<string, string | string[] | undefined>;
export type FieldErrors = Partial<Record<string, string>>;
export type ValidationResult =
  | { ok: true; criteria: SearchCriteria }
  | { ok: false; fieldErrors: FieldErrors };

export const SEATS_ERROR = "Enter a whole number from 1 to 15";
export const DEFAULT_RADIUS_MILES = 25;
export const MAX_DAILY_MIN_DOLLARS = 30;
export const MAX_DAILY_MAX_DOLLARS = 300;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}
function many(v: string | string[] | undefined): string[] {
  const list = Array.isArray(v) ? v : v ? v.split(",") : [];
  return list.map((s) => s.trim()).filter(Boolean);
}
function wholeNumber(text: string): number | null {
  return /^\d{1,6}$/.test(text) ? Number(text) : null;
}

export function validateDates(
  pickupLocal: string,
  returnLocal: string,
  timeZone: string,
  now: Date,
): { ok: true; pickupAt: Date; returnAt: Date } | { ok: false; fieldErrors: FieldErrors } {
  const errors: FieldErrors = {};
  const pickupAt = pickupLocal ? zonedLocalToUtc(pickupLocal, timeZone) : null;
  const returnAt = returnLocal ? zonedLocalToUtc(returnLocal, timeZone) : null;
  if (!pickupAt) errors.pickup = "Enter a pickup date and time";
  if (!returnAt) errors.return = "Enter a return date and time";
  if (pickupAt && returnAt) {
    if (returnAt.getTime() <= pickupAt.getTime()) {
      errors.return = "Return must be after pickup";
    } else if (billableDays(pickupAt, returnAt) > MAX_RENTAL_DAYS) {
      errors.return = `Rentals can be at most ${MAX_RENTAL_DAYS} days`;
    }
    if (pickupAt.getTime() < now.getTime()) {
      errors.pickup = "Pickup must be in the future";
    }
  }
  if (Object.keys(errors).length > 0 || !pickupAt || !returnAt) {
    return { ok: false, fieldErrors: errors };
  }
  return { ok: true, pickupAt, returnAt };
}

export function validateSearch(raw: RawParams, now: Date): ValidationResult {
  const errors: FieldErrors = {};

  const locationText = one(raw.location);
  const location = locationText ? resolveLocation(locationText) : null;
  if (!locationText) {
    errors.location = "Enter a pickup location";
  } else if (!location) {
    errors.location =
      "We don't recognize that location yet. Try a Bay Area city or airport, such as San Jose, CA or SJC.";
  }

  const pickupLocal = one(raw.pickup);
  const returnLocal = one(raw.return);
  const dates = validateDates(pickupLocal, returnLocal, location?.timeZone ?? "America/Los_Angeles", now);
  if (!dates.ok) Object.assign(errors, dates.fieldErrors);

  let radiusMiles = DEFAULT_RADIUS_MILES;
  const radiusText = one(raw.radius);
  if (radiusText) {
    const r = wholeNumber(radiusText);
    if (r === null || r < 1 || r > 200) errors.radius = "Radius must be a whole number from 1 to 200 miles";
    else radiusMiles = r;
  }

  let year: number | undefined;
  const yearText = one(raw.year);
  if (yearText) {
    const y = wholeNumber(yearText);
    if (y === null || y < 1980 || y > 2100) errors.year = "Enter a four-digit model year";
    else year = y;
  }

  const typeValues = many(raw.type);
  const vehicleTypes = typeValues.filter((t): t is VehicleType =>
    (VEHICLE_TYPES as readonly string[]).includes(t),
  );
  if (vehicleTypes.length !== typeValues.length) errors.type = "Unknown vehicle type";

  let minPassengers = 1;
  const seatsText = one(raw.seats);
  if (seatsText) {
    const s = wholeNumber(seatsText);
    if (s === null || s < 1 || s > 15) errors.seats = SEATS_ERROR;
    else minPassengers = s;
  }

  let maxDailyCents: number | undefined;
  const maxDailyText = one(raw.maxDaily);
  if (maxDailyText) {
    const d = wholeNumber(maxDailyText);
    if (d === null || d < MAX_DAILY_MIN_DOLLARS || d > MAX_DAILY_MAX_DOLLARS || d % 10 !== 0) {
      errors.maxDaily = `Daily rate limit must be $${MAX_DAILY_MIN_DOLLARS} to $${MAX_DAILY_MAX_DOLLARS} in $10 steps`;
    } else if (d < MAX_DAILY_MAX_DOLLARS) {
      // The top of the range means "no daily limit".
      maxDailyCents = d * 100;
    }
  }

  let maxTotalCents: number | undefined;
  const maxTotalText = one(raw.maxTotal);
  if (maxTotalText) {
    const t = wholeNumber(maxTotalText);
    if (t === null || t < 1) errors.maxTotal = "Trip budget must be a whole dollar amount";
    else maxTotalCents = t * 100;
  }

  const sortText = one(raw.sort);
  const sort: SortOption = (SORT_OPTIONS as readonly string[]).includes(sortText)
    ? (sortText as SortOption)
    : "total_asc";

  const pageNumber = wholeNumber(one(raw.page) || "1");
  const page = pageNumber && pageNumber >= 1 ? pageNumber : 1;

  if (Object.keys(errors).length > 0 || !location || !dates.ok) {
    return { ok: false, fieldErrors: errors };
  }

  return {
    ok: true,
    criteria: {
      locationId: location.id,
      locationLabel: location.label,
      coordinates: location.coordinates,
      timeZone: location.timeZone,
      pickupLocal,
      returnLocal,
      pickupAt: dates.pickupAt,
      returnAt: dates.returnAt,
      radiusMiles,
      make: one(raw.make) || undefined,
      model: one(raw.model) || undefined,
      year,
      vehicleTypes,
      minPassengers,
      maxDailyCents,
      maxTotalCents,
      sort,
      page,
    },
  };
}
