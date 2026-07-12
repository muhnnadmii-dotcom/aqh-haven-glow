import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCcw } from "lucide-react";
import { usePaginatedQuery, type PageSize } from "@/lib/finance/use-paginated-query";
import { PaginationBar } from "@/components/finance/PaginationBar";


export const Route = createFileRoute("/_authenticated/admin/finance/settlement-lines")({
  ssr: false,
  component: SettlementLinesPage,
  validateSearch: (s: Record<string, unknown>) => ({
    settlement: (s.settlement as string) || undefined,
    provider: (s.provider as string) || undefined,
  }),
});

const LINE_LABEL: Record<string, string> = {
  sale: "مبيع",
  refund: "مرتجع",
  chargeback: "اعتراض/Chargeback",
  fee: "رسوم",
  fee_vat: "ضريبة الرسوم",
  payout_fee: "رسوم تحويل",
  adjustment: "تسوية",
  manual_adjustment: "تعديل يدوي من الوسيط",
  unexplained_deduction: "خصم غير مفسر",
  reserve_held: "احتياطي محتجز",
  reserve_released: "احتياطي مُفرج عنه",
  rounding_difference: "فرق تقريب",
  unexplained_transfer_fee: "فرق تحويل غير مبرر",
  wallet_top_up: "شحن محفظة الوسيط",
};

const CLASSIFY_OPTIONS: { value: string; label: string }[] = [
  { value: "refund", label: "استرجاع غير مرتبط" },
  { value: "chargeback", label: "اعتراض/Chargeback" },
  { value: "reserve_held", label: "احتياطي محتجز" },
  { value: "reserve_released", label: "احتياطي مُفرج عنه" },
  { value: "payout_fee", label: "رسوم تحويل" },
  { value: "manual_adjustment", label: "تعديل يدوي من الوسيط" },
  { value: "unexplained_deduction", label: "خصم غير مفسر" },
];

const MATCH_LABEL: Record<string, { text: string; tone: string }> = {
  matched_invoice: { text: "مطابق لفاتورة", tone: "text-emerald-400" },
  matched_cancelled_order: { text: "طلب ملغي ومطابق", tone: "text-emerald-400" },
  cancelled_order_needs_refund_match: { text: "طلب ملغي ينتظر الاسترجاع", tone: "text-amber-400" },
  order_found_invoice_missing: { text: "الطلب موجود بدون فاتورة", tone: "text-amber-400" },
  order_not_found: { text: "الطلب غير موجود", tone: "text-red-400" },
  needs_classification: { text: "بحاجة تصنيف", tone: "text-amber-400" },
  classified: { text: "مصنّف يدوياً", tone: "text-sky-400" },
  wallet_internal_transfer: { text: "تحويل داخلي إلى محفظة سلة", tone: "text-sky-400" },
  no_external_order_id: { text: "بدون رقم طلب", tone: "text-muted-foreground" },
};

