import { supabase } from "@/integrations/supabase/client";

/**
 * Unified aggregation layer for the finance "نظرة عامة" tab.
 * One RPC call per period so every section shares identical numbers.
 */

export type OverviewKpis = {
  bank_balance: number;
  total_sales: number;
  prev_total_sales: number;
  collected: number;
  prev_collected: number;
  operating_expenses: number;
  prev_operating_expenses: number;
  net_operating_cash: number;
  prev_net_operating_cash: number;
  gateway_cost: number;
  prev_gateway_cost: number;
  owner_draws: number;
  prev_owner_draws: number;
  inventory_value: number;
  assets_value: number;
};

export type PaymentMethodRow = {
  method: string;
  orders: number;
  customers: number;
  sales: number;
  avg_order: number | null;
};

export type GatewayRow = {
  provider: string;
  provider_code: string | null;
  settlements_count: number;
  gross_sales_amount: number;
  refunds_amount: number;
  fees_before_vat: number;
  fees_vat_amount: number;
  payout_fee: number;
  other_deductions: number;
  total_cost: number;
  cost_ratio: number | null;
  expected_net_amount: number;
  actual_bank_amount: number;
  pending_amount: number;
  difference_amount: number;
};

export type SalesHealth = {
  orders: number;
  customers: number;
  new_customers: number;
  returning_customers: number;
  avg_order: number | null;
  median_order: number;
  discounts: number;
  refunds: number;
  shipping_collected: number;
  cancelled_orders: number;
  cancelled_value: number;
  partial_payments: number;
  partial_payments_amount: number;
  daily: { d: string; sales: number }[];
  prev_daily: { d: string; sales: number }[];
};

export type DiscountCodeRow = {
  code: string;
  orders: number;
  customers: number;
  sales: number;
  discount_value: number;
  avg_order: number | null;
  refunds: number;
  net_sales: number;
  new_customers: number;
};

export type ShippingCompanyRow = {
  company: string;
  orders: number;
  delivered: number;
  active: number;
  cancelled: number;
  shipping_collected: number;
  avg_shipping: number | null;
};

export type FinanceOverview = {
  range: { from: string; to: string; prev_from: string; prev_to: string };
  kpis: OverviewKpis;
  payment_methods: PaymentMethodRow[];
  gateways: GatewayRow[];
  sales_health: SalesHealth;
  discount_codes: DiscountCodeRow[];
  shipping: {
    has_data: boolean;
    expenses_total: number;
    collected_total: number;
    companies: ShippingCompanyRow[];
  };
};

export async function fetchFinanceOverview(from: string, to: string): Promise<FinanceOverview> {
  const { data, error } = await (supabase as any).rpc("finance_overview", { p_from: from, p_to: to });
  if (error) throw error;
  return data as FinanceOverview;
}

/** Percentage change vs the previous comparable period. */
export function delta(cur: number, prev: number): number | null {
  if (!prev) return cur === 0 ? 0 : null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export const pct = (part: number, whole: number): number =>
  whole ? (part / whole) * 100 : 0;
