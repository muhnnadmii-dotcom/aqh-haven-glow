import { supabase } from "@/integrations/supabase/client";

const num = (v: any) => Number(v ?? 0);

// ─────────────────────────── Cash-extra ───────────────────────────
export type ProviderReceivable = { provider_id: string; name: string; awaiting_amount: number; count: number };
export type CashExtras = {
  providerReceivables: ProviderReceivable[];
  personalBusinessIn: number;   // نشاط تم تحصيله في حساب المالك الشخصي
  personalBusinessOut: number;  // نشاط دفعه المالك من حسابه الشخصي
  personalBusinessNet: number;  // صافي = ما يستحقه المالك مقابل النشاط الشخصي
  ownerSettlementBalance: number; // رصيد حساب تسوية المالك (owner_reimbursement + owner_collection – owner_withdrawal)
  internalTransfersCount: number;
  internalTransfersAmount: number;
};

export async function fetchCashExtras(from: string | null, to: string | null): Promise<CashExtras> {
  const providers = (await supabase.from("payment_providers").select("id, name").eq("is_active", true)).data ?? [];

  // Provider receivables — settlements not yet paid
  const stlQ = supabase
    .from("payment_settlements")
    .select("provider_id, expected_net_amount, status")
    .in("status", ["draft", "imported", "under_review", "matched", "partially_matched", "awaiting_payout"]);
  const stl = (await stlQ).data ?? [];
  const providerReceivables: ProviderReceivable[] = providers.map((p) => {
    const rows = stl.filter((s) => s.provider_id === p.id);
    return {
      provider_id: p.id,
      name: p.name,
      awaiting_amount: rows.reduce((a, r) => a + num(r.expected_net_amount), 0),
      count: rows.length,
    };
  });

  // Personal-business movements in the period
  const incQ = supabase
    .from("finance_incomes")
    .select("amount, transaction_type")
    .is("deleted_at", null)
    .eq("account_type", "personal")
    .eq("business_relation", "business");
  const expQ = supabase
    .from("finance_expenses")
    .select("amount, transaction_type")
    .is("deleted_at", null)
    .eq("account_type", "personal")
    .eq("business_relation", "business");
  const incQR = from && to ? incQ.gte("income_date", from).lte("income_date", to) : incQ;
  const expQR = from && to ? expQ.gte("expense_date", from).lte("expense_date", to) : expQ;
  const [{ data: incRows }, { data: expRows }] = await Promise.all([incQR, expQR]);

  const personalBusinessIn = (incRows ?? []).reduce((a, r) => a + num(r.amount), 0);
  const personalBusinessOut = (expRows ?? []).reduce((a, r) => a + num(r.amount), 0);
  const personalBusinessNet = personalBusinessOut - personalBusinessIn; // ما يستحقه المالك = ما دفعه من جيبه – ما حصّله لجيبه

  // Owner settlement account balance (all time — this is a running balance, not period-restricted)
  const [{ data: allInc }, { data: allExp }] = await Promise.all([
    supabase.from("finance_incomes").select("amount, transaction_type").is("deleted_at", null),
    supabase.from("finance_expenses").select("amount, transaction_type").is("deleted_at", null),
  ]);
  let ownerBal = 0;
  for (const r of allInc ?? []) {
    if (r.transaction_type === "owner_collection" || r.transaction_type === "owner_contribution") ownerBal += num(r.amount);
  }
  for (const r of allExp ?? []) {
    if (r.transaction_type === "owner_reimbursement") ownerBal += num(r.amount); // company reimburses owner → still a payable
    if (r.transaction_type === "owner_withdrawal") ownerBal -= num(r.amount);
  }

  // Internal transfers within the period
  const [it1, it2] = await Promise.all([
    (from && to
      ? supabase.from("finance_incomes").select("amount")
          .is("deleted_at", null).eq("transaction_type", "internal_transfer_in")
          .gte("income_date", from).lte("income_date", to)
      : supabase.from("finance_incomes").select("amount")
          .is("deleted_at", null).eq("transaction_type", "internal_transfer_in")),
    (from && to
      ? supabase.from("finance_expenses").select("amount")
          .is("deleted_at", null).eq("transaction_type", "internal_transfer_out")
          .gte("expense_date", from).lte("expense_date", to)
      : supabase.from("finance_expenses").select("amount")
          .is("deleted_at", null).eq("transaction_type", "internal_transfer_out")),
  ]);
  const inAmount = (it1.data ?? []).reduce((a, r) => a + num(r.amount), 0);
  const outAmount = (it2.data ?? []).reduce((a, r) => a + num(r.amount), 0);

  return {
    providerReceivables,
    personalBusinessIn,
    personalBusinessOut,
    personalBusinessNet,
    ownerSettlementBalance: ownerBal,
    internalTransfersCount: (it1.data?.length ?? 0) + (it2.data?.length ?? 0),
    internalTransfersAmount: (inAmount + outAmount) / 2, // avoid double-counting matched pairs
  };
}

