import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { ACCOUNT_TYPES, ACCOUNTANT_STATUS, ATTACHMENT_STATUS, INTERNAL_REVIEW, fmtSAR, labelOf, toneOf } from "@/lib/finance/constants";
import { Plus, Search, X, Pencil, Trash2, RotateCcw, Archive } from "lucide-react";
import { toast } from "sonner";
import { AttachmentsPanel, PendingAttachmentsPicker, uploadPendingAttachments, type PendingAttachment } from "@/components/finance/AttachmentsPanel";
import { AuditPanel } from "@/components/finance/AuditPanel";

export const Route = createFileRoute("/_authenticated/admin/finance/expenses")({
  ssr: false,
  component: ExpensesPage,
});

function ExpensesPage() {
  const roles = useFinanceRoles();
  const [rows, setRows] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [mains, setMains] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const [q, setQ] = useState("");
  const [fMonth, setFMonth] = useState("");
  const [fSup, setFSup] = useState("");
  const [fMain, setFMain] = useState("");
  const [fSub, setFSub] = useState("");
  const [fAccount, setFAccount] = useState("");
  const [fInternal, setFInternal] = useState("");
  const [fAcct, setFAcct] = useState("");
  const [fAtt, setFAtt] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: exps }, { data: sups }, { data: cats }] = await Promise.all([
      supabase.from("finance_expenses").select("*").order("expense_date", { ascending: false }),
      supabase.from("finance_suppliers").select("id, name").eq("is_active", true).order("name"),
      supabase.from("finance_categories").select("*").eq("is_active", true).order("display_order"),
    ]);
    setRows(exps ?? []);
    setSuppliers(sups ?? []);
    setMains((cats ?? []).filter((c: any) => c.kind === "main"));
    setSubs((cats ?? []).filter((c: any) => c.kind === "sub"));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const supName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "—";
  const catName = (id: string | null) => [...mains, ...subs].find((c) => c.id === id)?.name ?? "—";

  const filtered = useMemo(() => rows.filter((r) => {
    if (!showDeleted && r.deleted_at) return false;
    if (showDeleted && !r.deleted_at) return false;
    if (q && !(r.item_name ?? "").toLowerCase().includes(q.toLowerCase()) && !(r.supplier_name ?? "").toLowerCase().includes(q.toLowerCase())) return false;
    if (fMonth && r.month !== fMonth) return false;
    if (fSup && r.supplier_id !== fSup) return false;
    if (fMain && r.main_category_id !== fMain) return false;
    if (fSub && r.sub_category_id !== fSub) return false;
    if (fAccount && r.account_type !== fAccount) return false;
    if (fInternal && r.internal_review_status !== fInternal) return false;
    if (fAcct && r.accountant_status !== fAcct) return false;
    if (fAtt && r.attachment_status !== fAtt) return false;
    return true;
  }), [rows, q, fMonth, fSup, fMain, fSub, fAccount, fInternal, fAcct, fAtt, showDeleted]);

  const months = useMemo(() => Array.from(new Set(rows.map((r) => r.month).filter(Boolean))).sort().reverse(), [rows]);
  const total = filtered.reduce((a, b) => a + Number(b.amount ?? 0), 0);
  const subsForMain = fMain ? subs.filter((s) => s.parent_id === fMain) : subs;
  const deletedCount = rows.filter((r) => r.deleted_at).length;

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
        <h2 className="text-base font-semibold">المصروفات {showDeleted && <span className="text-amber-300 text-[12px]">(المؤرشفة)</span>}</h2>
        <div className="flex items-center gap-2">
          {roles.canManage && deletedCount > 0 && (
            <button onClick={() => setShowDeleted(!showDeleted)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] ${showDeleted ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>
              <Archive size={13} /> {showDeleted ? "إخفاء المؤرشفة" : `عرض المؤرشفة (${deletedCount})`}
            </button>
          )}
          {roles.canManage && (
            <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[12px] hover:bg-gold/25">
              <Plus size={14} /> إضافة مصروف
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-2">
        <label className="relative col-span-2 md:col-span-2">
          <Search size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث…" className="w-full pr-7 pl-2 py-1.5 rounded-lg bg-background/60 border border-white/10 text-[12px]" />
        </label>
        <Select v={fMonth} onChange={setFMonth} ph="الشهر" opts={months.map((m) => ({ value: m, label: m }))} />
        <Select v={fSup} onChange={setFSup} ph="المورد" opts={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        <Select v={fMain} onChange={(v) => { setFMain(v); setFSub(""); }} ph="تصنيف رئيسي" opts={mains.map((c) => ({ value: c.id, label: c.name }))} />
        <Select v={fSub} onChange={setFSub} ph="تصنيف فرعي" opts={subsForMain.map((c) => ({ value: c.id, label: c.name }))} />
        <Select v={fAccount} onChange={setFAccount} ph="نوع الحساب" opts={ACCOUNT_TYPES.map((a) => ({ value: a.value, label: a.label }))} />
        <Select v={fInternal} onChange={setFInternal} ph="داخلي" opts={INTERNAL_REVIEW.map((a) => ({ value: a.value, label: a.label }))} />
        <Select v={fAcct} onChange={setFAcct} ph="المحاسب" opts={ACCOUNTANT_STATUS.map((a) => ({ value: a.value, label: a.label }))} />
        <Select v={fAtt} onChange={setFAtt} ph="المرفق" opts={ATTACHMENT_STATUS.map((a) => ({ value: a.value, label: a.label }))} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-[12px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-start px-3 py-2">التاريخ</th>
              <th className="text-start px-3 py-2">المبلغ</th>
              <th className="text-start px-3 py-2">البيان</th>
              <th className="text-start px-3 py-2">المورد</th>
              <th className="text-start px-3 py-2">رئيسي</th>
              <th className="text-start px-3 py-2">فرعي</th>
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
                <td className="px-3 py-2 max-w-[180px] truncate" title={r.item_name}>{r.item_name}</td>
                <td className="px-3 py-2">{supName(r.supplier_id) !== "—" ? supName(r.supplier_id) : r.supplier_name || "—"}</td>
                <td className="px-3 py-2">{catName(r.main_category_id)}</td>
                <td className="px-3 py-2">{catName(r.sub_category_id)}</td>
                <td className="px-3 py-2"><Badge tone={toneOf(INTERNAL_REVIEW, r.internal_review_status)}>{labelOf(INTERNAL_REVIEW, r.internal_review_status)}</Badge></td>
                <td className="px-3 py-2"><Badge tone={toneOf(ACCOUNTANT_STATUS, r.accountant_status)}>{labelOf(ACCOUNTANT_STATUS, r.accountant_status)}</Badge></td>
                <td className="px-3 py-2"><Badge tone={toneOf(ATTACHMENT_STATUS, r.attachment_status)}>{labelOf(ATTACHMENT_STATUS, r.attachment_status)}</Badge></td>
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
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">لا توجد بيانات</td></tr>
            )}
          </tbody>
          <tfoot className="bg-white/5 font-semibold">
            <tr><td className="px-3 py-2">الإجمالي</td><td className="px-3 py-2 font-mono">{fmtSAR(total)}</td><td colSpan={8}></td></tr>
          </tfoot>
        </table>
      </div>

      {(editing || creating) && (
        <ExpenseDialog row={editing} suppliers={suppliers} mains={mains} subs={subs} roles={roles}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
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

function ExpenseDialog({ row, suppliers, mains, subs, roles, onClose, onSaved }: any) {
  const isNew = !row;
  const accountantOnly = !roles.canManage && roles.canAccountant;
  const [f, setF] = useState({
    expense_date: row?.expense_date ?? new Date().toISOString().slice(0, 10),
    amount: row?.amount ?? 0,
    item_name: row?.item_name ?? "",
    supplier_id: row?.supplier_id ?? "",
    supplier_name: row?.supplier_name ?? "",
    main_category_id: row?.main_category_id ?? "",
    sub_category_id: row?.sub_category_id ?? "",
    account_type: row?.account_type ?? "business",
    note: row?.note ?? "",
    internal_review_status: row?.internal_review_status ?? "unreviewed",
    accountant_status: row?.accountant_status ?? "not_reviewed",
    accountant_note: row?.accountant_note ?? "",
    attachment_status: row?.attachment_status ?? "not_attached",
  });
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const subsForMain = f.main_category_id ? subs.filter((s: any) => s.parent_id === f.main_category_id) : [];

  const save = async () => {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (isNew) {
        const status = pending.length > 0 ? "attached" : f.attachment_status;
        const { data: inserted, error } = await supabase.from("finance_expenses").insert({
          ...f,
          attachment_status: status,
          amount: Number(f.amount),
          supplier_id: f.supplier_id || null,
          main_category_id: f.main_category_id || null,
          sub_category_id: f.sub_category_id || null,
          month: f.expense_date.slice(0, 7),
          created_by: u.user?.id ?? null,
        }).select("id").single();
        if (error) throw error;
        if (pending.length > 0 && inserted?.id) {
          const { failed } = await uploadPendingAttachments("expense", inserted.id, pending);
          if (failed > 0) {
            toast.warning(`تم حفظ العملية، لكن تعذر رفع ${failed} مرفق. يمكنك رفعها من تفاصيل العملية.`);
          } else {
            toast.success("تم إنشاء العملية مع المرفقات");
          }
        } else {
          toast.success("تم إنشاء العملية");
        }
      } else {
        const patch: any = accountantOnly
          ? {
              main_category_id: f.main_category_id || null,
              sub_category_id: f.sub_category_id || null,
              accountant_status: f.accountant_status,
              accountant_note: f.accountant_note,
            }
          : { ...f, amount: Number(f.amount), supplier_id: f.supplier_id || null, main_category_id: f.main_category_id || null, sub_category_id: f.sub_category_id || null };
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
          <div className="font-semibold">{isNew ? "إضافة مصروف" : "تفاصيل المصروف"}</div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          {row?.deleted_at && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-[11px] p-2">
              عملية مؤرشفة بتاريخ {new Date(row.deleted_at).toLocaleString("ar")}{row.delete_reason ? ` · السبب: ${row.delete_reason}` : ""}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="التاريخ"><input type="date" disabled={accountantOnly} value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} className="inp" /></Field>
            <Field label="المبلغ"><input type="number" step="0.01" disabled={accountantOnly} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value as any })} className="inp" /></Field>
            <Field label="البيان / الشيء المشترى" wide><input disabled={accountantOnly} value={f.item_name} onChange={(e) => setF({ ...f, item_name: e.target.value })} className="inp" /></Field>
            <Field label="المورد">
              <select disabled={accountantOnly} value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })} className="inp">
                <option value="">— بدون —</option>
                {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="اسم مورد حر (إذا غير موجود)"><input disabled={accountantOnly} value={f.supplier_name} onChange={(e) => setF({ ...f, supplier_name: e.target.value })} className="inp" /></Field>
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
            <Field label="نوع الحساب">
              <select disabled={accountantOnly} value={f.account_type} onChange={(e) => setF({ ...f, account_type: e.target.value })} className="inp">
                {ACCOUNT_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </Field>
            <Field label="مراجعة داخلية">
              <select disabled={accountantOnly} value={f.internal_review_status} onChange={(e) => setF({ ...f, internal_review_status: e.target.value })} className="inp">
                {INTERNAL_REVIEW.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </Field>
            <Field label="حالة المحاسب">
              <select value={f.accountant_status} onChange={(e) => setF({ ...f, accountant_status: e.target.value })} className="inp">
                {ACCOUNTANT_STATUS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </Field>
            <Field label="حالة المرفق">
              <select disabled={accountantOnly} value={f.attachment_status} onChange={(e) => setF({ ...f, attachment_status: e.target.value })} className="inp">
                {ATTACHMENT_STATUS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="الملاحظة"><textarea disabled={accountantOnly} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className="inp min-h-[60px]" /></Field>
          <Field label="ملاحظة المحاسب"><textarea value={f.accountant_note} onChange={(e) => setF({ ...f, accountant_note: e.target.value })} className="inp min-h-[60px]" /></Field>

          {isNew && roles.canManage && (
            <PendingAttachmentsPicker items={pending} setItems={setPending} />
          )}

          {!isNew && (
            <>
              <AttachmentsPanel relatedType="expense" relatedId={row.id} canManage={roles.canManage} />
              <AuditPanel relatedType="finance_expenses" relatedId={row.id} />
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-white/10">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px] bg-white/5 hover:bg-white/10">إلغاء</button>
          <button disabled={saving} onClick={save} className="px-4 py-1.5 rounded-lg text-[12px] bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30 disabled:opacity-50">{saving ? "..." : "حفظ"}</button>
        </div>
        <style>{`.inp { width:100%; padding:8px 10px; border-radius:8px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); font-size:12px; } .inp:disabled{opacity:.6}`}</style>
      </div>
    </div>
  );
}
function Field({ label, children, wide }: any) {
  return <label className={`block ${wide ? "col-span-2" : ""}`}><div className="text-[11px] text-muted-foreground mb-1">{label}</div>{children}</label>;
}
