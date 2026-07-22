import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Loader2, ShoppingCart, User, X, Check, ChevronsUpDown, ArrowUp, ArrowDown, Filter } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { useUrlState } from "@/lib/finance/use-url-state";
import { currentYm } from "@/lib/finance/current-month";
import {
  PURCHASE_TYPE_LABEL,
  PURCHASE_STATUS_LABEL,
  PURCHASE_STATUS_CLASS,
  PURCHASE_PAY_LABEL,
  VAT_DEDUCTIBILITY_LABEL,
  ATTACHMENT_LABEL,
  NON_DEDUCTIBLE_REASON_LABEL,
  SAR,
} from "@/lib/finance/purchase-constants";


export const Route = createFileRoute("/_authenticated/admin/finance/purchase-invoices/")({
  ssr: false,
  component: PurchaseInvoicesList,
});

// --- URL helpers for CSV multi-value state ---
const parseCsv = (s: string) => (s ? s.split(",").filter(Boolean) : []);
const toCsv = (arr: string[]) => arr.join(",");

// --- Date helpers ---
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const startOfWeek = (d: Date) => { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() - day); return x; };
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const startOfQuarter = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
const endOfQuarter = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 0);
const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);
const endOfYear = (d: Date) => new Date(d.getFullYear(), 11, 31);
const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

type SortKey = "issue_date" | "total_amount" | "vat_amount" | "status" | "internal_reference";

