// Browser-only helper: shrink photos before upload. Vercel rejects requests
// over 4.5 MB, and phone photos are often 3-10 MB each, so photos are redrawn
// at most `maxEdge` pixels on the long side as JPEG. The server still checks
// every file's bytes and size.

export async function downscaleImage(file: Blob, maxEdge = 1920, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob) return blob;
  } catch {
    // Not decodable in this browser (e.g. HEIC): send the original and let the server decide.
  }
  return file;
}

/** Shrinks several photos so that together they fit in `budgetBytes` (tries smaller sizes if needed). */
export async function downscaleAll(files: Blob[], budgetBytes = 3_800_000): Promise<Blob[]> {
  const steps: [number, number][] = [[1920, 0.85], [1600, 0.78], [1280, 0.72], [1024, 0.65]];
  let out: Blob[] = files;
  for (const [edge, quality] of steps) {
    out = await Promise.all(files.map((f) => downscaleImage(f, edge, quality)));
    if (out.reduce((sum, b) => sum + b.size, 0) <= budgetBytes) return out;
  }
  return out;
}
