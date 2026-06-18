/**
 * Client-side image compression.
 * Runs in the browser before upload; no server changes needed.
 */

export type CompressOptions = {
  maxEdge?: number;        // max width/height in px
  quality?: number;        // 0..1 for webp
  jpegQuality?: number;    // fallback quality for jpeg
  skipUnderBytes?: number; // skip compression if file is already small
  preferFormat?: "webp" | "jpeg";
};

const DEFAULTS: Required<CompressOptions> = {
  maxEdge: 2000,
  quality: 0.82,
  jpegQuality: 0.85,
  skipUnderBytes: 300 * 1024,
  preferFormat: "webp",
};

const SKIP_MIMES = new Set(["image/gif", "image/svg+xml"]);

function canvasToBlob(canvas: HTMLCanvasElement | OffscreenCanvas, type: string, quality: number): Promise<Blob | null> {
  if ("convertToBlob" in canvas) {
    return (canvas as OffscreenCanvas).convertToBlob({ type, quality }).catch(() => null);
  }
  return new Promise((resolve) => {
    (canvas as HTMLCanvasElement).toBlob((b) => resolve(b), type, quality);
  });
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const o = { ...DEFAULTS, ...opts };

  // Not an image, or a format we shouldn't recompress.
  if (!file.type.startsWith("image/") || SKIP_MIMES.has(file.type)) return file;

  // Already small enough — skip.
  if (file.size <= o.skipUnderBytes) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // can't decode → upload original
  }

  const { width: w0, height: h0 } = bitmap;
  const scale = Math.min(1, o.maxEdge / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  let canvas: HTMLCanvasElement | OffscreenCanvas;
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(w, h);
    ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | null;
  } else {
    canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    ctx = canvas.getContext("2d");
  }
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const preferWebp = o.preferFormat === "webp";
  let blob = preferWebp ? await canvasToBlob(canvas, "image/webp", o.quality) : null;
  let outMime = "image/webp";
  let outExt = "webp";
  if (!blob) {
    blob = await canvasToBlob(canvas, "image/jpeg", o.jpegQuality);
    outMime = "image/jpeg";
    outExt = "jpg";
  }
  if (!blob) return file;

  // If compression made things bigger (rare, tiny images), keep original.
  if (blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  const out = new File([blob], `${baseName}.${outExt}`, { type: outMime, lastModified: Date.now() });
  // eslint-disable-next-line no-console
  console.debug("[compressImage]", {
    from: `${(file.size / 1024).toFixed(0)}KB`,
    to: `${(out.size / 1024).toFixed(0)}KB`,
    dims: `${w0}x${h0} → ${w}x${h}`,
    type: outMime,
  });
  return out;
}
