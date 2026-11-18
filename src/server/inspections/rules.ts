/**
 * Vehicle condition check rules shared by the pickup check (F6) and the
 * return inspection (F7). Pure functions: no database or network access, so
 * they run in unit tests and in the browser for instant feedback.
 *
 * The message wording matches the written test cases (TC-PC03, TC-PC04,
 * TC-RA04) and the field options match Table 2 of the test data.
 */

export const EXTERIOR_DAMAGE = ["None", "Minor", "Major"] as const;
export const FUEL_LEVELS = ["Full", "3/4", "1/2", "1/4", "Empty"] as const;
export const CLEANLINESS = ["Clean", "Light dirt", "Dirty"] as const;
export const PHOTO_CATEGORIES = ["exterior", "fuel_gauge", "interior"] as const;

export type ExteriorDamage = (typeof EXTERIOR_DAMAGE)[number];
export type FuelLevel = (typeof FUEL_LEVELS)[number];
export type Cleanliness = (typeof CLEANLINESS)[number];
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

/** Labels used on screen and inside messages ("fuel gauge", not "fuel_gauge"). */
export const CATEGORY_LABELS: Record<PhotoCategory, string> = {
  exterior: "exterior",
  fuel_gauge: "fuel gauge",
  interior: "interior",
};
/** Form field labels, shown as "Exterior photo", "Fuel gauge photo", "Interior photo". */
export const CATEGORY_FIELD_LABELS: Record<PhotoCategory, string> = {
  exterior: "Exterior photo",
  fuel_gauge: "Fuel gauge photo",
  interior: "Interior photo",
};

/** 10 MB, counted as 10 × 1024 × 1024 bytes (see OPEN_QUESTIONS Q-08). */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"] as const;
export type PhotoContentType = (typeof ALLOWED_PHOTO_TYPES)[number];

export const MESSAGES = {
  wrongType: "Only JPG or PNG files are allowed.",
  tooLarge: "File must be 10 MB or smaller.",
  selectDamage: "Select the exterior damage",
  selectFuel: "Select a fuel level",
  selectCleanliness: "Select the cleanliness",
  acknowledge: "Confirm that this record matches the vehicle",
  prepare: "Confirm that the vehicle is clean and the fuel level is Full",
} as const;

/** "interior" / "fuel gauge and interior" / "exterior, fuel gauge, and interior". */
export function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels.join("");
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

/** TC-PC03 / TC-RA04: "Add a photo for each category: interior is missing." */
export function missingPhotosMessage(missing: PhotoCategory[]): string {
  const ordered = PHOTO_CATEGORIES.filter((c) => missing.includes(c));
  return `Add a photo for each category: ${joinLabels(ordered.map((c) => CATEGORY_LABELS[c]))} ${ordered.length === 1 ? "is" : "are"} missing.`;
}

/**
 * Detects JPEG or PNG from the file's first bytes. The browser-reported type
 * and the file name are not trusted, so a PDF renamed to .jpg is still refused.
 */
export function sniffImageType(head: Uint8Array): PhotoContentType | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (head.length >= png.length && png.every((b, i) => head[i] === b)) return "image/png";
  return null;
}

export type PhotoCheck = { ok: true; contentType: PhotoContentType } | { ok: false; message: string };

/**
 * Checks one uploaded photo. Type is checked first, so an oversized PDF is
 * reported as the wrong type (TC-PC04 uploads notes.pdf before big.jpg).
 */
export function checkPhoto(file: { size: number; head: Uint8Array }): PhotoCheck {
  const contentType = sniffImageType(file.head);
  if (!contentType) return { ok: false, message: MESSAGES.wrongType };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, message: MESSAGES.tooLarge };
  if (file.size < 1) return { ok: false, message: MESSAGES.wrongType };
  return { ok: true, contentType };
}

/** Browser-side check before upload, from the name and declared type only. The server re-checks the bytes. */
export function quickCheckPhoto(file: { name: string; type: string; size: number }): string | null {
  const byType = (ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type);
  const byName = /\.(jpe?g|png)$/i.test(file.name);
  if (!byType || !byName) return MESSAGES.wrongType;
  if (file.size > MAX_PHOTO_BYTES) return MESSAGES.tooLarge;
  return null;
}

export type ConditionValues = { exteriorDamage: string; fuelLevel: string; cleanliness: string };

/** Field errors for the three condition selections, keyed by form field name. */
export function checkConditionValues(v: ConditionValues): Partial<Record<keyof ConditionValues, string>> {
  const errors: Partial<Record<keyof ConditionValues, string>> = {};
  if (!(EXTERIOR_DAMAGE as readonly string[]).includes(v.exteriorDamage)) errors.exteriorDamage = MESSAGES.selectDamage;
  if (!(FUEL_LEVELS as readonly string[]).includes(v.fuelLevel)) errors.fuelLevel = MESSAGES.selectFuel;
  if (!(CLEANLINESS as readonly string[]).includes(v.cleanliness)) errors.cleanliness = MESSAGES.selectCleanliness;
  return errors;
}

/** Storage path for one photo: <booking>/<stage>/<random>-<category>.<ext>. */
export function photoPath(bookingId: string, stage: "pickup" | "return", category: PhotoCategory, contentType: PhotoContentType, random: string): string {
  return `${bookingId}/${stage}/${random}-${category}.${contentType === "image/png" ? "png" : "jpg"}`;
}