function PurchaseInvoicesList() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Search
  const [q, setQ] = useState(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      return sp.get("q") ?? "";
    }
    return "";
  });
  const [, setUrlQ] = useUrlState("q", "", { debounceMs: 400 });
  useEffect(() => {
    const t = setTimeout(() => setUrlQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q, setUrlQ]);

  // Multi-select filters (CSV in URL)
  const [fStatusCsv, setFStatusCsv] = useUrlState("status", "");
  const [fPayCsv, setFPayCsv] = useUrlState("pay", "");
  const [fTypeCsv, setFTypeCsv] = useUrlState("type", "");
  const [fVatCsv, setFVatCsv] = useUrlState("vat", "");
  const fStatus = parseCsv(fStatusCsv);
  const fPay = parseCsv(fPayCsv);
  const fType = parseCsv(fTypeCsv);
  const fVat = parseCsv(fVatCsv);

  const [fSupplier, setFSupplier] = useUrlState("sup", "");
  const [fAttach, setFAttach] = useUrlState("att", "");
  const [fPersonal, setFPersonal] = useUrlState("pers", "");

  // Date: month OR from/to range
  const [fMonth, setFMonth] = useUrlState("month", currentYm());
  const [fFrom, setFFrom] = useUrlState("from", "");
  const [fTo, setFTo] = useUrlState("to", "");
  const dateMode: "month" | "range" = fFrom || fTo ? "range" : "month";

  // Amount range
  const [fMin, setFMin] = useUrlState("min", "");
  const [fMax, setFMax] = useUrlState("max", "");

  // Sort
  const [sortKey, setSortKey] = useUrlState("sort", "issue_date");
  const [sortDir, setSortDir] = useUrlState("dir", "desc");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const toggleInCsv = (csv: string, setter: (v: string) => void, val: string) => {
    const arr = parseCsv(csv);
    const next = arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
    setter(toCsv(next));
  };

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["purchase_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_invoices" as any)
        .select("*")
        .order("issue_date", { ascending: false })
        .order("id", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["finance_suppliers_min"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_suppliers").select("id, name, tax_number").eq("is_active", true).order("name");
      return (data ?? []) as any[];
    },
  });
  const supName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "—";
  const supTax = (id: string | null) => suppliers.find((s) => s.id === id)?.tax_number ?? "";

  // attachment map
  const invoiceIds = invoices.map((i) => i.id);
  const { data: attachments = [] } = useQuery({
    queryKey: ["purchase_invoice_attachments", invoiceIds.length],
    queryFn: async () => {
      if (!invoiceIds.length) return [];
      const { data } = await supabase
        .from("finance_attachments")
        .select("related_bigint_id")
        .eq("related_type", "purchase_invoice" as any)
        .in("related_bigint_id", invoiceIds);
      return (data ?? []) as any[];
    },
    enabled: invoiceIds.length > 0,
  });
  const hasAttachment = (id: number) => attachments.some((a) => Number(a.related_bigint_id) === id);

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("purchase_invoices" as any)
        .insert({ created_by: u.user?.id ?? null } as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as number;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["purchase_invoices"] });
      navigate({ to: "/admin/finance/purchase-invoices/$id", params: { id: String(id) } });
    },
    onError: (e: any) => toast.error("تعذر إنشاء الفاتورة: " + e.message),
  });

  const attStatusOf = (r: any) => (hasAttachment(r.id) ? "attached" : "not_attached");

  // Parse smart search query
  const searchTokens = useMemo(() => {
    const raw = q.trim();
    if (!raw) return { text: [] as string[], refOnly: [] as string[], supOnly: [] as string[], gt: null as number | null, lt: null as number | null };
    const parts = raw.split(/\s+/);
    const text: string[] = [];
    const refOnly: string[] = [];
    const supOnly: string[] = [];
    let gt: number | null = null;
    let lt: number | null = null;
    for (const p of parts) {
      if (p.startsWith("#") && p.length > 1) refOnly.push(p.slice(1).toLowerCase());
      else if (p.startsWith("@") && p.length > 1) supOnly.push(p.slice(1).toLowerCase());
      else if (p.startsWith(">") && !isNaN(Number(p.slice(1)))) gt = Number(p.slice(1));
      else if (p.startsWith("<") && !isNaN(Number(p.slice(1)))) lt = Number(p.slice(1));
      else text.push(p.toLowerCase());
    }
    return { text, refOnly, supOnly, gt, lt };
  }, [q]);

  const filtered = useMemo(() => {
    const arr = invoices.filter((r) => {
      if (fStatus.length && !fStatus.includes(r.status)) return false;
      if (fPay.length && !fPay.includes(r.payment_status)) return false;
      if (fType.length && !fType.includes(r.purchase_type)) return false;
      if (fVat.length && !fVat.includes(r.vat_deductibility)) return false;
      if (fSupplier && r.supplier_id !== fSupplier) return false;
      if (fPersonal === "yes" && !r.paid_from_personal_account) return false;
      if (fPersonal === "no" && r.paid_from_personal_account) return false;

      // Date
      const d = r.issue_date ?? "";
      if (dateMode === "range") {
        if (fFrom && d < fFrom) return false;
        if (fTo && d > fTo) return false;
      } else if (fMonth) {
        if (!d.startsWith(fMonth)) return false;
      }

      // Amount
      const tot = Number(r.total_amount || 0);
      if (fMin && tot < Number(fMin)) return false;
      if (fMax && tot > Number(fMax)) return false;

      if (fAttach && attStatusOf(r) !== fAttach) return false;

      // Smart search
      const { text, refOnly, supOnly, gt, lt } = searchTokens;
      if (gt !== null && tot <= gt) return false;
      if (lt !== null && tot >= lt) return false;
      const ref = String(r.internal_reference ?? "").toLowerCase();
      const sName = String(supName(r.supplier_id)).toLowerCase();
      for (const t of refOnly) if (!ref.includes(t)) return false;
      for (const t of supOnly) if (!sName.includes(t)) return false;
      if (text.length) {
        const hay = `${ref} ${String(r.supplier_invoice_number ?? "").toLowerCase()} ${sName} ${String(r.notes ?? "").toLowerCase()} ${String(supTax(r.supplier_id)).toLowerCase()}`;
        for (const t of text) if (!hay.includes(t)) return false;
      }
      return true;
    });

    // Sort
    const dir = sortDir === "asc" ? 1 : -1;
    const key = sortKey as SortKey;
    arr.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (key === "total_amount" || key === "vat_amount") return (Number(av || 0) - Number(bv || 0)) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
    return arr;
  }, [invoices, fStatusCsv, fPayCsv, fTypeCsv, fVatCsv, fSupplier, fPersonal, fMonth, fFrom, fTo, fMin, fMax, fAttach, searchTokens, attachments, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const total = filtered.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const paid = filtered.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    const remaining = filtered.reduce((s, r) => s + Number(r.remaining_amount || 0), 0);
    const deductible = filtered.reduce((s, r) => s + Number(r.deductible_vat_amount || 0), 0);
    const nondec = filtered.reduce((s, r) => s + Number(r.non_deductible_vat_amount || 0), 0);
    return { total, paid, remaining, deductible, nondec };
  }, [filtered]);

  // Active filters count
  const activeCount =
    (q ? 1 : 0) + fStatus.length + fPay.length + fType.length + fVat.length +
    (fSupplier ? 1 : 0) + (fAttach ? 1 : 0) + (fPersonal ? 1 : 0) +
    (dateMode === "range" ? ((fFrom ? 1 : 0) + (fTo ? 1 : 0)) : (fMonth !== currentYm() ? 1 : 0)) +
    (fMin ? 1 : 0) + (fMax ? 1 : 0);

  const clearAll = () => {
    setQ("");
    setFStatusCsv(""); setFPayCsv(""); setFTypeCsv(""); setFVatCsv("");
    setFSupplier(""); setFAttach(""); setFPersonal("");
    setFMonth(currentYm()); setFFrom(""); setFTo("");
    setFMin(""); setFMax("");
  };

  // Quick date presets
  const applyPreset = (preset: string) => {
    const now = new Date();
    if (preset === "today") { setFMonth(""); setFFrom(ymd(now)); setFTo(ymd(now)); }
    else if (preset === "week") { setFMonth(""); setFFrom(ymd(startOfWeek(now))); setFTo(ymd(now)); }
    else if (preset === "month") { setFFrom(""); setFTo(""); setFMonth(currentYm()); }
    else if (preset === "prevmonth") {
      const p = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      setFMonth(""); setFFrom(ymd(startOfMonth(p))); setFTo(ymd(endOfMonth(p)));
    }
    else if (preset === "quarter") { setFMonth(""); setFFrom(ymd(startOfQuarter(now))); setFTo(ymd(endOfQuarter(now))); }
    else if (preset === "year") { setFMonth(String(now.getFullYear())); setFFrom(""); setFTo(""); }
    else if (preset === "all") { setFMonth(""); setFFrom(""); setFTo(""); }
  };

  // Quick filter chips
  type QuickChip = { key: string; label: string; active: boolean; toggle: () => void };
  const quickChips: QuickChip[] = [
    { key: "unpaid", label: "غير مسددة", active: fPay.includes("unpaid") && fPay.includes("partially_paid"),
      toggle: () => setFPayCsv(fPay.includes("unpaid") ? "" : "unpaid,partially_paid") },
    { key: "att", label: "بدون مرفق", active: fAttach === "not_attached",
      toggle: () => setFAttach(fAttach === "not_attached" ? "" : "not_attached") },
    { key: "review", label: "قيد المراجعة", active: fStatus.length === 1 && fStatus[0] === "under_review",
      toggle: () => setFStatusCsv(fStatus[0] === "under_review" ? "" : "under_review") },
    { key: "nondec", label: "غير قابل خصم", active: fVat.includes("non_deductible"),
      toggle: () => setFVatCsv(fVat.includes("non_deductible") ? "" : "non_deductible") },
    { key: "pers", label: "من حساب شخصي", active: fPersonal === "yes",
      toggle: () => setFPersonal(fPersonal === "yes" ? "" : "yes") },
  ];

  const sortHeader = (key: SortKey, label: string) => (
    <button
      onClick={() => {
        if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("desc"); }
      }}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      {sortKey === key ? (sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ChevronsUpDown size={11} className="opacity-40" />}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.3em] text-gold/80 uppercase">Purchase Invoices</div>
          <h2 className="text-lg font-semibold mt-1">فواتير المشتريات</h2>
        </div>
        <Button onClick={() => create.mutate()} disabled={create.isPending} className="bg-gold text-black hover:bg-gold/90">
          {create.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Plus className="w-4 h-4 ml-1" />}
          فاتورة جديدة
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="عدد الفواتير" value={String(filtered.length)} />
        <KPI label="إجمالي" value={SAR(kpis.total)} />
        <KPI label="المدفوع" value={SAR(kpis.paid)} tone="emerald" />
        <KPI label="المتبقي" value={SAR(kpis.remaining)} tone="amber" />
        <KPI label="ضريبة قابلة للخصم" value={SAR(kpis.deductible)} tone="blue" />
      </div>

      {/* Quick chips */}
      <div className="flex flex-wrap items-center gap-2">
        {quickChips.map((c) => (
          <button
            key={c.key}
            onClick={c.toggle}
            className={`px-3 py-1 rounded-full text-[11px] border transition ${
              c.active
                ? "bg-gold/20 border-gold/50 text-gold"
                : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
            }`}
          >
            {c.label}
          </button>
        ))}
        <div className="ms-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          {activeCount > 0 && (
            <>
              <span className="inline-flex items-center gap-1"><Filter size={11} /> {activeCount} فلتر نشط</span>
              <button onClick={clearAll} className="px-2 py-1 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-foreground">مسح الكل</button>
            </>
          )}
          <button onClick={() => setShowAdvanced((v) => !v)} className="px-2 py-1 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-foreground">
            {showAdvanced ? "إخفاء الفلاتر المتقدمة" : "فلاتر متقدمة"}
          </button>
        </div>
      </div>

      {/* Search + date presets */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-3">
        <div className="relative">
          <Input
            placeholder='بحث ذكي — استخدم "#REF"، "@مورد"، ">500"، "<100" أو كلمات عادية'
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-black/40 border-white/10 text-sm pr-8"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute inset-y-0 left-2 flex items-center text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Date presets */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground">التاريخ:</span>
          {[
            { k: "today", l: "اليوم" },
            { k: "week", l: "هذا الأسبوع" },
            { k: "month", l: "هذا الشهر" },
            { k: "prevmonth", l: "الشهر السابق" },
            { k: "quarter", l: "هذا الربع" },
            { k: "year", l: "هذه السنة" },
            { k: "all", l: "كل الوقت" },
          ].map((p) => (
            <button
              key={p.k}
              onClick={() => applyPreset(p.k)}
              className="px-2 py-1 rounded-md bg-white/5 border border-white/10 hover:bg-white/10"
            >
              {p.l}
            </button>
          ))}
          <div className="mx-2 h-4 w-px bg-white/10" />
          {dateMode === "month" ? (
            <YearMonthPicker value={fMonth} onChange={setFMonth} />
          ) : (
            <>
              <label className="text-muted-foreground">من</label>
              <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className="bg-black/40 border-white/10 text-sm w-36 h-8" />
              <label className="text-muted-foreground">إلى</label>
              <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className="bg-black/40 border-white/10 text-sm w-36 h-8" />
              <button
                onClick={() => { setFFrom(""); setFTo(""); setFMonth(currentYm()); }}
                className="px-2 py-1 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-[11px]"
              >
                رجوع لوضع الشهر
              </button>
            </>
          )}
        </div>

        {/* Advanced filters */}
        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2 border-t border-white/5">
            <MultiSel label="الحالة" options={PURCHASE_STATUS_LABEL} selected={fStatus} onToggle={(v) => toggleInCsv(fStatusCsv, setFStatusCsv, v)} onClear={() => setFStatusCsv("")} />
            <MultiSel label="حالة السداد" options={PURCHASE_PAY_LABEL} selected={fPay} onToggle={(v) => toggleInCsv(fPayCsv, setFPayCsv, v)} onClear={() => setFPayCsv("")} />
            <MultiSel label="نوع المشتريات" options={PURCHASE_TYPE_LABEL} selected={fType} onToggle={(v) => toggleInCsv(fTypeCsv, setFTypeCsv, v)} onClear={() => setFTypeCsv("")} />
            <MultiSel label="قابلية الخصم" options={VAT_DEDUCTIBILITY_LABEL} selected={fVat} onToggle={(v) => toggleInCsv(fVatCsv, setFVatCsv, v)} onClear={() => setFVatCsv("")} />

            <div>
              <FieldLabel>المورد</FieldLabel>
              <SupplierCombobox suppliers={suppliers} value={fSupplier} onChange={setFSupplier} />
            </div>

            <div>
              <FieldLabel>المرفق</FieldLabel>
              <Sel value={fAttach} onChange={setFAttach} placeholder="الكل">
                <option value="attached">مرفق</option>
                <option value="not_attached">غير مرفق</option>
              </Sel>
            </div>

            <div>
              <FieldLabel>من حساب شخصي</FieldLabel>
              <Sel value={fPersonal} onChange={setFPersonal} placeholder="الكل">
                <option value="yes">نعم</option>
                <option value="no">لا</option>
              </Sel>
            </div>

            <div>
              <FieldLabel>نطاق الإجمالي (ر.س)</FieldLabel>
              <div className="flex items-center gap-1">
                <Input type="number" placeholder="من" value={fMin} onChange={(e) => setFMin(e.target.value)} className="bg-black/40 border-white/10 text-sm h-8" />
                <span className="text-muted-foreground">—</span>
                <Input type="number" placeholder="إلى" value={fMax} onChange={(e) => setFMax(e.target.value)} className="bg-black/40 border-white/10 text-sm h-8" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="font-semibold text-gold">تم تحديد {selected.size} فاتورة</span>
          <span className="mx-1 text-muted-foreground">—</span>
          <BulkSel
            placeholder="تغيير الحالة"
            disabled={bulkBusy}
            onPick={async (v) => {
              if (!v) return;
              setBulkBusy(true);
              const ids = Array.from(selected);
              const { error } = await supabase.from("purchase_invoices" as any).update({ status: v } as any).in("id", ids);
              setBulkBusy(false);
              if (error) return toast.error(error.message);
              toast.success(`تم تحديث ${ids.length} فاتورة`);
              setSelected(new Set());
              qc.invalidateQueries({ queryKey: ["purchase_invoices"] });
            }}
          >
            {Object.entries(PURCHASE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </BulkSel>
          <BulkSel
            placeholder="تغيير قابلية الخصم"
            disabled={bulkBusy}
            onPick={async (v) => {
              if (!v) return;
              const patch: any = { vat_deductibility: v };
              if (v === "non_deductible") {
                const reasons = Object.entries(NON_DEDUCTIBLE_REASON_LABEL);
                const list = reasons.map(([_, l], i) => `${i + 1}. ${l}`).join("\n");
                const pick = window.prompt(`اختر سبب عدم قابلية الخصم:\n${list}\n\nأدخل الرقم:`, "1");
                if (!pick) return;
                const idx = Number(pick) - 1;
                if (!reasons[idx]) return toast.error("اختيار غير صالح");
                patch.non_deductible_reason = reasons[idx][0];
              } else {
                patch.non_deductible_reason = null;
              }
              setBulkBusy(true);
              const ids = Array.from(selected);
              const { error } = await supabase.from("purchase_invoices" as any).update(patch).in("id", ids);
              setBulkBusy(false);
              if (error) return toast.error(error.message);
              toast.success("تم التحديث");
              setSelected(new Set());
              qc.invalidateQueries({ queryKey: ["purchase_invoices"] });
            }}
          >
            {Object.entries(VAT_DEDUCTIBILITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </BulkSel>
          <BulkSel
            placeholder="تغيير المورد"
            disabled={bulkBusy}
            onPick={async (v) => {
              if (!v) return;
              setBulkBusy(true);
              const ids = Array.from(selected);
              const { error } = await supabase.from("purchase_invoices" as any).update({ supplier_id: v } as any).in("id", ids);
              setBulkBusy(false);
              if (error) return toast.error(error.message);
              toast.success("تم التحديث");
              setSelected(new Set());
              qc.invalidateQueries({ queryKey: ["purchase_invoices"] });
            }}
          >
            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </BulkSel>
          <button
            disabled={bulkBusy}
            onClick={async () => {
              const ids = Array.from(selected);
              const targets = invoices.filter((r) => ids.includes(r.id) && (r.status === "draft" || r.status === "rejected"));
              if (targets.length === 0) return toast.error("لا يمكن الحذف إلا للمسودات والمرفوضة");
              if (!confirm(`حذف ${targets.length} فاتورة نهائيًا؟`)) return;
              setBulkBusy(true);
              const { error } = await supabase.from("purchase_invoices" as any).delete().in("id", targets.map((t) => t.id));
              setBulkBusy(false);
              if (error) return toast.error(error.message);
              toast.success("تم الحذف");
              setSelected(new Set());
              qc.invalidateQueries({ queryKey: ["purchase_invoices"] });
            }}
            className="px-3 py-1.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 text-[12px]"
          >حذف المحدد (مسودة/مرفوضة)</button>
          <button onClick={() => setSelected(new Set())} className="ms-auto p-1.5 rounded hover:bg-white/10" title="إلغاء التحديد"><X size={14} /></button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline ml-2" />جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <ShoppingCart className="w-8 h-8 mx-auto opacity-40 mb-2" />
            لا توجد فواتير مطابقة للفلاتر
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="p-2 w-8">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) filtered.forEach((r) => next.add(r.id));
                      else filtered.forEach((r) => next.delete(r.id));
                      setSelected(next);
                    }}
                  />
                </th>
                <th className="text-right p-2">{sortHeader("internal_reference", "المرجع الداخلي")}</th>
                <th className="text-right p-2">المورد</th>
                <th className="text-right p-2">{sortHeader("issue_date", "التاريخ")}</th>
                <th className="text-right p-2">النوع</th>
                <th className="text-right p-2">قبل الضريبة</th>
                <th className="text-right p-2">{sortHeader("vat_amount", "الضريبة")}</th>
                <th className="text-right p-2">القابل للخصم</th>
                <th className="text-right p-2">غير القابل</th>
                <th className="text-right p-2">{sortHeader("total_amount", "الإجمالي")}</th>
                <th className="text-right p-2">المرفق</th>
                <th className="text-right p-2">{sortHeader("status", "الحالة")}</th>
                <th className="text-right p-2">السداد</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const attStatus = attStatusOf(r);
                const isSel = selected.has(r.id);
                return (
                  <tr key={r.id} className={`border-t border-white/5 hover:bg-white/5 cursor-pointer ${isSel ? "bg-gold/5" : ""}`} onClick={() => navigate({ to: "/admin/finance/purchase-invoices/$id", params: { id: String(r.id) } })}>
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(r.id); else next.delete(r.id);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td className="p-2 font-mono text-xs">{r.internal_reference}</td>
                    <td className="p-2">
                      {supName(r.supplier_id)}
                      {r.paid_from_personal_account && <User className="inline w-3 h-3 mr-1 text-amber-300" />}
                    </td>
                    <td className="p-2 whitespace-nowrap">{r.issue_date}</td>
                    <td className="p-2 text-xs">{PURCHASE_TYPE_LABEL[r.purchase_type] ?? r.purchase_type}</td>
                    <td className="p-2">{SAR(r.taxable_amount)}</td>
                    <td className="p-2">{SAR(r.vat_amount)}</td>
                    <td className="p-2 text-blue-300">{SAR(r.deductible_vat_amount)}</td>
                    <td className="p-2 text-muted-foreground">{SAR(r.non_deductible_vat_amount)}</td>
                    <td className="p-2 font-semibold">{SAR(r.total_amount)}</td>
                    <td className={`p-2 text-xs ${attStatus === "attached" ? "text-emerald-300" : "text-amber-300"}`}>{ATTACHMENT_LABEL[attStatus]}</td>
                    <td className="p-2"><Badge variant="outline" className={PURCHASE_STATUS_CLASS[r.status] ?? ""}>{PURCHASE_STATUS_LABEL[r.status] ?? r.status}</Badge></td>
                    <td className="p-2 text-xs">{PURCHASE_PAY_LABEL[r.payment_status] ?? r.payment_status}</td>
                  </tr>
                );
              })}
            </tbody>

          </table>
        )}
      </div>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" | "blue" }) {
  const t = tone === "emerald" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : tone === "blue" ? "text-blue-300" : "";
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${t}`}>{value}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: any }) {
  return <div className="text-[11px] text-muted-foreground mb-1">{children}</div>;
}

function Sel({ value, onChange, placeholder, children }: { value: string; onChange: (v: string) => void; placeholder: string; children: any }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm h-8">
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

function MultiSel({
  label, options, selected, onToggle, onClear,
}: {
  label: string;
  options: Record<string, string>;
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="w-full h-8 flex items-center justify-between bg-black/40 border border-white/10 rounded-md px-2 text-sm hover:bg-black/50">
            <span className="truncate text-right">
              {selected.length === 0 ? <span className="text-muted-foreground">الكل</span>
                : selected.length === 1 ? options[selected[0]] ?? selected[0]
                : `${selected.length} محدد`}
            </span>
            <ChevronsUpDown size={12} className="text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2 bg-background border-white/10" align="start">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground">{label}</span>
            {selected.length > 0 && (
              <button onClick={onClear} className="text-[11px] text-gold hover:underline">مسح</button>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto">
            {Object.entries(options).map(([k, v]) => {
              const on = selected.includes(k);
              return (
                <button
                  key={k}
                  onClick={() => onToggle(k)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-right hover:bg-white/5 ${on ? "text-gold" : ""}`}
                >
                  <span className={`w-4 h-4 flex items-center justify-center rounded border ${on ? "bg-gold border-gold text-black" : "border-white/20"}`}>
                    {on && <Check size={12} />}
                  </span>
                  <span className="flex-1 text-right">{v}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function SupplierCombobox({
  suppliers, value, onChange,
}: {
  suppliers: any[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = suppliers.find((s) => s.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full h-8 flex items-center justify-between bg-black/40 border border-white/10 rounded-md px-2 text-sm hover:bg-black/50">
          <span className="truncate text-right">
            {current ? current.name : <span className="text-muted-foreground">كل الموردين</span>}
          </span>
          <ChevronsUpDown size={12} className="text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 bg-background border-white/10" align="start">
        <Command>
          <CommandInput placeholder="ابحث عن مورد..." className="h-9" />
          <CommandList>
            <CommandEmpty>لا يوجد مورد.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={() => { onChange(""); setOpen(false); }}>
                <span className="flex-1">كل الموردين</span>
                {!value && <Check size={14} />}
              </CommandItem>
              {suppliers.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.name} ${s.tax_number ?? ""}`}
                  onSelect={() => { onChange(s.id); setOpen(false); }}
                >
                  <div className="flex-1">
                    <div>{s.name}</div>
                    {s.tax_number && <div className="text-[10px] text-muted-foreground">ض: {s.tax_number}</div>}
                  </div>
                  {value === s.id && <Check size={14} />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function BulkSel({ placeholder, onPick, disabled, children }: { placeholder: string; onPick: (v: string) => void; disabled?: boolean; children: any }) {
  return (
    <select
      disabled={disabled}
      defaultValue=""
      onChange={(e) => { const v = e.target.value; e.target.value = ""; if (v) onPick(v); }}
      className="bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-[12px] disabled:opacity-50"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

function YearMonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [openY, setOpenY] = useState(false);
  const [openM, setOpenM] = useState(false);
  const now = new Date();
  const curY = now.getFullYear();
  const parsed = /^(\d{4})(?:-(\d{2}))?$/.exec(value || "");
  const selY = parsed ? Number(parsed[1]) : curY;
  const selM = parsed && parsed[2] ? Number(parsed[2]) : null; // null = all months of selY
  const years: number[] = [];
  for (let y = curY - 5; y <= curY + 1; y++) years.push(y);

  const label = value
    ? (selM ? `${AR_MONTHS[selM - 1]} ${selY}` : `كل ${selY}`)
    : "كل الوقت";

  const setYear = (y: number) => {
    onChange(selM ? `${y}-${String(selM).padStart(2, "0")}` : String(y));
    setOpenY(false);
  };
  const setMonth = (m: number | null) => {
    onChange(m ? `${selY}-${String(m).padStart(2, "0")}` : String(selY));
    setOpenM(false);
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground text-[11px]">{label}</span>

      <Popover open={openY} onOpenChange={setOpenY}>
        <PopoverTrigger asChild>
          <button className="px-2 h-8 rounded-md bg-black/40 border border-white/10 hover:bg-black/50 text-sm inline-flex items-center gap-1">
            {selY}
            <ChevronsUpDown size={11} className="text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2 bg-background border-white/10" align="start">
          <div className="grid grid-cols-3 gap-1">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-2 py-1.5 rounded-md text-xs border ${
                  y === selY ? "bg-gold/20 border-gold/50 text-gold" : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={openM} onOpenChange={setOpenM}>
        <PopoverTrigger asChild>
          <button className="px-2 h-8 rounded-md bg-black/40 border border-white/10 hover:bg-black/50 text-sm inline-flex items-center gap-1 min-w-[88px] justify-between">
            {selM ? AR_MONTHS[selM - 1] : "كل الأشهر"}
            <ChevronsUpDown size={11} className="text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2 bg-background border-white/10" align="start">
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => setMonth(null)}
              className={`col-span-3 px-2 py-1.5 rounded-md text-xs border ${
                !selM ? "bg-gold/20 border-gold/50 text-gold" : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
            >
              كل الأشهر ({selY})
            </button>
            {AR_MONTHS.map((name, i) => {
              const m = i + 1;
              return (
                <button
                  key={m}
                  onClick={() => setMonth(m)}
                  className={`px-2 py-1.5 rounded-md text-xs border ${
                    m === selM ? "bg-gold/20 border-gold/50 text-gold" : "bg-white/5 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
