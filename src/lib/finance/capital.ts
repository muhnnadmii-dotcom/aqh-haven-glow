// Capital tracking helpers (opening balance, injections, withdrawals).
// Backed by public.aqh_finance_capital.
import { supabase } from "@/integrations/supabase/client";

export type CapitalEntryType = "opening_balance" | "capital_injection" | "owner_withdrawal";

export interface CapitalEntry {
  id: string;
  entry_type: CapitalEntryType;
  amount: number;
  entry_date: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const CAPITAL_TYPE_LABELS: Record<CapitalEntryType, string> = {
  opening_balance: "الرصيد الافتتاحي",
  capital_injection: "ضخّ رأس مال",
  owner_withdrawal: "سحب رأس مال",
};

const TABLE = "aqh_finance_capital" as any;

export async function listCapital(): Promise<CapitalEntry[]> {
  const { data, error } = await (supabase.from(TABLE) as any).select("*").order("entry_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CapitalEntry[];
}

export async function createCapital(row: {
  entry_type: CapitalEntryType;
  amount: number;
  entry_date: string;
  note?: string | null;
}) {
  const { data, error } = await (supabase.from(TABLE) as any).insert(row).select().single();
  if (error) throw error;
  return data as CapitalEntry;
}

export async function updateCapital(id: string, patch: Partial<Omit<CapitalEntry, "id">>) {
  const { error } = await (supabase.from(TABLE) as any).update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCapital(id: string) {
  const { error } = await (supabase.from(TABLE) as any).delete().eq("id", id);
  if (error) throw error;
}

/** Sum invested capital = opening_balance + injections − withdrawals up to date (inclusive). */
export function computeInvestedCapital(entries: CapitalEntry[], asOfDate?: string): number {
  return entries
    .filter((e) => !asOfDate || e.entry_date <= asOfDate)
    .reduce((acc, e) => {
      const amt = Number(e.amount) || 0;
      if (e.entry_type === "owner_withdrawal") return acc - amt;
      return acc + amt;
    }, 0);
}

/**
 * Cash on hand = invested capital (as of end) + income − operating expenses − owner draws
 * where income/expenses/draws are filtered up to end date (or the full dataset if no bound).
 */
export function computeCashOnHand(params: {
  capital: CapitalEntry[];
  incomes: { income_date: string; amount: number }[];
  operating: { expense_date: string; amount: number }[];
  draws: { expense_date: string; amount: number }[];
  asOfDate?: string;
}): number {
  const { capital, incomes, operating, draws, asOfDate } = params;
  const invested = computeInvestedCapital(capital, asOfDate);
  const sumBy = <T,>(rows: T[], date: (r: T) => string, amt: (r: T) => number) =>
    rows.filter((r) => !asOfDate || date(r) <= asOfDate).reduce((a, r) => a + (Number(amt(r)) || 0), 0);
  const inc = sumBy(incomes, (r) => r.income_date, (r) => r.amount);
  const opx = sumBy(operating, (r) => r.expense_date, (r) => r.amount);
  const dwx = sumBy(draws, (r) => r.expense_date, (r) => r.amount);
  return invested + inc - opx - dwx;
}