// ─────────────────────────── Settlements panel ───────────────────────────
export type SettlementsSummary = {
  awaiting_payout: { count: number; amount: number };
  unmatched: { count: number; amount: number };
  fees_total: number;
  fees_vat_total: number;
  rounding_diff_total: number;
  unexplained_diff_total: number;
  providerBalances: { provider_id: string; name: string; balance: number }[];
};

export async function fetchSettlementsSummary(from: string | null, to: string | null): Promise<SettlementsSummary> {
  let q = supabase
    .from("payment_settlements")
    .select("provider_id, status, expected_net_amount, actual_bank_amount, fees_before_vat, fees_vat_amount, difference_amount, settlement_date");
  if (from) q = q.gte("settlement_date", from);
  if (to) q = q.lte("settlement_date", to);
  const stl = (await q).data ?? [];

  const awaiting = stl.filter((s) => s.status === "awaiting_payout");
  const unmatched = stl.filter((s) =>
    ["draft", "imported", "under_review", "partially_matched"].includes(String(s.status)));

  const providers = (await supabase.from("payment_providers").select("id, name").eq("is_active", true)).data ?? [];
  const balances = providers.map((p) => {
    const rows = stl.filter((s) => s.provider_id === p.id && s.status !== "paid" && s.status !== "cancelled");
    return { provider_id: p.id, name: p.name, balance: rows.reduce((a, r) => a + num(r.expected_net_amount), 0) };
  });

  // Rounding vs unexplained differences: rounding is |diff| ≤ tolerance from provider
  const tolMap = new Map<string, number>();
  for (const p of (await supabase.from("payment_providers").select("id, rounding_tolerance")).data ?? []) {
    tolMap.set(p.id, num(p.rounding_tolerance));
  }

  let roundingDiff = 0;
  let unexplained = 0;
  for (const s of stl) {
    const diff = num(s.difference_amount);
    if (diff === 0) continue;
    const tol = tolMap.get(s.provider_id) ?? 0;
    if (Math.abs(diff) <= tol) roundingDiff += diff;
    else unexplained += diff;
  }

  return {
    awaiting_payout: { count: awaiting.length, amount: awaiting.reduce((a, s) => a + num(s.expected_net_amount), 0) },
    unmatched: { count: unmatched.length, amount: unmatched.reduce((a, s) => a + num(s.expected_net_amount), 0) },
    fees_total: stl.reduce((a, s) => a + num(s.fees_before_vat), 0),
    fees_vat_total: stl.reduce((a, s) => a + num(s.fees_vat_amount), 0),
    rounding_diff_total: roundingDiff,
    unexplained_diff_total: unexplained,
    providerBalances: balances,
  };
}

// ─────────────────────────── VAT panel ───────────────────────────
export type VatPanelData = {
  period_id: string | null;
  period_label: string | null;
  filing_deadline: string | null;
  output_vat: number;
  input_vat_deductible: number;
  input_vat_non_deductible: number;
  pending_review_count: number;
  net_due: number;
  net_credit: number;
};

export async function fetchVatPanel(): Promise<VatPanelData> {
  // Prefer active (non-filed) period; else latest
  const { data: periods } = await supabase
    .from("tax_periods")
    .select("id, start_date, end_date, status, filing_deadline")
    .order("start_date", { ascending: false })
    .limit(20);
  if (!periods || periods.length === 0) {
    return {
      period_id: null, period_label: null, filing_deadline: null,
      output_vat: 0, input_vat_deductible: 0, input_vat_non_deductible: 0,
      pending_review_count: 0, net_due: 0, net_credit: 0,
    };
  }
  const active = periods.find((p) => p.status !== "filed" && p.status !== "closed" && p.status !== "paid") ?? periods[0];

  const { data: summary } = await supabase.rpc("vat_get_period_summary", { p_period_id: active.id });
  const s: any = summary ?? {};
  const deadline = (active as any).filing_deadline
    ? String((active as any).filing_deadline)
    : deadlineFromEnd(String(active.end_date));

  return {
    period_id: active.id,
    period_label: `${active.start_date} → ${active.end_date}`,
    filing_deadline: deadline,
    output_vat: num(s.sales?.output_vat),
    input_vat_deductible: num(s.purchases?.deductible),
    input_vat_non_deductible: num(s.purchases?.non_deductible),
    pending_review_count: num(s.purchases?.pending_review),
    net_due: num(s.result?.net_due),
    net_credit: num(s.result?.net_credit),
  };
}

function deadlineFromEnd(endDateISO: string): string {
  const d = new Date(endDateISO + "T00:00:00");
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}
