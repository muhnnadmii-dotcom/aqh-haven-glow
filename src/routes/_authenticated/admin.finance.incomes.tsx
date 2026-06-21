import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { ACCOUNT_TYPES, ACCOUNTANT_STATUS, ATTACHMENT_STATUS, INTERNAL_REVIEW, fmtSAR, labelOf, toneOf } from "@/lib/finance/constants";
import { Plus, Search, X, Paperclip, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AttachmentsPanel } from "@/components/finance/AttachmentsPanel";
import { AuditPanel } from "@/components/finance/AuditPanel";

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

  // filters
  const [q, setQ] = useState("");
  const [fMonth, setFMonth] = useState("");
  const [fSource, setFSource] = useState("");
  const [fAccount, setFAccount] = useState("");
  const [fInternal, setFInternal] = useState("");
  const [fAcct, setFAcct] = useState("");
  const [fAtt, setFAtt] = useState("");

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
    if (q && !(r.note ?? "").toLowerCase().includes(q.toLowerCase()) && !sourceName(r.income_source_id).toLowerCase().includes(q.toLowerCase())) return false;
    if (fMonth && r.month !== fMonth) return false;
    if (fSource && r.income_source_id !== fSource) return false;
    if (fAccount && r.account_type !== fAccount) return false;
    if (fInternal && r.internal_review_status !== fInternal) return false;
    if (fAcct && r.accountant_status !== fAcct) return false;
    if (fAtt && r.attachment_status !== fAtt) return false;
    return true;
  }), [rows, q, fMonth, fSource, fAccount, fInternal, fAcct, fAtt, sources]);

  const months = useMemo(() => Array.from(new Set(rows.map((r) => r.month).filter(Boolean))).sort().reverse(), [rows]);

  const total = filtered.reduce((a, b) => a + Number(b.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">الدخل / التحصيلات</h2>
        {roles.canManage && (
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[12px] hover:bg-gold/25">
            <Plus size={14} /> إضافة دخل
          </button>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <label className="relative col-span-2 md:col-span-2">
          <Search size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث…" className="w-full pr-7 pl-2 py-1.5 rounded-lg bg-background/60 border border-white/10 text-[12px]" />
        </label>
        <Select v={fMonth} onChange={setFMonth} ph="الشهر" opts={months.map((m) => ({ value: m, label: m }))} />
        <Select v={fSource} onChange={setFSource} ph="مصدر الدخل" opts={sources.map((s) => ({ value: s.id, label: s.name }))} />
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
              <th className="text-start px-3 py-2">الحساب</th>
              <th className="text-start px-3 py-2">داخلي</th>
              <th className="text-start px-3 py-2">المحاسب</th>
              <th className="text-start px-3 py-2">المرفق</th>
              <th className="text-start px-3 py-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-3 py-2 whitespace-nowrap">{r.income_date}</td>
                <td className="px-3 py-2 font-mono">{fmtSAR(r.amount)}</td>
                <td className="px-3 py-2">{sourceName(r.income_source_id)}</td>
                <td className="px-3 py-2">{labelOf(ACCOUNT_TYPES, r.account_type)}</td>
                <td className="px-3 py-2"><Badge tone={toneOf(INTERNAL_REVIEW, r.internal_review_status)}>{labelOf(INTERNAL_REVIEW, r.internal_review_status)}</Badge></td>
                <td className="px-3 py-2"><Badge tone={toneOf(ACCOUNTANT_STATUS, r.accountant_status)}>{labelOf(ACCOUNTANT_STATUS, r.accountant_status)}</Badge></td>
                <td className="px-3 py-2"><Badge tone={toneOf(ATTACHMENT_STATUS, r.attachment_status)}>{labelOf(ATTACHMENT_STATUS, r.attachment_status)}</Badge></td>
                <td className="px-3 py-2">
                  <button onClick={() => setEditing(r)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px]">
                    <Pencil size={11} /> فتح
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">لا توجد بيانات</td></tr>
            )}
          </tbody>
          <tfoot className="bg-white/5 font-semibold">
            <tr><td className="px-3 py-2">الإجمالي</td><td className="px-3 py-2 font-mono">{fmtSAR(total)}</td><td colSpan={6}></td></tr>
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

function IncomeDialog({ row, sources, roles, onClose, onSaved }: any) {
  const isNew = !row;
  const accountantOnly = !roles.canManage && roles.canAccountant;
  const [f, setF] = useState({
    income_date: row?.income_date ?? new Date().toISOString().slice(0, 10),
    amount: row?.amount ?? 0,
    income_source_id: row?.income_source_id ?? "",
    account_type: row?.account_type ?? "business",
    note: row?.note ?? "",
    internal_review_status: row?.internal_review_status ?? "unreviewed",
    accountant_status: row?.accountant_status ?? "not_reviewed",
    accountant_note: row?.accountant_note ?? "",
    attachment_status: row?.attachment_status ?? "not_attached",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (isNew) {
        const { error } = await supabase.from("finance_incomes").insert({
          ...f,
          amount: Number(f.amount),
          income_source_id: f.income_source_id || null,
          month: f.income_date.slice(0, 7),
          created_by: u.user?.id ?? null,
        });
        if (error) throw error;
        toast.success("تم إنشاء العملية");
      } else {
        const patch: any = accountantOnly
          ? { accountant_status: f.accountant_status, accountant_note: f.accountant_note }
          : { ...f, amount: Number(f.amount), income_source_id: f.income_source_id || null };
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
          <div className="font-semibold">{isNew ? "إضافة دخل" : "تفاصيل عملية الدخل"}</div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="التاريخ"><input type="date" disabled={accountantOnly} value={f.income_date} onChange={(e) => setF({ ...f, income_date: e.target.value })} className="inp" /></Field>
            <Field label="المبلغ"><input type="number" step="0.01" disabled={accountantOnly} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value as any })} className="inp" /></Field>
            <Field label="مصدر الدخل">
              <select disabled={accountantOnly} value={f.income_source_id} onChange={(e) => setF({ ...f, income_source_id: e.target.value })} className="inp">
                <option value="">—</option>
                {sources.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
            <Field label="حالة المرفق" wide>
              <select disabled={accountantOnly} value={f.attachment_status} onChange={(e) => setF({ ...f, attachment_status: e.target.value })} className="inp">
                {ATTACHMENT_STATUS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="الملاحظة"><textarea disabled={accountantOnly} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className="inp min-h-[60px]" /></Field>
          <Field label="ملاحظة المحاسب"><textarea value={f.accountant_note} onChange={(e) => setF({ ...f, accountant_note: e.target.value })} className="inp min-h-[60px]" /></Field>

          {!isNew && (
            <>
              <AttachmentsPanel relatedType="income" relatedId={row.id} canManage={roles.canManage} />
              <AuditPanel relatedType="finance_incomes" relatedId={row.id} />
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

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "col-span-2" : ""}`}>
      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
