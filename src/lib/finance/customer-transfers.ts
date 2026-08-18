import { supabase } from "@/integrations/supabase/client";

/**
 * Unified client layer for "حوالات العملاء المباشرة".
 * Single source of truth = the SQL view public.finance_customer_transfer_status,
 * which is also what finance_overview aggregates. No competing logic here.
 */

export type TransferState = "unlinked" | "linked" | "advance_pending" | "suspected_duplicate";

export type TransferStatusRow = {
  income_id: string;
  income_date: string;
  amount: number;
  note: string | null;
  account_type: string | null;
  transaction_type: string | null;
  collection_type: string | null;
  sales_invoice_id: number | null;
  invoice_number: string | null;
  inv_status: string | null;
  inv_channel: string | null;
  dup_count: number | null;
  link_state: TransferState;
};

export const TRANSFER_LABELS: Record<TransferState, string> = {
  unlinked: "غير مرتبطة بفاتورة",
  advance_pending: "دفعة مقدمة معلقة",
  linked: "مرتبطة",
  suspected_duplicate: "اشتباه تكرار",
};

export const TRANSFER_TONES: Record<TransferState, string> = {
  unlinked: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  advance_pending: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  linked: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  suspected_duplicate: "bg-red-500/15 text-red-300 border-red-500/30",
};

/** Filter key used in the URL (`?cust=`). `needs_link` = everything not linked. */
export type TransferFilter = "" | "needs_link" | TransferState;

export async function fetchTransferStatuses(): Promise<TransferStatusRow[]> {
  const { data, error } = await (supabase as any)
    .from("finance_customer_transfer_status")
    .select("*")
    .order("income_date", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  return ((data as any[]) ?? []).map((r) => ({ ...r, amount: Number(r.amount ?? 0) }));
}

export function matchesFilter(state: TransferState, f: TransferFilter): boolean {
  if (!f) return true;
  if (f === "needs_link") return state !== "linked";
  return state === f;
}

export type Suggestion = {
  invoice_id: number;
  invoice_number: string | null;
  issue_date: string;
  customer_name: string | null;
  total_amount: number;
  remaining_amount: number;
  payment_method: string | null;
  score: number;
  confidence: string;
  reason: string;
};

export async function fetchSuggestions(incomeId: string): Promise<Suggestion[]> {
  const { data, error } = await (supabase as any).rpc("finance_customer_transfer_suggestions", {
    p_income_id: incomeId,
  });
  if (error) throw new Error(error.message);
  return ((data as any[]) ?? []).map((r) => ({
    ...r,
    total_amount: Number(r.total_amount ?? 0),
    remaining_amount: Number(r.remaining_amount ?? 0),
  }));
}

export async function linkIncomeToInvoice(incomeId: string, invoiceId: number) {
  const { data, error } = await (supabase as any).rpc("finance_link_income_to_invoice", {
    p_income_id: incomeId,
    p_invoice_id: invoiceId,
  });
  if (error) throw new Error(error.message);
  return data;
}
