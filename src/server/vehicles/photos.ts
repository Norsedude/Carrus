// Listing photo rules, shared by the upload action and unit tests.

export const PHOTO_BUCKET = "vehicle-photos";
/** Q-08: "10 MB" is taken as 10,000,000 bytes. */
export const MAX_PHOTO_BYTES = 10_000_000;
export const MAX_PHOTOS_PER_LISTING = 8;

export type PhotoKind = { ext: "jpg" | "png" | "webp"; mime: "image/jpeg" | "image/png" | "image/webp" };

/** Detects JPEG, PNG or WebP from the file's first bytes (not its name or claimed type). */
export function sniffImage(bytes: Uint8Array): PhotoKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return { ext: "png", mime: "image/png" };
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

export type PhotoCheck = { ok: true; kind: PhotoKind } | { ok: false; message: string };

export function checkPhoto(name: string, size: number, head: Uint8Array): PhotoCheck {
  if (size === 0) return { ok: false, message: `${name} is empty.` };
  if (size > MAX_PHOTO_BYTES) return { ok: false, message: `${name} is larger than 10 MB.` };
  const kind = sniffImage(head);
  if (!kind) return { ok: false, message: `${name} is not a JPG, PNG or WebP image.` };
  return { ok: true, kind };
}
