import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link as LinkIcon, RotateCcw, Search, AlertTriangle, CheckCircle2, Wallet, Building2, RefreshCcw, Pencil, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/settlement-reconciliation")({
  ssr: false,
  component: ReconciliationPage,
});

type Settlement = {
  id: string;
  provider_id: string;
  settlement_reference: string | null;
  report_reference: string | null;
  source_file_name: string | null;
  settlement_date: string | null;
  period_start: string | null;
  period_end: string | null;
  imported_at: string | null;
  payout_received_date: string | null;
  expected_net_amount: number;
  gross_sales_amount: number;
  refunds_amount: number;
  fees_before_vat: number;
  fees_vat_amount: number;
  payout_fee: number;
  adjustments_amount: number;
  provider_invoice_deductions_amount?: number | null;
  status: string;
  payout_status: string | null;
  reconciliation_status?: string | null;
  needs_review_count?: number | null;
  notes: string | null;
};

type Provider = { id: string; name: string; provider_code: string | null };

type CandidateInvoice = {
  id: number;
  internal_reference: string | null;
  supplier_invoice_number: string | null;
  invoice_date: string | null;
  total_amount: number;
  remaining_amount: number;
  supplier_name: string | null;
};

type LinkedDeduction = {
  id: string;
  amount: number;
  payment_date: string;
  status: string;
  purchase_invoice_id: number;
  internal_reference: string | null;
  supplier_invoice_number: string | null;
};
type IncomeSource = { id: string; name: string };
type Account = { id: string; name: string };

type Income = {
  id: string;
  income_date: string;
  amount: number;
  note: string | null;
  transaction_type: string | null;
  business_relation: string | null;
  payment_provider_id: string | null;
  income_source_id: string | null;
  settlement_id: string | null;
  account_id: string | null;
};

type Allocation = {
  id: string;
  settlement_id: string;
  transaction_id: string;
  allocated_amount: number;
  difference_amount: number;
  difference_type: string | null;
  difference_note: string | null;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
};

const PAYOUT_LABEL: Record<string, string> = {
  awaiting_payout: "بانتظار التحويل",
  partially_received: "استُلمت جزئياً",
  received: "تم استلامها",
  paid: "محوّلة",
};

const MATCH_STATUS_LABEL: Record<string, string> = {
  unmatched: "غير مطابقة",
  partially_matched: "مطابقة جزئياً",
  fully_matched: "مطابقة بالكامل",
  needs_review: "تحتاج مراجعة",
  closed: "مقفلة",
  matched: "مطابقة",
  imported: "مستوردة",
  under_review: "تحتاج مراجعة",
  draft: "مسودة",
  cancelled: "ملغاة",
};

const DIFF_TYPE_LABEL: Record<string, string> = {
  rounding_difference: "فرق تقريب",
  payout_fee: "رسوم تحويل",
  bank_fee: "رسوم بنكية",
  reserve_held: "مبلغ محتجز",
  reserve_released: "إفراج محتجز",
  refund: "استرجاع",
  adjustment: "تعديل",
  timing_difference: "فرق توقيت",
  unknown_difference: "فرق غير معروف",
};

const MATCH_STRENGTH_LABEL: Record<string, string> = {
  exact_match: "مطابقة دقيقة",
  probable_match: "مطابقة محتملة",
  weak_match: "مطابقة ضعيفة",
  no_match: "لا مطابقة",
};

const MATCH_COLOR: Record<string, string> = {
  exact_match: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  probable_match: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  weak_match: "text-orange-400 border-orange-500/40 bg-orange-500/10",
  no_match: "text-red-400 border-red-500/40 bg-red-500/10",
};

const fmt = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));
const MS_PER_DAY = 86400000;
const RIYADH_DATE_TIME = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" });
const dateMs = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, (m || 1) - 1, day || 1);
};
const addDays = (d: string, days: number) => new Date(dateMs(d) + days * MS_PER_DAY).toISOString().slice(0, 10);
const daysBetween = (a: string | null, b: string | null) => {
  if (!a || !b) return 999;
  return Math.abs(Math.floor((dateMs(a) - dateMs(b)) / MS_PER_DAY));
};
const settlementMatchDate = (s: Settlement | null) => s?.settlement_date || s?.period_end || null;
const inMatchWindow = (incomeDate: string, refDate: string) => incomeDate >= addDays(refDate, -7) && incomeDate <= addDays(refDate, 14);

function isTechnicalRef(ref: string | null | undefined) {
  if (!ref) return true;
  return /^[a-z0-9_]+-[a-f0-9]{6,}$/i.test(ref.trim());
}

