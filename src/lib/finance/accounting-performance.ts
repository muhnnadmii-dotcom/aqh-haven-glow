import { supabase } from "@/integrations/supabase/client";

export type AccountingPerformance = {
  gross_sales: number;
  sales_discounts: number;
  net_sales: number;
  cogs: number | null;
  gross_profit: number | null;
  operating_expenses: number;
  net_profit: number;
  ar_balance: number;
  ap_balance: number;
  inventory_value: number;
  output_vat: number;
  deductible_input_vat: number;
  net_vat: number;
  cogs_available: boolean;
};

export async function getAccountingPerformance(from: string, to: string): Promise<AccountingPerformance> {
  const { data, error } = await supabase.rpc("get_accounting_performance" as any, { p_from: from, p_to: to });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    gross_sales: Number(row?.gross_sales ?? 0),
    sales_discounts: Number(row?.sales_discounts ?? 0),
    net_sales: Number(row?.net_sales ?? 0),
    cogs: row?.cogs == null ? null : Number(row.cogs),
    gross_profit: row?.gross_profit == null ? null : Number(row.gross_profit),
    operating_expenses: Number(row?.operating_expenses ?? 0),
    net_profit: Number(row?.net_profit ?? 0),
    ar_balance: Number(row?.ar_balance ?? 0),
    ap_balance: Number(row?.ap_balance ?? 0),
    inventory_value: Number(row?.inventory_value ?? 0),
    output_vat: Number(row?.output_vat ?? 0),
    deductible_input_vat: Number(row?.deductible_input_vat ?? 0),
    net_vat: Number(row?.net_vat ?? 0),
    cogs_available: Boolean(row?.cogs_available ?? false),
  };
}
