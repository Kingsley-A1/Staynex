// Client-side image preparation for host photo uploads. Oversized originals
// (4K/8K captures, 20 MB phone photos) are downscaled and re-encoded in the
// browser before they ever hit storage, so hosts are never told their best
// photo is "too large". The backend still enforces the same ceiling
// server-side — this is UX, not the security boundary.

/** Mirrors the backend's MAX_IMAGE_BYTES — uploads above this are rejected. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Content types the platform accepts (mirrors the backend allowlist). */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

/** Longest edge after downscaling — ample for full-screen gallery display. */
const MAX_EDGE_PX = 2560;

/** Re-encode ladder: try each until the result fits MAX_UPLOAD_BYTES. */
const ENCODE_LADDER = [
  { maxEdge: 2560, quality: 0.85 },
  { maxEdge: 2048, quality: 0.8 },
  { maxEdge: 1600, quality: 0.75 },
] as const;

export interface PreparedImage {
  blob: Blob;
  contentType: string;
  filename: string;
  /** True when the browser re-encoded the file (resized and/or converted). */
  resized: boolean;
}

/**
 * Prepare a user-picked file for upload. Well-sized files in accepted formats
 * pass through untouched; anything oversized (pixels or bytes) or in a
 * canvas-decodable foreign format (e.g. HEIC on Safari) is downscaled to WebP.
 * Throws a user-facing Error when the file can't be made uploadable.
 */
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`"${file.name}" is not an image.`);
  }

  const bitmap = await decodeImage(file);
  if (!bitmap) {
    // Undecodable in this browser. Pass through only if it's already valid.
    if (isAcceptedType(file.type) && file.size <= MAX_UPLOAD_BYTES) {
      return { blob: file, contentType: file.type, filename: file.name, resized: false };
    }
    throw new Error(
      `"${file.name}" couldn't be read by your browser. Please use a JPEG, PNG, or WebP image.`,
    );
  }

  try {
    const withinPixelBudget = Math.max(bitmap.width, bitmap.height) <= MAX_EDGE_PX;
    if (isAcceptedType(file.type) && file.size <= MAX_UPLOAD_BYTES && withinPixelBudget) {
      return { blob: file, contentType: file.type, filename: file.name, resized: false };
    }

    for (const step of ENCODE_LADDER) {
      const blob = await encodeScaled(bitmap, step.maxEdge, step.quality);
      if (blob && blob.size <= MAX_UPLOAD_BYTES) {
        return {
          blob,
          contentType: blob.type,
          filename: replaceExtension(file.name, blob.type),
          resized: true,
        };
      }
    }
  } finally {
    bitmap.close();
  }

  throw new Error(
    `"${file.name}" is too large even after resizing. Please try a different photo.`,
  );
}

function isAcceptedType(type: string): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type);
}

/**
 * Decode with EXIF orientation applied so rotated phone photos come out
 * upright. Returns null when the browser can't decode the format.
 */
async function decodeImage(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Older engines reject the options bag — retry without it.
    try {
      return await createImageBitmap(file);
    } catch {
      return null;
    }
  }
}

async function encodeScaled(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number,
): Promise<Blob | null> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);

  // WebP first (smaller); JPEG fallback for engines without WebP encoding.
  const webp = await canvasToBlob(canvas, "image/webp", quality);
  if (webp && webp.type === "image/webp") return webp;
  return canvasToBlob(canvas, "image/jpeg", quality);
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function replaceExtension(filename: string, contentType: string): string {
  const ext = contentType === "image/webp" ? "webp" : "jpg";
  const base = filename.replace(/\.[^.]+$/, "");
  return `${base}.${ext}`;
}
