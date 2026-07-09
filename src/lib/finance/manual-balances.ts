// Manual balances: user-entered actual cash, inventory value, and other assets.
// Backed by singleton row in public.aqh_finance_manual_balances.
import { supabase } from "@/integrations/supabase/client";

export interface ManualBalances {
  id: string;
  cash_actual: number;
  inventory_value: number;
  assets_value: number;
  cash_anchor_date: string | null;
  note: string | null;
  updated_at: string;
}

const TABLE = "aqh_finance_manual_balances" as any;

export async function getManualBalances(): Promise<ManualBalances | null> {
  const { data, error } = await (supabase.from(TABLE) as any)
    .select("*")
    .eq("singleton", true)
    .maybeSingle();
  if (error) throw error;
  return (data as ManualBalances) ?? null;
}

export async function updateManualBalances(patch: Partial<Omit<ManualBalances, "id" | "updated_at">>) {
  const { error } = await (supabase.from(TABLE) as any)
    .update(patch)
    .eq("singleton", true);
  if (error) throw error;
}

export function totalNetWorth(b: ManualBalances | null): number {
  if (!b) return 0;
  return (Number(b.cash_actual) || 0) + (Number(b.inventory_value) || 0) + (Number(b.assets_value) || 0);
}
