import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";

export const MEDIA_BUCKET = "media";

export function publicUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("/")) return path;
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

export const MAX_IMAGE_MB = 8;

export async function uploadMedia(file: File, folder = "uploads"): Promise<string> {
  const uid = (await getSessionUser())?.id;
  if (!uid) throw new Error("يجب تسجيل الدخول لرفع الملفات");
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    throw new Error(`حجم الصورة كبير. الحد الأقصى ${MAX_IMAGE_MB} ميجابايت`);
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  // RLS requires path to start with the user's uid (unless admin/staff, which still passes).
  const path = `${uid}/${folder}/${name}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function deleteMedia(path: string): Promise<void> {
  if (!path || path.startsWith("http")) return;
  await supabase.storage.from(MEDIA_BUCKET).remove([path]);
}
