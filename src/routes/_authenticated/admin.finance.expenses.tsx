import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { usePaginatedQuery, type PageSize } from "@/lib/finance/use-paginated-query";
import { PaginationBar } from "@/components/finance/PaginationBar";
import { useUrlState, useInitialUrlPage, useSyncPageToUrl } from "@/lib/finance/use-url-state";
import { ACCOUNT_TYPES, ACCOUNTANT_STATUS, ATTACHMENT_STATUS, INTERNAL_REVIEW, OWNER_DRAW_SLUG, fmtSAR, labelOf, toneOf } from "@/lib/finance/constants";
import { OUTGOING_TYPES, ACCOUNTING_STATUSES, outgoingLabel, defaultBusinessRelation } from "@/lib/finance/transaction-types";

const BUSINESS_RELATIONS: { value: string; label: string }[] = [
  { value: "business", label: "تخص النشاط" },
  { value: "personal", label: "شخصية" },
  { value: "owner_settlement", label: "تسوية مالك" },
  { value: "internal_transfer", label: "تحويل داخلي" },
  { value: "unclassified", label: "غير محددة" },
];
import { Plus, Search, X, Pencil, Trash2, RotateCcw, Archive, Wallet, Tag } from "lucide-react";
import { toast } from "sonner";
import { AttachmentsPanel, PendingAttachmentsPicker, uploadPendingAttachments, type PendingAttachment } from "@/components/finance/AttachmentsPanel";
import { AuditPanel } from "@/components/finance/AuditPanel";
import { RowAttachmentControl } from "@/components/finance/RowAttachmentControl";
import { ReviewStatusEditor } from "@/components/finance/ReviewStatusEditor";

export const Route = createFileRoute("/_authenticated/admin/finance/expenses")({
  ssr: false,
  component: ExpensesPage,
});

