import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileSpreadsheet, RefreshCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/sales-import-batches")({
  ssr: false,
  component: SalesBatchesPage,
});

function SalesBatchesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-4" dir="rtl">
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
