import { supabase } from "@/integrations/supabase/client";

/** الحقول المسموح نسخها عند تكرار عرض السعر (بدون رقم/حالة/تواريخ/منشئ/مرفقات) */
const COPY_FIELDS = [
  "client_name",
  "client_contact",
  "project_name",
  "project_city",
  "currency",
  "vat_rate",
  "discount",
  "discount_type",
  "prices_include_vat",
  "items",
  "scope_text",
  "notes_text",
  "payment_terms",
  "delivery_terms",
  "warranty_terms",
  "subtotal",
  "vat_total",
  "grand_total",
] as const;

export async function duplicateQuote(sourceId: number): Promise<{ id: number; quote_no: string }> {
  const { data: src, error } = await supabase
    .from("aqh_quotes")
    .select(COPY_FIELDS.join(","))
    .eq("id", sourceId)
    .maybeSingle();
  if (error) throw new Error("تعذر قراءة عرض السعر الأصلي");
  if (!src) throw new Error("عرض السعر غير موجود");

  const { data: nx, error: rpcErr } = await supabase.rpc("aqh_next_quote_no" as any);
  if (rpcErr || !nx) throw new Error("تعذر توليد رقم عرض جديد");

  const payload: Record<string, unknown> = {};
  for (const f of COPY_FIELDS) payload[f] = (src as any)[f] ?? null;
  payload.quote_no = String(nx);
  payload.status = "draft";

  const { data: ins, error: insErr } = await supabase
    .from("aqh_quotes")
    .insert(payload as any)
    .select("id,quote_no")
    .single();
  if (insErr || !ins) throw new Error("تعذر إنشاء نسخة جديدة من عرض السعر");

  return { id: ins.id as number, quote_no: String(ins.quote_no) };
}
