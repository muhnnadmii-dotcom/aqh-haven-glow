import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { Plus, X, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/finance/settlements")({
  ssr: false,
  component: SettlementsPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة",
  imported: "مستوردة",
  under_review: "قيد المراجعة",
  matched: "مطابقة",
  partially_matched: "مطابقة جزئية",
  awaiting_payout: "بانتظار التحويل",
  paid: "محوّلة",
  cancelled: "ملغاة",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "text-muted-foreground",
  imported: "text-blue-400",
  under_review: "text-amber-400",
  matched: "text-emerald-400",
  partially_matched: "text-amber-400",
  awaiting_payout: "text-orange-400",
  paid: "text-emerald-400",
  cancelled: "text-red-400",
};

function SettlementsPage() {
  const roles = useFinanceRoles();
  const [rows, setRows] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [filterProvider, setFilterProvider] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const [s, p] = await Promise.all([
      supabase.from("payment_settlements" as any).select("*").order("settlement_date", { ascending: false }),
      supabase.from("payment_providers" as any).select("*").eq("is_active", true).order("name"),
    ]);
    if (s.error) toast.error(s.error.message); else setRows(s.data ?? []);
    setProviders(p.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (filterProvider && r.provider_id !== filterProvider) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    return true;
  }), [rows, filterProvider, filterStatus]);

  const providerName = (id: string) => providers.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">التسويات</h2>
          <p className="text-[11px] text-muted-foreground mt-1">قائمة تسويات بوابات الدفع مع الصافي المتوقع والفعلي والفرق عن الحوالة البنكية.</p>
        </div>
        {roles.canManage && (
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[12px] hover:bg-gold/25">
            <Plus size={14} /> تسوية جديدة
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
          <option value="">كل البوابات</option>
          {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-[12px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-start px-3 py-2">التاريخ</th>
              <th className="text-start px-3 py-2">البوابة</th>
              <th className="text-start px-3 py-2">المرجع</th>
              <th className="text-start px-3 py-2">إجمالي المبيعات</th>
              <th className="text-start px-3 py-2">الرسوم + ضريبتها</th>
              <th className="text-start px-3 py-2">صافي متوقع</th>
              <th className="text-start px-3 py-2">فعلي</th>
              <th className="text-start px-3 py-2">الفرق</th>
              <th className="text-start px-3 py-2">الحالة</th>
              <th className="text-start px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">لا توجد تسويات</td></tr>
            )}
            {filtered.map((r) => {
              const feesTotal = Number(r.fees_before_vat) + Number(r.fees_vat_amount) + Number(r.payout_fee);
              const diff = Number(r.difference_amount);
              return (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-3 py-2">{r.settlement_date}</td>
                  <td className="px-3 py-2">{providerName(r.provider_id)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.settlement_reference ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{Number(r.gross_sales_amount).toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums">{feesTotal.toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums">{Number(r.expected_net_amount).toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums">{r.actual_bank_amount != null ? Number(r.actual_bank_amount).toFixed(2) : "—"}</td>
                  <td className={`px-3 py-2 tabular-nums ${Math.abs(diff) > 0.05 ? "text-red-400" : "text-emerald-400"}`}>{diff.toFixed(2)}</td>
                  <td className={`px-3 py-2 ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status]}</td>
                  <td className="px-3 py-2">
                    <Link to="/admin/finance/settlements/$id" params={{ id: r.id }} className="inline-flex items-center gap-1 text-gold hover:underline">
                      تفاصيل <ChevronLeft size={12} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {creating && (
        <SettlementForm
          providers={providers}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

function SettlementForm({ providers, onClose, onSaved }: { providers: any[]; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    provider_id: providers[0]?.id ?? "",
    settlement_reference: "",
    settlement_date: new Date().toISOString().slice(0, 10),
    period_start: "",
    period_end: "",
    gross_sales_amount: "0",
    refunds_amount: "0",
    fees_before_vat: "0",
    fees_vat_amount: "0",
    payout_fee: "0",
    other_deductions: "0",
    reserve_held: "0",
    reserve_released: "0",
    actual_bank_amount: "",
    status: "draft",
    notes: "",
  });

  const preview = useMemo(() => {
    const n = (k: keyof typeof form) => Number(form[k]) || 0;
    const expected = n("gross_sales_amount") - n("refunds_amount") - n("fees_before_vat") - n("fees_vat_amount") - n("payout_fee") - n("other_deductions") - n("reserve_held") + n("reserve_released");
    const actual = form.actual_bank_amount === "" ? null : Number(form.actual_bank_amount);
    const diff = actual == null ? 0 : actual - expected;
    return { expected, diff };
  }, [form]);

  const save = async () => {
    if (!form.provider_id) { toast.error("اختر البوابة"); return; }
    setSaving(true);
    const payload: any = {
      provider_id: form.provider_id,
      settlement_reference: form.settlement_reference || null,
      settlement_date: form.settlement_date,
      period_start: form.period_start || null,
      period_end: form.period_end || null,
      gross_sales_amount: Number(form.gross_sales_amount) || 0,
      refunds_amount: Number(form.refunds_amount) || 0,
      fees_before_vat: Number(form.fees_before_vat) || 0,
      fees_vat_amount: Number(form.fees_vat_amount) || 0,
      payout_fee: Number(form.payout_fee) || 0,
      other_deductions: Number(form.other_deductions) || 0,
      reserve_held: Number(form.reserve_held) || 0,
      reserve_released: Number(form.reserve_released) || 0,
      actual_bank_amount: form.actual_bank_amount === "" ? null : Number(form.actual_bank_amount),
      status: form.status,
      notes: form.notes || null,
    };
    const { error } = await supabase.from("payment_settlements" as any).insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("تم إنشاء التسوية"); onSaved(); }
  };

  const field = (k: keyof typeof form, label: string, type = "number") => (
    <label className="block text-[11px]">{label}
      <input type={type} step="0.01" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px] tabular-nums" />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-[#0b1220] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">تسوية جديدة (إدخال يدوي)</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[11px]">البوابة
            <select value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block text-[11px]">مرجع التسوية
            <input value={form.settlement_reference} onChange={(e) => setForm({ ...form, settlement_reference: e.target.value })} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]" />
          </label>
          {field("settlement_date", "تاريخ التسوية", "date")}
          <label className="block text-[11px]">الحالة
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          {field("period_start", "بداية الفترة", "date")}
          {field("period_end", "نهاية الفترة", "date")}
        </div>

        <div className="pt-2 border-t border-white/5">
          <div className="text-[11px] text-muted-foreground mb-2">أرقام التسوية</div>
          <div className="grid grid-cols-2 gap-3">
            {field("gross_sales_amount", "إجمالي المبيعات")}
            {field("refunds_amount", "المرتجعات")}
            {field("fees_before_vat", "الرسوم قبل الضريبة")}
            {field("fees_vat_amount", "ضريبة الرسوم")}
            {field("payout_fee", "رسوم التحويل")}
            {field("other_deductions", "خصومات أخرى")}
            {field("reserve_held", "احتياطي محتجز")}
            {field("reserve_released", "احتياطي مُفرج عنه")}
            {field("actual_bank_amount", "المبلغ الفعلي بالبنك (اختياري)")}
          </div>
        </div>

        <div className="rounded-lg bg-white/5 border border-white/10 p-3 flex justify-between text-[12px]">
          <div>الصافي المتوقع: <span className="tabular-nums font-medium">{preview.expected.toFixed(2)}</span></div>
          <div>الفرق: <span className={`tabular-nums font-medium ${Math.abs(preview.diff) > 0.05 ? "text-red-400" : "text-emerald-400"}`}>{preview.diff.toFixed(2)}</span></div>
        </div>

        <label className="block text-[11px]">ملاحظات
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]" />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded border border-white/10 text-[12px]">إلغاء</button>
          <button disabled={saving} onClick={save} className="px-3 py-1.5 rounded bg-gold/20 border border-gold/40 text-gold text-[12px] disabled:opacity-50">
            {saving ? "…" : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}
