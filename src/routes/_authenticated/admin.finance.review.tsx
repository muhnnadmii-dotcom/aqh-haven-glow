import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Inbox, X, Paperclip, CheckCircle2, User, Building, Link2, AlertCircle, ArrowLeftRight, Info, Split, Landmark, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { AttachmentsPanel } from "@/components/finance/AttachmentsPanel";

export const Route = createFileRoute("/_authenticated/admin/finance/review")({
  ssr: false,
  component: ReviewCenter,
});

// ================== Labels ==================
const INCOMING_TYPE: Record<string, string> = {
  customer_invoice_collection: "تحصيل فاتورة عميل",
  cash_sale: "بيع نقدي",
  owner_contribution: "مساهمة مالك",
  internal_transfer_in: "تحويل داخلي وارد",
  supplier_refund: "استرداد من مورد",
  loan_received: "قرض مستلم",
  other_income: "دخل آخر",
  unclassified_incoming: "غير مصنف",
};
const OUTGOING_TYPE: Record<string, string> = {
  supplier_invoice_payment: "دفعة فاتورة مورد",
  operating_expense: "مصروف تشغيلي",
  inventory_purchase: "شراء مخزون",
  asset_purchase: "شراء أصل",
  owner_withdrawal: "سحب مالك",
  internal_transfer_out: "تحويل داخلي صادر",
  loan_payment: "سداد قرض",
  tax_or_government_payment: "ضريبة/رسوم حكومية",
  customer_refund: "استرداد للعميل",
  unclassified_outgoing: "غير مصنف",
};
const BUSINESS_REL: Record<string, string> = {
  business: "نشاط تجاري",
  personal: "شخصي",
  owner_settlement: "تسوية مالك",
  internal_transfer: "تحويل داخلي",
  unclassified: "غير مصنف",
};
const ACCT_STATUS: Record<string, string> = {
  unclassified: "غير مصنف",
  classified: "مصنف",
  reviewed: "مكتمل المراجعة",
};
const REVIEW_STATUS: Record<string, string> = { unreviewed: "غير مراجع", reviewed: "مراجع" };
const ATTACH: Record<string, string> = { attached: "مرفق", not_attached: "بدون مرفق", not_required: "مستثنى" };
const SAR = (n: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(Number(n) || 0);

// ================== Row type ==================
type Row = {
  kind: "income" | "expense";
  id: string;
  date: string;
  amount: number;
  direction: "incoming" | "outgoing";
  transaction_type: string | null;
  business_relation: string;
  accounting_status: string;
  internal_review_status: string;
  attachment_status: string;
  account_id: string | null;
  account_type: string;
  customer_id?: string | null;
  supplier_id?: string | null;
  sales_invoice_id?: number | null;
  purchase_invoice_id?: number | null;
  related_transaction_id?: string | null;
  note?: string | null;
  internal_note?: string | null;
  settlement_id?: string | null;
  split_parent_id?: string | null;
  raw: any;
};

// ================== Page ==================
function ReviewCenter() {
  const qc = useQueryClient();

  // Load raw data
  const { data: incomes = [], isLoading: loadingI } = useQuery({
    queryKey: ["review_incomes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_incomes")
        .select("*").is("deleted_at", null)
        .order("income_date", { ascending: false }).limit(2000);
      if (error) throw error;
      return data as any[];
    },
  });
  const { data: expenses = [], isLoading: loadingE } = useQuery({
    queryKey: ["review_expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_expenses")
        .select("*").is("deleted_at", null)
        .order("expense_date", { ascending: false }).limit(2000);
      if (error) throw error;
      return data as any[];
    },
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["fin_accounts_all"],
    queryFn: async () => (await supabase.from("finance_accounts").select("*").eq("is_active", true).order("name")).data as any[],
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["finance_suppliers_min"],
    queryFn: async () => (await supabase.from("finance_suppliers").select("id, name").eq("is_active", true).order("name")).data as any[],
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["profiles_customers_min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, phone").order("full_name").limit(1000)).data as any[],
  });
  const { data: categoriesAll = [] } = useQuery({
    queryKey: ["fin_categories_all"],
    queryFn: async () => (await supabase.from("finance_categories").select("*").eq("is_active", true).order("display_order")).data as any[],
  });
  const { data: salesInvoices = [] } = useQuery({
    queryKey: ["sales_invoices_min"],
    queryFn: async () => (await supabase.from("sales_invoices" as any).select("id, invoice_number, customer_id, total_amount, remaining_amount, issue_date, status").limit(1000)).data as any[],
  });
  const { data: purchaseInvoices = [] } = useQuery({
    queryKey: ["purchase_invoices_min"],
    queryFn: async () => (await supabase.from("purchase_invoices" as any).select("id, internal_reference, supplier_id, total_amount, remaining_amount, issue_date, status").limit(1000)).data as any[],
  });
  const { data: settlements = [] } = useQuery({
    queryKey: ["review_settlements"],
    queryFn: async () => (await supabase.from("payment_settlements" as any).select("id, provider_id, settlement_date, expected_net_amount, actual_bank_amount, difference_amount, status, bank_income_id, settlement_reference").order("settlement_date", { ascending: false }).limit(500)).data as any[],
  });
  const { data: providers = [] } = useQuery({
    queryKey: ["review_providers"],
    queryFn: async () => (await supabase.from("payment_providers" as any).select("id, name, code, rounding_tolerance").eq("is_active", true)).data as any[],
  });

  const rows: Row[] = useMemo(() => {
    const inc = incomes.map((r: any): Row => ({
      kind: "income", id: r.id, date: r.income_date, amount: Number(r.amount) || 0,
      direction: "incoming", transaction_type: r.transaction_type,
      business_relation: r.business_relation, accounting_status: r.accounting_status,
      internal_review_status: r.internal_review_status, attachment_status: r.attachment_status,
      account_id: r.account_id, account_type: r.account_type,
      customer_id: r.customer_id, sales_invoice_id: r.sales_invoice_id,
      related_transaction_id: r.related_transaction_id, note: r.note, internal_note: r.internal_note,
      settlement_id: r.settlement_id, split_parent_id: r.split_parent_id, raw: r,
    }));
    const exp = expenses.map((r: any): Row => ({
      kind: "expense", id: r.id, date: r.expense_date, amount: Number(r.amount) || 0,
      direction: "outgoing", transaction_type: r.transaction_type,
      business_relation: r.business_relation, accounting_status: r.accounting_status,
      internal_review_status: r.internal_review_status, attachment_status: r.attachment_status,
      account_id: r.account_id, account_type: r.account_type,
      supplier_id: r.supplier_id, purchase_invoice_id: r.purchase_invoice_id,
      related_transaction_id: r.related_transaction_id, note: r.note, internal_note: r.internal_note,
      settlement_id: r.settlement_id, split_parent_id: r.split_parent_id, raw: r,
    }));
    return [...inc, ...exp].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [incomes, expenses]);

  // Detect provider (Salla/Tabby/Tamara/...) from note
  const providerMatch = (r: Row): { id: string; name: string } | null => {
    const hay = `${r.note ?? ""} ${r.internal_note ?? ""}`.toLowerCase();
    for (const p of providers as any[]) {
      const needles = [p.code, p.name, p.name?.replace(/\s+/g, "")].filter(Boolean).map((s: string) => String(s).toLowerCase());
      if (needles.some((n) => hay.includes(n))) return { id: p.id, name: p.name };
    }
    return null;
  };

  // Flags per row
  const flags = (r: Row) => {
    const isUnclassified = r.accounting_status === "unclassified" || !r.transaction_type || r.business_relation === "unclassified";
    const noAccount = !r.account_id;
    const noAttachment = r.attachment_status === "not_attached";
    const personalNeedsReview = r.account_type === "personal" && r.internal_review_status !== "reviewed";
    const isTransferType = r.transaction_type === "internal_transfer_in" || r.transaction_type === "internal_transfer_out";
    const transferMissingCounterpart = isTransferType && !r.related_transaction_id;
    const unlinkedInvoice = r.kind === "income"
      ? (r.transaction_type === "customer_invoice_collection" && !r.sales_invoice_id)
      : (r.transaction_type === "supplier_invoice_payment" && !r.purchase_invoice_id);
    const missingParty = r.kind === "income"
      ? (r.transaction_type === "customer_invoice_collection" && !r.customer_id)
      : (r.transaction_type === "supplier_invoice_payment" && !r.supplier_id);
    const pm = providerMatch(r);
    const unlinkedProviderSettlement = r.kind === "income" && !!pm && !r.settlement_id;
    const isSplitChild = !!r.split_parent_id;
    const isCompleted = r.internal_review_status === "reviewed" && r.accounting_status === "reviewed";
    return { isUnclassified, noAccount, noAttachment, personalNeedsReview, transferMissingCounterpart, unlinkedInvoice, missingParty, unlinkedProviderSettlement, isSplitChild, isCompleted, providerName: pm?.name ?? null };
  };


  // Filters
  const [chip, setChip] = useState<string>("unclassified");
  const [fFrom, setFFrom] = useState<string>("");
  const [fTo, setFTo] = useState<string>("");
  const [fMonth, setFMonth] = useState<string>("");
  const [fDir, setFDir] = useState<string>("");
  const [fType, setFType] = useState<string>("");
  const [fAccount, setFAccount] = useState<string>("");
  const [fAcctType, setFAcctType] = useState<string>("");
  const [fSupplier, setFSupplier] = useState<string>("");
  const [fCustomer, setFCustomer] = useState<string>("");
  const [fAttach, setFAttach] = useState<string>("");
  const [fLinked, setFLinked] = useState<string>(""); // linked|unlinked
  const [fSettled, setFSettled] = useState<string>(""); // settled|unsettled (transfer)
  const [fReview, setFReview] = useState<string>("");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const f = flags(r);
      // chip filter
      if (chip === "unclassified" && !f.isUnclassified) return false;
      if (chip === "unlinked" && !(f.unlinkedInvoice || f.noAccount || f.missingParty)) return false;
      if (chip === "no_attach" && !f.noAttachment) return false;
      if (chip === "personal" && !f.personalNeedsReview) return false;
      if (chip === "transfer" && !f.transferMissingCounterpart) return false;
      if (chip === "provider_unlinked" && !f.unlinkedProviderSettlement) return false;
      if (chip === "completed" && !f.isCompleted) return false;


      if (fFrom && r.date < fFrom) return false;
      if (fTo && r.date > fTo) return false;
      if (fMonth && !(r.date ?? "").startsWith(fMonth)) return false;
      if (fDir && r.direction !== fDir) return false;
      if (fType && r.transaction_type !== fType) return false;
      if (fAccount && r.account_id !== fAccount) return false;
      if (fAcctType && r.account_type !== fAcctType) return false;
      if (fSupplier && r.supplier_id !== fSupplier) return false;
      if (fCustomer && r.customer_id !== fCustomer) return false;
      if (fAttach && r.attachment_status !== fAttach) return false;
      if (fLinked === "linked" && !(r.sales_invoice_id || r.purchase_invoice_id)) return false;
      if (fLinked === "unlinked" && (r.sales_invoice_id || r.purchase_invoice_id)) return false;
      if (fSettled === "settled" && !r.related_transaction_id) return false;
      if (fSettled === "unsettled" && r.related_transaction_id) return false;
      if (fReview && r.internal_review_status !== fReview) return false;
      if (q) {
        const s = q.toLowerCase();
        const hay = `${r.note ?? ""} ${r.internal_note ?? ""} ${String(r.amount)}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, chip, fFrom, fTo, fMonth, fDir, fType, fAccount, fAcctType, fSupplier, fCustomer, fAttach, fLinked, fSettled, fReview, q]);

  // KPI counts
  const kpis = useMemo(() => {
    let unclassified = 0, unlinked = 0, noAttach = 0, personal = 0, transfer = 0, completed = 0;
    rows.forEach((r) => {
      const f = flags(r);
      if (f.isUnclassified) unclassified++;
      if (f.unlinkedInvoice || f.noAccount || f.missingParty) unlinked++;
      if (f.noAttachment) noAttach++;
      if (f.personalNeedsReview) personal++;
      if (f.transferMissingCounterpart) transfer++;
      if (f.isCompleted) completed++;
    });
    return { unclassified, unlinked, noAttach, personal, transfer, completed };
  }, [rows]);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSel = (r: Row) => {
    const key = `${r.kind}:${r.id}`;
    setSelected((s) => { const ns = new Set(s); if (ns.has(key)) ns.delete(key); else ns.add(key); return ns; });
  };
  const clearSel = () => setSelected(new Set());

  const [showBulk, setShowBulk] = useState(false);
  const [openRow, setOpenRow] = useState<Row | null>(null);

  const nameOf = {
    account: (id?: string | null) => accounts.find((a: any) => a.id === id)?.name ?? "—",
    supplier: (id?: string | null) => suppliers.find((s: any) => s.id === id)?.name ?? "—",
    customer: (id?: string | null) => {
      const c = customers.find((x: any) => x.id === id);
      return c ? (c.full_name || c.phone || "—") : "—";
    },
    salesInvoice: (id?: number | null) => salesInvoices.find((s: any) => Number(s.id) === Number(id))?.invoice_number ?? (id ? `#${id}` : "—"),
    purchaseInvoice: (id?: number | null) => purchaseInvoices.find((s: any) => Number(s.id) === Number(id))?.internal_reference ?? (id ? `#${id}` : "—"),
  };

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["review_incomes"] });
    qc.invalidateQueries({ queryKey: ["review_expenses"] });
  };

  const loading = loadingI || loadingE;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] tracking-[0.3em] text-gold/80 uppercase">Review Center</div>
        <h2 className="text-lg font-semibold mt-1">مركز مراجعة الحركات</h2>
        <p className="text-xs text-muted-foreground mt-1">
          تنظيف وربط الحركات القديمة بدون تعديل المبالغ أو التواريخ. جميع التعديلات تُسجل في سجل التعديلات.
        </p>
      </div>

      {/* KPI chips */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiChip label="إجمالي غير المصنف" count={kpis.unclassified} active={chip === "unclassified"} onClick={() => setChip("unclassified")} tone="amber" icon={AlertCircle} />
        <KpiChip label="غير مرتبط" count={kpis.unlinked} active={chip === "unlinked"} onClick={() => setChip("unlinked")} tone="blue" icon={Link2} />
        <KpiChip label="بدون مرفق" count={kpis.noAttach} active={chip === "no_attach"} onClick={() => setChip("no_attach")} tone="orange" icon={Paperclip} />
        <KpiChip label="حساب شخصي يحتاج مراجعة" count={kpis.personal} active={chip === "personal"} onClick={() => setChip("personal")} tone="purple" icon={User} />
        <KpiChip label="تحويل غير مكتمل" count={kpis.transfer} active={chip === "transfer"} onClick={() => setChip("transfer")} tone="cyan" icon={ArrowLeftRight} />
        <KpiChip label="مكتمل" count={kpis.completed} active={chip === "completed"} onClick={() => setChip("completed")} tone="emerald" icon={CheckCircle2} />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 rounded-xl bg-white/5 border border-white/10 p-3">
        <Input placeholder="بحث..." value={q} onChange={(e) => setQ(e.target.value)} className="bg-black/40 border-white/10 text-sm" />
        <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className="bg-black/40 border-white/10 text-sm" placeholder="من" />
        <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className="bg-black/40 border-white/10 text-sm" placeholder="إلى" />
        <Input type="month" value={fMonth} onChange={(e) => setFMonth(e.target.value)} className="bg-black/40 border-white/10 text-sm" />
        <Sel value={fDir} onChange={setFDir} placeholder="الاتجاه">
          <option value="incoming">وارد</option><option value="outgoing">صادر</option>
        </Sel>
        <Sel value={fType} onChange={setFType} placeholder="نوع الحركة">
          <optgroup label="وارد">
            {Object.entries(INCOMING_TYPE).map(([k, v]) => <option key={"i"+k} value={k}>{v}</option>)}
          </optgroup>
          <optgroup label="صادر">
            {Object.entries(OUTGOING_TYPE).map(([k, v]) => <option key={"o"+k} value={k}>{v}</option>)}
          </optgroup>
        </Sel>
        <Sel value={fAccount} onChange={setFAccount} placeholder="الحساب المالي">
          {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Sel>
        <Sel value={fAcctType} onChange={setFAcctType} placeholder="شخصي/تجاري">
          <option value="business">تجاري</option><option value="personal">شخصي</option>
        </Sel>
        <Sel value={fSupplier} onChange={setFSupplier} placeholder="المورد">
          {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Sel>
        <Sel value={fCustomer} onChange={setFCustomer} placeholder="العميل">
          {customers.map((c: any) => <option key={c.id} value={c.id}>{c.full_name || c.phone}</option>)}
        </Sel>
        <Sel value={fAttach} onChange={setFAttach} placeholder="المرفق">
          {Object.entries(ATTACH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Sel>
        <Sel value={fLinked} onChange={setFLinked} placeholder="ارتباط الفاتورة">
          <option value="linked">مرتبط</option><option value="unlinked">غير مرتبط</option>
        </Sel>
        <Sel value={fSettled} onChange={setFSettled} placeholder="التحويل">
          <option value="settled">مسوّى</option><option value="unsettled">غير مسوّى</option>
        </Sel>
        <Sel value={fReview} onChange={setFReview} placeholder="حالة المراجعة">
          {Object.entries(REVIEW_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Sel>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/30 p-3">
          <div className="text-sm">تم اختيار <b>{selected.size}</b> حركة</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={clearSel}>إلغاء الاختيار</Button>
            <Button size="sm" onClick={() => setShowBulk(true)} className="bg-gold text-black hover:bg-gold/90">تعديل جماعي</Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline ml-2" />جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <Inbox className="w-8 h-8 mx-auto opacity-40 mb-2" />
            لا توجد حركات مطابقة
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="p-2 w-8"></th>
                <th className="text-right p-2">التاريخ</th>
                <th className="text-right p-2">الاتجاه</th>
                <th className="text-right p-2">المبلغ</th>
                <th className="text-right p-2">النوع</th>
                <th className="text-right p-2">علاقة النشاط</th>
                <th className="text-right p-2">الحساب</th>
                <th className="text-right p-2">الطرف</th>
                <th className="text-right p-2">الفاتورة</th>
                <th className="text-right p-2">تنبيهات</th>
                <th className="text-right p-2">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((r) => {
                const f = flags(r);
                const key = `${r.kind}:${r.id}`;
                const typeMap = r.direction === "incoming" ? INCOMING_TYPE : OUTGOING_TYPE;
                return (
                  <tr key={key} className={`border-t border-white/5 hover:bg-white/5 cursor-pointer ${f.isCompleted ? "opacity-70" : ""}`}>
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(key)} onCheckedChange={() => toggleSel(r)} />
                    </td>
                    <td className="p-2 whitespace-nowrap" onClick={() => setOpenRow(r)}>{r.date}</td>
                    <td className="p-2" onClick={() => setOpenRow(r)}>
                      {r.direction === "incoming"
                        ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">وارد</Badge>
                        : <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/30">صادر</Badge>}
                    </td>
                    <td className={`p-2 font-semibold ${r.direction === "incoming" ? "text-emerald-300" : "text-red-300"}`} onClick={() => setOpenRow(r)}>{SAR(r.amount)}</td>
                    <td className="p-2 text-xs" onClick={() => setOpenRow(r)}>{typeMap[r.transaction_type ?? ""] ?? <span className="text-amber-300">غير محدد</span>}</td>
                    <td className="p-2 text-xs" onClick={() => setOpenRow(r)}>{BUSINESS_REL[r.business_relation]}</td>
                    <td className="p-2 text-xs" onClick={() => setOpenRow(r)}>
                      {r.account_id ? nameOf.account(r.account_id) : <span className="text-amber-300">بدون</span>}
                      {r.account_type === "personal" && <User className="inline w-3 h-3 mr-1 text-amber-300" />}
                    </td>
                    <td className="p-2 text-xs" onClick={() => setOpenRow(r)}>
                      {r.kind === "income" ? nameOf.customer(r.customer_id) : nameOf.supplier(r.supplier_id)}
                    </td>
                    <td className="p-2 text-xs" onClick={() => setOpenRow(r)}>
                      {r.kind === "income" ? (r.sales_invoice_id ? nameOf.salesInvoice(r.sales_invoice_id) : "—") : (r.purchase_invoice_id ? nameOf.purchaseInvoice(r.purchase_invoice_id) : "—")}
                    </td>
                    <td className="p-2" onClick={() => setOpenRow(r)}>
                      <div className="flex flex-wrap gap-1">
                        {f.isUnclassified && <Dot color="amber" title="غير مصنف" />}
                        {f.noAccount && <Dot color="blue" title="بدون حساب" />}
                        {f.noAttachment && <Dot color="orange" title="بدون مرفق" />}
                        {f.personalNeedsReview && <Dot color="purple" title="شخصي غير مراجع" />}
                        {f.transferMissingCounterpart && <Dot color="cyan" title="تحويل بدون طرف مقابل" />}
                        {f.unlinkedInvoice && <Dot color="rose" title="بدون فاتورة" />}
                        {f.missingParty && <Dot color="pink" title="بدون طرف" />}
                      </div>
                    </td>
                    <td className="p-2 text-xs" onClick={() => setOpenRow(r)}>
                      {f.isCompleted
                        ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">مكتمل</Badge>
                        : <Badge variant="outline" className="bg-white/10 text-muted-foreground border-white/20">قيد المراجعة</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {filtered.length > 500 && (
          <div className="p-2 text-center text-xs text-muted-foreground">تعرض أول 500 حركة من {filtered.length}. ضيّق الفلاتر للمزيد.</div>
        )}
      </div>

      {openRow && (
        <RowDrawer
          row={openRow}
          accounts={accounts} suppliers={suppliers} customers={customers}
          salesInvoices={salesInvoices} purchaseInvoices={purchaseInvoices}
          incomes={incomes} expenses={expenses}
          onClose={() => setOpenRow(null)}
          onDone={() => { invalidateAll(); setOpenRow(null); }}
        />
      )}

      {showBulk && (
        <BulkModal
          selected={selected}
          accounts={accounts} categoriesAll={categoriesAll}
          onClose={() => setShowBulk(false)}
          onDone={() => { invalidateAll(); clearSel(); setShowBulk(false); }}
        />
      )}
    </div>
  );
}

// ================== Small pieces ==================
function KpiChip({ label, count, active, onClick, tone, icon: Icon }: any) {
  const tones: Record<string, string> = {
    amber: "border-amber-500/40 text-amber-300 bg-amber-500/10",
    blue: "border-blue-500/40 text-blue-300 bg-blue-500/10",
    orange: "border-orange-500/40 text-orange-300 bg-orange-500/10",
    purple: "border-purple-500/40 text-purple-300 bg-purple-500/10",
    cyan: "border-cyan-500/40 text-cyan-300 bg-cyan-500/10",
    emerald: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
  };
  return (
    <button onClick={onClick} className={`rounded-xl border p-3 text-right transition ${active ? tones[tone] + " ring-2 ring-current/40" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
      <div className="flex items-center justify-between">
        <Icon className="w-4 h-4 opacity-70" />
        <div className="text-2xl font-bold">{count}</div>
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
    </button>
  );
}
function Sel({ value, onChange, placeholder, children }: { value: string; onChange: (v: string) => void; placeholder: string; children: any }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}
function Dot({ color, title }: { color: string; title: string }) {
  const map: Record<string, string> = {
    amber: "bg-amber-400", blue: "bg-blue-400", orange: "bg-orange-400",
    purple: "bg-purple-400", cyan: "bg-cyan-400", rose: "bg-rose-400", pink: "bg-pink-400",
  };
  return <span title={title} className={`inline-block w-2 h-2 rounded-full ${map[color]}`} />;
}
function Field({ label, children }: { label: string; children: any }) {
  return <div><div className="text-[11px] text-muted-foreground mb-1">{label}</div>{children}</div>;
}

// ================== Row Drawer ==================
function RowDrawer({ row, accounts, suppliers, customers, salesInvoices, purchaseInvoices, incomes, expenses, onClose, onDone }: any) {
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<any>({
    transaction_type: row.transaction_type ?? "",
    business_relation: row.business_relation ?? "unclassified",
    account_id: row.account_id ?? "",
    account_type: row.account_type ?? "business",
    customer_id: row.customer_id ?? "",
    supplier_id: row.supplier_id ?? "",
    sales_invoice_id: row.sales_invoice_id ?? "",
    purchase_invoice_id: row.purchase_invoice_id ?? "",
    related_transaction_id: row.related_transaction_id ?? "",
    accounting_status: row.accounting_status ?? "unclassified",
    internal_review_status: row.internal_review_status ?? "unreviewed",
    internal_note: row.internal_note ?? "",
  });
  const table = row.kind === "income" ? "finance_incomes" : "finance_expenses";
  const typeMap = row.direction === "incoming" ? INCOMING_TYPE : OUTGOING_TYPE;

  const save = async () => {
    setPending(true);
    try {
      const payload: any = {
        transaction_type: state.transaction_type || null,
        business_relation: state.business_relation,
        account_id: state.account_id || null,
        account_type: state.account_type,
        accounting_status: state.accounting_status,
        internal_review_status: state.internal_review_status,
        internal_note: state.internal_note || null,
        related_transaction_id: state.related_transaction_id || null,
      };
      if (row.kind === "income") {
        payload.customer_id = state.customer_id || null;
        payload.sales_invoice_id = state.sales_invoice_id ? Number(state.sales_invoice_id) : null;
      } else {
        payload.supplier_id = state.supplier_id || null;
        payload.purchase_invoice_id = state.purchase_invoice_id ? Number(state.purchase_invoice_id) : null;
      }
      const { error } = await supabase.from(table as any).update(payload).eq("id", row.id);
      if (error) throw error;
      toast.success("تم حفظ التعديلات");
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setPending(false); }
  };

  const markComplete = async () => {
    // Guard: must be classified
    if (!state.transaction_type || state.business_relation === "unclassified") {
      toast.error("لا يمكن الإكمال — الحركة غير مصنفة بالكامل");
      return;
    }
    setState({ ...state, accounting_status: "reviewed", internal_review_status: "reviewed" });
    // save immediately with reviewed
    setPending(true);
    try {
      const payload: any = {
        transaction_type: state.transaction_type || null,
        business_relation: state.business_relation,
        account_id: state.account_id || null,
        account_type: state.account_type,
        accounting_status: "reviewed",
        internal_review_status: "reviewed",
        internal_note: state.internal_note || null,
        related_transaction_id: state.related_transaction_id || null,
      };
      if (row.kind === "income") {
        payload.customer_id = state.customer_id || null;
        payload.sales_invoice_id = state.sales_invoice_id ? Number(state.sales_invoice_id) : null;
      } else {
        payload.supplier_id = state.supplier_id || null;
        payload.purchase_invoice_id = state.purchase_invoice_id ? Number(state.purchase_invoice_id) : null;
      }
      const { error } = await supabase.from(table as any).update(payload).eq("id", row.id);
      if (error) throw error;
      toast.success("تم اعتماد المراجعة");
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setPending(false); }
  };

  // Quick actions
  const applyQuick = (patch: any) => setState((s: any) => ({ ...s, ...patch }));

  // Counterpart candidates for transfer (same amount, opposite direction, ±5 days)
  const counterpartCandidates = useMemo(() => {
    if (state.transaction_type !== "internal_transfer_in" && state.transaction_type !== "internal_transfer_out") return [];
    const pool = row.kind === "income" ? expenses : incomes;
    const rowDate = new Date(row.date).getTime();
    return pool.filter((c: any) => {
      const cAmt = Number(c.amount) || 0;
      if (Math.abs(cAmt - row.amount) > 0.01) return false;
      const cDate = new Date(c.income_date || c.expense_date).getTime();
      if (Math.abs(cDate - rowDate) > 5 * 86400000) return false;
      return true;
    }).slice(0, 20);
  }, [state.transaction_type, row, incomes, expenses]);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex" onClick={onClose}>
      <div className="mr-auto w-full max-w-2xl bg-background border-l border-white/10 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-white/10 p-3 flex items-center justify-between z-10">
          <div>
            <div className="flex items-center gap-2">
              {row.direction === "incoming"
                ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">وارد</Badge>
                : <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/30">صادر</Badge>}
              <span className={`font-bold ${row.direction === "incoming" ? "text-emerald-300" : "text-red-300"}`}>{SAR(row.amount)}</span>
              <span className="text-muted-foreground text-sm">· {row.date}</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 font-mono">{row.kind} · {row.id.slice(0, 8)}</div>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded p-2 flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>لا يمكن تعديل المبلغ أو التاريخ من هذه الشاشة. تظهر جميع التعديلات في سجل التعديلات مع القيم السابقة والجديدة.</span>
          </div>

          {/* Quick actions */}
          <div>
            <div className="text-[11px] text-muted-foreground mb-2">إجراءات سريعة</div>
            <div className="flex flex-wrap gap-2">
              {row.direction === "incoming" && (
                <>
                  <QuickBtn onClick={() => applyQuick({ transaction_type: "customer_invoice_collection", business_relation: "business" })}>تحصيل فاتورة عميل</QuickBtn>
                  <QuickBtn onClick={() => applyQuick({ transaction_type: "cash_sale", business_relation: "business" })}>بيع نقدي</QuickBtn>
                  <QuickBtn onClick={() => applyQuick({ transaction_type: "owner_contribution", business_relation: "owner_settlement" })}>مساهمة مالك</QuickBtn>
                  <QuickBtn onClick={() => applyQuick({ transaction_type: "internal_transfer_in", business_relation: "internal_transfer" })}>تحويل داخلي وارد</QuickBtn>
                  <QuickBtn onClick={() => applyQuick({ transaction_type: "customer_invoice_collection", business_relation: "business", account_type: "personal" })}>تحصيل بحساب شخصي</QuickBtn>
                </>
              )}
              {row.direction === "outgoing" && (
                <>
                  <QuickBtn onClick={() => applyQuick({ transaction_type: "supplier_invoice_payment", business_relation: "business" })}>دفعة فاتورة مورد</QuickBtn>
                  <QuickBtn onClick={() => applyQuick({ transaction_type: "operating_expense", business_relation: "business" })}>مصروف تشغيلي</QuickBtn>
                  <QuickBtn onClick={() => applyQuick({ transaction_type: "owner_withdrawal", business_relation: "owner_settlement" })}>سحب مالك</QuickBtn>
                  <QuickBtn onClick={() => applyQuick({ transaction_type: "internal_transfer_out", business_relation: "internal_transfer" })}>تحويل داخلي صادر</QuickBtn>
                  <QuickBtn onClick={() => applyQuick({ transaction_type: "operating_expense", business_relation: "business", account_type: "personal" })}>مصروف نشاط مدفوع شخصيًا</QuickBtn>
                </>
              )}
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="نوع الحركة">
              <select value={state.transaction_type} onChange={(e) => setState({ ...state, transaction_type: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
                <option value="">—</option>
                {Object.entries(typeMap).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="علاقة الحركة بالنشاط">
              <select value={state.business_relation} onChange={(e) => setState({ ...state, business_relation: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
                {Object.entries(BUSINESS_REL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="الحساب المالي">
              <select value={state.account_id} onChange={(e) => setState({ ...state, account_id: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
                <option value="">— بدون —</option>
                {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.account_owner_type === "owner" ? "شخصي" : "نشاط"})</option>)}
              </select>
            </Field>
            <Field label="نوع الحساب">
              <select value={state.account_type} onChange={(e) => setState({ ...state, account_type: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
                <option value="business">تجاري</option><option value="personal">شخصي</option>
              </select>
            </Field>

            {row.kind === "income" ? (
              <>
                <Field label="ربط بعميل">
                  <select value={state.customer_id} onChange={(e) => setState({ ...state, customer_id: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
                    <option value="">—</option>
                    {customers.map((c: any) => <option key={c.id} value={c.id}>{c.full_name || c.phone}</option>)}
                  </select>
                </Field>
                <Field label="ربط بفاتورة مبيعات">
                  <select value={state.sales_invoice_id} onChange={(e) => setState({ ...state, sales_invoice_id: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
                    <option value="">—</option>
                    {salesInvoices
                      .filter((s: any) => !state.customer_id || s.customer_id === state.customer_id)
                      .map((s: any) => <option key={s.id} value={s.id}>{s.invoice_number} · {SAR(s.total_amount)}</option>)}
                  </select>
                </Field>
              </>
            ) : (
              <>
                <Field label="ربط بمورد">
                  <select value={state.supplier_id} onChange={(e) => setState({ ...state, supplier_id: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
                    <option value="">—</option>
                    {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="ربط بفاتورة مشتريات">
                  <select value={state.purchase_invoice_id} onChange={(e) => setState({ ...state, purchase_invoice_id: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
                    <option value="">—</option>
                    {purchaseInvoices
                      .filter((p: any) => !state.supplier_id || p.supplier_id === state.supplier_id)
                      .map((p: any) => <option key={p.id} value={p.id}>{p.internal_reference} · {SAR(p.total_amount)}</option>)}
                  </select>
                </Field>
              </>
            )}
          </div>

          {(state.transaction_type === "internal_transfer_in" || state.transaction_type === "internal_transfer_out") && (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
              <div className="text-sm font-semibold mb-2 flex items-center gap-2"><ArrowLeftRight className="w-4 h-4" />الطرف المقابل للتحويل</div>
              {counterpartCandidates.length === 0 ? (
                <div className="text-xs text-muted-foreground">لا توجد حركات مطابقة بنفس المبلغ خلال 5 أيام.</div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {counterpartCandidates.map((c: any) => (
                    <label key={c.id} className={`flex items-center justify-between p-2 rounded cursor-pointer border ${state.related_transaction_id === c.id ? "bg-cyan-500/20 border-cyan-500/50" : "border-white/5 hover:bg-white/5"}`}>
                      <div>
                        <div className="text-xs">{c.income_date || c.expense_date}</div>
                        <div className="text-xs text-muted-foreground">{c.note ?? "—"}</div>
                      </div>
                      <input type="radio" checked={state.related_transaction_id === c.id} onChange={() => setState({ ...state, related_transaction_id: c.id })} />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <Field label="ملاحظة داخلية">
            <Textarea value={state.internal_note} onChange={(e) => setState({ ...state, internal_note: e.target.value })} rows={2} className="bg-black/40 border-white/10 text-sm" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="حالة التصنيف المحاسبي">
              <select value={state.accounting_status} onChange={(e) => setState({ ...state, accounting_status: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
                {Object.entries(ACCT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="حالة المراجعة الداخلية">
              <select value={state.internal_review_status} onChange={(e) => setState({ ...state, internal_review_status: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
                {Object.entries(REVIEW_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>

          <div className="pt-2">
            <AttachmentsPanel relatedType={row.kind === "income" ? "income" : "expense"} relatedId={row.id} canManage />
          </div>
        </div>

        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-white/10 p-3 flex justify-between gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={save} disabled={pending}>{pending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}</Button>
            <Button onClick={markComplete} disabled={pending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="w-4 h-4 ml-1" />اعتماد المراجعة
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
function QuickBtn({ children, onClick }: any) {
  return <button onClick={onClick} className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-md px-2 py-1">{children}</button>;
}

// ================== Bulk Modal ==================
function BulkModal({ selected, accounts, categoriesAll, onClose, onDone }: any) {
  const [pending, setPending] = useState(false);
  const [set, setSet] = useState<any>({
    transaction_type_income: "", transaction_type_expense: "",
    business_relation: "", account_id: "", accounting_status: "", internal_review_status: "",
    main_category_id: "", sub_category_id: "",
  });
  const mainCats = categoriesAll.filter((c: any) => !c.parent_id);
  const subCats = categoriesAll.filter((c: any) => c.parent_id === set.main_category_id);

  const apply = async () => {
    setPending(true);
    try {
      const incomeIds = [...selected].filter((k: string) => k.startsWith("income:")).map((k) => k.slice(7));
      const expenseIds = [...selected].filter((k: string) => k.startsWith("expense:")).map((k) => k.slice(8));

      const incPayload: any = {};
      const expPayload: any = {};
      if (set.business_relation) { incPayload.business_relation = set.business_relation; expPayload.business_relation = set.business_relation; }
      if (set.account_id) { incPayload.account_id = set.account_id; expPayload.account_id = set.account_id; }
      if (set.accounting_status) { incPayload.accounting_status = set.accounting_status; expPayload.accounting_status = set.accounting_status; }
      if (set.internal_review_status) { incPayload.internal_review_status = set.internal_review_status; expPayload.internal_review_status = set.internal_review_status; }
      if (set.transaction_type_income) incPayload.transaction_type = set.transaction_type_income;
      if (set.transaction_type_expense) expPayload.transaction_type = set.transaction_type_expense;
      if (set.main_category_id) expPayload.main_category_id = set.main_category_id;
      if (set.sub_category_id) expPayload.sub_category_id = set.sub_category_id;

      if (incomeIds.length && Object.keys(incPayload).length) {
        const { error } = await supabase.from("finance_incomes").update(incPayload).in("id", incomeIds);
        if (error) throw error;
      }
      if (expenseIds.length && Object.keys(expPayload).length) {
        const { error } = await supabase.from("finance_expenses").update(expPayload).in("id", expenseIds);
        if (error) throw error;
      }
      toast.success(`تم تحديث ${incomeIds.length + expenseIds.length} حركة`);
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setPending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background border border-white/10 rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold">تعديل جماعي — {selected.size} حركة</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded p-2">
            التعديل الجماعي مسموح فقط للحقول التالية. لا يمكن تعديل المبلغ أو التاريخ أو المورد أو العميل أو الفاتورة أو المرفق جماعيًا.
          </div>

          <Field label="علاقة النشاط">
            <select value={set.business_relation} onChange={(e) => setSet({ ...set, business_relation: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
              <option value="">— بدون تغيير —</option>
              {Object.entries(BUSINESS_REL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>

          <Field label="الحساب المالي">
            <select value={set.account_id} onChange={(e) => setSet({ ...set, account_id: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
              <option value="">— بدون تغيير —</option>
              {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="نوع الحركة (الوارد)">
              <select value={set.transaction_type_income} onChange={(e) => setSet({ ...set, transaction_type_income: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
                <option value="">— بدون —</option>
                {Object.entries(INCOMING_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="نوع الحركة (الصادر)">
              <select value={set.transaction_type_expense} onChange={(e) => setSet({ ...set, transaction_type_expense: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
                <option value="">— بدون —</option>
                {Object.entries(OUTGOING_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="التصنيف الرئيسي (للمدفوعات)">
              <select value={set.main_category_id} onChange={(e) => setSet({ ...set, main_category_id: e.target.value, sub_category_id: "" })} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
                <option value="">—</option>
                {mainCats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="التصنيف الفرعي">
              <select value={set.sub_category_id} onChange={(e) => setSet({ ...set, sub_category_id: e.target.value })} disabled={!set.main_category_id} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
                <option value="">—</option>
                {subCats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="حالة المراجعة">
              <select value={set.internal_review_status} onChange={(e) => setSet({ ...set, internal_review_status: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
                <option value="">—</option>
                {Object.entries(REVIEW_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="حالة التصنيف المحاسبي">
              <select value={set.accounting_status} onChange={(e) => setSet({ ...set, accounting_status: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
                <option value="">—</option>
                {Object.entries(ACCT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>
        </div>
        <div className="p-3 border-t border-white/10 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={apply} disabled={pending} className="bg-gold text-black hover:bg-gold/90">
            {pending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle2 className="w-4 h-4 ml-1" />}
            تطبيق التعديل
          </Button>
        </div>
      </div>
    </div>
  );
}
