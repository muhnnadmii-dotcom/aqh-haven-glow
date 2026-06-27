// Private storage helpers for customer-uploaded media.
// Files go into the `customer-uploads` bucket and are read via short-lived
// signed URLs. To distinguish from legacy public `media` paths in shared
// columns (e.g. aquarium image_paths arrays), stored values are tagged with
// a "cu:" prefix.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import { compressImage } from "@/lib/image-compress";
import { getImageUrl, IMAGE_PLACEHOLDER, MAX_IMAGE_MB, onImageError } from "@/lib/storage";

export const CUSTOMER_BUCKET = "customer-uploads";
export const CUSTOMER_PREFIX = "cu:";
export const SIGNED_URL_TTL_SECONDS = 60 * 30; // 30 minutes

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

/** Upload a customer file to the private bucket. Returns a "cu:" prefixed token. */
export async function uploadPrivateMedia(file: File, folder = "uploads"): Promise<string> {
  const uid = (await getSessionUser())?.id;
  if (!uid) throw new Error("يجب تسجيل الدخول لرفع الملفات");
  if (!file || file.size === 0) throw new Error("الملف فارغ أو غير صالح");

  if (file.type.startsWith("image/")) {
    try { file = await compressImage(file); } catch { /* keep original */ }
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
  const path = `${uid}/${folder}/${name}`;
  const { error } = await supabase.storage.from(CUSTOMER_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: mime,
  });
  if (error) throw error;
  return `${CUSTOMER_PREFIX}${path}`;
}

/** True if a stored value points at the private customer bucket. */
export function isPrivateAsset(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(CUSTOMER_PREFIX);
}

/** Strip the "cu:" marker to get the raw storage path. */
export function stripCustomerPrefix(stored: string): string {
  return stored.startsWith(CUSTOMER_PREFIX) ? stored.slice(CUSTOMER_PREFIX.length) : stored;
}

/** Resolve any stored value to a usable URL. Private assets get a signed URL. */
export async function resolveAssetUrl(
  stored: string | null | undefined,
  bucket: string = CUSTOMER_BUCKET,
): Promise<string> {
  if (!stored) return IMAGE_PLACEHOLDER;
  if (isPrivateAsset(stored)) {
    const path = stripCustomerPrefix(stored);
    const { data, error } = await supabase.storage
      .from(CUSTOMER_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return IMAGE_PLACEHOLDER;
    return data.signedUrl;
  }
  // Explicit private bucket without marker (e.g. request_attachments.bucket)
  if (bucket === CUSTOMER_BUCKET) {
    const { data, error } = await supabase.storage
      .from(CUSTOMER_BUCKET)
      .createSignedUrl(stored, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return IMAGE_PLACEHOLDER;
    return data.signedUrl;
  }
  return getImageUrl(stored);
}

/** React hook returning a (possibly signed) URL for a stored asset. */
export function useAssetUrl(
  stored: string | null | undefined,
  bucket: string = CUSTOMER_BUCKET,
): string {
  const [url, setUrl] = useState<string>(() =>
    isPrivateAsset(stored) || bucket === CUSTOMER_BUCKET ? IMAGE_PLACEHOLDER : getImageUrl(stored),
  );
  useEffect(() => {
    let active = true;
    resolveAssetUrl(stored, bucket).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [stored, bucket]);
  return url;
}

/** Drop-in <img>/<a> element that handles private signed URLs transparently. */
export function AssetImage(props: {
  stored: string | null | undefined;
  bucket?: string;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
  onClick?: () => void;
}) {
  const { stored, bucket, alt, className, loading, onClick } = props;
  const url = useAssetUrl(stored, bucket);
  return (
    <img
      src={url}
      alt={alt ?? ""}
      className={className}
      loading={loading ?? "lazy"}
      onClick={onClick}
      onError={onImageError}
    />
  );
}

/** Delete a private upload. Accepts either the raw path or a "cu:" token. */
export async function deletePrivateMedia(stored: string): Promise<void> {
  if (!stored) return;
  const path = stripCustomerPrefix(stored);
  await supabase.storage.from(CUSTOMER_BUCKET).remove([path]);
}
