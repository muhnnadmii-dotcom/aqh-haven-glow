import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileSpreadsheet, RefreshCcw, Wrench, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/finance/sales-import-batches")({
  ssr: false,
  component: SalesBatchesPage,
});

function SalesBatchesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("sales_import_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function runPreview() {
    setBusy(true); setApplied(null);
    const { data, error } = await (supabase as any).rpc("salla_backfill_preview");
    setBusy(false);
    if (error) return toast.error(error.message);
    setPreview(data);
  }

  async function runApply() {
    if (!confirm("سيتم تحديث الفواتير المستوردة الحالية (draft فقط) وإنشاء بنودها الملخصة. لا يتم اعتماد أي فاتورة تلقائيًا. متابعة؟")) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("salla_backfill_apply");
    setBusy(false);
    if (error) return toast.error(error.message);
    setApplied(data);
    setPreview(null);
    toast.success("تم إصلاح بيانات الفواتير المستوردة.");
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Backfill panel */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Wrench className="text-gold" size={18} />
            <h2 className="text-sm font-semibold">إصلاح بيانات الفواتير المستوردة (سلة)</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={runPreview} disabled={busy} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[12px] inline-flex items-center gap-1.5 disabled:opacity-50">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} معاينة
            </button>
            <button
              onClick={runApply}
              disabled={busy || !preview}
              className="px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-[12px] inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              تنفيذ الإصلاح
            </button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground mb-3">
          يقرأ اللقطة الأصلية لكل فاتورة سلة مستوردة ويعيد تعبئة الحقول الناقصة (وسيط الدفع، طريقة الدفع الأصلية، حالة التسوية، اسم العميل، الضريبة، الشحن) وينشئ بنودًا ملخصة عند غيابها. لا يعتمد أي فاتورة تلقائيًا ولا ينشئ فواتير مكررة.
        </p>

        {preview && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[12px]">
            <Stat label="إجمالي فواتير سلة" value={preview.total_salla_invoices} />
            <Stat label="سيتم تحديثها" value={preview.invoices_to_update} tone="blue" />
            <Stat label="بحاجة إنشاء بنود" value={preview.items_to_create_invoices} tone="amber" />
            <Stat label="بدون اسم عميل" value={preview.missing_customer_name} />
            <Stat label="بدون ضريبة" value={preview.missing_vat} />
            <Stat label="فرق بالمجاميع" value={preview.totals_mismatch} tone="red" />
          </div>
        )}

        {applied && (
          <div className="mt-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-[12px] text-emerald-200">
            تم تحديث <b>{applied.invoices_updated}</b> فاتورة، وإنشاء <b>{applied.items_created}</b> بند. فروقات بالمجاميع: <b>{applied.totals_mismatch}</b>.
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-gold" size={18} />
            <h2 className="text-sm font-semibold">سجل عمليات استيراد المبيعات</h2>
          </div>
          <button onClick={load} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[12px] inline-flex items-center gap-1.5">
            <RefreshCcw size={13} /> تحديث
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-muted-foreground">
              <tr className="border-b border-white/10">
                <th className="p-2 text-right">التاريخ</th>
                <th className="p-2 text-right">الملف</th>
                <th className="p-2 text-right">القناة</th>
                <th className="p-2 text-right">الشيت</th>
                <th className="p-2 text-right">الإجمالي</th>
                <th className="p-2 text-right">مستورد</th>
                <th className="p-2 text-right">مكرر</th>
                <th className="p-2 text-right">مراجعة</th>
                <th className="p-2 text-right">أخطاء</th>
                <th className="p-2 text-right">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">جارٍ التحميل…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">لا توجد عمليات استيراد بعد.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="p-2">{new Date(r.created_at).toLocaleString("ar-SA")}</td>
                  <td className="p-2 font-mono text-[11px]">{r.file_name}</td>
                  <td className="p-2">{r.sales_channel}</td>
                  <td className="p-2">{r.sheet_name ?? "—"}</td>
                  <td className="p-2">{r.total_rows}</td>
                  <td className="p-2 text-emerald-300">{r.imported_rows}</td>
                  <td className="p-2 text-orange-300">{r.duplicate_rows}</td>
                  <td className="p-2 text-amber-300">{r.needs_review_rows}</td>
                  <td className="p-2 text-red-300">{r.error_rows}</td>
                  <td className="p-2">
                    <span className="px-2 py-0.5 rounded border border-white/15 bg-white/5 text-[11px]">{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "blue" | "amber" | "red" }) {
  const t = tone === "blue" ? "text-blue-300" : tone === "amber" ? "text-amber-300" : tone === "red" ? "text-red-300" : "";
  return (
    <div className="rounded-lg bg-black/30 border border-white/10 p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold mt-0.5 ${t}`}>{value ?? 0}</div>
    </div>
  );
}