function SettlementLinesPage() {
  const search = Route.useSearch();
  const [rows, setRows] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<Record<string, { id: number; invoice_number: string }>>({});
  const [orders, setOrders] = useState<Record<string, { external_order_id: string; order_status: string | null }>>({});
  const [filterType, setFilterType] = useState("");
  const [filterMatch, setFilterMatch] = useState("");
  const [filterSettlement, setFilterSettlement] = useState(search.settlement || "");
  const [filterProvider, setFilterProvider] = useState(search.provider || "");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);

  const load = async () => {
    const [l, s, p] = await Promise.all([
      supabase.from("payment_settlement_lines" as any).select("*").order("transaction_date", { ascending: false }).limit(2000),
      supabase.from("payment_settlements" as any).select("id,settlement_reference,settlement_date,report_reference,source_file_name,provider_id"),
      supabase.from("payment_providers" as any).select("id,name"),
    ]);
    if (l.error) toast.error(l.error.message);
    const lines = l.data ?? [];
    setRows(lines);
    setSettlements(s.data ?? []);
    setProviders(p.data ?? []);

    const invIds = Array.from(new Set(lines.map((x: any) => x.sales_invoice_id).filter(Boolean)));
    const ordIds = Array.from(new Set(lines.map((x: any) => x.salla_order_id).filter(Boolean)));
    if (invIds.length) {
      const { data } = await supabase.from("sales_invoices" as any).select("id,invoice_number").in("id", invIds);
      const map: any = {}; (data ?? []).forEach((r: any) => { map[r.id] = r; }); setInvoices(map);
    } else setInvoices({});
    if (ordIds.length) {
      const { data } = await supabase.from("salla_orders" as any).select("id,external_order_id,order_status").in("id", ordIds);
      const map: any = {}; (data ?? []).forEach((r: any) => { map[r.id] = r; }); setOrders(map);
    } else setOrders({});
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (filterType && r.line_type !== filterType) return false;
    if (filterSettlement && r.settlement_id !== filterSettlement) return false;
    if (filterMatch && (r.matching_status ?? "unclassified") !== filterMatch) return false;
    if (filterProvider) {
      const st = settlements.find((s) => s.id === r.settlement_id);
      if (!st || st.provider_id !== filterProvider) return false;
    }
    return true;
  }), [rows, filterType, filterMatch, filterSettlement, filterProvider, settlements]);

  const stRef = (id: string) => {
    const s = settlements.find((x) => x.id === id);
    if (!s) return "—";
    const p = providers.find((pp) => pp.id === s.provider_id);
    const ref = s.report_reference || s.settlement_reference || s.source_file_name || s.settlement_date;
    return `${p?.name ?? "—"} — ${ref}`;
  };

  const rematchPreview = async () => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("rematch_settlement_lines_preview", { _settlement_id: filterSettlement || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPreview(data);
  };
  const rematchApply = async () => {
    if (!confirm("سيتم تحديث علاقات الربط والحالات فقط بدون تغيير أي مبالغ. متابعة؟")) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("rematch_settlement_lines_apply", { _settlement_id: filterSettlement || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`تم تحديث ${data?.updated ?? 0} حركة`);
    setPreview(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold">حركات التسويات</h2>
          <p className="text-[11px] text-muted-foreground mt-1">جميع تفاصيل التسويات (مبيعات، مرتجعات، رسوم، ضريبة رسوم، تسويات احتياطي، فروقات).</p>
        </div>
        <button onClick={rematchPreview} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10 disabled:opacity-50">
          <RefreshCcw size={14} /> إعادة مطابقة الحركات{filterSettlement ? " (لهذه التسوية)" : ""}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
          <option value="">كل البوابات</option>
          {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterSettlement} onChange={(e) => setFilterSettlement(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
          <option value="">كل التسويات</option>
          {settlements.map((s) => <option key={s.id} value={s.id}>{s.report_reference || s.settlement_reference || s.source_file_name || s.settlement_date}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
          <option value="">كل الأنواع</option>
          {Object.entries(LINE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterMatch} onChange={(e) => setFilterMatch(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
          <option value="">كل حالات المطابقة</option>
          {Object.entries(MATCH_LABEL).map(([k, v]) => <option key={k} value={k}>{v.text}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-[12px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-start px-3 py-2">التاريخ</th>
              <th className="text-start px-3 py-2">التسوية</th>
              <th className="text-start px-3 py-2">النوع</th>
              <th className="text-start px-3 py-2">رقم الطلب</th>
              <th className="text-start px-3 py-2">مرجع الوسيط / الفاتورة</th>
              <th className="text-start px-3 py-2">المبلغ</th>
              <th className="text-start px-3 py-2">حالة المطابقة</th>
              <th className="text-start px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">لا توجد حركات</td></tr>
            )}
            {filtered.map((r) => {
              const inv = r.sales_invoice_id ? invoices[r.sales_invoice_id] : null;
              const ord = r.salla_order_id ? orders[r.salla_order_id] : null;
              const m = MATCH_LABEL[r.matching_status] ?? { text: r.matching_status ?? "غير مصنّف", tone: "text-muted-foreground" };
              const needsClassify = !r.external_order_id && (r.matching_status === "needs_classification" || !r.matching_status);
              return (
                <tr key={r.id} className={`border-t border-white/5 hover:bg-white/5 ${needsClassify ? "bg-amber-500/5" : ""}`}>
                  <td className="px-3 py-2">{r.transaction_date ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{stRef(r.settlement_id)}</td>
                  <td className="px-3 py-2">{LINE_LABEL[r.line_type] ?? r.line_type}</td>
                  <td className="px-3 py-2 tabular-nums">{r.external_order_id ?? "—"}</td>
                  <td className="px-3 py-2">
                    {inv ? (
                      <Link to="/admin/finance/sales-invoices/$id" params={{ id: String(inv.id) }} className="text-gold hover:underline">{inv.invoice_number}</Link>
                    ) : ord ? (
                      <span className="text-amber-300">طلب #{ord.external_order_id} · {ord.order_status ?? "—"}</span>
                    ) : (
                      <span className="text-muted-foreground text-[10px]">{r.provider_transaction_id ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{Number(r.amount).toFixed(2)}</td>
                  <td className={`px-3 py-2 ${m.tone}`}>{m.text}{inv ? ` ${inv.invoice_number}` : ""}</td>
                  <td className="px-3 py-2">
                    {needsClassify ? (
                      <ClassifyLine row={r} onDone={load} />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0b1220] p-4 space-y-3" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold">معاينة إعادة المطابقة</div>
            <div className="text-[12px] text-muted-foreground">
              إجمالي الحركات: <b>{preview.total_lines}</b> · مع رقم طلب: <b>{preview.with_external_order}</b>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-[12px] space-y-1">
              {Object.entries(preview.by_status ?? {}).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span>{MATCH_LABEL[k]?.text ?? k}</span><b>{v as any}</b>
                </div>
              ))}
            </div>
            {Array.isArray(preview.sample_order_not_found) && preview.sample_order_not_found.length > 0 && (
              <details className="text-[11px]">
                <summary className="cursor-pointer">أرقام طلبات غير موجودة (عيّنة)</summary>
                <div className="mt-1 text-muted-foreground font-mono">{preview.sample_order_not_found.join(", ")}</div>
              </details>
            )}
            <div className="text-[11px] text-muted-foreground">
              لن يتم تغيير أي مبالغ. لن يتم إنشاء فواتير أو تسويات. تحديث الربط والحالات فقط.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setPreview(null)} className="px-3 py-1.5 rounded border border-white/10 text-[12px]">إلغاء</button>
              <button onClick={rematchApply} disabled={busy} className="px-3 py-1.5 rounded bg-emerald-600/80 text-white text-[12px] disabled:opacity-50">تنفيذ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClassifyLine({ row, onDone }: { row: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>(row.line_type ?? "unexplained_deduction");
  const [note, setNote] = useState<string>(row.classification_note ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase as any)
      .from("payment_settlement_lines")
      .update({
        line_type: type,
        matching_status: "classified",
        classification_reason: type,
        classification_note: note || null,
        classified_at: new Date().toISOString(),
        classified_by: u.user?.id ?? null,
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("تم تصنيف الحركة");
    setOpen(false);
    onDone();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="px-2 py-1 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[11px] hover:bg-amber-500/30">
        تصنيف الحركة
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0b1220] p-4 space-y-3" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold">تصنيف حركة تسوية غير مرتبطة بطلب</div>
            <div className="text-[11px] text-muted-foreground">
              المبلغ: <b className="tabular-nums">{Number(row.amount).toFixed(2)}</b> · التاريخ: {row.transaction_date ?? "—"}
            </div>
            <label className="block text-[11px]">نوع الحركة الصحيح
              <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
                {CLASSIFY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="block text-[11px]">ملاحظة (اختياري)
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]" />
            </label>
            <div className="text-[11px] text-muted-foreground">
              لن يتغير المبلغ ولا أي روابط أخرى. سيتم فقط تحديث نوع الحركة وحالتها.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded border border-white/10 text-[12px]">إلغاء</button>
              <button disabled={saving} onClick={save} className="px-3 py-1.5 rounded bg-emerald-600/80 text-white text-[12px] disabled:opacity-50">{saving ? "…" : "حفظ التصنيف"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
