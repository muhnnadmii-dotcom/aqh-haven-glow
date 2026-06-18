import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import { compressImage } from "@/lib/image-compress";

export const MEDIA_BUCKET = "media";

// 1×1 transparent PNG — used as last-resort fallback for broken images.
export const IMAGE_PLACEHOLDER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='100%25' height='100%25' fill='%230a1a2e'/><text x='50%25' y='50%25' fill='%23ffffff55' font-family='sans-serif' font-size='18' text-anchor='middle' dominant-baseline='middle'>لا توجد صورة</text></svg>";

/**
 * Resolve any stored image reference to a usable URL.
 * - empty → placeholder
 * - already absolute (http/https) or root-relative (/) → returned as-is
 * - storage path → public URL from the `media` bucket
 */
export function getImageUrl(path: string | null | undefined): string {
  if (!path) return IMAGE_PLACEHOLDER;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/") || path.startsWith("data:")) {
    return path;
  }
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl || IMAGE_PLACEHOLDER;
}

// Back-compat alias — existing components import publicUrl.
export const publicUrl = getImageUrl;

/** Drop-in onError handler for <img> tags. */
export function onImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const el = e.currentTarget;
  if (el.src !== IMAGE_PLACEHOLDER) el.src = IMAGE_PLACEHOLDER;
}

export const MAX_IMAGE_MB = 5;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

export async function uploadMedia(file: File, folder = "uploads"): Promise<string> {
  const uid = (await getSessionUser())?.id;
  if (!uid) throw new Error("يجب تسجيل الدخول لرفع الملفات");
  if (!file || file.size === 0) {
    throw new Error("الملف فارغ أو غير صالح");
  }
  // Compress images in the browser before any size/type validation.
  // Non-images or unsupported types are returned unchanged by compressImage.
  if (file.type.startsWith("image/")) {
    try {
      file = await compressImage(file);
    } catch {
      // fall through with original file
    }
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    throw new Error(`حجم الصورة كبير. الحد الأقصى ${MAX_IMAGE_MB} ميجابايت`);
  }
  const mime = (file.type || "").toLowerCase();
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_MIME.has(mime) || !ALLOWED_EXT.has(ext)) {
    throw new Error("نوع الملف غير مدعوم. الأنواع المسموحة: JPG, PNG, WEBP");
  }
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  // RLS requires path to start with the user's uid (admin/staff also allowed).
  const path = `${uid}/${folder}/${name}`;
  // eslint-disable-next-line no-console
  console.debug("[uploadMedia]", { path, size: file.size, mime });
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: mime,
  });
  if (error) throw error;
  return path;
}

export async function deleteMedia(path: string): Promise<void> {
  if (!path || path.startsWith("http") || path.startsWith("data:")) return;
  await supabase.storage.from(MEDIA_BUCKET).remove([path]);
}
