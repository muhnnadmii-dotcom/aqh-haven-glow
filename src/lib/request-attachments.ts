import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import { MEDIA_BUCKET, getImageUrl } from "@/lib/storage";

export const MAX_ATTACHMENT_MB = 10;

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
]);
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif", "pdf"]);

export type AttachmentRow = {
  id: string;
  request_id: string;
  related_type: "request" | "note" | "report";
  related_id: string | null;
  file_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  is_visible_to_customer: boolean;
  created_at: string;
};

export function attachmentUrl(path: string) {
  return getImageUrl(path);
}

export function isImage(mime: string | null | undefined, name?: string) {
  if (mime && mime.startsWith("image/")) return true;
  if (!name) return false;
  const ext = name.split(".").pop()?.toLowerCase();
  return !!ext && ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
}

export async function uploadRequestAttachment(
  requestId: string,
  file: File,
  opts: { visibleToCustomer?: boolean; relatedType?: "request" | "note" | "report"; relatedId?: string | null } = {},
): Promise<AttachmentRow> {
  const user = await getSessionUser();
  if (!user) throw new Error("يجب تسجيل الدخول لرفع الملفات");
  if (!file || file.size === 0) throw new Error("الملف فارغ أو غير صالح");
  if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024)
    throw new Error(`حجم الملف كبير. الحد الأقصى ${MAX_ATTACHMENT_MB} ميجابايت`);

  const mime = (file.type || "").toLowerCase();
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_MIME.has(mime) || !ALLOWED_EXT.has(ext))
    throw new Error("نوع الملف غير مدعوم. المسموح: صور أو PDF");

  const safeName = file.name.replace(/[^\w.\u0600-\u06FF-]+/g, "_").slice(0, 80);
  const storedName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  // RLS on storage requires path to start with uploader uid
  const path = `${user.id}/request-attachments/${requestId}/${storedName}`;

  const { error: upErr } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: mime,
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase.from("request_attachments").insert({
    request_id: requestId,
    related_type: opts.relatedType ?? "request",
    related_id: opts.relatedId ?? null,
    file_path: path,
    file_name: file.name,
    file_type: mime,
    file_size: file.size,
    uploaded_by: user.id,
    is_visible_to_customer: opts.visibleToCustomer ?? true,
  }).select().single();
  if (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    throw error;
  }
  return data as unknown as AttachmentRow;
}

export const REPORT_TYPES: { value: string; label: string }[] = [
  { value: "preview", label: "تقرير معاينة" },
  { value: "maintenance", label: "تقرير صيانة" },
  { value: "tank_status", label: "تقرير حالة حوض" },
  { value: "recommendations", label: "تقرير توصيات" },
  { value: "proposal", label: "عرض مبدئي" },
  { value: "general", label: "تقرير عام" },
];

export const REPORT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  REPORT_TYPES.map((r) => [r.value, r.label]),
);
