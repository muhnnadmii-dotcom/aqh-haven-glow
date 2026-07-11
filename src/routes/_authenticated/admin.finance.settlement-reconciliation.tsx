import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link as LinkIcon, RotateCcw, Search, Filter, AlertTriangle, CheckCircle2, Wallet, Building2 } from "lucide-react";

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
  settlement_date: string;
  period_start: string | null;
  period_end: string | null;
  imported_at: string | null;
  expected_net_amount: number;
  gross_sales_amount: number;
  refunds_amount: number;
  fees_before_vat: number;
  fees_vat_amount: number;
  payout_fee: number;
  adjustments_amount: number;
  status: string;
  payout_status: string | null;
  notes: string | null;
};

type Provider = { id: string; name: string; code: string | null };

type Income = {
  id: string;
  income_date: string;
  amount: number;
  note: string | null;
  transaction_type: string | null;
  payment_provider_id: string | null;
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

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة",
  imported: "مستوردة",
  under_review: "قيد المراجعة",
  matched: "مطابقة",
  partially_matched: "مطابقة جزئياً",
  awaiting_payout: "بانتظار التحويل",
  fully_matched: "مطابقة بالكامل",
  paid: "محوّلة",
  closed: "مقفلة",
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

const fmt = (n: number) => new Intl.NumberFormat("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));
const daysBetween = (a: string, b: string) => Math.abs(Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86400000));

function isTechnicalRef(ref: string | null | undefined) {
  if (!ref) return true;
  // e.g. "salla_payments-0acfe154b75b" — provider code + hash
  return /^[a-z0-9_]+-[a-f0-9]{6,}$/i.test(ref.trim());
}

function displayRef(s: Settlement, providerName: string) {
  const realRef = s.report_reference && s.report_reference.trim() ? s.report_reference.trim() : null;
  if (realRef) return `${providerName} — تسوية #${realRef}`;
  const fileMatch = s.source_file_name?.match(/#?(\d{5,})/);
  if (fileMatch) return `${providerName} — تسوية #${fileMatch[1]}`;
  if (!isTechnicalRef(s.settlement_reference)) return `${providerName} — ${s.settlement_reference}`;
  if (s.source_file_name) return `${providerName} — ${s.source_file_name}`;
  const date = s.imported_at ? new Date(s.imported_at).toLocaleDateString("ar-SA") : s.settlement_date;
  return `${providerName} — استيراد ${date}`;
}

function ReconciliationPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [sFilterProvider, setSFilterProvider] = useState("");
  const [sFilterStatus, setSFilterStatus] = useState("");
  const [sFilterMatch, setSFilterMatch] = useState<"" | "unmatched" | "partial" | "full">("");
  const [iFilterProvider, setIFilterProvider] = useState("");
  const [iFilterAlloc, setIFilterAlloc] = useState<"" | "unmatched" | "partial" | "full">("");
  const [iShowAll, setIShowAll] = useState(false);
  const [iSearch, setISearch] = useState("");

  // Selection
  const [selSettlementId, setSelSettlementId] = useState<string | null>(null);
  const [selIncomeId, setSelIncomeId] = useState<string | null>(null);
  const [allocInput, setAllocInput] = useState<string>("");
  const [diffType, setDiffType] = useState<string>("");
  const [diffNote, setDiffNote] = useState<string>("");
  const [allowOver, setAllowOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, s, i, a] = await Promise.all([
      supabase.from("payment_providers" as any).select("id,name,code").eq("is_active", true),
      supabase.from("payment_settlements" as any).select("id,provider_id,settlement_reference,report_reference,source_file_name,settlement_date,period_start,period_end,imported_at,expected_net_amount,gross_sales_amount,refunds_amount,fees_before_vat,fees_vat_amount,payout_fee,adjustments_amount,status,payout_status,notes").order("settlement_date", { ascending: false }).limit(500),
      supabase.from("finance_incomes" as any).select("id,income_date,amount,note,transaction_type,payment_provider_id,settlement_id,account_id").is("deleted_at", null).order("income_date", { ascending: false }).limit(500),
      supabase.from("settlement_bank_allocations" as any).select("*").eq("status", "confirmed"),
    ]);
    if (p.error) toast.error(p.error.message); else setProviders((p.data as any) ?? []);
    if (s.error) toast.error(s.error.message); else setSettlements((s.data as any) ?? []);
    if (i.error) toast.error(i.error.message); else setIncomes((i.data as any) ?? []);
    if (a.error) toast.error(a.error.message); else setAllocations((a.data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const providerById = useMemo(() => Object.fromEntries(providers.map(p => [p.id, p])), [providers]);

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

  const settlementsFiltered = useMemo(() => {
    return settlements.filter(s => {
      if (sFilterProvider && s.provider_id !== sFilterProvider) return false;
      if (sFilterStatus && s.status !== sFilterStatus) return false;
      const used = settleAlloc[s.id] ?? 0;
      const remaining = Number(s.expected_net_amount) - used;
      if (sFilterMatch === "unmatched" && used > 0) return false;
      if (sFilterMatch === "partial" && !(used > 0 && remaining > 0.05)) return false;
      if (sFilterMatch === "full" && !(Math.abs(remaining) <= 0.05 && used > 0)) return false;
      // by default hide fully closed to reduce noise
      if (!sFilterMatch && (s.status === "closed" || s.status === "cancelled")) return false;
      return true;
    });
  }, [settlements, sFilterProvider, sFilterStatus, sFilterMatch, settleAlloc]);

  const incomesFiltered = useMemo(() => {
    return incomes.filter(inc => {
      const used = incomeAlloc[inc.id] ?? 0;
      const remaining = Number(inc.amount) - used;
      // Hide non-settlement-related incomes unless "show all"
      if (!iShowAll) {
        const isSettlementType = inc.transaction_type === "payment_provider_settlement";
        const hasProvider = !!inc.payment_provider_id;
        if (!isSettlementType && !hasProvider) return false;
      }
      if (iFilterProvider && inc.payment_provider_id !== iFilterProvider) return false;
      if (iFilterAlloc === "unmatched" && used > 0) return false;
      if (iFilterAlloc === "partial" && !(used > 0 && remaining > 0.05)) return false;
      if (iFilterAlloc === "full" && !(Math.abs(remaining) <= 0.05 && used > 0)) return false;
      if (iSearch) {
        const q = iSearch.toLowerCase();
        if (!(inc.note ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [incomes, iFilterProvider, iFilterAlloc, iShowAll, iSearch, incomeAlloc]);

  const selSettlement = useMemo(() => settlements.find(s => s.id === selSettlementId) || null, [settlements, selSettlementId]);
  const selIncome = useMemo(() => incomes.find(i => i.id === selIncomeId) || null, [incomes, selIncomeId]);

  const settleRemaining = selSettlement ? Number(selSettlement.expected_net_amount) - (settleAlloc[selSettlement.id] ?? 0) : 0;
  const incomeRemaining = selIncome ? Number(selIncome.amount) - (incomeAlloc[selIncome.id] ?? 0) : 0;

  // Suggested amount / match strength
  const suggestion = useMemo(() => {
    if (!selSettlement || !selIncome) return null;
    const sameProvider = !!(selIncome.payment_provider_id && selIncome.payment_provider_id === selSettlement.provider_id);
    const dateDelta = daysBetween(selSettlement.settlement_date, selIncome.income_date);
    const settleExpected = Number(selSettlement.expected_net_amount || 0);
    const incomeAmount = Number(selIncome.amount || 0);
    const diffFull = incomeAmount - settleExpected;
    const absDiffFull = Math.abs(diffFull);
    const suggestedAmount = Math.min(settleRemaining, incomeRemaining);
    if (suggestedAmount <= 0) return { strength: "no_match", suggestedAmount: 0, diff: 0, suggestedType: null as string | null, reason: "لا يوجد متبقٍ في أحد الطرفين", sameProvider, dateDelta };

    const diff = incomeRemaining - settleRemaining;
    const absDiff = Math.abs(diff);
    let strength: string = "no_match";
    let suggestedType: string | null = null;
    let reason = "";

    // Ratio guard against the settlement expected total — prevents e.g. 6664 vs 4250 pretending to match.
    const ratio = absDiffFull / Math.max(settleExpected, 1);

    if (sameProvider && absDiff <= 0.05 && dateDelta <= 30 && ratio <= 0.02) {
      strength = "exact_match";
      suggestedType = absDiff > 0 ? "rounding_difference" : null;
      reason = "نفس الوسيط + المبلغ متطابق ضمن هامش التقريب";
    } else if (absDiff <= 0.05 && ratio <= 0.02) {
      strength = "probable_match";
      suggestedType = absDiff > 0 ? "rounding_difference" : null;
      reason = "المبلغ متطابق لكن الوسيط أو التاريخ لا يتطابق";
    } else if (sameProvider && absDiff <= 20 && dateDelta <= 30 && ratio <= 0.05) {
      strength = "probable_match";
      suggestedType = "unknown_difference";
      reason = `نفس الوسيط · فرق ${fmt(absDiff)} يحتاج تصنيف`;
    } else if (sameProvider && dateDelta <= 15 && ratio <= 0.10) {
      strength = "weak_match";
      suggestedType = "unknown_difference";
      reason = `نفس الوسيط لكن الفرق ${fmt(absDiffFull)} (${(ratio * 100).toFixed(1)}%)`;
    } else {
      strength = "no_match";
      reason = sameProvider
        ? `الفرق كبير جداً (${fmt(absDiffFull)} · ${(ratio * 100).toFixed(1)}%)`
        : "الوسيط مختلف";
    }
    return { strength, suggestedAmount, diff, suggestedType, reason, sameProvider, dateDelta };
  }, [selSettlement, selIncome, settleRemaining, incomeRemaining]);

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
      _settlement_id: selSettlement.id,
      _transaction_id: selIncome.id,
      _amount: amt,
      _difference_type: diffType || null,
      _difference_note: diffNote || null,
      _allow_over_settlement: allowOver,
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

  // KPIs
  const kpis = useMemo(() => {
    const totals = { awaiting: 0, unmatched: 0, partial: 0, full: 0, unallocated: 0, roundingDiff: 0, unknownDiff: 0 };
    for (const s of settlements) {
      if (s.status === "cancelled" || s.status === "closed") continue;
      const used = settleAlloc[s.id] ?? 0;
      const remaining = Number(s.expected_net_amount) - used;
      if (used <= 0) totals.awaiting++;
      else if (Math.abs(remaining) <= 0.05) totals.full++;
      else totals.partial++;
      if (used <= 0) totals.unmatched++;
    }
    for (const inc of incomes) {
      const used = incomeAlloc[inc.id] ?? 0;
      const remaining = Number(inc.amount) - used;
      if ((inc.transaction_type === "payment_provider_settlement" || inc.payment_provider_id) && remaining > 0.05)
        totals.unallocated += remaining;
    }
    for (const a of allocations) {
      if (a.difference_type === "rounding_difference") totals.roundingDiff += Number(a.difference_amount);
      if (a.difference_type === "unknown_difference") totals.unknownDiff += Number(a.difference_amount);
    }
    return totals;
  }, [settlements, incomes, allocations, settleAlloc, incomeAlloc]);

  const selectionAllocations = useMemo(() => {
    if (!selSettlement) return [];
    return allocations.filter(a => a.settlement_id === selSettlement.id);
  }, [allocations, selSettlement]);

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-amber-400">مركز مطابقة التسويات والحوالات</h1>
        <button onClick={load} className="text-xs px-3 py-1.5 rounded border border-white/10 hover:bg-white/5">تحديث</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
        <Kpi label="بانتظار التحويل" value={kpis.awaiting} tone="orange" />
        <Kpi label="غير مطابقة" value={kpis.unmatched} tone="red" />
        <Kpi label="مطابقة جزئياً" value={kpis.partial} tone="amber" />
        <Kpi label="مطابقة بالكامل" value={kpis.full} tone="emerald" />
        <Kpi label="مبالغ حوالات غير مخصصة" value={`${fmt(kpis.unallocated)} ر.س`} tone="blue" />
        <Kpi label="فروقات تقريب" value={`${fmt(kpis.roundingDiff)} ر.س`} tone="muted" />
        <Kpi label="فروقات غير مفسرة" value={`${fmt(kpis.unknownDiff)} ر.س`} tone="red" />
      </div>

      {/* Three columns (desktop). Stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* RIGHT (in RTL, listed first) — Settlements */}
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
              <select value={sFilterStatus} onChange={e => setSFilterStatus(e.target.value)} className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1">
                <option value="">كل الحالات</option>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={sFilterMatch} onChange={e => setSFilterMatch(e.target.value as any)} className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1">
                <option value="">حسب المطابقة</option>
                <option value="unmatched">غير مطابقة</option>
                <option value="partial">جزئية</option>
                <option value="full">بالكامل</option>
              </select>
            </div>
          </div>
          <ul className="max-h-[520px] overflow-auto divide-y divide-white/5">
            {loading && <li className="p-4 text-xs text-muted-foreground">جاري التحميل…</li>}
            {!loading && settlementsFiltered.length === 0 && <li className="p-4 text-xs text-muted-foreground">لا توجد تسويات مطابقة للفلاتر</li>}
            {settlementsFiltered.map(s => {
              const used = settleAlloc[s.id] ?? 0;
              const remaining = Number(s.expected_net_amount) - used;
              const isSel = s.id === selSettlementId;
              const cls = isSel ? "bg-amber-500/10 border-r-2 border-amber-500" : "hover:bg-white/5";
              return (
                <li key={s.id}>
                  <button onClick={() => setSelSettlementId(s.id)} className={`w-full text-right p-3 text-xs space-y-1 ${cls}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-amber-400">{providerById[s.provider_id]?.name ?? "—"}</span>
                      <span className="text-muted-foreground">{s.settlement_date}</span>
                    </div>
                    <div className="text-muted-foreground">مرجع: {s.settlement_reference ?? "—"}</div>
                    <div className="flex justify-between">
                      <span>المتوقع: <b className="text-white">{fmt(s.expected_net_amount)}</b></span>
                      <span>مخصص: <b className="text-blue-300">{fmt(used)}</b></span>
                    </div>
                    <div className="flex justify-between">
                      <span>المتبقي: <b className={remaining > 0.05 ? "text-amber-300" : "text-emerald-300"}>{fmt(remaining)}</b></span>
                      <span className="text-muted-foreground">{STATUS_LABEL[s.status] ?? s.status}</span>
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
            {!selSettlement && !selIncome && (
              <div className="p-6 text-center text-muted-foreground text-xs">اختر تسوية وحوالة بنكية لبدء المطابقة</div>
            )}
            {selSettlement && (
              <div className="rounded border border-white/10 p-2 space-y-1 bg-black/20">
                <div className="text-amber-400 font-semibold">التسوية المختارة</div>
                <Row label="الوسيط" value={providerById[selSettlement.provider_id]?.name ?? "—"} />
                <Row label="المرجع" value={selSettlement.settlement_reference ?? "—"} />
                <Row label="التاريخ" value={selSettlement.settlement_date} />
                <Row label="الصافي المتوقع" value={fmt(selSettlement.expected_net_amount)} bold />
                <Row label="المتبقي للتخصيص" value={fmt(settleRemaining)} tone={settleRemaining > 0.05 ? "amber" : "emerald"} bold />
              </div>
            )}
            {selIncome && (
              <div className="rounded border border-white/10 p-2 space-y-1 bg-black/20">
                <div className="text-blue-300 font-semibold">الحوالة المختارة</div>
                <Row label="التاريخ" value={selIncome.income_date} />
                <Row label="المبلغ الكلي" value={fmt(selIncome.amount)} bold />
                <Row label="المتبقي" value={fmt(incomeRemaining)} tone={incomeRemaining > 0.05 ? "amber" : "emerald"} bold />
                <Row label="البيان" value={selIncome.note ?? "—"} />
              </div>
            )}

            {suggestion && selSettlement && selIncome && (
              <div className={`rounded border p-2 ${MATCH_COLOR[suggestion.strength]}`}>
                <div className="flex items-center justify-between font-semibold">
                  <span>{MATCH_STRENGTH_LABEL[suggestion.strength]}</span>
                  <span>{suggestion.reason}</span>
                </div>
                <Row label="المبلغ المقترح" value={fmt(suggestion.suggestedAmount)} />
                <Row label="الفرق (بنك − متبقٍ)" value={fmt(suggestion.diff)} />
              </div>
            )}

            {selSettlement && selIncome && (
              <div className="space-y-2">
                <label className="block">
                  <span className="text-muted-foreground">المبلغ المخصص</span>
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
                  <span className="text-muted-foreground">ملاحظة الفرق</span>
                  <textarea value={diffNote} onChange={e => setDiffNote(e.target.value)} rows={2} className="mt-1 w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-sm" />
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={allowOver} onChange={e => setAllowOver(e.target.checked)} />
                  <span>السماح بتجاوز صافي التسوية (يتطلب سبباً موثقاً)</span>
                </label>
                <button onClick={confirm} disabled={submitting} className="w-full rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold py-2 text-sm disabled:opacity-50">
                  <CheckCircle2 className="w-4 h-4 inline-block ml-1" />
                  تأكيد المطابقة
                </button>
              </div>
            )}

            {/* Existing allocations for selected settlement */}
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
                      <span className="text-muted-foreground">{new Date(a.confirmed_at ?? a.created_at).toLocaleString("ar-SA")}</span>
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
            <h2 className="font-semibold text-sm">الحوالات البنكية</h2>
            <span className="text-xs text-muted-foreground mr-auto">{incomesFiltered.length}</span>
          </header>
          <div className="p-2 space-y-2 border-b border-white/10">
            <div className="flex gap-2 flex-wrap">
              <select value={iFilterProvider} onChange={e => setIFilterProvider(e.target.value)} className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1">
                <option value="">كل الوسطاء</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={iFilterAlloc} onChange={e => setIFilterAlloc(e.target.value as any)} className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1">
                <option value="">حسب الربط</option>
                <option value="unmatched">غير مرتبطة</option>
                <option value="partial">جزئياً</option>
                <option value="full">بالكامل</option>
              </select>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={iShowAll} onChange={e => setIShowAll(e.target.checked)} />
                <span>إظهار كل الحركات</span>
              </label>
            </div>
            <div className="relative">
              <Search className="w-3 h-3 absolute right-2 top-2 text-muted-foreground" />
              <input value={iSearch} onChange={e => setISearch(e.target.value)} placeholder="بحث في البيان" className="w-full text-xs bg-black/40 border border-white/10 rounded pr-7 pl-2 py-1.5" />
            </div>
          </div>
          <ul className="max-h-[520px] overflow-auto divide-y divide-white/5">
            {loading && <li className="p-4 text-xs text-muted-foreground">جاري التحميل…</li>}
            {!loading && incomesFiltered.length === 0 && <li className="p-4 text-xs text-muted-foreground">لا توجد حوالات مطابقة</li>}
            {incomesFiltered.map(inc => {
              const used = incomeAlloc[inc.id] ?? 0;
              const remaining = Number(inc.amount) - used;
              const isSel = inc.id === selIncomeId;
              const cls = isSel ? "bg-blue-500/10 border-r-2 border-blue-400" : "hover:bg-white/5";
              return (
                <li key={inc.id}>
                  <button onClick={() => setSelIncomeId(inc.id)} className={`w-full text-right p-3 text-xs space-y-1 ${cls}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-blue-300">{providerById[inc.payment_provider_id ?? ""]?.name ?? (inc.transaction_type ?? "—")}</span>
                      <span className="text-muted-foreground">{inc.income_date}</span>
                    </div>
                    <div className="text-muted-foreground line-clamp-1">{inc.note ?? "—"}</div>
                    <div className="flex justify-between">
                      <span>المبلغ: <b className="text-white">{fmt(inc.amount)}</b></span>
                      <span>مستخدم: <b className="text-amber-300">{fmt(used)}</b></span>
                    </div>
                    <div className="flex justify-between">
                      <span>المتبقي: <b className={remaining > 0.05 ? "text-amber-300" : "text-emerald-300"}>{fmt(remaining)}</b></span>
                      <span className="text-muted-foreground">
                        {used <= 0 ? "غير مرتبطة" : Math.abs(remaining) <= 0.05 ? "بالكامل" : "جزئياً"}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="text-xs text-muted-foreground p-3 rounded border border-white/10 flex gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>المطابقة تربط الأصول المستحقة لدى الوسيط بالحوالة البنكية فقط، ولا تُسجل مبيعات أو ضريبة أو رسوم إضافية. جميع الإجراءات تُحفظ في سجل التدقيق.</span>
      </div>
    </div>
  );
}

function Row({ label, value, bold, tone }: { label: string; value: any; bold?: boolean; tone?: "amber" | "emerald" | "red" | "muted" }) {
  const toneCls = tone === "amber" ? "text-amber-300" : tone === "emerald" ? "text-emerald-300" : tone === "red" ? "text-red-300" : "text-white";
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? "font-bold" : ""} ${toneCls}`}>{value}</span>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: any; tone: "orange" | "red" | "amber" | "emerald" | "blue" | "muted" }) {
  const cls: Record<string, string> = {
    orange: "text-orange-300 border-orange-500/30 bg-orange-500/5",
    red: "text-red-300 border-red-500/30 bg-red-500/5",
    amber: "text-amber-300 border-amber-500/30 bg-amber-500/5",
    emerald: "text-emerald-300 border-emerald-500/30 bg-emerald-500/5",
    blue: "text-blue-300 border-blue-500/30 bg-blue-500/5",
    muted: "text-muted-foreground border-white/10 bg-white/[0.02]",
  };
  return (
    <div className={`rounded-lg border p-3 ${cls[tone]}`}>
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}
