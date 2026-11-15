// Time helpers. All persisted instants are UTC; a listing's IANA time zone is
// used to interpret and display local pickup/return times.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_RENTAL_DAYS = 30;

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function offsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Parse a wall-clock "YYYY-MM-DDTHH:mm" in `timeZone` to a UTC instant. Returns null if malformed. */
export function zonedLocalToUtc(local: string, timeZone: string): Date | null {
  const m = LOCAL_RE.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(guess);
  // Reject impossible dates such as 2026-02-31.
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) return null;
  const first = offsetMs(guess, timeZone);
  let utc = guess - first;
  const second = offsetMs(utc, timeZone);
  if (second !== first) utc = guess - second;
  return new Date(utc);
}

/** Format an instant as wall-clock "YYYY-MM-DDTHH:mm" in `timeZone` (for inputs and URLs). */
export function utcToZonedLocal(instant: Date, timeZone: string): string {
  const shifted = new Date(instant.getTime() + offsetMs(instant.getTime(), timeZone));
  return shifted.toISOString().slice(0, 16);
}

export function formatDateTime(instant: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(instant));
}

/**
 * Billable days = ceil(elapsed hours / 24), minimum 1 (proposed default, D-006).
 * Uses elapsed time, so a daylight-saving shift never adds a phantom day.
 */
export function billableDays(pickupAt: Date, returnAt: Date): number {
  const elapsed = returnAt.getTime() - pickupAt.getTime();
  if (!(elapsed > 0)) throw new RangeError("returnAt must be after pickupAt");
  return Math.max(1, Math.ceil(elapsed / DAY_MS));
}
