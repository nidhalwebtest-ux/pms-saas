/**
 * Downscale + re-encode an image in the browser before upload. Phone cameras
 * produce 4–12 MB JPEGs; resizing to a sane max dimension and re-encoding as
 * JPEG keeps uploads fast without a visible quality drop for our use (building
 * reference photos). Runs entirely client-side — no server round-trip.
 *
 * Returns the original file untouched if it isn't an image, can't be decoded,
 * or compression wouldn't actually shrink it.
 */
export async function compressImage(
  file: File,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;

  const maxDim = opts.maxDim ?? 1600;
  const quality = opts.quality ?? 0.8;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  // Keep the original if re-encoding didn't help (e.g. already-small image).
  if (!blob || blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
}
