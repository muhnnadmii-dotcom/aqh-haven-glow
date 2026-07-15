import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { usePaginatedQuery, type PageSize } from "@/lib/finance/use-paginated-query";
import { PaginationBar } from "@/components/finance/PaginationBar";
import { useUrlState, useInitialUrlPage, useSyncPageToUrl } from "@/lib/finance/use-url-state";
import { currentYm } from "@/lib/finance/current-month";
import { ACCOUNT_TYPES, ACCOUNTANT_STATUS, ATTACHMENT_STATUS, INTERNAL_REVIEW, fmtSAR, labelOf } from "@/lib/finance/constants";
import { INCOMING_TYPES, ACCOUNTING_STATUSES, incomingLabel, defaultBusinessRelation } from "@/lib/finance/transaction-types";

const BUSINESS_RELATIONS: { value: string; label: string }[] = [
  { value: "business", label: "تخص النشاط" },
  { value: "personal", label: "شخصية" },
  { value: "owner_settlement", label: "تسوية مالك" },
  { value: "internal_transfer", label: "تحويل داخلي" },
  { value: "unclassified", label: "غير محددة" },
];
import { Plus, Search, X, Pencil, Trash2, RotateCcw, Archive, Tag, Link2, ExternalLink, Wand2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AttachmentsPanel, PendingAttachmentsPicker, uploadPendingAttachments, type PendingAttachment } from "@/components/finance/AttachmentsPanel";
import { AuditPanel } from "@/components/finance/AuditPanel";
import { RowAttachmentControl } from "@/components/finance/RowAttachmentControl";
import { ReviewStatusEditor } from "@/components/finance/ReviewStatusEditor";

export const Route = createFileRoute("/_authenticated/admin/finance/incomes")({
  ssr: false,
  component: IncomesPage,
});

type Income = any;
type Provider = { id: string; name: string; provider_code: string };
type Settlement = {
  id: string; provider_id: string; settlement_reference: string | null;
  settlement_date: string | null; expected_net_amount: number | null;
  actual_bank_amount: number | null; status: string | null; bank_income_id: string | null;
};
type Alloc = {
  id: string; settlement_id: string; transaction_id: string;
  allocated_amount: number; status: string;
  difference_type: string | null; difference_amount: number | null;
};

type LinkStatus = "unmatched" | "suggested_match" | "partially_allocated" | "fully_allocated" | "needs_review";

const LINK_TONES: Record<LinkStatus, string> = {
  unmatched: "bg-white/5 text-muted-foreground border-white/15",
  suggested_match: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  partially_allocated: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  fully_allocated: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  needs_review: "bg-red-500/15 text-red-300 border-red-500/30",
};
const LINK_LABELS: Record<LinkStatus, string> = {
  unmatched: "غير مرتبطة",
  suggested_match: "مطابقة مقترحة",
  partially_allocated: "مرتبطة جزئيًا",
  fully_allocated: "مرتبطة بالكامل",
  needs_review: "تحتاج مراجعة",
};

// Normalize a source name/code to a provider_code (salla_payments/tabby/tamara), or null.
function normalizeProviderCode(name?: string | null): string | null {
  if (!name) return null;
  const s = String(name).trim().toLowerCase();
  if (s === "salla" || s === "سلة" || s.includes("سلة") || s.startsWith("salla")) return "salla_payments";
  if (s === "tabby" || s === "تابي" || s.includes("تابي") || s === "tabby.ai") return "tabby";
  if (s === "tamara" || s === "تمارا" || s.includes("تمارا")) return "tamara";
  return null;
}
function providerAr(code?: string | null): string {
  return code === "salla_payments" ? "سلة" : code === "tabby" ? "تابي" : code === "tamara" ? "تمارا" : "—";
}

