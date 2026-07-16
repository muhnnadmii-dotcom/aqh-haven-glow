import { supabase } from "@/integrations/supabase/client";

export type TaxPeriod = {
  id: string;
  start_date: string;
  end_date: string;
  due_date: string | null;
  status: "open" | "under_review" | "ready" | "filed" | "paid" | "closed";
  carried_credit_in: number;
  carried_credit_used: number;
  carried_credit_out: number;
  filed_at: string | null;
  paid_at: string | null;
  notes: string | null;
};

export const fmtSAR = (n: number | null | undefined) =>
  (Number(n ?? 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ﷼";

export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("en-GB") : "—";

export async function fetchPeriods(): Promise<TaxPeriod[]> {
  const { data, error } = await supabase
    .from("tax_periods" as any)
    .select("*")
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any as TaxPeriod[];
}

export async function fetchSummary(periodId: string) {
  const { data, error } = await supabase.rpc("vat_get_period_summary" as any, { p_period_id: periodId });
  if (error) throw error;
  return data as any;
}

export async function fetchSalesLines(periodId: string) {
  const { data, error } = await supabase.rpc("vat_get_sales_lines" as any, { p_period_id: periodId });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchPurchaseLines(periodId: string) {
  const { data, error } = await supabase.rpc("vat_get_purchase_lines" as any, { p_period_id: periodId });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchPendingDocumentInvoices(periodId: string) {
  const { data, error } = await supabase.rpc("vat_get_pending_document_invoices" as any, { p_period_id: periodId });
  if (error) throw error;
  return (data ?? []) as any[];
}
export async function fetchExcluded(periodId: string) {
  const { data, error } = await supabase.rpc("vat_get_excluded_invoices" as any, { p_period_id: periodId });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function validateReturn(periodId: string) {
  const { data, error } = await supabase.rpc("vat_validate_return" as any, { p_period_id: periodId });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function markAsFiled(periodId: string, overrideReason?: string) {
  const { data, error } = await supabase.rpc("vat_mark_as_filed" as any, {
    p_period_id: periodId,
    p_override_reason: overrideReason || null,
  });
  if (error) throw error;
  return data as string;
}

export function labelStatus(s: string) {
  return (
    {
      open: "مفتوحة",
      under_review: "قيد المراجعة",
      ready: "جاهزة",
      filed: "تم التقديم",
      paid: "تم السداد",
      closed: "مغلقة",
    } as Record<string, string>
  )[s] ?? s;
}

export function exclusionLabel(k: string) {
  return (
    {
      draft: "مسودة",
      pending_review: "قيد المراجعة",
      rejected: "مرفوضة",
      missing_attachment: "مفقودة المرفق",
      non_deductible: "غير خصمها",
      duplicate: "مكررة",
    } as Record<string, string>
  )[k] ?? k;
}

export function exportCsv(filename: string, rows: any[], columns: { key: string; label: string }[]) {
  const header = columns.map((c) => `"${c.label}"`).join(",");
  const body = rows
    .map((r) =>
      columns
        .map((c) => {
          const v = r[c.key];
          const s = v == null ? "" : String(v).replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(",")
    )
    .join("\n");
  const csv = "\uFEFF" + header + "\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