function displayRef(s: Settlement, providerName: string) {
  const realRef = s.report_reference && s.report_reference.trim() ? s.report_reference.trim() : null;
  if (realRef) return `${providerName} — تسوية #${realRef}`;
  const fileMatch = s.source_file_name?.match(/#?(\d{5,})/);
  if (fileMatch) return `${providerName} — تسوية #${fileMatch[1]}`;
  if (!isTechnicalRef(s.settlement_reference)) return `${providerName} — ${s.settlement_reference}`;
  if (s.source_file_name) return `${providerName} — ${s.source_file_name}`;
  return `${providerName} — تسوية بدون مرجع`;
}

// Non-provider income types that should NEVER appear in the reconciliation left column by default.
const NON_PROVIDER_TYPES = new Set([
  "customer_invoice_collection",
  "direct_sale",
  "customer_advance",
  "supplier_refund",
  "owner_contribution",
  "owner_collection",
  "internal_transfer_in",
  "loan_received",
  "other_incoming",
]);

function ReconciliationPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters (settlements)
  const [sFilterProvider, setSFilterProvider] = useState("");
  const [sFilterPayout, setSFilterPayout] = useState("");
  const [sFilterMatch, setSFilterMatch] = useState<"" | "unmatched" | "partial" | "full" | "needs_review">("");
  const [sSearch, setSSearch] = useState("");
  const [sDateFrom, setSDateFrom] = useState("");
  const [sDateTo, setSDateTo] = useState("");

  // Filters (incomes)
  const [iFilterProvider, setIFilterProvider] = useState("");
  const [iFilterAlloc, setIFilterAlloc] = useState<"" | "unmatched" | "partial" | "full">("");
  const [iFilterAccount, setIFilterAccount] = useState("");
  const [iShowAll, setIShowAll] = useState(false);
  const [iSearch, setISearch] = useState("");
  const [iDateFrom, setIDateFrom] = useState("");
  const [iDateTo, setIDateTo] = useState("");
  const [iAmountMin, setIAmountMin] = useState("");
  const [iAmountMax, setIAmountMax] = useState("");

  // Selection
  const [selSettlementId, setSelSettlementId] = useState<string | null>(null);
  const [selIncomeId, setSelIncomeId] = useState<string | null>(null);
  const [allocInput, setAllocInput] = useState<string>("");
  const [diffType, setDiffType] = useState<string>("");
  const [diffNote, setDiffNote] = useState<string>("");
  const [allowOver, setAllowOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingSettlement, setEditingSettlement] = useState<Settlement | null>(null);

  // Provider-invoice deductions (independent supplier invoices the gateway deducts from the payout)
  const [candInvoices, setCandInvoices] = useState<CandidateInvoice[]>([]);
  const [linkedDeductions, setLinkedDeductions] = useState<LinkedDeduction[]>([]);
  const [deductPreview, setDeductPreview] = useState<any>(null);
  const [deductBusy, setDeductBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, src, acc, s, i, a] = await Promise.all([
      supabase.from("payment_providers" as any).select("id,name,provider_code").eq("is_active", true),
      supabase.from("finance_income_sources" as any).select("id,name"),
      supabase.from("finance_accounts" as any).select("id,name"),
      supabase.from("payment_settlements" as any).select("id,provider_id,settlement_reference,report_reference,source_file_name,settlement_date,period_start,period_end,imported_at,payout_received_date,expected_net_amount,gross_sales_amount,refunds_amount,fees_before_vat,fees_vat_amount,payout_fee,adjustments_amount,provider_invoice_deductions_amount,status,payout_status,notes").order("settlement_date", { ascending: false, nullsFirst: false }).limit(500),
      supabase.from("finance_incomes" as any).select("id,income_date,amount,note,transaction_type,business_relation,payment_provider_id,income_source_id,settlement_id,account_id").is("deleted_at", null).order("income_date", { ascending: false }).limit(1000),
      supabase.from("settlement_bank_allocations" as any).select("*").eq("status", "confirmed"),
    ]);
    if (p.error) toast.error(p.error.message); else setProviders((p.data as any) ?? []);
    if (!src.error) setSources((src.data as any) ?? []);
    if (!acc.error) setAccounts((acc.data as any) ?? []);
    if (s.error) toast.error(s.error.message); else setSettlements((s.data as any) ?? []);
    if (i.error) toast.error(i.error.message); else setIncomes((i.data as any) ?? []);
    if (a.error) toast.error(a.error.message); else setAllocations((a.data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const providerById = useMemo(() => Object.fromEntries(providers.map(p => [p.id, p])), [providers]);
  const sourceById = useMemo(() => Object.fromEntries(sources.map(s => [s.id, s])), [sources]);
  const accountById = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts]);

  // Normalize a free-text source (Arabic/English) to a provider_code.
  const normalizeSource = useCallback((raw: string | null | undefined): string | null => {
    if (!raw) return null;
    const t = raw.toLowerCase().trim();
    if (t.includes("salla") || t.includes("سلة") || t.includes("سله")) return "salla_payments";
    if (t.includes("tabby") || t.includes("تابي")) return "tabby";
    if (t.includes("tamara") || t.includes("تمارا")) return "tamara";
    return null;
  }, []);

  const providerByCode = useMemo(() => {
    const m: Record<string, Provider> = {};
    for (const p of providers) if (p.provider_code) m[p.provider_code] = p;
    return m;
  }, [providers]);

  // Derive a provider_id for an income row when the column is null, by
  // matching its income_source name or its note text against provider aliases.
  const derivedProviderId = useCallback((inc: Income): string | null => {
    if (inc.payment_provider_id) return inc.payment_provider_id;
    const srcName = inc.income_source_id ? sourceById[inc.income_source_id]?.name : null;
    const codeFromSource = normalizeSource(srcName);
    if (codeFromSource && providerByCode[codeFromSource]) return providerByCode[codeFromSource].id;
    const codeFromNote = normalizeSource(inc.note);
    if (codeFromNote && providerByCode[codeFromNote]) return providerByCode[codeFromNote].id;
    return null;
  }, [sourceById, providerByCode, normalizeSource]);

  const settleAlloc = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of allocations) m[a.settlement_id] = (m[a.settlement_id] ?? 0) + Number(a.allocated_amount);
    return m;
  }, [allocations]);

  const incomeAlloc = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of allocations) m[a.transaction_id] = (m[a.transaction_id] ?? 0) + Number(a.allocated_amount);
    return m;
  }, [allocations]);

  const selSettlement = useMemo(() => settlements.find(s => s.id === selSettlementId) || null, [settlements, selSettlementId]);

  // ── Settlement list filter ──
  const settlementsFiltered = useMemo(() => {
    return settlements.filter(s => {
      if (sFilterProvider && s.provider_id !== sFilterProvider) return false;
      if (sFilterPayout && (s.payout_status ?? "") !== sFilterPayout) return false;
      const used = settleAlloc[s.id] ?? 0;
      const remaining = Number(s.expected_net_amount) - used;
      if (sFilterMatch === "unmatched" && used > 0) return false;
      if (sFilterMatch === "partial" && !(used > 0 && remaining > 0.05)) return false;
      if (sFilterMatch === "full" && !(Math.abs(remaining) <= 0.05 && used > 0)) return false;
      if (sFilterMatch === "needs_review" && !(Number(s.needs_review_count ?? 0) > 0 || s.status === "under_review")) return false;
      if (!sFilterMatch && (s.status === "closed" || s.status === "cancelled")) return false;
      if (sSearch) {
        const q = sSearch.toLowerCase();
        const hay = [s.settlement_reference, s.report_reference, s.source_file_name, String(s.expected_net_amount)].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (sDateFrom && s.settlement_date && s.settlement_date < sDateFrom) return false;
      if (sDateTo && s.settlement_date && s.settlement_date > sDateTo) return false;
      return true;
    });
  }, [settlements, sFilterProvider, sFilterPayout, sFilterMatch, sSearch, sDateFrom, sDateTo, settleAlloc]);

  // ── Income list filter (bank transfers from providers) ──
  const incomesFiltered = useMemo(() => {
    // Provider filter: explicit filter wins; else the currently selected settlement's provider.
    const effProvider = iFilterProvider || (selSettlement ? selSettlement.provider_id : "");
    const refDate = settlementMatchDate(selSettlement);
    return incomes.filter(inc => {
      const used = incomeAlloc[inc.id] ?? 0;
      const remaining = Number(inc.amount) - used;
      if (Number(inc.amount) <= 0) return false;

      const provId = derivedProviderId(inc);

      if (!iShowAll) {
        // Strict default: MUST be linkable to a payment provider AND not clearly non-business.
        if (inc.business_relation === "personal") return false;
        if (inc.transaction_type && NON_PROVIDER_TYPES.has(inc.transaction_type)) return false;
        const isProviderSettlement = inc.transaction_type === "payment_provider_settlement";
        if (!isProviderSettlement && !provId) return false;
        // Hide fully-allocated to reduce noise unless explicit filter says otherwise.
        if (used > 0 && Math.abs(remaining) <= 0.05 && iFilterAlloc !== "full" && iFilterAlloc !== "partial") return false;
      }
      if (effProvider && provId !== effProvider) return false;
      if (!iShowAll && selSettlement && refDate && !inMatchWindow(inc.income_date, refDate)) return false;
      if (iFilterAlloc === "unmatched" && used > 0) return false;
      if (iFilterAlloc === "partial" && !(used > 0 && remaining > 0.05)) return false;
      if (iFilterAlloc === "full" && !(Math.abs(remaining) <= 0.05 && used > 0)) return false;
      if (iFilterAccount && inc.account_id !== iFilterAccount) return false;
      if (iDateFrom && inc.income_date < iDateFrom) return false;
      if (iDateTo && inc.income_date > iDateTo) return false;
      if (iAmountMin && Number(inc.amount) < Number(iAmountMin)) return false;
      if (iAmountMax && Number(inc.amount) > Number(iAmountMax)) return false;
      if (iSearch) {
        const q = iSearch.toLowerCase();
        const hay = [inc.note, String(inc.amount)].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [incomes, iFilterProvider, iFilterAlloc, iFilterAccount, iShowAll, iSearch, iDateFrom, iDateTo, iAmountMin, iAmountMax, incomeAlloc, selSettlement, derivedProviderId]);

  // Score-based ranking (matching engine)
  const scoreOf = useCallback((inc: Income, s: Settlement): { strength: string; score: number; diff: number; dateDelta: number | null } => {
    const provId = derivedProviderId(inc);
    const sameProvider = provId === s.provider_id;
    const expected = Number(s.expected_net_amount) - (settleAlloc[s.id] ?? 0);
    const remaining = Number(inc.amount) - (incomeAlloc[inc.id] ?? 0);
    const diff = remaining - expected;
    const absDiff = Math.abs(diff);
    const refDate = settlementMatchDate(s);
    const dateDelta = refDate ? daysBetween(refDate, inc.income_date) : null;
    const isInsideWindow = refDate ? inMatchWindow(inc.income_date, refDate) : true;

    let strength: string;
    if (sameProvider && absDiff <= 0.05 && isInsideWindow) strength = "exact_match";
    else if (sameProvider && absDiff <= 10 && isInsideWindow) strength = "probable_match";
    else if (sameProvider) strength = "weak_match";
    else strength = "no_match";

    // Lower score is better
    const providerPenalty = sameProvider ? 0 : 1000;
    const amountPenalty = absDiff <= 0.05 ? 0 : absDiff <= 10 ? absDiff * 2 : 200 + absDiff;
    const datePenalty = refDate ? (isInsideWindow ? Math.min(21, dateDelta ?? 0) : 500 + Math.min(365, dateDelta ?? 365)) : 0;
    return { strength, score: providerPenalty + amountPenalty + datePenalty, diff, dateDelta };
  }, [derivedProviderId, settleAlloc, incomeAlloc]);

  const incomesRanked = useMemo(() => {
    if (!selSettlement) return incomesFiltered.map(inc => ({ inc, strength: "no_match", score: 999, diff: 0 }));
    return incomesFiltered
      .map(inc => ({ inc, ...scoreOf(inc, selSettlement) }))
      .sort((a, b) => a.score - b.score);
  }, [incomesFiltered, selSettlement, scoreOf]);

  const bestMatches = useMemo(() => {
    if (!selSettlement) return [];
    return incomesRanked.filter(r => r.strength === "exact_match" || r.strength === "probable_match").slice(0, 3);
  }, [incomesRanked, selSettlement]);

  const selIncome = useMemo(() => incomes.find(i => i.id === selIncomeId) || null, [incomes, selIncomeId]);

  const settleRemaining = selSettlement ? Number(selSettlement.expected_net_amount) - (settleAlloc[selSettlement.id] ?? 0) : 0;
  const incomeRemaining = selIncome ? Number(selIncome.amount) - (incomeAlloc[selIncome.id] ?? 0) : 0;

  const suggestion = useMemo(() => {
    if (!selSettlement || !selIncome) return null;
    const provId = derivedProviderId(selIncome);
    const sameProvider = provId === selSettlement.provider_id;
    const refDate = settlementMatchDate(selSettlement);
    const dateDelta = refDate ? daysBetween(refDate, selIncome.income_date) : null;
    const isInsideWindow = refDate ? inMatchWindow(selIncome.income_date, refDate) : true;
    const suggestedAmount = Math.min(settleRemaining, incomeRemaining);
    if (suggestedAmount <= 0) return { strength: "no_match", suggestedAmount: 0, diff: 0, suggestedType: null as string | null, reason: "لا يوجد متبقٍ في أحد الطرفين", sameProvider, dateDelta };
    const diff = incomeRemaining - settleRemaining;
    const absDiff = Math.abs(diff);
    let strength = "no_match", suggestedType: string | null = null, reason = "";
    if (sameProvider && absDiff <= 0.05 && isInsideWindow) {
      strength = "exact_match";
      suggestedType = absDiff > 0 ? "rounding_difference" : null;
      reason = refDate ? "نفس الوسيط + المبلغ متطابق ضمن هامش التقريب + التاريخ ضمن النطاق" : "نفس الوسيط + المبلغ متطابق ضمن هامش التقريب";
    } else if (sameProvider && absDiff <= 10 && isInsideWindow) {
      strength = "probable_match";
      suggestedType = absDiff <= 0.05 ? "rounding_difference" : "unknown_difference";
      reason = `نفس الوسيط · فرق ${fmt(absDiff)} ريال`;
    } else if (sameProvider) {
      strength = "weak_match";
      suggestedType = "unknown_difference";
      reason = refDate && !isInsideWindow ? `نفس الوسيط · خارج نطاق التاريخ الافتراضي · فرق ${fmt(absDiff)} ريال` : `نفس الوسيط · فرق ${fmt(absDiff)} ريال`;
    } else {
      strength = "no_match";
      reason = "الوسيط مختلف";
    }
    return { strength, suggestedAmount, diff, suggestedType, reason, sameProvider, dateDelta };
  }, [selSettlement, selIncome, settleRemaining, incomeRemaining, derivedProviderId]);

  useEffect(() => {
    if (suggestion && suggestion.suggestedAmount > 0) {
      setAllocInput(suggestion.suggestedAmount.toFixed(2));
      setDiffType(suggestion.suggestedType ?? "");
    } else {
      setAllocInput("");
      setDiffType("");
    }
    setDiffNote("");
    setAllowOver(false);
  }, [suggestion?.suggestedAmount, selSettlementId, selIncomeId]);

  const confirm = async () => {
    if (!selSettlement || !selIncome) return;
    const amt = Number(allocInput);
    if (!(amt > 0)) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    setSubmitting(true);
    const { error } = await supabase.rpc("apply_settlement_allocation" as any, {
      _settlement_id: selSettlement.id, _transaction_id: selIncome.id, _amount: amt,
      _difference_type: diffType || null, _difference_note: diffNote || null, _allow_over_settlement: allowOver,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تسجيل المطابقة");
    setSelSettlementId(null); setSelIncomeId(null);
    await load();
  };

  const reverse = async (allocId: string) => {
    const reason = window.prompt("سبب عكس التخصيص:");
    if (!reason || !reason.trim()) return;
    const { error } = await supabase.rpc("reverse_settlement_allocation" as any, { _allocation_id: allocId, _reason: reason.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success("تم عكس التخصيص");
    await load();
  };

  const recalcSettlement = async (settlementId: string) => {
    const { error } = await supabase.rpc("recalculate_settlement_totals" as any, { _settlement_id: settlementId });
    if (error) { toast.error(error.message); return; }
    toast.success("تم إعادة احتساب التسوية");
    await load();
  };

  // ---- Provider invoice deductions (independent broker invoices deducted from the payout) ----
  const shortfall = selSettlement && selIncome ? settleRemaining - incomeRemaining : 0;
  const hasShortfall = shortfall > 0.05;

  const loadDeductionContext = useCallback(async (settlement: Settlement | null) => {
    if (!settlement) { setCandInvoices([]); setLinkedDeductions([]); return; }

    const [inv, links] = await Promise.all([
      supabase.from("purchase_invoices" as any)
        .select("id,internal_reference,supplier_invoice_number,invoice_date,total_amount,remaining_amount,supplier_id,status")
        .eq("payment_provider_id", settlement.provider_id)
        .in("status", ["approved", "partially_paid", "under_review"])
        .gt("remaining_amount", 0)
        .order("invoice_date", { ascending: false })
        .limit(100),
      supabase.from("purchase_invoice_provider_payments" as any)
        .select("id,amount,payment_date,status,purchase_invoice_id")
        .eq("settlement_id", settlement.id)
        .neq("status", "reversed"),
    ]);

    const invRows: any[] = (inv.data as any[]) ?? [];
    const linkRows: any[] = (links.data as any[]) ?? [];

    const supplierIds = Array.from(new Set(invRows.map(r => r.supplier_id).filter(Boolean)));
    let supplierNames: Record<string, string> = {};
    if (supplierIds.length) {
      const { data: sup } = await supabase.from("finance_suppliers" as any).select("id,name").in("id", supplierIds);
      supplierNames = Object.fromEntries(((sup as any[]) ?? []).map(s => [s.id, s.name]));
    }

    const linkedInvoiceIds = new Set(linkRows.map(l => l.purchase_invoice_id));

    setCandInvoices(
      invRows
        .filter(r => !linkedInvoiceIds.has(r.id))
        .map(r => ({
          id: r.id,
          internal_reference: r.internal_reference,
          supplier_invoice_number: r.supplier_invoice_number,
          invoice_date: r.invoice_date,
          total_amount: Number(r.total_amount ?? 0),
          remaining_amount: Number(r.remaining_amount ?? 0),
          supplier_name: r.supplier_id ? supplierNames[r.supplier_id] ?? null : null,
        })),
    );

    const invById = Object.fromEntries(invRows.map(r => [r.id, r]));
    let extra: Record<string, any> = {};
    const missing = linkRows.map(l => l.purchase_invoice_id).filter(id => !invById[id]);
    if (missing.length) {
      const { data: mi } = await supabase.from("purchase_invoices" as any)
        .select("id,internal_reference,supplier_invoice_number").in("id", missing);
      extra = Object.fromEntries(((mi as any[]) ?? []).map(r => [r.id, r]));
    }

    setLinkedDeductions(linkRows.map(l => {
      const src = invById[l.purchase_invoice_id] ?? extra[l.purchase_invoice_id] ?? {};
      return {
        id: l.id,
        amount: Number(l.amount ?? 0),
        payment_date: l.payment_date,
        status: l.status,
        purchase_invoice_id: l.purchase_invoice_id,
        internal_reference: src.internal_reference ?? null,
        supplier_invoice_number: src.supplier_invoice_number ?? null,
      };
    }));
  }, []);

  useEffect(() => { setDeductPreview(null); loadDeductionContext(selSettlement); }, [selSettlementId, selSettlement, loadDeductionContext]);

  // Exact-amount matches against the shortfall come first.
  const candidatesRanked = useMemo(() => {
    if (!hasShortfall) return [];
    return [...candInvoices]
      .map(c => ({ c, delta: Math.abs(c.remaining_amount - shortfall) }))
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 8);
  }, [candInvoices, shortfall, hasShortfall]);

  const previewDeduction = async (invoiceId: number) => {
    if (!selSettlement) return;
    setDeductBusy(true);
    const { data, error } = await supabase.rpc("preview_settlement_provider_invoice_deduction" as any, {
      p_settlement_id: selSettlement.id, p_invoice_id: invoiceId, p_amount: null,
    });
    setDeductBusy(false);
    if (error) { toast.error(error.message); return; }
    setDeductPreview(data);
  };

  const confirmDeduction = async () => {
    if (!selSettlement || !deductPreview) return;
    const ref = deductPreview.internal_reference ?? deductPreview.supplier_invoice_number ?? "";
    if (!window.confirm(`تأكيد خصم فاتورة الوسيط ${ref} بمبلغ ${fmt(deductPreview.invoice?.remaining_amount ?? 0)} ر.س من صافي هذه التسوية؟ لن يتأثر البنك أو الكاش.`)) return;
    setDeductBusy(true);
    const { error } = await supabase.rpc("confirm_settlement_provider_invoice_deduction" as any, {
      p_settlement_id: selSettlement.id,
      p_invoice_id: deductPreview.invoice.id,
      p_amount: null,
      p_notes: null,
    });
    setDeductBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم ربط فاتورة الوسيط وخصمها من صافي التسوية");
    setDeductPreview(null);
    await load();
  };


  const resetFilters = () => {
    setSFilterProvider(""); setSFilterPayout(""); setSFilterMatch(""); setSSearch(""); setSDateFrom(""); setSDateTo("");
    setIFilterProvider(""); setIFilterAlloc(""); setIFilterAccount(""); setIShowAll(false); setISearch("");
    setIDateFrom(""); setIDateTo(""); setIAmountMin(""); setIAmountMax("");
  };

  // KPIs
  const kpis = useMemo(() => {
    const totals = { awaiting: 0, unmatched: 0, partial: 0, full: 0, needs_review: 0, unallocated: 0, roundingDiff: 0, unknownDiff: 0 };
    for (const s of settlements) {
      if (s.status === "cancelled" || s.status === "closed") continue;
      if (s.payout_status === "awaiting_payout") totals.awaiting++;
      const used = settleAlloc[s.id] ?? 0;
      const remaining = Number(s.expected_net_amount) - used;
      if (used <= 0) totals.unmatched++;
      else if (Math.abs(remaining) <= 0.05) totals.full++;
      else totals.partial++;
      if (Number(s.needs_review_count ?? 0) > 0 || s.status === "under_review") totals.needs_review++;
    }
    for (const inc of incomes) {
      const provId = derivedProviderId(inc);
      const used = incomeAlloc[inc.id] ?? 0;
      const remaining = Number(inc.amount) - used;
      if ((inc.transaction_type === "payment_provider_settlement" || provId) && remaining > 0.05)
        totals.unallocated += remaining;
    }
    for (const a of allocations) {
      if (a.difference_type === "rounding_difference") totals.roundingDiff += Number(a.difference_amount);
      if (a.difference_type === "unknown_difference") totals.unknownDiff += Number(a.difference_amount);
    }
    return totals;
  }, [settlements, incomes, allocations, settleAlloc, incomeAlloc, derivedProviderId]);

  const selectionAllocations = useMemo(() => {
    if (!selSettlement) return [];
    return allocations.filter(a => a.settlement_id === selSettlement.id);
  }, [allocations, selSettlement]);

  const settleDateLabel = (s: Settlement) => s.settlement_date ?? "تاريخ التسوية غير محدد";
  const selectedRefDate = settlementMatchDate(selSettlement);

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-amber-400">مركز مطابقة التسويات والحوالات</h1>
        <div className="flex gap-2">
          <button onClick={resetFilters} className="text-xs px-3 py-1.5 rounded border border-white/10 hover:bg-white/5">إعادة ضبط الفلاتر</button>
          <button onClick={load} className="text-xs px-3 py-1.5 rounded border border-white/10 hover:bg-white/5 flex items-center gap-1"><RefreshCcw className="w-3 h-3" /> تحديث</button>
        </div>
      </div>

      {/* KPIs — clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
        <Kpi label="بانتظار التحويل" value={kpis.awaiting} tone="orange" onClick={() => { setSFilterPayout("awaiting_payout"); setSFilterMatch(""); }} />
        <Kpi label="غير مطابقة" value={kpis.unmatched} tone="red" onClick={() => { setSFilterMatch("unmatched"); setSFilterPayout(""); }} />
        <Kpi label="مطابقة جزئياً" value={kpis.partial} tone="amber" onClick={() => { setSFilterMatch("partial"); setSFilterPayout(""); }} />
        <Kpi label="مطابقة بالكامل" value={kpis.full} tone="emerald" onClick={() => { setSFilterMatch("full"); setSFilterPayout(""); }} />
        <Kpi label="تحتاج مراجعة" value={kpis.needs_review} tone="amber" onClick={() => { setSFilterMatch("needs_review"); setSFilterPayout(""); }} />
        <Kpi label="حوالات غير مخصصة" value={`${fmt(kpis.unallocated)} ر.س`} tone="blue" onClick={() => setIFilterAlloc("unmatched")} />
        <Kpi label="فروقات تقريب / غير مفسرة" value={`${fmt(kpis.roundingDiff)} / ${fmt(kpis.unknownDiff)}`} tone="muted" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* RIGHT — Settlements */}
        <section className="lg:col-span-4 rounded-lg border border-white/10 bg-white/[0.02]">
          <header className="p-3 border-b border-white/10 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold text-sm">التسويات</h2>
            <span className="text-xs text-muted-foreground mr-auto">{settlementsFiltered.length}</span>
          </header>
          <div className="p-2 space-y-2 border-b border-white/10">
            <div className="flex gap-2 flex-wrap">
              <select value={sFilterProvider} onChange={e => setSFilterProvider(e.target.value)} className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1">
                <option value="">كل الوسطاء</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={sFilterPayout} onChange={e => setSFilterPayout(e.target.value)} className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1">
                <option value="">حالة التحويل</option>
                {Object.entries(PAYOUT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={sFilterMatch} onChange={e => setSFilterMatch(e.target.value as any)} className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1">
                <option value="">حالة المطابقة</option>
                <option value="unmatched">غير مطابقة</option>
                <option value="partial">جزئية</option>
                <option value="full">بالكامل</option>
                <option value="needs_review">تحتاج مراجعة</option>
              </select>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <input type="date" value={sDateFrom} onChange={e => setSDateFrom(e.target.value)} className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1" />
              <span className="text-xs text-muted-foreground">→</span>
              <input type="date" value={sDateTo} onChange={e => setSDateTo(e.target.value)} className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1" />
            </div>
            <div className="relative">
              <Search className="w-3 h-3 absolute right-2 top-2 text-muted-foreground" />
              <input value={sSearch} onChange={e => setSSearch(e.target.value)} placeholder="بحث بالمرجع أو المبلغ" className="w-full text-xs bg-black/40 border border-white/10 rounded pr-7 pl-2 py-1.5" />
            </div>
          </div>
          <ul className="max-h-[560px] overflow-auto divide-y divide-white/5">
            {loading && <li className="p-4 text-xs text-muted-foreground">جاري التحميل…</li>}
            {!loading && settlementsFiltered.length === 0 && <li className="p-4 text-xs text-muted-foreground">لا توجد تسويات مطابقة للفلاتر</li>}
            {settlementsFiltered.map(s => {
              const used = settleAlloc[s.id] ?? 0;
              const remaining = Number(s.expected_net_amount) - used;
              const isSel = s.id === selSettlementId;
              const cls = isSel ? "bg-amber-500/10 border-r-2 border-amber-500" : "hover:bg-white/5";
              const providerName = providerById[s.provider_id]?.name ?? "—";
              const needsReview = Number(s.needs_review_count ?? 0);
              const matchStatus = used <= 0 ? "unmatched" : (Math.abs(remaining) <= 0.05 ? "fully_matched" : "partially_matched");
              return (
                <li key={s.id}>
                  <button onClick={() => setSelSettlementId(s.id)} className={`w-full text-right p-3 text-xs space-y-1 ${cls}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-amber-400 truncate">{displayRef(s, providerName)}</span>
                      <span className="text-muted-foreground shrink-0">{settleDateLabel(s)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>الصافي المتوقع: <b className="text-white">{fmt(s.expected_net_amount)}</b></span>
                      <span>المرتبط: <b className="text-blue-300">{fmt(used)}</b></span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span>المتبقي: <b className={remaining > 0.05 ? "text-amber-300" : "text-emerald-300"}>{fmt(remaining)}</b></span>
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/25 text-orange-200">{PAYOUT_LABEL[s.payout_status ?? ""] ?? (s.payout_status ?? "—")}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10">{MATCH_STATUS_LABEL[matchStatus]}</span>
                        {needsReview > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/25 text-red-300">مراجعة: {needsReview}</span>}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* CENTER — Match panel */}
        <section className="lg:col-span-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.02]">
          <header className="p-3 border-b border-amber-500/20 flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold text-sm">المطابقة والتخصيص</h2>
          </header>
          <div className="p-3 space-y-3 text-xs">
            {!selSettlement && (
              <div className="p-6 text-center text-muted-foreground text-xs border border-dashed border-white/10 rounded">اختر تسوية من القائمة اليمنى للبدء</div>
            )}

            {selSettlement && (
              <div className="rounded border border-white/10 p-2 space-y-1 bg-black/20">
                <div className="text-amber-400 font-semibold">ملخص التسوية</div>
                <Row label="الوسيط" value={providerById[selSettlement.provider_id]?.name ?? "—"} />
                <Row label="المرجع" value={displayRef(selSettlement, providerById[selSettlement.provider_id]?.name ?? "—")} />
                <Row label="تاريخ التسوية" value={settleDateLabel(selSettlement)} tone={selSettlement.settlement_date ? undefined : "muted"} />
                {(selSettlement.period_start || selSettlement.period_end) && (
                  <Row label="فترة التسوية" value={`${selSettlement.period_start ?? "…"} → ${selSettlement.period_end ?? "…"}`} />
                )}
                {selSettlement.imported_at && (
                  <Row label="تاريخ الاستيراد" value={RIYADH_DATE_TIME.format(new Date(selSettlement.imported_at))} />
                )}
                {selSettlement.payout_received_date && <Row label="تاريخ وصول الحوالة" value={selSettlement.payout_received_date} />}
                {selSettlement.source_file_name && <Row label="الملف المصدر" value={selSettlement.source_file_name} />}
                <div className="mt-2 pt-2 border-t border-white/5 space-y-0.5">
                  <Row label="إجمالي المبيعات" value={fmt(selSettlement.gross_sales_amount)} />
                  <Row label="المرتجعات" value={`− ${fmt(selSettlement.refunds_amount)}`} tone="red" />
                  <Row label="الرسوم" value={`− ${fmt(Number(selSettlement.fees_before_vat) + Number(selSettlement.fees_vat_amount))}`} tone="red" />
                  {Number(selSettlement.payout_fee || 0) > 0 && (<Row label="رسوم التحويل" value={`− ${fmt(selSettlement.payout_fee)}`} tone="red" />)}
                  {Math.abs(Number(selSettlement.adjustments_amount || 0)) > 0.005 && (
                    <Row label="تسويات إضافية" value={fmt(selSettlement.adjustments_amount)} tone={Number(selSettlement.adjustments_amount) < 0 ? "red" : "emerald"} />
                  )}
                  {Number(selSettlement.provider_invoice_deductions_amount || 0) > 0.005 && (
                    <>
                      <Row label="خصم فواتير الوسيط" value={`− ${fmt(Number(selSettlement.provider_invoice_deductions_amount || 0))}`} tone="red" />
                      {linkedDeductions.map(d => (
                        <div key={d.id} className="text-[10px] text-muted-foreground ps-2">
                          • {d.internal_reference ?? "—"}{d.supplier_invoice_number ? ` / ${d.supplier_invoice_number}` : ""} — {fmt(d.amount)} ر.س ({d.payment_date})
                        </div>
                      ))}
                    </>
                  )}
                </div>
                <div className="mt-1 pt-1 border-t border-white/5">
                  <Row label="الصافي المتوقع" value={fmt(selSettlement.expected_net_amount)} bold />
                  <Row label="المتبقي للتخصيص" value={fmt(settleRemaining)} tone={settleRemaining > 0.05 ? "amber" : "emerald"} bold />
                </div>
                <div className="pt-1 flex justify-between items-center flex-wrap gap-1">
                  <div className="flex gap-1 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/25 text-orange-200">حالة التحويل: {PAYOUT_LABEL[selSettlement.payout_status ?? ""] ?? "—"}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10">حالة المطابقة: {MATCH_STATUS_LABEL[settleRemaining <= 0.05 && (settleAlloc[selSettlement.id] ?? 0) > 0 ? "fully_matched" : (settleAlloc[selSettlement.id] ?? 0) > 0 ? "partially_matched" : "unmatched"]}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditingSettlement(selSettlement)} className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-muted-foreground hover:text-amber-300 hover:bg-white/5 inline-flex items-center gap-1"><Pencil className="w-3 h-3" /> تعديل بيانات التسوية</button>
                    <button onClick={() => recalcSettlement(selSettlement.id)} className="text-[10px] px-2 py-0.5 rounded border border-amber-500/30 text-amber-300 hover:bg-amber-500/10">↻ إعادة احتساب</button>
                  </div>
                </div>
              </div>
            )}

            {selSettlement && !selectedRefDate && (
              <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200 text-xs flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>تاريخ التسوية غير محدد؛ الاقتراح يعتمد على الوسيط والمبلغ فقط.</span>
              </div>
            )}

            {selSettlement && selectedRefDate && !iShowAll && (
              <div className="rounded border border-white/10 bg-white/5 p-2 text-muted-foreground text-[11px]">
                تظهر الحوالات من {addDays(selectedRefDate, -7)} إلى {addDays(selectedRefDate, 14)} افتراضياً. فعّل «إظهار كل الحركات» للتوسيع.
              </div>
            )}

            {selSettlement && !selIncome && bestMatches.length > 0 && (
              <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2 space-y-2">
                <div className="text-emerald-300 font-semibold">أفضل المطابقات المقترحة</div>
                {bestMatches.map(({ inc, strength, diff }) => (
                  <button key={inc.id} onClick={() => setSelIncomeId(inc.id)} className="w-full text-right p-2 rounded border border-white/10 bg-black/30 hover:bg-white/5">
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-300">{inc.income_date}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${MATCH_COLOR[strength]}`}>{MATCH_STRENGTH_LABEL[strength]}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span>{fmt(inc.amount)} ر.س</span>
                      <span className={Math.abs(diff) <= 0.05 ? "text-emerald-300" : "text-amber-300"}>الفرق: {fmt(diff)}</span>
                    </div>
                    {inc.note && <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{inc.note}</div>}
                  </button>
                ))}
              </div>
            )}

            {selSettlement && !selIncome && bestMatches.length === 0 && (
              <div className="rounded border border-red-500/30 bg-red-500/5 p-3 text-center text-red-200 text-xs">لا توجد حوالة مطابقة حتى الآن</div>
            )}

            {selIncome && (
              <div className="rounded border border-white/10 p-2 space-y-1 bg-black/20">
                <div className="text-blue-300 font-semibold">الحوالة المختارة</div>
                <Row label="التاريخ" value={selIncome.income_date} />
                <Row label="الوسيط" value={providerById[derivedProviderId(selIncome) ?? ""]?.name ?? "—"} />
                <Row label="الحساب" value={accountById[selIncome.account_id ?? ""]?.name ?? "—"} />
                <Row label="المبلغ الكلي" value={fmt(selIncome.amount)} bold />
                <Row label="المتبقي غير المستخدم" value={fmt(incomeRemaining)} tone={incomeRemaining > 0.05 ? "amber" : "emerald"} bold />
                <Row label="البيان" value={selIncome.note ?? "—"} />
              </div>
            )}

            {selSettlement && selIncome && hasShortfall && (
              <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-amber-300 font-semibold">فواتير وسيط محتملة</div>
                  <div className="text-[11px] text-muted-foreground">النقص: <b className="text-amber-200">{fmt(shortfall)}</b> ر.س</div>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  فواتير مشتريات معتمدة غير مسددة لنفس الوسيط قد يكون خصمها من الحوالة. لا يتم أي ربط تلقائي.
                </div>

                {candidatesRanked.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground">لا توجد فواتير مرشحة لهذا الوسيط.</div>
                ) : candidatesRanked.map(({ c, delta }) => (
                  <div key={c.id} className={`rounded border p-2 space-y-1 bg-black/30 ${delta <= 0.05 ? "border-emerald-500/40" : "border-white/10"}`}>
                    <div className="flex justify-between text-xs">
                      <span className="text-amber-200">{c.internal_reference ?? `#${c.id}`}{c.supplier_invoice_number ? ` / ${c.supplier_invoice_number}` : ""}</span>
                      {delta <= 0.05 && <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/40 text-emerald-300">مطابقة دقيقة</span>}
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{c.supplier_name ?? "—"}</span>
                      <span>{c.invoice_date ?? "—"}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span>المتبقي: <b>{fmt(c.remaining_amount)}</b></span>
                      <span className={delta <= 0.05 ? "text-emerald-300" : "text-amber-300"}>الفرق عن النقص: {fmt(c.remaining_amount - shortfall)}</span>
                    </div>
                    <button
                      onClick={() => previewDeduction(c.id)}
                      disabled={deductBusy}
                      className="w-full mt-1 rounded border border-amber-500/40 text-amber-200 hover:bg-amber-500/10 py-1 text-[11px] disabled:opacity-50"
                    >
                      معاينة الخصم
                    </button>
                  </div>
                ))}

                {deductPreview && (
                  <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2 space-y-1 text-[11px]">
                    <div className="text-emerald-300 font-semibold">معاينة خصم فاتورة الوسيط</div>
                    <Row label="الفاتورة" value={`${deductPreview.internal_reference ?? ""}${deductPreview.supplier_invoice_number ? ` / ${deductPreview.supplier_invoice_number}` : ""}`} />
                    <Row label="المبلغ" value={fmt(Number(deductPreview.invoice?.remaining_amount ?? 0))} bold />
                    <Row label="الصافي المتوقع الحالي" value={fmt(Number(deductPreview.settlement?.expected_net_amount ?? 0))} />
                    <Row label="الصافي المتوقع بعد الخصم" value={fmt(Number(deductPreview.settlement?.new_expected_net_amount ?? 0))} bold tone="emerald" />
                    <div className="text-[10px] text-muted-foreground">
                      يُسدَّد الدائنون من حساب مستحقات الوسيط فقط، بقيد مسودة، بلا مصروف أو ضريبة أو حركة بنك.
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={confirmDeduction} disabled={deductBusy} className="flex-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 text-[11px] disabled:opacity-50">
                        تأكيد الخصم وربطه بالتسوية
                      </button>
                      <button onClick={() => setDeductPreview(null)} className="rounded border border-white/10 px-3 py-1.5 text-[11px]">إلغاء</button>
                    </div>
                  </div>
                )}
              </div>
            )}


            {suggestion && selSettlement && selIncome && (
              <div className={`rounded border p-2 ${MATCH_COLOR[suggestion.strength]}`}>
                <div className="flex items-center justify-between font-semibold">
                  <span>{MATCH_STRENGTH_LABEL[suggestion.strength]}</span>
                  <span className="text-xs">{suggestion.reason}</span>
                </div>
                <Row label="مبلغ التخصيص المقترح" value={fmt(suggestion.suggestedAmount)} />
                <Row label="الفرق بعد التخصيص" value={fmt(suggestion.diff)} />
                <Row label="فارق التاريخ" value={suggestion.dateDelta == null ? "غير مستخدم" : `${suggestion.dateDelta} يوم`} />
              </div>
            )}

            {selSettlement && selIncome && (
              <div className="space-y-2">
                <label className="block">
                  <span className="text-muted-foreground">مبلغ التخصيص</span>
                  <input type="number" step="0.01" min="0" value={allocInput} onChange={e => setAllocInput(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-sm" />
                </label>
                <label className="block">
                  <span className="text-muted-foreground">نوع الفرق</span>
                  <select value={diffType} onChange={e => setDiffType(e.target.value)} className="mt-1 w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-sm">
                    <option value="">— لا يوجد —</option>
                    {Object.entries(DIFF_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-muted-foreground">ملاحظة</span>
                  <textarea value={diffNote} onChange={e => setDiffNote(e.target.value)} rows={2} className="mt-1 w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-sm" />
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={allowOver} onChange={e => setAllowOver(e.target.checked)} />
                  <span>السماح بتجاوز صافي التسوية</span>
                </label>
                <button onClick={confirm} disabled={submitting || !(Number(allocInput) > 0)} className="w-full rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold py-2 text-sm disabled:opacity-50">
                  <CheckCircle2 className="w-4 h-4 inline-block ml-1" /> تأكيد المطابقة
                </button>
              </div>
            )}

            {selSettlement && selectionAllocations.length > 0 && (
              <div className="pt-3 border-t border-white/10 space-y-2">
                <div className="font-semibold text-amber-400">التخصيصات المسجّلة</div>
                {selectionAllocations.map(a => (
                  <div key={a.id} className="rounded border border-white/10 p-2 space-y-1 bg-black/20">
                    <div className="flex justify-between">
                      <span>مبلغ: <b>{fmt(a.allocated_amount)}</b></span>
                      <span>فرق: <b>{fmt(a.difference_amount)}</b></span>
                    </div>
                    <div className="text-muted-foreground">{DIFF_TYPE_LABEL[a.difference_type ?? ""] ?? "—"} {a.difference_note ? `— ${a.difference_note}` : ""}</div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{new Date(a.confirmed_at ?? a.created_at).toLocaleString("en-US")}</span>
                      {a.status === "confirmed" && (
                        <button onClick={() => reverse(a.id)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" /> عكس
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* LEFT — Bank incomes */}
        <section className="lg:col-span-4 rounded-lg border border-white/10 bg-white/[0.02]">
          <header className="p-3 border-b border-white/10 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-300" />
            <h2 className="font-semibold text-sm">حوالات بوابات الدفع</h2>
            <span className="text-xs text-muted-foreground mr-auto">{incomesFiltered.length}</span>
          </header>
          <div className="p-2 space-y-2 border-b border-white/10">
            <div className="flex gap-2 flex-wrap">
              <select value={iFilterProvider} onChange={e => setIFilterProvider(e.target.value)} className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1">
                <option value="">{selSettlement ? `وسيط التسوية: ${providerById[selSettlement.provider_id]?.name ?? ""}` : "كل الوسطاء"}</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={iFilterAlloc} onChange={e => setIFilterAlloc(e.target.value as any)} className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1">
                <option value="">حالة الربط</option>
                <option value="unmatched">غير مرتبطة</option>
                <option value="partial">مرتبطة جزئياً</option>
                <option value="full">مرتبطة بالكامل</option>
              </select>
              <select value={iFilterAccount} onChange={e => setIFilterAccount(e.target.value)} className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1">
                <option value="">كل الحسابات</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={iShowAll} onChange={e => setIShowAll(e.target.checked)} />
                <span>إظهار كل الحركات</span>
              </label>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <input type="date" value={iDateFrom} onChange={e => setIDateFrom(e.target.value)} className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1" />
              <span className="text-xs text-muted-foreground">→</span>
              <input type="date" value={iDateTo} onChange={e => setIDateTo(e.target.value)} className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1" />
              <input type="number" value={iAmountMin} onChange={e => setIAmountMin(e.target.value)} placeholder="مبلغ من" className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1 w-24" />
              <input type="number" value={iAmountMax} onChange={e => setIAmountMax(e.target.value)} placeholder="إلى" className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1 w-20" />
            </div>
            <div className="relative">
              <Search className="w-3 h-3 absolute right-2 top-2 text-muted-foreground" />
              <input value={iSearch} onChange={e => setISearch(e.target.value)} placeholder="بحث في البيان أو المبلغ" className="w-full text-xs bg-black/40 border border-white/10 rounded pr-7 pl-2 py-1.5" />
            </div>
          </div>
          <ul className="max-h-[560px] overflow-auto divide-y divide-white/5">
            {loading && <li className="p-4 text-xs text-muted-foreground">جاري التحميل…</li>}
            {!loading && incomesRanked.length === 0 && <li className="p-4 text-xs text-muted-foreground">لا توجد حوالات مطابقة{!iShowAll ? " — فعّل «إظهار كل الحركات» للتوسيع" : ""}</li>}
            {selSettlement && bestMatches.length > 0 && (
              <li className="p-2 text-[10px] text-emerald-300 border-b border-white/5 bg-emerald-500/5">أفضل المطابقات</li>
            )}
            {incomesRanked.map(({ inc, strength, diff }, idx) => {
              const used = incomeAlloc[inc.id] ?? 0;
              const remaining = Number(inc.amount) - used;
              const isSel = inc.id === selIncomeId;
              const cls = isSel ? "bg-blue-500/10 border-r-2 border-blue-400" : "hover:bg-white/5";
              const provId = derivedProviderId(inc);
              const showRestHeader = selSettlement && idx === bestMatches.length && bestMatches.length > 0 && strength !== "exact_match" && strength !== "probable_match";
              const nodes = [] as any[];
              if (showRestHeader) {
                nodes.push(
                  <li key={`hdr-${inc.id}`} className="p-2 text-[10px] text-muted-foreground border-b border-white/5">باقي حوالات الوسيط</li>
                );
              }
              nodes.push(
                <li key={inc.id}>
                  <button onClick={() => setSelIncomeId(inc.id)} className={`w-full text-right p-3 text-xs space-y-1 ${cls}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-blue-300">{providerById[provId ?? ""]?.name ?? (inc.transaction_type ?? "غير محدد")}</span>
                      <span className="text-muted-foreground">{inc.income_date}</span>
                    </div>
                    <div className="text-muted-foreground line-clamp-1">{inc.note ?? "—"}</div>
                    <div className="flex justify-between">
                      <span>المبلغ: <b className="text-white">{fmt(inc.amount)}</b></span>
                      <span>المتبقي: <b className={remaining > 0.05 ? "text-amber-300" : "text-emerald-300"}>{fmt(remaining)}</b></span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground text-[10px]">
                        {used <= 0 ? "غير مرتبطة" : Math.abs(remaining) <= 0.05 ? "مرتبطة بالكامل" : "مرتبطة جزئياً"}
                      </span>
                      {selSettlement && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${MATCH_COLOR[strength]}`}>
                          {MATCH_STRENGTH_LABEL[strength]} · فرق {fmt(diff)}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
              return nodes;
            })}
          </ul>
        </section>
      </div>

      <div className="text-xs text-muted-foreground p-3 rounded border border-white/10 flex gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>هذه الشاشة لا تُنشئ مبيعات ولا رسومًا ولا ضريبة ولا قيودًا جديدة. تكتفي بربط التسويات بالحوالات البنكية المقابلة، وكل إجراء يُحفظ في سجل التدقيق.</span>
      </div>
      {editingSettlement && (
        <SettlementMetaDialog
          settlement={editingSettlement}
          onClose={() => setEditingSettlement(null)}
          onSaved={async () => { setEditingSettlement(null); await load(); }}
        />
      )}
    </div>
  );
}

function SettlementMetaDialog({ settlement, onClose, onSaved }: { settlement: Settlement; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    settlement_reference: settlement.settlement_reference ?? "",
    settlement_date: settlement.settlement_date ?? "",
    period_start: settlement.period_start ?? "",
    period_end: settlement.period_end ?? "",
  });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("payment_settlements" as any)
      .update({
        settlement_reference: form.settlement_reference.trim() || null,
        settlement_date: form.settlement_date || null,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
      })
      .eq("id", settlement.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("تم تحديث بيانات التسوية"); await onSaved(); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0b1220] p-5 space-y-3" dir="rtl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">تعديل بيانات التسوية</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-[11px] text-muted-foreground">
          هذا التعديل يغيّر المرجع والتواريخ فقط، ولا يغيّر المبالغ أو الحركات أو الروابط الحالية.
        </div>
        <label className="block text-[11px]">مرجع التسوية
          <input value={form.settlement_reference} onChange={(e) => setForm({ ...form, settlement_reference: e.target.value })} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]" />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block text-[11px]">تاريخ التسوية
            <input type="date" value={form.settlement_date} onChange={(e) => setForm({ ...form, settlement_date: e.target.value })} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]" />
            {!form.settlement_date && <span className="mt-1 block text-[10px] text-amber-300">تاريخ التسوية غير محدد</span>}
          </label>
          <label className="block text-[11px]">بداية الفترة
            <input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]" />
          </label>
          <label className="block text-[11px]">نهاية الفترة
            <input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]" />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded border border-white/10 text-[12px]">إلغاء</button>
          <button disabled={saving} onClick={save} className="px-3 py-1.5 rounded bg-amber-500 text-black text-[12px] disabled:opacity-50">
            {saving ? "…" : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, tone }: { label: string; value: any; bold?: boolean; tone?: "amber" | "emerald" | "red" | "muted" }) {
  const toneCls = tone === "amber" ? "text-amber-300" : tone === "emerald" ? "text-emerald-300" : tone === "red" ? "text-red-300" : tone === "muted" ? "text-muted-foreground" : "text-white";
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? "font-bold" : ""} ${toneCls}`}>{value}</span>
    </div>
  );
}

function Kpi({ label, value, tone, onClick }: { label: string; value: any; tone: "orange" | "red" | "amber" | "emerald" | "blue" | "muted"; onClick?: () => void }) {
  const cls: Record<string, string> = {
    orange: "text-orange-300 border-orange-500/30 bg-orange-500/5",
    red: "text-red-300 border-red-500/30 bg-red-500/5",
    amber: "text-amber-300 border-amber-500/30 bg-amber-500/5",
    emerald: "text-emerald-300 border-emerald-500/30 bg-emerald-500/5",
    blue: "text-blue-300 border-blue-500/30 bg-blue-500/5",
    muted: "text-muted-foreground border-white/10 bg-white/[0.02]",
  };
  return (
    <button onClick={onClick} disabled={!onClick} className={`text-right rounded-lg border p-3 ${cls[tone]} ${onClick ? "hover:brightness-125 cursor-pointer" : "cursor-default"}`}>
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </button>
  );
}
