import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { Plus, X, ChevronLeft, Upload, RefreshCcw, Pencil, CalendarX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";
import { usePaginatedQuery, type PageSize } from "@/lib/finance/use-paginated-query";
import { PaginationBar } from "@/components/finance/PaginationBar";

export const Route = createFileRoute("/_authenticated/admin/finance/settlements/")({
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

// Columns needed for the list view (no notes / raw / snapshot payload).
const LIST_COLS =
  "id,provider_id,settlement_reference,settlement_date,gross_sales_amount," +
  "fees_before_vat,fees_vat_amount,payout_fee,expected_net_amount,actual_bank_amount," +
  "difference_amount,status";

function SettlementsPage() {
  const roles = useFinanceRoles();
  const [providers, setProviders] = useState<any[]>([]);
  const [filterProvider, setFilterProvider] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);

  useEffect(() => {
    supabase.from("payment_providers" as any).select("id, name, provider_code, is_active").eq("is_active", true).order("name")
      .then(({ data }) => setProviders(data ?? []));
  }, []);

  const fetcher = useCallback(async ({ page, pageSize }: { page: number; pageSize: PageSize }) => {
    let q = supabase.from("payment_settlements" as any)
      .select(LIST_COLS, { count: "exact" })
      .order("settlement_date", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false });
    if (filterProvider) q = q.eq("provider_id", filterProvider);
    if (filterStatus) q = q.eq("status", filterStatus);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await q.range(from, to);
    if (error) throw new Error(error.message);
    return { rows: (data as any[]) ?? [], total: count ?? 0 };
  }, [filterProvider, filterStatus]);

  const pg = usePaginatedQuery(fetcher, [filterProvider, filterStatus]);
  useEffect(() => { if (pg.error) toast.error(pg.error); }, [pg.error]);
  const reload = pg.reload;

  const providerName = useMemo(() => {
    const m = new Map(providers.map((p) => [p.id, p.name]));
    return (id: string) => m.get(id) ?? "—";
  }, [providers]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">التسويات</h2>
          <p className="text-[11px] text-muted-foreground mt-1">قائمة تسويات بوابات الدفع مع الصافي المتوقع والفعلي والفرق عن الحوالة البنكية.</p>
        </div>
        {roles.canManage && (
          <div className="flex items-center gap-2">
            <DateRepairButton onDone={reload} />
            <RematchAllButton onDone={reload} />
            <Link to="/admin/finance/settlements/import" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/20 border border-gold/40 text-gold text-[12px] hover:bg-gold/30">
              <Upload size={14} /> استيراد تسوية
            </Link>
            <Link to="/admin/finance/settlements/import-bulk" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10">
              <Upload size={14} /> استيراد جماعي
            </Link>
            <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10">
              <Plus size={14} /> تسوية جديدة
            </button>
          </div>
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

      <div className={`overflow-x-auto rounded-xl border border-white/10 bg-white/5 ${pg.loading ? "opacity-70" : ""}`}>
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
            {pg.rows.length === 0 && !pg.loading && (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">لا توجد تسويات</td></tr>
            )}
            {pg.rows.map((r) => {
              const feesTotal = Number(r.fees_before_vat) + Number(r.fees_vat_amount) + Number(r.payout_fee);
              const diff = Number(r.difference_amount);
              return (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-3 py-2">{formatSettlementDate(r.settlement_date)}</td>
                  <td className="px-3 py-2">{providerName(r.provider_id)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.settlement_reference ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{Number(r.gross_sales_amount).toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums">{feesTotal.toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums">{Number(r.expected_net_amount).toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums">{r.actual_bank_amount != null ? Number(r.actual_bank_amount).toFixed(2) : "—"}</td>
                  <td className={`px-3 py-2 tabular-nums ${Math.abs(diff) > 0.05 ? "text-red-400" : "text-emerald-400"}`}>{diff.toFixed(2)}</td>
                  <td className={`px-3 py-2 ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status]}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      {roles.canManage && (
                        <button onClick={() => setEditing(r)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-gold">
                          <Pencil size={12} /> تعديل بيانات التسوية
                        </button>
                      )}
                      {roles.canManage && (
                        <button onClick={() => setDeleting(r)} className="inline-flex items-center gap-1 text-red-400 hover:text-red-300" title="حذف التسوية وإعادة استيرادها">
                          <Trash2 size={12} /> حذف / إعادة استيراد
                        </button>
                      )}
                      <button onClick={() => window.location.assign(`/admin/finance/settlement-lines?settlement=${r.id}`)} className="inline-flex items-center gap-1 text-gold hover:underline">
                        الحركات <ChevronLeft size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <PaginationBar page={pg.page} pageCount={pg.pageCount} pageSize={pg.pageSize} total={pg.total} loading={pg.loading} onPage={pg.setPage} onPageSize={pg.setPageSize} />
      </div>

      {creating && (
        <SettlementForm
          providers={providers}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); reload(); }}
        />
      )}
      {editing && (
        <SettlementMetaForm
          settlement={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
      {deleting && (
        <SettlementDeleteDialog
          settlement={deleting}
          providerName={providerName(deleting.provider_id)}
          onClose={() => setDeleting(null)}
          onDone={() => { setDeleting(null); reload(); }}
        />
      )}
    </div>
  );
}

function formatSettlementDate(value: string | null | undefined) {
  return value || "تاريخ التسوية غير محدد";
}

function SettlementForm({ providers, onClose, onSaved }: { providers: any[]; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    provider_id: providers[0]?.id ?? "",
    settlement_reference: "",
    settlement_date: "",
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
      settlement_date: form.settlement_date || null,
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

function SettlementMetaForm({ settlement, onClose, onSaved }: { settlement: any; onClose: () => void; onSaved: () => void }) {
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
    else { toast.success("تم تحديث بيانات التسوية"); onSaved(); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0b1220] p-5 space-y-3">
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
          <button disabled={saving} onClick={save} className="px-3 py-1.5 rounded bg-gold/20 border border-gold/40 text-gold text-[12px] disabled:opacity-50">
            {saving ? "…" : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DateRepairButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);

  const run = async () => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("preview_auto_imported_settlement_dates");
    setBusy(false);
    if (error) return toast.error(error.message);
    const count = Array.isArray(data) ? data[0]?.affected_count : data?.affected_count;
    setPreview({ affected_count: Number(count ?? 0) });
  };

  const apply = async () => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("clear_auto_imported_settlement_dates");
    setBusy(false);
    if (error) return toast.error(error.message);
    const count = Array.isArray(data) ? data[0]?.updated_count : data?.updated_count;
    toast.success(`تم تصحيح ${Number(count ?? 0)} تسوية`);
    setPreview(null);
    onDone();
  };

  return (
    <>
      <button onClick={run} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10 disabled:opacity-50">
        <CalendarX size={14} /> تصحيح تواريخ الاستيراد
      </button>
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0b1220] p-4 space-y-3" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold">معاينة تصحيح تواريخ التسويات</div>
            <div className="text-[12px] text-muted-foreground">
              سيتم تحويل تاريخ التسوية إلى "غير محدد" لعدد <b>{preview.affected_count}</b> تسوية مطابقة لنمط تاريخ الاستيراد الخاطئ.
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-[11px] text-muted-foreground">
              لن يتم تغيير تاريخ الاستيراد، المبالغ، الحركات، أو أي روابط حالية.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setPreview(null)} className="px-3 py-1.5 rounded border border-white/10 text-[12px]">إلغاء</button>
              <button onClick={apply} disabled={busy || preview.affected_count <= 0} className="px-3 py-1.5 rounded bg-emerald-600/80 text-white text-[12px] disabled:opacity-50">تنفيذ</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RematchAllButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const run = async () => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("rematch_settlement_lines_preview", { _settlement_id: null });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPreview(data);
  };
  const apply = async () => {
    if (!confirm("سيتم إعادة مطابقة جميع حركات التسويات (بدون تغيير أي مبالغ). متابعة؟")) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("rematch_settlement_lines_apply", { _settlement_id: null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`تم تحديث ${data?.updated ?? 0} حركة`);
    setPreview(null);
    onDone();
  };
  return (
    <>
      <button onClick={run} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10 disabled:opacity-50">
        <RefreshCcw size={14} /> إعادة مطابقة الكل
      </button>
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0b1220] p-4 space-y-3" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold">معاينة إعادة المطابقة</div>
            <div className="text-[12px] text-muted-foreground">
              إجمالي الحركات: <b>{preview.total_lines}</b> · مع رقم طلب: <b>{preview.with_external_order}</b>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-[12px] space-y-1">
              {Object.entries(preview.by_status ?? {}).map(([k, v]) => (
                <div key={k} className="flex justify-between"><span>{k}</span><b>{v as any}</b></div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setPreview(null)} className="px-3 py-1.5 rounded border border-white/10 text-[12px]">إلغاء</button>
              <button onClick={apply} disabled={busy} className="px-3 py-1.5 rounded bg-emerald-600/80 text-white text-[12px] disabled:opacity-50">تنفيذ</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