function IncomesPage() {
  const roles = useFinanceRoles();
  const navigate = useNavigate();
  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [pageAllocs, setPageAllocs] = useState<Alloc[]>([]);
  const [editing, setEditing] = useState<Income | null>(null);
  const [creating, setCreating] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [reclassifyOpen, setReclassifyOpen] = useState(false);
  const [linkedDialog, setLinkedDialog] = useState<{ income: Income; settlements: Settlement[]; allocs: Alloc[] } | null>(null);
  const [unclassifiedCount, setUnclassifiedCount] = useState(0);
  const [deletedCount, setDeletedCount] = useState(0);

  const [q, setQ] = useState(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      return sp.get("q") ?? "";
    }
    return "";
  });
  const [debouncedQ, setDebouncedQ] = useUrlState("q", "", { debounceMs: 400 });
  const [fMonth, setFMonth] = useUrlState("month", "");
  const [fSource, setFSource] = useUrlState("src", "");
  const [fAccount, setFAccount] = useUrlState("acc", "");
  const [fInternal, setFInternal] = useUrlState("internal", "");
  const [fAcct, setFAcct] = useUrlState("acct", "");
  const [fAtt, setFAtt] = useUrlState("att", "");
  const [fTxnType, setFTxnType] = useUrlState("txn", "");
  const [fAccStatus, setFAccStatus] = useUrlState("astatus", "");
  const [fProviderRaw, setFProviderRaw] = useUrlState("provider", "");
  const fProvider = fProviderRaw as "" | "salla_payments" | "tabby" | "tamara" | "none";
  const setFProvider = (v: "" | "salla_payments" | "tabby" | "tamara" | "none") => setFProviderRaw(v);
  const [fLinkRaw, setFLinkRaw] = useUrlState("link", "");
  const fLink = fLinkRaw as "" | LinkStatus;
  const setFLink = (v: "" | LinkStatus) => setFLinkRaw(v);
  const initialPage = useInitialUrlPage();

  const resetFilters = () => {
    setQ(""); setFMonth(""); setFSource(""); setFAccount(""); setFInternal("");
    setFAcct(""); setFAtt(""); setFTxnType(""); setFAccStatus(""); setFProvider(""); setFLink("");
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q, setDebouncedQ]);

  useEffect(() => {
    (async () => {
      const [{ data: srcs }, { data: prov }, { data: setts }] = await Promise.all([
        supabase.from("finance_income_sources").select("id, name").eq("is_active", true).order("display_order"),
        supabase.from("payment_providers").select("id, name, provider_code"),
        supabase.from("payment_settlements").select("id, provider_id, settlement_reference, settlement_date, expected_net_amount, actual_bank_amount, status, bank_income_id"),
      ]);
      setSources(srcs ?? []);
      setProviders((prov as any) ?? []);
      setSettlements((setts as any) ?? []);
    })();
  }, []);

  const providerByCode = useMemo(() => new Map(providers.map((p) => [p.provider_code, p])), [providers]);

  const refreshCounts = useCallback(async () => {
    const [u, d] = await Promise.all([
      supabase.from("finance_incomes").select("id", { count: "exact", head: true }).is("deleted_at", null).or("accounting_status.is.null,accounting_status.eq.unclassified"),
      supabase.from("finance_incomes").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
    ]);
    setUnclassifiedCount(u.count ?? 0);
    setDeletedCount(d.count ?? 0);
  }, []);
  useEffect(() => { refreshCounts(); }, [refreshCounts]);

  const fetcher = useCallback(async ({ page, pageSize }: { page: number; pageSize: PageSize }) => {
    let query = supabase.from("finance_incomes").select("*", { count: "exact" })
      .order("income_date", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false });
    if (showDeleted) query = query.not("deleted_at", "is", null);
    else query = query.is("deleted_at", null);
    if (debouncedQ) {
      const like = `%${debouncedQ.replace(/[%_]/g, (m) => "\\" + m)}%`;
      query = query.ilike("note", like);
    }
    if (fMonth) query = query.eq("month", fMonth);
    if (fSource) query = query.eq("income_source_id", fSource);
    if (fAccount) query = query.eq("account_type", fAccount as any);
    if (fInternal) query = query.eq("internal_review_status", fInternal as any);
    if (fAcct) query = query.eq("accountant_status", fAcct as any);
    if (fAtt) query = query.eq("attachment_status", fAtt as any);
    if (fTxnType) query = query.eq("transaction_type", fTxnType as any);
    if (fAccStatus) {
      if (fAccStatus === "unclassified") query = query.or("accounting_status.is.null,accounting_status.eq.unclassified");
      else query = query.eq("accounting_status", fAccStatus as any);
    }
    if (fProvider === "none") query = query.is("payment_provider_id", null);
    else if (fProvider) {
      const p = providerByCode.get(fProvider);
      if (!p) return { rows: [], total: 0 };
      query = query.eq("payment_provider_id", p.id);
    }
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await query.range(from, to);
    if (error) throw new Error(error.message);
    const incRows = (data as any[]) ?? [];

    // Fetch confirmed allocations only for current page rows.
    const ids = incRows.map((r) => r.id);
    if (ids.length) {
      const { data: als } = await supabase.from("settlement_bank_allocations")
        .select("id, settlement_id, transaction_id, allocated_amount, status, difference_type, difference_amount")
        .eq("status", "confirmed").in("transaction_id", ids);
      setPageAllocs((als as any) ?? []);
    } else {
      setPageAllocs([]);
    }
    return { rows: incRows, total: count ?? 0 };
  }, [showDeleted, debouncedQ, fMonth, fSource, fAccount, fInternal, fAcct, fAtt, fTxnType, fAccStatus, fProvider, providerByCode]);

  const pg = usePaginatedQuery(fetcher, [showDeleted, debouncedQ, fMonth, fSource, fAccount, fInternal, fAcct, fAtt, fTxnType, fAccStatus, fProvider], undefined, initialPage);
  useSyncPageToUrl(pg.page);
  const [rows, setLocalRows] = useState<Income[]>([]);
  useEffect(() => { setLocalRows(pg.rows); }, [pg.rows]);
  const setRows = (updater: (prev: any[]) => any[]) => setLocalRows((p) => updater(p));
  const loading = pg.loading;
  const load = useCallback(() => { pg.reload(); refreshCounts(); }, [pg.reload, refreshCounts]);
  const allocs = pageAllocs;


  const sourceName = (id: string | null) => sources.find((s) => s.id === id)?.name ?? "—";
  const providerById = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers]);
  const settlementById = useMemo(() => new Map(settlements.map((s) => [s.id, s])), [settlements]);

  // Per-income enrichment
  const enrichment = useMemo(() => {
    const allocByIncome = new Map<string, Alloc[]>();
    for (const a of allocs) {
      const arr = allocByIncome.get(a.transaction_id) ?? [];
      arr.push(a);
      allocByIncome.set(a.transaction_id, arr);
    }
    const settByBankIncome = new Map<string, Settlement[]>();
    for (const s of settlements) {
      if (s.bank_income_id) {
        const arr = settByBankIncome.get(s.bank_income_id) ?? [];
        arr.push(s);
        settByBankIncome.set(s.bank_income_id, arr);
      }
    }

    const out = new Map<string, {
      providerCode: string | null;
      providerName: string;
      isProviderIncome: boolean;
      allocated: number;
      remaining: number;
      linkStatus: LinkStatus;
      linkedSettlements: Settlement[];
      linkedAllocs: Alloc[];
    }>();

    for (const r of rows) {
      // Resolve provider: explicit column → source name normalization.
      let providerCode: string | null = null;
      if (r.payment_provider_id) {
        providerCode = providerById.get(r.payment_provider_id)?.provider_code ?? null;
      }
      if (!providerCode) providerCode = normalizeProviderCode(sourceName(r.income_source_id));
      const isProviderIncome = !!providerCode && Number(r.amount) > 0;

      const rowAllocs = allocByIncome.get(r.id) ?? [];
      const directSetts = settByBankIncome.get(r.id) ?? [];
      const linkedSettIds = new Set<string>();
      rowAllocs.forEach((a) => linkedSettIds.add(a.settlement_id));
      directSetts.forEach((s) => linkedSettIds.add(s.id));
      const linkedSettlements = Array.from(linkedSettIds).map((id) => settlementById.get(id)).filter(Boolean) as Settlement[];

      const amount = Number(r.amount ?? 0);
      let allocated = rowAllocs.reduce((s, a) => s + Number(a.allocated_amount ?? 0), 0);
      // Direct bank_income link with no explicit alloc → treat as full for that settlement.
      const directOnly = directSetts.filter((s) => !rowAllocs.some((a) => a.settlement_id === s.id));
      if (directOnly.length && allocated === 0) allocated = amount;
      const remaining = Math.max(0, +(amount - allocated).toFixed(2));

      const hasIssue = rowAllocs.some((a) => a.difference_type && Number(a.difference_amount ?? 0) !== 0);
      let linkStatus: LinkStatus;
      if (hasIssue) linkStatus = "needs_review";
      else if (allocated === 0) linkStatus = "unmatched";
      else if (Math.abs(amount - allocated) <= 0.05) linkStatus = "fully_allocated";
      else linkStatus = "partially_allocated";

      out.set(r.id, {
        providerCode, providerName: providerAr(providerCode),
        isProviderIncome, allocated, remaining, linkStatus,
        linkedSettlements, linkedAllocs: rowAllocs,
      });
    }
    return out;
  }, [rows, allocs, settlements, sources, providerById, settlementById]);

  // Server-side filters already applied; keep fLink as page-scope client filter.
  const filtered = useMemo(() => rows.filter((r) => {
    if (!fLink) return true;
    const en = enrichment.get(r.id);
    return en?.linkStatus === fLink;
  }), [rows, fLink, enrichment]);

  const summary = useMemo(() => {
    const s = { unmatched: 0, suggested: 0, partial: 0, full: 0, needsReview: 0, unallocated: 0 };
    for (const r of rows) {
      if (r.deleted_at) continue;
      const en = enrichment.get(r.id);
      if (!en || !en.isProviderIncome) continue;
      if (en.linkStatus === "unmatched") s.unmatched++;
      if (en.linkStatus === "suggested_match") s.suggested++;
      if (en.linkStatus === "partially_allocated") s.partial++;
      if (en.linkStatus === "fully_allocated") s.full++;
      if (en.linkStatus === "needs_review") s.needsReview++;
      s.unallocated += en.remaining;
    }
    return s;
  }, [rows, enrichment]);

  const months = useMemo(() => {
    const out: string[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  }, []);
  const total = filtered.reduce((a, b) => a + Number(b.amount ?? 0), 0);


  const softDelete = async (r: Income) => {
    const en = enrichment.get(r.id);
    if (en && en.allocated > 0) {
      toast.error("لا يمكن حذف حوالة مرتبطة بتسوية مؤكدة — يجب عكس التخصيص أولًا من مركز المطابقة.");
      return;
    }
    const reason = window.prompt("سبب الحذف (اختياري):", "") ?? "";
    if (!confirm("هل أنت متأكد من حذف هذه العملية؟ سيتم إخفاؤها من الجداول مع الاحتفاظ بها في سجل النظام.")) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("finance_incomes").update({
      deleted_at: new Date().toISOString(),
      deleted_by: u.user?.id ?? null,
      delete_reason: reason || null,
    }).eq("id", r.id);
    if (error) toast.error("تعذر الحذف: " + error.message);
    else { toast.success("تمت الأرشفة"); load(); }
  };

  const restore = async (r: Income) => {
    if (!confirm("استعادة هذه العملية إلى الجدول الافتراضي؟")) return;
    const { error } = await supabase.from("finance_incomes").update({
      deleted_at: null, deleted_by: null, delete_reason: null,
    }).eq("id", r.id);
    if (error) toast.error("تعذر الاستعادة: " + error.message);
    else { toast.success("تمت الاستعادة"); load(); }
  };

  const openReconciliation = (incomeId?: string) => {
    const url = incomeId ? `/admin/finance/settlement-reconciliation?income=${incomeId}` : "/admin/finance/settlement-reconciliation";
    navigate({ to: url });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">المقبوضات {showDeleted && <span className="text-amber-300 text-[12px]">(المؤرشفة)</span>}</h2>
        <div className="flex items-center gap-2">
          {roles.canManage && (
            <button onClick={() => setReclassifyOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[12px] hover:bg-sky-500/25">
              <Wand2 size={13} /> تصنيف حوالات الوسطاء القديمة
            </button>
          )}
          {roles.canManage && deletedCount > 0 && (
            <button onClick={() => setShowDeleted(!showDeleted)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] ${showDeleted ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>
              <Archive size={13} /> {showDeleted ? "إخفاء المؤرشفة" : `عرض المؤرشفة (${deletedCount})`}
            </button>
          )}
          {roles.canManage && (
            <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[12px] hover:bg-gold/25">
              <Plus size={14} /> إضافة دخل
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <SummaryCard label="غير مرتبطة" value={summary.unmatched} tone="text-muted-foreground" active={fLink === "unmatched"} onClick={() => setFLink(fLink === "unmatched" ? "" : "unmatched")} />
        <SummaryCard label="مطابقات مقترحة" value={summary.suggested} tone="text-sky-300" active={fLink === "suggested_match"} onClick={() => setFLink(fLink === "suggested_match" ? "" : "suggested_match")} />
        <SummaryCard label="مرتبطة جزئيًا" value={summary.partial} tone="text-orange-300" active={fLink === "partially_allocated"} onClick={() => setFLink(fLink === "partially_allocated" ? "" : "partially_allocated")} />
        <SummaryCard label="مرتبطة بالكامل" value={summary.full} tone="text-emerald-300" active={fLink === "fully_allocated"} onClick={() => setFLink(fLink === "fully_allocated" ? "" : "fully_allocated")} />
        <SummaryCard label="مبلغ غير مخصص" value={fmtSAR(summary.unallocated)} tone="text-gold" />
        <SummaryCard label="تحتاج مراجعة" value={summary.needsReview} tone="text-red-300" active={fLink === "needs_review"} onClick={() => setFLink(fLink === "needs_review" ? "" : "needs_review")} />
      </div>

      {unclassifiedCount > 0 && (
        <button
          onClick={() => setFAccStatus("unclassified")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] ${fAccStatus === "unclassified" ? "bg-amber-500/20 border-amber-500/40 text-amber-200" : "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"}`}
        >
          <Tag size={13} /> حركات غير مصنفة: {unclassifiedCount}
        </button>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        <label className="relative col-span-2">
          <Search size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث…" className="w-full pr-7 pl-2 py-1.5 rounded-lg bg-background/60 border border-white/10 text-[12px]" />
        </label>
        <Select v={fProvider} onChange={(v) => setFProvider(v as any)} ph="وسيط الدفع" opts={[
          { value: "salla_payments", label: "سلة" },
          { value: "tabby", label: "تابي" },
          { value: "tamara", label: "تمارا" },
          { value: "none", label: "بدون وسيط" },
        ]} />
        <Select v={fLink} onChange={(v) => setFLink(v as any)} ph="حالة الربط" opts={(Object.keys(LINK_LABELS) as LinkStatus[]).map((k) => ({ value: k, label: LINK_LABELS[k] }))} />
        <Select v={fTxnType} onChange={setFTxnType} ph="نوع الحركة" opts={INCOMING_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
        <Select v={fMonth} onChange={setFMonth} ph="الشهر" opts={months.map((m) => ({ value: m, label: m }))} />
        <Select v={fSource} onChange={setFSource} ph="المصدر الأصلي" opts={sources.map((s) => ({ value: s.id, label: s.name }))} />
        <Select v={fAccStatus} onChange={setFAccStatus} ph="حالة التصنيف" opts={ACCOUNTING_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
        <Select v={fAccount} onChange={setFAccount} ph="نوع الحساب" opts={ACCOUNT_TYPES.map((a) => ({ value: a.value, label: a.label }))} />
        <Select v={fInternal} onChange={setFInternal} ph="مراجعة داخلية" opts={INTERNAL_REVIEW.map((a) => ({ value: a.value, label: a.label }))} />
        <Select v={fAcct} onChange={setFAcct} ph="حالة المحاسب" opts={ACCOUNTANT_STATUS.map((a) => ({ value: a.value, label: a.label }))} />
        <Select v={fAtt} onChange={setFAtt} ph="حالة المرفق" opts={ATTACHMENT_STATUS.map((a) => ({ value: a.value, label: a.label }))} />
        <button onClick={resetFilters} className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[12px] inline-flex items-center gap-1"><RotateCcw size={12} /> إعادة ضبط</button>
      </div>

      <div className={`overflow-x-auto rounded-xl border border-white/10 bg-white/5 ${loading ? "opacity-70" : ""}`}>
        <table className="w-full text-[12px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-start px-3 py-2">التاريخ</th>
              <th className="text-start px-3 py-2">المبلغ</th>
              <th className="text-start px-3 py-2">وسيط الدفع</th>
              <th className="text-start px-3 py-2">نوع الحركة</th>
              <th className="text-start px-3 py-2">الحساب</th>
              <th className="text-start px-3 py-2">حالة الربط</th>
              <th className="text-start px-3 py-2">المخصص</th>
              <th className="text-start px-3 py-2">المتبقي</th>
              <th className="text-start px-3 py-2">التسوية المرتبطة</th>
              <th className="text-start px-3 py-2">المرفق</th>
              <th className="text-start px-3 py-2">المحاسب</th>
              <th className="text-start px-3 py-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const en = enrichment.get(r.id)!;
              return (
              <tr key={r.id} className={`border-t border-white/5 hover:bg-white/5 ${r.deleted_at ? "opacity-60" : ""}`}>
                <td className="px-3 py-2 whitespace-nowrap">{r.income_date}</td>
                <td className="px-3 py-2 font-mono">{fmtSAR(r.amount)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {en.providerCode ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-gold/30 bg-gold/10 text-gold">{en.providerName}</span>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">—</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.transaction_type ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-white/10 bg-white/5">
                      {incomingLabel(r.transaction_type)}
                    </span>
                  ) : (
                    <span className="text-amber-300/80 text-[10px]">مقبوض غير مصنف</span>
                  )}
                </td>
                <td className="px-3 py-2">{labelOf(ACCOUNT_TYPES, r.account_type)}</td>
                <td className="px-3 py-2">
                  {en.isProviderIncome ? (
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border whitespace-nowrap ${LINK_TONES[en.linkStatus]}`}>{LINK_LABELS[en.linkStatus]}</span>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">لا ينطبق</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-[11px]">{en.allocated > 0 ? fmtSAR(en.allocated) : "—"}</td>
                <td className={`px-3 py-2 font-mono text-[11px] ${en.remaining > 0 && en.isProviderIncome ? "text-orange-300" : ""}`}>{en.isProviderIncome ? fmtSAR(en.remaining) : "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {en.linkedSettlements.length === 0 ? (
                    en.isProviderIncome ? (
                      <button onClick={() => openReconciliation(r.id)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-sky-500/10 border border-sky-500/30 text-sky-300 hover:bg-sky-500/20">
                        <Link2 size={10} /> بحث عن تسوية
                      </button>
                    ) : <span className="text-muted-foreground text-[10px]">—</span>
                  ) : en.linkedSettlements.length === 1 ? (
                    <button onClick={() => navigate({ to: "/admin/finance/settlement-lines", search: { settlement: en.linkedSettlements[0].id } })} className="inline-flex items-center gap-1 text-[10px] text-sky-300 hover:underline">
                      {providerAr(providerById.get(en.linkedSettlements[0].provider_id)?.provider_code)} — تسوية #{en.linkedSettlements[0].settlement_reference ?? en.linkedSettlements[0].id.slice(0, 8)}
                      <ExternalLink size={10} />
                    </button>
                  ) : (
                    <button onClick={() => setLinkedDialog({ income: r, settlements: en.linkedSettlements, allocs: en.linkedAllocs })} className="inline-flex items-center gap-1 text-[10px] text-sky-300 hover:underline">
                      مرتبط بـ {en.linkedSettlements.length} تسويات
                    </button>
                  )}
                </td>
                <td className="px-3 py-2">
                  <RowAttachmentControl relatedType="income" relatedId={r.id} status={r.attachment_status} canManage={roles.canManage} canDelete={roles.canManage}
                    onChanged={(s) => setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, attachment_status: s } : x))}
                  />
                </td>
                <td className="px-3 py-2">
                  <ReviewStatusEditor table="finance_incomes" rowId={r.id} field="accountant_status" value={r.accountant_status} note={r.accountant_note}
                    canEdit={(roles.canManage || roles.canAccountant) && !r.deleted_at}
                    onChanged={(v, n) => setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, accountant_status: v, ...(n !== undefined ? { accountant_note: n } : {}) } : x))}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditing(r)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px]">
                      <Pencil size={11} /> فتح
                    </button>
                    {roles.canManage && !r.deleted_at && (
                      <button onClick={() => softDelete(r)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-300 text-[11px]" title="أرشفة / حذف">
                        <Trash2 size={11} />
                      </button>
                    )}
                    {roles.canManage && r.deleted_at && (
                      <button onClick={() => restore(r)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px]" title="استعادة">
                        <RotateCcw size={11} /> استعادة
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );})}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">لا توجد بيانات</td></tr>
            )}
          </tbody>
          <tfoot className="bg-white/5 font-semibold">
            <tr><td className="px-3 py-2">إجمالي الصفحة</td><td className="px-3 py-2 font-mono">{fmtSAR(total)}</td><td colSpan={10} className="text-muted-foreground text-[11px]">{pg.total} سجل مطابق</td></tr>
          </tfoot>
        </table>
        <PaginationBar page={pg.page} pageCount={pg.pageCount} pageSize={pg.pageSize} total={pg.total} loading={pg.loading} onPage={pg.setPage} onPageSize={pg.setPageSize} />
      </div>

      {(editing || creating) && (
        <IncomeDialog
          row={editing}
          sources={sources}
          providers={providers}
          roles={roles}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}

      {reclassifyOpen && (
        <ReclassifyDialog
          sources={sources}
          providers={providers}
          onClose={() => setReclassifyOpen(false)}
          onDone={() => { setReclassifyOpen(false); load(); }}
        />
      )}


      {linkedDialog && (
        <LinkedSettlementsDialog
          income={linkedDialog.income}
          settlements={linkedDialog.settlements}
          allocs={linkedDialog.allocs}
          providers={providers}
          onClose={() => setLinkedDialog(null)}
          onOpen={(settlementId: string) => { setLinkedDialog(null); navigate({ to: "/admin/finance/settlement-lines", search: { settlement: settlementId } }); }}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone, active, onClick }: { label: string; value: number | string; tone?: string; active?: boolean; onClick?: () => void }) {
  const Cmp: any = onClick ? "button" : "div";
  return (
    <Cmp onClick={onClick} className={`rounded-xl border p-3 text-start transition ${active ? "bg-white/10 border-gold/40" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold font-mono mt-1 ${tone ?? ""}`}>{value}</div>
    </Cmp>
  );
}

function Select({ v, onChange, ph, opts }: { v: string; onChange: (s: string) => void; ph: string; opts: { value: string; label: string }[] }) {
  return (
    <select value={v} onChange={(e) => onChange(e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-background/60 border border-white/10 text-[12px]">
      <option value="">{ph}</option>
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function LinkedSettlementsDialog({ income, settlements, allocs, providers, onClose, onOpen }: any) {
  const providerById = new Map<string, Provider>(providers.map((p: Provider) => [p.id, p]));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-background border border-white/10 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-semibold text-sm">التسويات المرتبطة — {fmtSAR(income.amount)}</div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded"><X size={16} /></button>
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-auto">
          {settlements.map((s: Settlement) => {
            const alloc = allocs.find((a: Alloc) => a.settlement_id === s.id);
            const p = providerById.get(s.provider_id);
            return (
              <div key={s.id} className="rounded-lg border border-white/10 bg-white/5 p-3 text-[12px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gold">{providerAr(p?.provider_code)}</span>
                  <button onClick={() => onOpen(s.id)} className="font-mono text-[11px] text-sky-300 hover:underline inline-flex items-center gap-1">
                    #{s.settlement_reference ?? s.id.slice(0, 8)}
                    <ExternalLink size={10} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 text-[11px]">
                  <div>الصافي المتوقع: <span className="font-mono">{fmtSAR(s.expected_net_amount)}</span></div>
                  <div>المخصص من الحوالة: <span className="font-mono text-emerald-300">{fmtSAR(alloc?.allocated_amount ?? income.amount)}</span></div>
                  <div>حالة التسوية: {s.status ?? "—"}</div>
                  <div>التاريخ: {s.settlement_date ?? "—"}</div>
                </div>
                <button onClick={() => onOpen(s.id)} className="text-[11px] text-sky-300 hover:underline inline-flex items-center gap-1"><ExternalLink size={11} /> عرض حركات التسوية</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type ReclassifyPlan = {
  candidates: Array<{ id: string; income_date: string; amount: number; sourceName: string; providerCode: string; providerId: string; account_type: string; currentType: string | null; conflict: boolean; skipReason?: string }>;
  bySalla: number; byTabby: number; byTamara: number;
  toChange: number; conflicts: number; skipped: number;
};

function ReclassifyDialog({ sources, providers, onClose, onDone }: any) {
  const [rows, setRows] = useState<Income[]>([]);
  useEffect(() => {
    (async () => {
      // Fetch only candidates: non-deleted, positive amount, no explicit payment_provider_id.
      const { data } = await supabase.from("finance_incomes")
        .select("id, income_date, amount, income_source_id, payment_provider_id, account_type, transaction_type, deleted_at")
        .is("deleted_at", null).gt("amount", 0).is("payment_provider_id", null)
        .order("income_date", { ascending: false }).limit(5000);
      setRows((data as any) ?? []);
    })();
  }, []);

  const [applying, setApplying] = useState(false);

  const plan: ReclassifyPlan = useMemo(() => {
    const providerByCode = new Map<string, Provider>((providers as Provider[]).map((p) => [p.provider_code, p]));
    const srcById = new Map<string, string>((sources as any[]).map((s: any) => [s.id, s.name]));
    const out: ReclassifyPlan = { candidates: [], bySalla: 0, byTabby: 0, byTamara: 0, toChange: 0, conflicts: 0, skipped: 0 };
    for (const r of rows as Income[]) {
      if (r.deleted_at) continue;
      if (Number(r.amount) <= 0) continue;
      if (r.payment_provider_id) continue; // already tagged
      const src = srcById.get(r.income_source_id) ?? "";
      const code = normalizeProviderCode(src);
      if (!code) continue;
      const prov = providerByCode.get(code);
      if (!prov) continue;
      if (r.account_type === "personal") {
        out.candidates.push({ id: r.id, income_date: r.income_date, amount: Number(r.amount), sourceName: src, providerCode: code, providerId: prov.id, account_type: r.account_type, currentType: r.transaction_type, conflict: false, skipReason: "حساب شخصي — يحتاج تأكيد يدوي" });
        out.skipped++;
        continue;
      }
      const conflict = !!r.transaction_type && r.transaction_type !== "payment_provider_settlement" && r.transaction_type !== "unclassified_incoming";
      out.candidates.push({ id: r.id, income_date: r.income_date, amount: Number(r.amount), sourceName: src, providerCode: code, providerId: prov.id, account_type: r.account_type, currentType: r.transaction_type, conflict });
      if (code === "salla_payments") out.bySalla++;
      if (code === "tabby") out.byTabby++;
      if (code === "tamara") out.byTamara++;
      if (conflict) out.conflicts++;
      else out.toChange++;
    }
    return out;
  }, [rows, sources, providers]);

  const apply = async () => {
    if (!confirm(`سيتم تحديث ${plan.toChange} حركة إلى (تحويل تسوية وسيط دفع). لن يتم تغيير المبلغ أو التاريخ أو الحساب. متابعة؟`)) return;
    setApplying(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      const targets = plan.candidates.filter((c) => !c.conflict && !c.skipReason);
      let ok = 0, fail = 0;
      for (const c of targets) {
        const { error } = await supabase.from("finance_incomes").update({
          payment_provider_id: c.providerId,
          transaction_type: "payment_provider_settlement",
          business_relation: "business",
          accounting_status: "classified",
        }).eq("id", c.id);
        if (error) { fail++; continue; }
        await (supabase as any).rpc("finance_log_manual_audit", {
          p_related_type: "finance_incomes",
          p_related_id: c.id,
          p_action: "reclassify_provider",
          p_field_name: "transaction_type",
          p_old_value: c.currentType ?? null,
          p_new_value: "payment_provider_settlement",
          p_note: `تصنيف تلقائي — وسيط: ${providerAr(c.providerCode)} (${c.sourceName})`,
        });
        ok++;
      }
      toast.success(`تم تحديث ${ok} حركة${fail ? ` — فشل ${fail}` : ""}`);
      onDone();
    } catch (e: any) {
      toast.error("تعذر التنفيذ: " + (e.message ?? "خطأ"));
    } finally { setApplying(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl bg-background border border-white/10 p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-semibold">تصنيف حوالات الوسطاء القديمة</div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[12px]">
          <Stat label="حركات سلة" value={plan.bySalla} />
          <Stat label="حركات تابي" value={plan.byTabby} />
          <Stat label="حركات تمارا" value={plan.byTamara} />
          <Stat label="سيتغير نوعها" value={plan.toChange} tone="text-emerald-300" />
          <Stat label="مستبعدة / تعارض" value={plan.conflicts + plan.skipped} tone="text-amber-300" />
        </div>
        <div className="text-[11px] text-muted-foreground">
          سيتم تحديث الحقول الآتية فقط: وسيط الدفع، نوع الحركة (= تحويل تسوية وسيط دفع)، علاقة العملية (= تخص النشاط)، حالة التصنيف (= مصنف). لن يتم تغيير المبلغ، التاريخ، الحساب، ولن تُنشأ حركات جديدة أو قيود جديدة. جميع التغييرات تُسجّل في سجل التدقيق.
        </div>

        {(plan.conflicts + plan.skipped) > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px]">
            <div className="font-semibold text-amber-300 mb-2 inline-flex items-center gap-1"><AlertTriangle size={12} /> تعارض أو استبعاد ({plan.conflicts + plan.skipped})</div>
            <div className="max-h-40 overflow-auto space-y-1">
              {plan.candidates.filter((c) => c.conflict || c.skipReason).map((c) => (
                <div key={c.id} className="flex items-center justify-between border-b border-white/5 py-1">
                  <span>{c.income_date} — {fmtSAR(c.amount)} — {c.sourceName}</span>
                  <span className="text-amber-300">{c.skipReason ?? `مصنف يدويًا: ${incomingLabel(c.currentType)}`}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-[11px]">
          <div className="font-semibold mb-2">معاينة الحركات القابلة للتصنيف ({plan.toChange})</div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full">
              <thead className="text-muted-foreground text-[10px]"><tr><th className="text-start pb-1">التاريخ</th><th className="text-start pb-1">المبلغ</th><th className="text-start pb-1">المصدر</th><th className="text-start pb-1">الوسيط الجديد</th></tr></thead>
              <tbody>
                {plan.candidates.filter((c) => !c.conflict && !c.skipReason).slice(0, 200).map((c) => (
                  <tr key={c.id} className="border-t border-white/5"><td className="py-1">{c.income_date}</td><td className="font-mono">{fmtSAR(c.amount)}</td><td>{c.sourceName}</td><td className="text-gold">{providerAr(c.providerCode)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px] bg-white/5 hover:bg-white/10">إلغاء</button>
          <button disabled={applying || plan.toChange === 0} onClick={apply} className="px-4 py-1.5 rounded-lg text-[12px] bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30 disabled:opacity-50">
            {applying ? "..." : `تنفيذ التصنيف (${plan.toChange})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold font-mono ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

const COLLECTION_TYPES = [
  { value: "invoice_collection", label: "تحصيل فاتورة" },
  { value: "cash_sale", label: "بيع نقدي" },
  { value: "advance_payment", label: "دفعة مقدمة" },
  { value: "other", label: "أخرى" },
];

function IncomeDialog({ row, sources, providers, roles, onClose, onSaved }: any) {
  const isNew = !row;
  const accountantOnly = !roles.canManage && roles.canAccountant;
  const canReview = roles.canManage || roles.canAccountant;

  const [f, setF] = useState({
    income_date: row?.income_date ?? new Date().toISOString().slice(0, 10),
    amount: row?.amount ?? 0,
    income_source_id: row?.income_source_id ?? "",
    account_id: row?.account_id ?? "",
    account_type: row?.account_type ?? "business",
    note: row?.note ?? "",
    internal_review_status: row?.internal_review_status ?? "unreviewed",
    accountant_status: row?.accountant_status ?? "not_reviewed",
    accountant_note: row?.accountant_note ?? "",
    attachment_status: row?.attachment_status ?? "not_attached",
    transaction_type: row?.transaction_type ?? "",
    accounting_status: row?.accounting_status ?? "unclassified",
    business_relation: row?.business_relation ?? "unclassified",
    internal_note: row?.internal_note ?? "",
    customer_id: row?.customer_id ?? "",
    sales_invoice_id: row?.sales_invoice_id ?? "",
    collection_type: row?.collection_type ?? "",
    related_transaction_id: row?.related_transaction_id ?? "",
    payment_provider_id: row?.payment_provider_id ?? "",
    settlement_id: row?.settlement_id ?? "",
    supplier_id: row?.supplier_id ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: accs }, { data: invs }] = await Promise.all([
        supabase.from("finance_accounts").select("id, name, kind").eq("is_active", true).order("name"),
        supabase.from("sales_invoices").select("id, invoice_number, customer_id, total_amount, issue_date").order("issue_date", { ascending: false }).limit(200),
      ]);
      setAccounts(accs ?? []);
      setInvoices(invs ?? []);
    })();
  }, []);

  const t = f.transaction_type;
  const isSaleLike = t === "customer_invoice_collection" || t === "direct_sale" || t === "cash_sale" || t === "customer_advance";
  const showInvoice = t === "customer_invoice_collection";
  const showCollectionType = isSaleLike;
  const showRelated = t === "internal_transfer_in";
  const showCustomer = isSaleLike || t === "customer_refund";
  const showSupplier = t === "supplier_refund";
  const showProvider = t === "payment_provider_settlement";

  // Auto-derive business_relation when a type is picked (user can still override).
  const setType = (newType: string) => {
    const suggested = defaultBusinessRelation(newType);
    setF({
      ...f,
      transaction_type: newType,
      business_relation: suggested ?? f.business_relation,
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const txnType = f.transaction_type || null;
      // Auto accounting_status: unclassified when txn type missing, else keep prior or classified
      const accStatus = txnType
        ? (f.accounting_status === "unclassified" ? "classified" : f.accounting_status)
        : "unclassified";
      // Auto attachment_status
      const willHaveAttachment = isNew ? pending.length > 0 : f.attachment_status === "attached";
      const attStatus = willHaveAttachment
        ? "attached"
        : (f.attachment_status === "not_required" ? "not_required" : "not_attached");

      const base: any = {
        income_date: f.income_date,
        amount: Number(f.amount),
        income_source_id: f.income_source_id || null,
        account_id: f.account_id || null,
        account_type: f.account_type,
        note: f.note || null,
        transaction_type: txnType,
        accounting_status: accStatus,
        business_relation: f.business_relation || "unclassified",
        attachment_status: attStatus,
        internal_review_status: f.internal_review_status,
        accountant_status: f.accountant_status,
        accountant_note: f.accountant_note || null,
        internal_note: f.internal_note || null,
        customer_id: showCustomer ? (f.customer_id || null) : null,
        sales_invoice_id: showInvoice ? (f.sales_invoice_id || null) : null,
        collection_type: showCollectionType ? (f.collection_type || null) : null,
        related_transaction_id: showRelated ? (f.related_transaction_id || null) : null,
        supplier_id: showSupplier ? (f.supplier_id || null) : null,
        payment_provider_id: showProvider ? (f.payment_provider_id || null) : null,
        settlement_id: showProvider ? (f.settlement_id || null) : null,
      };

      if (isNew) {
        const { data: inserted, error } = await supabase.from("finance_incomes").insert({
          ...base,
          month: f.income_date.slice(0, 7),
          created_by: u.user?.id ?? null,
        }).select("id").single();
        if (error) throw error;
        if (pending.length > 0 && inserted?.id) {
          const { failed } = await uploadPendingAttachments("income", inserted.id, pending);
          if (failed > 0) toast.warning(`تم الحفظ، تعذر رفع ${failed} مرفق.`);
          else toast.success("تم إنشاء العملية مع المرفقات");
        } else toast.success("تم إنشاء العملية");
      } else {
        const patch: any = accountantOnly
          ? { accountant_status: f.accountant_status, accountant_note: f.accountant_note || null }
          : base;
        const { error } = await supabase.from("finance_incomes").update(patch).eq("id", row.id);
        if (error) throw error;
        toast.success("تم الحفظ");
      }
      onSaved();
    } catch (e: any) {
      toast.error("تعذر الحفظ: " + (e.message ?? "خطأ"));
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-background border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="font-semibold">{isNew ? "إضافة مقبوض" : "تفاصيل عملية المقبوض"}</div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-4">
          {row?.deleted_at && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-[11px] p-2">
              عملية مؤرشفة بتاريخ {new Date(row.deleted_at).toLocaleString("en-US")}{row.delete_reason ? ` · السبب: ${row.delete_reason}` : ""}
            </div>
          )}

          {/* Section 1: Movement */}
          {f.payment_provider_id && f.transaction_type === "payment_provider_settlement" && (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-200 text-[11px] p-2">
              هذه حوالة تسوية من وسيط دفع، وسيتم ربطها بتقرير التسوية من مركز المطابقة. لن يتم اعتبار المبلغ مبيعات جديدة.
            </div>
          )}
          <SectionCard title="بيانات الحركة">
            <div className="grid grid-cols-2 gap-3">
              <Field label="التاريخ"><input type="date" disabled={accountantOnly} value={f.income_date} onChange={(e) => setF({ ...f, income_date: e.target.value })} className="inp" /></Field>
              <Field label="المبلغ"><input type="number" step="0.01" disabled={accountantOnly} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value as any })} className="inp" /></Field>
              <Field label="الحساب المالي">
                <select disabled={accountantOnly} value={f.account_id} onChange={(e) => setF({ ...f, account_id: e.target.value })} className="inp">
                  <option value="">— اختر —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="نوع الحساب">
                <select disabled={accountantOnly} value={f.account_type} onChange={(e) => setF({ ...f, account_type: e.target.value })} className="inp">
                  {ACCOUNT_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </Field>
              <Field label="نوع الحركة">
                <select disabled={accountantOnly} value={f.transaction_type} onChange={(e) => setType(e.target.value)} className="inp">
                  <option value="">— اختر —</option>
                  {INCOMING_TYPES.map((tt) => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
                </select>
              </Field>
              <Field label="علاقة العملية بالنشاط">
                <select disabled={accountantOnly} value={f.business_relation} onChange={(e) => setF({ ...f, business_relation: e.target.value })} className="inp">
                  {BUSINESS_RELATIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </Field>
              <Field label="المصدر">
                <select disabled={accountantOnly} value={f.income_source_id} onChange={(e) => {
                  const srcId = e.target.value;
                  const srcName = (sources as any[]).find((s: any) => s.id === srcId)?.name;
                  const code = normalizeProviderCode(srcName);
                  const prov = code ? (providers as Provider[]).find((p) => p.provider_code === code) : null;
                  if (prov) {
                    setF({
                      ...f, income_source_id: srcId,
                      payment_provider_id: prov.id,
                      transaction_type: "payment_provider_settlement",
                      business_relation: "business",
                      accounting_status: "classified",
                    });
                  } else {
                    setF({ ...f, income_source_id: srcId });
                  }
                }} className="inp">
                  <option value="">—</option>
                  {sources.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="البيان / المرجع" wide>
                <input disabled={accountantOnly} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className="inp" placeholder="وصف العملية أو رقم مرجعي" />
              </Field>
            </div>

            {isNew && roles.canManage && (
              <div className="mt-3"><PendingAttachmentsPicker items={pending} setItems={setPending} /></div>
            )}
            {!isNew && (
              <div className="mt-3">
                <AttachmentsPanel relatedType="income" relatedId={row.id} canManage={roles.canManage} />
              </div>
            )}
          </SectionCard>

          {/* Section 2: Link (conditional) */}
          {(showInvoice || showCollectionType || showRelated) && (
            <SectionCard title="الربط">
              <div className="grid grid-cols-2 gap-3">
                {showInvoice && (
                  <Field label="فاتورة المبيعات" wide>
                    <select disabled={accountantOnly} value={f.sales_invoice_id} onChange={(e) => {
                      const inv = invoices.find((x) => x.id === e.target.value);
                      setF({ ...f, sales_invoice_id: e.target.value, customer_id: inv?.customer_id ?? f.customer_id });
                    }} className="inp">
                      <option value="">— اختر فاتورة —</option>
                      {invoices.map((inv) => <option key={inv.id} value={inv.id}>{inv.invoice_number} — {fmtSAR(inv.total_amount)} ({inv.issue_date})</option>)}
                    </select>
                  </Field>
                )}
                {showCollectionType && (
                  <Field label="وسيط الدفع">
                    <select disabled={accountantOnly} value={f.collection_type} onChange={(e) => setF({ ...f, collection_type: e.target.value })} className="inp">
                      <option value="">—</option>
                      {COLLECTION_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </Field>
                )}
                {showRelated && (
                  <Field label="التحويل المرتبط (UUID)" wide>
                    <input disabled={accountantOnly} value={f.related_transaction_id} onChange={(e) => setF({ ...f, related_transaction_id: e.target.value })} className="inp ltr" placeholder="معرف الحركة المقابلة" />
                  </Field>
                )}
              </div>
            </SectionCard>
          )}

          {/* Section 3: Review (collapsible, review perms only) */}
          {canReview && (
            <details className="rounded-xl border border-white/10 bg-white/[.03]" open={showReview} onToggle={(e) => setShowReview((e.target as HTMLDetailsElement).open)}>
              <summary className="cursor-pointer px-3 py-2 text-[12px] font-semibold text-muted-foreground select-none">المراجعة</summary>
              <div className="p-3 border-t border-white/10 grid grid-cols-2 gap-3">
                <Field label="حالة التصنيف">
                  <select disabled={accountantOnly} value={f.accounting_status} onChange={(e) => setF({ ...f, accounting_status: e.target.value })} className="inp">
                    {ACCOUNTING_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="المراجعة الداخلية">
                  <select disabled={accountantOnly} value={f.internal_review_status} onChange={(e) => setF({ ...f, internal_review_status: e.target.value })} className="inp">
                    {INTERNAL_REVIEW.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </Field>
                <Field label="حالة المحاسب">
                  <select value={f.accountant_status} onChange={(e) => setF({ ...f, accountant_status: e.target.value })} className="inp">
                    {ACCOUNTANT_STATUS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </Field>
                <Field label="ملاحظة المحاسب" wide><textarea value={f.accountant_note} onChange={(e) => setF({ ...f, accountant_note: e.target.value })} className="inp min-h-[60px]" /></Field>
                <Field label="ملاحظة داخلية (للتصنيف)" wide><textarea disabled={accountantOnly} value={f.internal_note} onChange={(e) => setF({ ...f, internal_note: e.target.value })} className="inp min-h-[50px]" /></Field>
              </div>
            </details>
          )}

          {!isNew && <AuditPanel relatedType="finance_incomes" relatedId={row.id} />}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-white/10">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px] bg-white/5 hover:bg-white/10">إلغاء</button>
          <button disabled={saving} onClick={save} className="px-4 py-1.5 rounded-lg text-[12px] bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30 disabled:opacity-50">{saving ? "..." : "حفظ"}</button>
        </div>
        <style>{`.inp { width:100%; padding:8px 10px; border-radius:8px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); font-size:12px; } .inp:disabled{opacity:.6} .inp.ltr{direction:ltr;text-align:left}`}</style>
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[.03] p-3">
      <div className="text-[12px] font-semibold text-gold/90 mb-3">{title}</div>
      {children}
    </section>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "col-span-2" : ""}`}>
      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
