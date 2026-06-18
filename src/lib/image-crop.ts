/**
 * Crop a source image (File or URL) to a File using a pixel rectangle from react-easy-crop.
 * Output is WebP with JPEG fallback. The result then flows through the normal upload
 * pipeline which runs compressImage() again.
 */

export type PixelCrop = { x: number; y: number; width: number; height: number };

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function cropImageToFile(
  source: File | string,
  crop: PixelCrop,
  opts: { quality?: number; fileName?: string } = {},
): Promise<File> {
  const quality = opts.quality ?? 0.92;
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const img = await loadImage(url);
    const w = Math.max(1, Math.round(crop.width));
    const h = Math.max(1, Math.round(crop.height));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas-unavailable");
    ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, w, h);

    const tryBlob = (type: string, q: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), type, q));

    let blob = await tryBlob("image/webp", quality);
    let ext = "webp";
    let mime = "image/webp";
    if (!blob) {
      blob = await tryBlob("image/jpeg", Math.max(quality, 0.9));
      ext = "jpg";
      mime = "image/jpeg";
    }
    if (!blob) throw new Error("crop-failed");

    const baseName = (opts.fileName ?? (typeof source !== "string" ? source.name : "cropped"))
      .replace(/\.[^.]+$/, "") || "cropped";
    return new File([blob], `${baseName}-cropped.${ext}`, { type: mime, lastModified: Date.now() });
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}