function ExpensesPage() {
  const roles = useFinanceRoles();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [mains, setMains] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [creatingOwnerDraw, setCreatingOwnerDraw] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
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
  const [fSup, setFSup] = useUrlState("sup", "");
  const [fMain, setFMain] = useUrlState("main", "");
  const [fSub, setFSub] = useUrlState("sub", "");
  const [fAccount, setFAccount] = useUrlState("acc", "");
  const [fInternal, setFInternal] = useUrlState("internal", "");
  const [fAcct, setFAcct] = useUrlState("acct", "");
  const [fAtt, setFAtt] = useUrlState("att", "");
  const [fTxnType, setFTxnType] = useUrlState("txn", "");
  const [fAccStatus, setFAccStatus] = useUrlState("astatus", "");
  const initialPage = useInitialUrlPage();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q, setDebouncedQ]);

  useEffect(() => {
    (async () => {
      const [{ data: sups }, { data: cats }] = await Promise.all([
        supabase.from("finance_suppliers").select("id, name").eq("is_active", true).order("name"),
        supabase.from("finance_categories").select("*").eq("is_active", true).order("display_order"),
      ]);
      setSuppliers(sups ?? []);
      setMains((cats ?? []).filter((c: any) => c.kind === "main"));
      setSubs((cats ?? []).filter((c: any) => c.kind === "sub"));
    })();
  }, []);

  const refreshCounts = useCallback(async () => {
    const [u, d] = await Promise.all([
      supabase.from("finance_expenses").select("id", { count: "exact", head: true }).is("deleted_at", null).or("accounting_status.is.null,accounting_status.eq.unclassified"),
      supabase.from("finance_expenses").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
    ]);
    setUnclassifiedCount(u.count ?? 0);
    setDeletedCount(d.count ?? 0);
  }, []);
  useEffect(() => { refreshCounts(); }, [refreshCounts]);

  const fetcher = useCallback(async ({ page, pageSize }: { page: number; pageSize: PageSize }) => {
    let query = supabase.from("finance_expenses").select("*", { count: "exact" })
      .order("expense_date", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false });
    if (showDeleted) query = query.not("deleted_at", "is", null);
    else query = query.is("deleted_at", null);
    if (debouncedQ) {
      const like = `%${debouncedQ.replace(/[%_]/g, (m) => "\\" + m)}%`;
      query = query.or(`item_name.ilike.${like},supplier_name.ilike.${like}`);
    }
    if (fMonth) query = query.eq("month", fMonth);
    if (fSup) query = query.eq("supplier_id", fSup);
    if (fMain) query = query.eq("main_category_id", fMain);
    if (fSub) query = query.eq("sub_category_id", fSub);
    if (fAccount) query = query.eq("account_type", fAccount as any);
    if (fInternal) query = query.eq("internal_review_status", fInternal as any);
    if (fAcct) query = query.eq("accountant_status", fAcct as any);
    if (fAtt) query = query.eq("attachment_status", fAtt as any);
    if (fTxnType) query = query.eq("transaction_type", fTxnType as any);
    if (fAccStatus) {
      if (fAccStatus === "unclassified") query = query.or("accounting_status.is.null,accounting_status.eq.unclassified");
      else query = query.eq("accounting_status", fAccStatus as any);
    }
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await query.range(from, to);
    if (error) throw new Error(error.message);
    return { rows: (data as any[]) ?? [], total: count ?? 0 };
  }, [showDeleted, debouncedQ, fMonth, fSup, fMain, fSub, fAccount, fInternal, fAcct, fAtt, fTxnType, fAccStatus]);

  const pg = usePaginatedQuery(fetcher, [showDeleted, debouncedQ, fMonth, fSup, fMain, fSub, fAccount, fInternal, fAcct, fAtt, fTxnType, fAccStatus]);
  const [rows, setLocalRows] = useState<any[]>([]);
  useEffect(() => { setLocalRows(pg.rows); }, [pg.rows]);
  const setRows = (updater: (prev: any[]) => any[]) => setLocalRows((p) => updater(p));
  const loading = pg.loading;
  const load = useCallback(() => { pg.reload(); refreshCounts(); }, [pg.reload, refreshCounts]);

  const supName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "—";
  const catName = (id: string | null) => [...mains, ...subs].find((c) => c.id === id)?.name ?? "—";
  const ownerDrawCatId = useMemo(() => mains.find((c: any) => c.system_slug === OWNER_DRAW_SLUG)?.id ?? null, [mains]);
  const ownerDrawSubId = useMemo(() => ownerDrawCatId ? (subs.find((s: any) => s.parent_id === ownerDrawCatId)?.id ?? null) : null, [subs, ownerDrawCatId]);

  const months = useMemo(() => {
    const out: string[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  }, []);
  const filtered = rows;
  const total = rows.reduce((a, b) => a + Number(b.amount ?? 0), 0);
  const subsForMain = fMain ? subs.filter((s) => s.parent_id === fMain) : subs;

  const softDelete = async (r: any) => {
    const reason = window.prompt("سبب الحذف (اختياري):", "") ?? "";
    if (!confirm("هل أنت متأكد من حذف هذه العملية؟ سيتم إخفاؤها من الجداول مع الاحتفاظ بها في سجل النظام.")) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("finance_expenses").update({
      deleted_at: new Date().toISOString(),
      deleted_by: u.user?.id ?? null,
      delete_reason: reason || null,
    }).eq("id", r.id);
    if (error) toast.error("تعذر الحذف: " + error.message);
    else { toast.success("تمت الأرشفة"); load(); }
  };

  const restore = async (r: any) => {
    if (!confirm("استعادة هذه العملية إلى الجدول الافتراضي؟")) return;
    const { error } = await supabase.from("finance_expenses").update({
      deleted_at: null, deleted_by: null, delete_reason: null,
    }).eq("id", r.id);
    if (error) toast.error("تعذر الاستعادة: " + error.message);
    else { toast.success("تمت الاستعادة"); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">المدفوعات {showDeleted && <span className="text-amber-300 text-[12px]">(المؤرشفة)</span>}</h2>
        <div className="flex items-center gap-2">
          {roles.canManage && deletedCount > 0 && (
            <button onClick={() => setShowDeleted(!showDeleted)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] ${showDeleted ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>
              <Archive size={13} /> {showDeleted ? "إخفاء المؤرشفة" : `عرض المؤرشفة (${deletedCount})`}
            </button>
          )}
          {roles.canManage && ownerDrawCatId && (
            <button onClick={() => setCreatingOwnerDraw(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-gold/40 text-gold text-[12px] hover:bg-gold/15">
              <Wallet size={13} /> سحب أونر
            </button>
          )}
          {roles.canManage && (
            <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[12px] hover:bg-gold/25">
              <Plus size={14} /> إضافة مصروف
            </button>
          )}
        </div>
      </div>

      {unclassifiedCount > 0 && (
        <button
          onClick={() => setFAccStatus("unclassified")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] ${fAccStatus === "unclassified" ? "bg-amber-500/20 border-amber-500/40 text-amber-200" : "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"}`}
        >
          <Tag size={13} /> حركات غير مصنفة: {unclassifiedCount}
        </button>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-2">
        <label className="relative col-span-2 md:col-span-2">
          <Search size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث…" className="w-full pr-7 pl-2 py-1.5 rounded-lg bg-background/60 border border-white/10 text-[12px]" />
        </label>
        <Select v={fMonth} onChange={setFMonth} ph="الشهر" opts={months.map((m) => ({ value: m, label: m }))} />
        <Select v={fSup} onChange={setFSup} ph="المورد" opts={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        <Select v={fMain} onChange={(v) => { setFMain(v); setFSub(""); }} ph="تصنيف رئيسي" opts={mains.map((c) => ({ value: c.id, label: c.name }))} />
        <Select v={fSub} onChange={setFSub} ph="تصنيف فرعي" opts={subsForMain.map((c) => ({ value: c.id, label: c.name }))} />
        <Select v={fTxnType} onChange={setFTxnType} ph="نوع الحركة" opts={OUTGOING_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
        <Select v={fAccStatus} onChange={setFAccStatus} ph="حالة التصنيف" opts={ACCOUNTING_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
        <Select v={fAccount} onChange={setFAccount} ph="نوع الحساب" opts={ACCOUNT_TYPES.map((a) => ({ value: a.value, label: a.label }))} />
        <Select v={fInternal} onChange={setFInternal} ph="داخلي" opts={INTERNAL_REVIEW.map((a) => ({ value: a.value, label: a.label }))} />
        <Select v={fAcct} onChange={setFAcct} ph="المحاسب" opts={ACCOUNTANT_STATUS.map((a) => ({ value: a.value, label: a.label }))} />
        <Select v={fAtt} onChange={setFAtt} ph="المرفق" opts={ATTACHMENT_STATUS.map((a) => ({ value: a.value, label: a.label }))} />
      </div>

      <div className={`overflow-x-auto rounded-xl border border-white/10 bg-white/5 ${loading ? "opacity-70" : ""}`}>
        <table className="w-full text-[12px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-start px-3 py-2">التاريخ</th>
              <th className="text-start px-3 py-2">المبلغ</th>
              <th className="text-start px-3 py-2">البيان</th>
              <th className="text-start px-3 py-2">المورد</th>
              <th className="text-start px-3 py-2">رئيسي</th>
              <th className="text-start px-3 py-2">فرعي</th>
              <th className="text-start px-3 py-2">نوع الحركة</th>
              <th className="text-start px-3 py-2">داخلي</th>
              <th className="text-start px-3 py-2">المحاسب</th>
              <th className="text-start px-3 py-2">المرفق</th>
              <th className="text-start px-3 py-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={`border-t border-white/5 hover:bg-white/5 ${r.deleted_at ? "opacity-60" : ""}`}>
                <td className="px-3 py-2 whitespace-nowrap">{r.expense_date}</td>
                <td className="px-3 py-2 font-mono">{fmtSAR(r.amount)}</td>
                <td className="px-3 py-2 max-w-[180px] truncate" title={r.item_name}>
                  {r.main_category_id === ownerDrawCatId && (
                    <span className="me-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-gold/40 bg-gold/10 text-gold align-middle">
                      <Wallet size={10} /> توزيع أرباح
                    </span>
                  )}
                  {r.item_name}
                </td>
                <td className="px-3 py-2">{supName(r.supplier_id) !== "—" ? supName(r.supplier_id) : r.supplier_name || "—"}</td>
                <td className="px-3 py-2">{catName(r.main_category_id)}</td>
                <td className="px-3 py-2">{catName(r.sub_category_id)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.transaction_type ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-white/10 bg-white/5">
                      {outgoingLabel(r.transaction_type)}
                    </span>
                  ) : (
                    <span className="text-amber-300/80 text-[10px]">غير مصنف</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <ReviewStatusEditor
                    table="finance_expenses"
                    rowId={r.id}
                    field="internal_review_status"
                    value={r.internal_review_status}
                    canEdit={roles.canManage && !r.deleted_at}
                    onChanged={(v) => setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, internal_review_status: v } : x))}
                  />
                </td>
                <td className="px-3 py-2">
                  <ReviewStatusEditor
                    table="finance_expenses"
                    rowId={r.id}
                    field="accountant_status"
                    value={r.accountant_status}
                    note={r.accountant_note}
                    canEdit={(roles.canManage || roles.canAccountant) && !r.deleted_at}
                    onChanged={(v, n) => setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, accountant_status: v, ...(n !== undefined ? { accountant_note: n } : {}) } : x))}
                  />
                </td>
                <td className="px-3 py-2">
                  <RowAttachmentControl
                    relatedType="expense"
                    relatedId={r.id}
                    status={r.attachment_status}
                    canManage={roles.canManage}
                    canDelete={roles.canManage}
                    onChanged={(s) => setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, attachment_status: s } : x))}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditing(r)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px]"><Pencil size={11} /> فتح</button>
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
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">لا توجد بيانات</td></tr>
            )}
          </tbody>
          <tfoot className="bg-white/5 font-semibold">
            <tr><td className="px-3 py-2">إجمالي الصفحة</td><td className="px-3 py-2 font-mono">{fmtSAR(total)}</td><td colSpan={9} className="text-muted-foreground text-[11px]">{pg.total} سجل مطابق</td></tr>
          </tfoot>
        </table>
        <PaginationBar page={pg.page} pageCount={pg.pageCount} pageSize={pg.pageSize} total={pg.total} loading={pg.loading} onPage={pg.setPage} onPageSize={pg.setPageSize} />
      </div>

      {(editing || creating || creatingOwnerDraw) && (
        <ExpenseDialog
          row={editing}
          initial={creatingOwnerDraw ? { main_category_id: ownerDrawCatId, sub_category_id: ownerDrawSubId, item_name: "سحب أونر" } : null}
          suppliers={suppliers} mains={mains} subs={subs} roles={roles}
          ownerDrawCatId={ownerDrawCatId}
          onClose={() => { setEditing(null); setCreating(false); setCreatingOwnerDraw(false); }}
          onSaved={() => { setEditing(null); setCreating(false); setCreatingOwnerDraw(false); load(); }}
        />
      )}
    </div>
  );
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) { return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border whitespace-nowrap ${tone}`}>{children}</span>; }
function Select({ v, onChange, ph, opts }: { v: string; onChange: (s: string) => void; ph: string; opts: { value: string; label: string }[] }) {
  return (
    <select value={v} onChange={(e) => onChange(e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-background/60 border border-white/10 text-[12px]">
      <option value="">{ph}</option>
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

const PAYMENT_TYPES = [
  { value: "cash", label: "نقدي" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "card", label: "بطاقة" },
  { value: "wallet", label: "محفظة إلكترونية" },
  { value: "other", label: "أخرى" },
];

function ExpenseDialog({ row, initial, suppliers, mains, subs, roles, ownerDrawCatId, onClose, onSaved }: any) {
  const isNew = !row;
  const accountantOnly = !roles.canManage && roles.canAccountant;
  const canReview = roles.canManage || roles.canAccountant;
  const initialTxnType = row?.transaction_type
    ?? (initial?.main_category_id && ownerDrawCatId && initial.main_category_id === ownerDrawCatId ? "owner_withdrawal" : "");

  const [f, setF] = useState({
    expense_date: row?.expense_date ?? new Date().toISOString().slice(0, 10),
    amount: row?.amount ?? 0,
    item_name: row?.item_name ?? initial?.item_name ?? "",
    supplier_id: row?.supplier_id ?? "",
    supplier_name: row?.supplier_name ?? "",
    main_category_id: row?.main_category_id ?? initial?.main_category_id ?? "",
    sub_category_id: row?.sub_category_id ?? initial?.sub_category_id ?? "",
    account_id: row?.account_id ?? "",
    account_type: row?.account_type ?? "business",
    note: row?.note ?? "",
    internal_review_status: row?.internal_review_status ?? "unreviewed",
    accountant_status: row?.accountant_status ?? "not_reviewed",
    accountant_note: row?.accountant_note ?? "",
    attachment_status: row?.attachment_status ?? "not_attached",
    transaction_type: initialTxnType,
    accounting_status: row?.accounting_status ?? (initialTxnType ? "classified" : "unclassified"),
    business_relation: row?.business_relation ?? (initialTxnType ? (defaultBusinessRelation(initialTxnType) ?? "unclassified") : "unclassified"),
    internal_note: row?.internal_note ?? "",
    purchase_invoice_id: row?.purchase_invoice_id ?? "",
    payment_type: row?.payment_type ?? "",
    related_transaction_id: row?.related_transaction_id ?? "",
    customer_id: row?.customer_id ?? "",
    sales_invoice_id: row?.sales_invoice_id ?? "",
    payment_provider_id: row?.payment_provider_id ?? "",
    settlement_id: row?.settlement_id ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<any[]>([]);
  const [showReview, setShowReview] = useState(false);

  const subsForMain = f.main_category_id ? subs.filter((s: any) => s.parent_id === f.main_category_id) : [];

  useEffect(() => {
    (async () => {
      const [{ data: accs }, { data: invs }] = await Promise.all([
        supabase.from("finance_accounts").select("id, name").eq("is_active", true).order("name"),
        supabase.from("purchase_invoices").select("id, internal_reference, supplier_invoice_number, supplier_id, total_amount, issue_date").order("issue_date", { ascending: false }).limit(200),
      ]);
      setAccounts(accs ?? []);
      setPurchaseInvoices(invs ?? []);
    })();
  }, []);

  const t = f.transaction_type;
  const showPurchaseInvoice = t === "supplier_invoice_payment";
  const showPaymentType = t !== "" && t !== "internal_transfer_out" && t !== "owner_withdrawal" && t !== "owner_reimbursement";
  const showRelated = t === "internal_transfer_out" || t === "owner_withdrawal" || t === "owner_reimbursement";
  const showCustomerRefund = t === "customer_refund";

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
      const accStatus = txnType
        ? (f.accounting_status === "unclassified" ? "classified" : f.accounting_status)
        : "unclassified";
      const willHaveAttachment = isNew ? pending.length > 0 : f.attachment_status === "attached";
      const attStatus = willHaveAttachment
        ? "attached"
        : (f.attachment_status === "not_required" ? "not_required" : "not_attached");

      const base: any = {
        expense_date: f.expense_date,
        amount: Number(f.amount),
        item_name: f.item_name,
        supplier_id: f.supplier_id || null,
        supplier_name: f.supplier_name || null,
        main_category_id: f.main_category_id || null,
        sub_category_id: f.sub_category_id || null,
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
        purchase_invoice_id: showPurchaseInvoice && f.purchase_invoice_id ? Number(f.purchase_invoice_id) : null,
        payment_type: showPaymentType ? (f.payment_type || null) : null,
        related_transaction_id: showRelated ? (f.related_transaction_id || null) : null,
        customer_id: showCustomerRefund ? (f.customer_id || null) : null,
        sales_invoice_id: showCustomerRefund && f.sales_invoice_id ? Number(f.sales_invoice_id) : null,
        payment_provider_id: f.payment_provider_id || null,
        settlement_id: f.settlement_id || null,
      };

      if (isNew) {
        const { data: inserted, error } = await supabase.from("finance_expenses").insert({
          ...base,
          month: f.expense_date.slice(0, 7),
          created_by: u.user?.id ?? null,
        }).select("id").single();
        if (error) throw error;
        if (pending.length > 0 && inserted?.id) {
          const { failed } = await uploadPendingAttachments("expense", inserted.id, pending);
          if (failed > 0) toast.warning(`تم الحفظ، تعذر رفع ${failed} مرفق.`);
          else toast.success("تم إنشاء العملية مع المرفقات");
        } else toast.success("تم إنشاء العملية");
      } else {
        const patch: any = accountantOnly
          ? {
              main_category_id: f.main_category_id || null,
              sub_category_id: f.sub_category_id || null,
              accountant_status: f.accountant_status,
              accountant_note: f.accountant_note || null,
            }
          : base;
        const { error } = await supabase.from("finance_expenses").update(patch).eq("id", row.id);
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
          <div className="font-semibold">{isNew ? "إضافة مدفوع" : "تفاصيل عملية المدفوع"}</div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-4">
          {row?.deleted_at && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-[11px] p-2">
              عملية مؤرشفة بتاريخ {new Date(row.deleted_at).toLocaleString("en-US")}{row.delete_reason ? ` · السبب: ${row.delete_reason}` : ""}
            </div>
          )}
          {ownerDrawCatId && f.main_category_id === ownerDrawCatId && (
            <div className="rounded-lg border border-gold/40 bg-gold/10 text-gold text-[11px] p-2 flex items-start gap-2">
              <Wallet size={13} className="mt-0.5" />
              <div>هذه العملية مصنّفة كـ <b>توزيع أرباح</b> ولن تُحتسب ضمن مصروفات التشغيل في الداشبورد.</div>
            </div>
          )}

          {/* Section 1: Movement */}
          <SectionCard title="بيانات الحركة">
            <div className="grid grid-cols-2 gap-3">
              <Field label="التاريخ"><input type="date" disabled={accountantOnly} value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} className="inp" /></Field>
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
              <Field label="البيان / الشيء المشترى" wide><input disabled={accountantOnly} value={f.item_name} onChange={(e) => setF({ ...f, item_name: e.target.value })} className="inp" /></Field>
              <Field label="نوع الحركة">
                <select disabled={accountantOnly} value={f.transaction_type} onChange={(e) => setType(e.target.value)} className="inp">
                  <option value="">— اختر —</option>
                  {OUTGOING_TYPES.map((tt) => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
                </select>
              </Field>
              <Field label="علاقة العملية بالنشاط">
                <select disabled={accountantOnly} value={f.business_relation} onChange={(e) => setF({ ...f, business_relation: e.target.value })} className="inp">
                  {BUSINESS_RELATIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </Field>
              <Field label="المورد">
                <select disabled={accountantOnly} value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })} className="inp">
                  <option value="">— بدون —</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="اسم مورد حر (إن لم يوجد)"><input disabled={accountantOnly} value={f.supplier_name} onChange={(e) => setF({ ...f, supplier_name: e.target.value })} className="inp" /></Field>
              <Field label="الملاحظة" wide><textarea disabled={accountantOnly} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className="inp min-h-[50px]" /></Field>
            </div>

            {isNew && roles.canManage && (
              <div className="mt-3"><PendingAttachmentsPicker items={pending} setItems={setPending} /></div>
            )}
            {!isNew && (
              <div className="mt-3"><AttachmentsPanel relatedType="expense" relatedId={row.id} canManage={roles.canManage} linkedRefs={row.purchase_invoice_id ? [{ relatedType: "purchase_invoice", relatedId: String(row.purchase_invoice_id) }] : []} /></div>
            )}
          </SectionCard>

          {/* Section 2: Classification + Link */}
          <SectionCard title="التصنيف والربط">
            <div className="grid grid-cols-2 gap-3">
              <Field label="التصنيف الرئيسي">
                <select value={f.main_category_id} onChange={(e) => setF({ ...f, main_category_id: e.target.value, sub_category_id: "" })} className="inp">
                  <option value="">—</option>
                  {mains.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="التصنيف الفرعي">
                <select value={f.sub_category_id} onChange={(e) => setF({ ...f, sub_category_id: e.target.value })} className="inp" disabled={!f.main_category_id}>
                  <option value="">—</option>
                  {subsForMain.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              {showPurchaseInvoice && (
                <Field label="فاتورة المشتريات" wide>
                  <select disabled={accountantOnly} value={f.purchase_invoice_id} onChange={(e) => {
                    const inv = purchaseInvoices.find((x) => String(x.id) === e.target.value);
                    setF({ ...f, purchase_invoice_id: e.target.value, supplier_id: inv?.supplier_id ?? f.supplier_id });
                  }} className="inp">
                    <option value="">— اختر فاتورة —</option>
                    {purchaseInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.internal_reference || inv.supplier_invoice_number || `#${inv.id}`} — {fmtSAR(inv.total_amount)} ({inv.issue_date})
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {showPaymentType && (
                <Field label="طريقة الدفع">
                  <select disabled={accountantOnly} value={f.payment_type} onChange={(e) => setF({ ...f, payment_type: e.target.value })} className="inp">
                    <option value="">—</option>
                    {PAYMENT_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
              )}
              {showRelated && (
                <Field label={t === "owner_withdrawal" ? "حركة المالك المرتبطة (UUID)" : "التحويل المرتبط (UUID)"} wide>
                  <input disabled={accountantOnly} value={f.related_transaction_id} onChange={(e) => setF({ ...f, related_transaction_id: e.target.value })} className="inp ltr" placeholder="معرف الحركة المقابلة" />
                </Field>
              )}
            </div>
          </SectionCard>

          {/* Section 3: Review (collapsible) */}
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

          {!isNew && <AuditPanel relatedType="finance_expenses" relatedId={row.id} />}
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

function Field({ label, children, wide }: any) {
  return <label className={`block ${wide ? "col-span-2" : ""}`}><div className="text-[11px] text-muted-foreground mb-1">{label}</div>{children}</label>;
}
