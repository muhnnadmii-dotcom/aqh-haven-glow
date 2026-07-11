import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, RefreshCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/sales-review")({
  ssr: false,
  component: SalesReviewPage,
});

const LABELS: Record<string, string> = {
  complete: "مكتملة",
  missing_original_invoice: "بلا رقم فاتورة",
  missing_tax_details: "بيانات ضريبية ناقصة",
  needs_review: "بحاجة مراجعة",
  needs_credit_note: "بحاجة إشعار دائن",
};

function SalesReviewPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  async function load() {
    setLoading(true);
    let q = (supabase as any)
      .from("sales_invoices")
      .select("id, invoice_number, external_order_id, external_invoice_number, order_date, issue_date, customer_name_snapshot, payment_provider, original_gross_amount, refund_amount, net_amount, vat_amount, data_completeness_status, sales_channel, import_batch_id")
      .neq("data_completeness_status", "complete")
      .order("issue_date", { ascending: false })
      .limit(500);
    if (filter) q = q.eq("data_completeness_status", filter);
    const { data } = await q;
    setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [filter]);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-400" size={18} />
            <h2 className="text-sm font-semibold">فواتير مبيعات تحتاج مراجعة</h2>
          </div>
          <div className="flex items-center gap-2">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="inp text-[12px]">
              <option value="">كل حالات المراجعة</option>
              <option value="missing_original_invoice">بلا رقم فاتورة</option>
              <option value="missing_tax_details">بيانات ضريبية ناقصة</option>
              <option value="needs_review">بحاجة مراجعة</option>
              <option value="needs_credit_note">بحاجة إشعار دائن</option>
            </select>
            <button onClick={load} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[12px] inline-flex items-center gap-1.5">
              <RefreshCcw size={13} /> تحديث
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-muted-foreground">
              <tr className="border-b border-white/10">
                <th className="p-2 text-right">رقم الفاتورة</th>
                <th className="p-2 text-right">القناة</th>
                <th className="p-2 text-right">رقم الطلب</th>
                <th className="p-2 text-right">فاتورة سلة</th>
                <th className="p-2 text-right">التاريخ</th>
                <th className="p-2 text-right">العميل</th>
                <th className="p-2 text-right">وسيط الدفع</th>
                <th className="p-2 text-right">الأصلي</th>
                <th className="p-2 text-right">المرتجع</th>
                <th className="p-2 text-right">الصافي</th>
                <th className="p-2 text-right">الضريبة</th>
                <th className="p-2 text-right">الحالة</th>
                <th className="p-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={13} className="p-4 text-center text-muted-foreground">جارٍ التحميل…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={13} className="p-4 text-center text-muted-foreground">لا توجد فواتير تحتاج مراجعة.</td></tr>}
              {rows.map((r: any) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="p-2 font-mono text-[11px]">{r.invoice_number}</td>
                  <td className="p-2">{r.sales_channel}</td>
                  <td className="p-2 font-mono text-[11px]">{r.external_order_id ?? "—"}</td>
                  <td className="p-2 font-mono text-[11px]">{r.external_invoice_number ?? "—"}</td>
                  <td className="p-2">{r.order_date ?? r.issue_date}</td>
                  <td className="p-2">{r.customer_name_snapshot ?? "—"}</td>
                  <td className="p-2">{r.payment_provider ?? "—"}</td>
                  <td className="p-2">{r.original_gross_amount ?? "—"}</td>
                  <td className="p-2">{Number(r.refund_amount) || "—"}</td>
                  <td className="p-2">{r.net_amount ?? "—"}</td>
                  <td className="p-2">{Number(r.vat_amount) || "—"}</td>
                  <td className="p-2">
                    <span className="px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[11px]">
                      {LABELS[r.data_completeness_status] ?? r.data_completeness_status}
                    </span>
                  </td>
                  <td className="p-2">
                    <Link to="/admin/finance/sales-invoices/$id" params={{ id: String(r.id) }} className="text-gold text-[11px] hover:underline">فتح</Link>
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
