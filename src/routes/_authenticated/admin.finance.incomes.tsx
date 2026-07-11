import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { ACCOUNT_TYPES, ACCOUNTANT_STATUS, ATTACHMENT_STATUS, INTERNAL_REVIEW, fmtSAR, labelOf, toneOf } from "@/lib/finance/constants";
import { INCOMING_TYPES, ACCOUNTING_STATUSES, incomingLabel, accountingStatusLabel, defaultBusinessRelation } from "@/lib/finance/transaction-types";

const BUSINESS_RELATIONS: { value: string; label: string }[] = [
  { value: "business", label: "تخص النشاط" },
  { value: "personal", label: "شخصية" },
  { value: "owner_settlement", label: "تسوية مالك" },
  { value: "internal_transfer", label: "تحويل داخلي" },
  { value: "unclassified", label: "غير محددة" },
];
import { Plus, Search, X, Pencil, Trash2, RotateCcw, Archive, Tag } from "lucide-react";
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

function IncomesPage() {
  const roles = useFinanceRoles();
  const [rows, setRows] = useState<Income[]>([]);
  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Income | null>(null);
  const [creating, setCreating] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const [q, setQ] = useState("");
  const [fMonth, setFMonth] = useState("");
  const [fSource, setFSource] = useState("");
  const [fAccount, setFAccount] = useState("");
  const [fInternal, setFInternal] = useState("");
  const [fAcct, setFAcct] = useState("");
  const [fAtt, setFAtt] = useState("");
  const [fTxnType, setFTxnType] = useState("");
  const [fAccStatus, setFAccStatus] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: incs }, { data: srcs }] = await Promise.all([
      supabase.from("finance_incomes").select("*").order("income_date", { ascending: false }),
      supabase.from("finance_income_sources").select("id, name").eq("is_active", true).order("display_order"),
    ]);
    setRows(incs ?? []);
    setSources(srcs ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const sourceName = (id: string | null) => sources.find((s) => s.id === id)?.name ?? "—";
  const filtered = useMemo(() => rows.filter((r) => {
    if (!showDeleted && r.deleted_at) return false;
    if (showDeleted && !r.deleted_at) return false;
    if (q && !(r.note ?? "").toLowerCase().includes(q.toLowerCase()) && !sourceName(r.income_source_id).toLowerCase().includes(q.toLowerCase())) return false;
    if (fMonth && r.month !== fMonth) return false;
    if (fSource && r.income_source_id !== fSource) return false;
    if (fAccount && r.account_type !== fAccount) return false;
    if (fInternal && r.internal_review_status !== fInternal) return false;
    if (fAcct && r.accountant_status !== fAcct) return false;
    if (fAtt && r.attachment_status !== fAtt) return false;
    if (fTxnType && r.transaction_type !== fTxnType) return false;
    if (fAccStatus && (r.accounting_status ?? "unclassified") !== fAccStatus) return false;
    return true;
  }), [rows, q, fMonth, fSource, fAccount, fInternal, fAcct, fAtt, fTxnType, fAccStatus, sources, showDeleted]);

  const unclassifiedCount = useMemo(
    () => rows.filter((r) => !r.deleted_at && (r.accounting_status ?? "unclassified") === "unclassified").length,
    [rows],
  );

  const months = useMemo(() => Array.from(new Set(rows.map((r) => r.month).filter(Boolean))).sort().reverse(), [rows]);
  const total = filtered.reduce((a, b) => a + Number(b.amount ?? 0), 0);
  const deletedCount = rows.filter((r) => r.deleted_at).length;

  const softDelete = async (r: Income) => {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">المقبوضات {showDeleted && <span className="text-amber-300 text-[12px]">(المؤرشفة)</span>}</h2>
        <div className="flex items-center gap-2">
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
        <Select v={fSource} onChange={setFSource} ph="مصدر الدخل" opts={sources.map((s) => ({ value: s.id, label: s.name }))} />
        <Select v={fTxnType} onChange={setFTxnType} ph="نوع الحركة" opts={INCOMING_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
        <Select v={fAccStatus} onChange={setFAccStatus} ph="حالة التصنيف" opts={ACCOUNTING_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
        <Select v={fAccount} onChange={setFAccount} ph="نوع الحساب" opts={ACCOUNT_TYPES.map((a) => ({ value: a.value, label: a.label }))} />
        <Select v={fInternal} onChange={setFInternal} ph="مراجعة داخلية" opts={INTERNAL_REVIEW.map((a) => ({ value: a.value, label: a.label }))} />
        <Select v={fAcct} onChange={setFAcct} ph="حالة المحاسب" opts={ACCOUNTANT_STATUS.map((a) => ({ value: a.value, label: a.label }))} />
        <Select v={fAtt} onChange={setFAtt} ph="حالة المرفق" opts={ATTACHMENT_STATUS.map((a) => ({ value: a.value, label: a.label }))} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-[12px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-start px-3 py-2">التاريخ</th>
              <th className="text-start px-3 py-2">المبلغ</th>
              <th className="text-start px-3 py-2">المصدر</th>
              <th className="text-start px-3 py-2">نوع الحركة</th>
              <th className="text-start px-3 py-2">الحساب</th>
              <th className="text-start px-3 py-2">داخلي</th>
              <th className="text-start px-3 py-2">المحاسب</th>
              <th className="text-start px-3 py-2">المرفق</th>
              <th className="text-start px-3 py-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={`border-t border-white/5 hover:bg-white/5 ${r.deleted_at ? "opacity-60" : ""}`}>
                <td className="px-3 py-2 whitespace-nowrap">{r.income_date}</td>
                <td className="px-3 py-2 font-mono">{fmtSAR(r.amount)}</td>
                <td className="px-3 py-2">{sourceName(r.income_source_id)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.transaction_type ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-white/10 bg-white/5">
                      {incomingLabel(r.transaction_type)}
                    </span>
                  ) : (
                    <span className="text-amber-300/80 text-[10px]">غير مصنف</span>
                  )}
                </td>
                <td className="px-3 py-2">{labelOf(ACCOUNT_TYPES, r.account_type)}</td>
                <td className="px-3 py-2">
                  <ReviewStatusEditor
                    table="finance_incomes"
                    rowId={r.id}
                    field="internal_review_status"
                    value={r.internal_review_status}
                    canEdit={roles.canManage && !r.deleted_at}
                    onChanged={(v) => setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, internal_review_status: v } : x))}
                  />
                </td>
                <td className="px-3 py-2">
                  <ReviewStatusEditor
                    table="finance_incomes"
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
                    relatedType="income"
                    relatedId={r.id}
                    status={r.attachment_status}
                    canManage={roles.canManage}
                    canDelete={roles.canManage}
                    onChanged={(s) => setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, attachment_status: s } : x))}
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
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">لا توجد بيانات</td></tr>
            )}
          </tbody>
          <tfoot className="bg-white/5 font-semibold">
            <tr><td className="px-3 py-2">الإجمالي</td><td className="px-3 py-2 font-mono">{fmtSAR(total)}</td><td colSpan={7}></td></tr>
          </tfoot>
        </table>
      </div>

      {(editing || creating) && (
        <IncomeDialog
          row={editing}
          sources={sources}
          roles={roles}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border whitespace-nowrap ${tone}`}>{children}</span>;
}
function Select({ v, onChange, ph, opts }: { v: string; onChange: (s: string) => void; ph: string; opts: { value: string; label: string }[] }) {
  return (
    <select value={v} onChange={(e) => onChange(e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-background/60 border border-white/10 text-[12px]">
      <option value="">{ph}</option>
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

const COLLECTION_TYPES = [
  { value: "invoice_collection", label: "تحصيل فاتورة" },
  { value: "cash_sale", label: "بيع نقدي" },
  { value: "advance_payment", label: "دفعة مقدمة" },
  { value: "other", label: "أخرى" },
];

function IncomeDialog({ row, sources, roles, onClose, onSaved }: any) {
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
              عملية مؤرشفة بتاريخ {new Date(row.deleted_at).toLocaleString("ar")}{row.delete_reason ? ` · السبب: ${row.delete_reason}` : ""}
            </div>
          )}

          {/* Section 1: Movement */}
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
                <select disabled={accountantOnly} value={f.transaction_type} onChange={(e) => setF({ ...f, transaction_type: e.target.value })} className="inp">
                  <option value="">— اختر —</option>
                  {INCOMING_TYPES.map((tt) => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
                </select>
              </Field>
              <Field label="المصدر">
                <select disabled={accountantOnly} value={f.income_source_id} onChange={(e) => setF({ ...f, income_source_id: e.target.value })} className="inp">
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
