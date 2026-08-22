import { supabase } from "@/integrations/supabase/client";

export type ProviderTaxAlertStatus =
  | "missing_invoice"
  | "missing_attachment"
  | "unreconciled"
  | "awaiting_issue";

export type ProviderTaxAlertRow = {
  provider_id: string;
  provider_name: string;
  provider_code: string | null;
  supplier_id: string | null;
  fee_month: string;
  due_date: string | null;
  alert_kind: "monthly_fees" | "campaign_charge";
  alert_status: ProviderTaxAlertStatus;
  settlement_count: number;
  settlement_fee_amount: number;
  settlement_vat_amount: number;
  invoice_count: number;
  invoice_ids: string[] | null;
  invoice_numbers: string[] | null;
  invoice_total: number;
  missing_attachment_count: number;
  unreconciled_amount: number;
  settlement_id: string | null;
  settlement_reference: string | null;
};

export type ProviderTaxInvoiceAlerts = {
  as_of: string;
  grace_days: number;
  action_required_count: number;
  waiting_count: number;
  missing_invoice_count: number;
  missing_attachment_count: number;
  unreconciled_count: number;
  rows: ProviderTaxAlertRow[];
};

/** Today's date in Asia/Riyadh as YYYY-MM-DD */
export function riyadhToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function fetchProviderTaxInvoiceAlerts(
  asOf?: string,
): Promise<ProviderTaxInvoiceAlerts> {
  const { data, error } = await (supabase as any).rpc(
    "finance_provider_tax_invoice_alerts",
    { p_as_of: asOf ?? riyadhToday() },
  );
  if (error) throw error;
  const d = (data ?? {}) as Partial<ProviderTaxInvoiceAlerts>;
  return {
    as_of: d.as_of ?? asOf ?? riyadhToday(),
    grace_days: Number(d.grace_days ?? 0),
    action_required_count: Number(d.action_required_count ?? 0),
    waiting_count: Number(d.waiting_count ?? 0),
    missing_invoice_count: Number(d.missing_invoice_count ?? 0),
    missing_attachment_count: Number(d.missing_attachment_count ?? 0),
    unreconciled_count: Number(d.unreconciled_count ?? 0),
    rows: (d.rows ?? []) as ProviderTaxAlertRow[],
  };
}

export const PROVIDER_TAX_ALERT_LABEL: Record<ProviderTaxAlertStatus, string> = {
  missing_invoice: "فاتورة الشهر غير مسجلة",
  missing_attachment: "الفاتورة مسجلة وملف PDF مفقود",
  unreconciled: "الفاتورة تحتاج مطابقة مع التسويات",
  awaiting_issue: "بانتظار الإصدار",
};
