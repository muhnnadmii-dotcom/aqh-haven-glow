import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtSAR } from "@/lib/finance/constants";
import { normalizePaymentMethod, normalizeShippingCompany } from "@/lib/finance/overview";
import { X } from "lucide-react";

export type SalesDrillSpec = {
  title: string;
  from: string;
  to: string;
  /** normalized payment method label */
  method?: string;
  /** discount code */
  code?: string;
  /** normalized shipping company label */
  company?: string;
  /** only cancelled invoices */
  cancelled?: boolean;
  /** only confirmed partial payments */
  partialOnly?: boolean;
};

type Row = Record<string, any>;

export function SalesRowsDrawer({ spec, onClose }: { spec: SalesDrillSpec; onClose: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setRows(null);
      setError(null);
      let q = supabase
        .from("sales_invoices")
        .select(
          "id,invoice_number,issue_date,customer_name_snapshot,external_order_id,total_amount,original_gross_amount,discount_code,original_payment_method,shipping_company,status,payment_status,paid_amount,remaining_amount",
        )
        .gte("issue_date", spec.from)
        .lte("issue_date", spec.to)
        .order("issue_date", { ascending: false })
        .limit(500);
      if (spec.cancelled) q = q.eq("status", "cancelled");
      else q = q.neq("status", "cancelled");
      if (spec.code) q = q.eq("discount_code", spec.code);
      const { data, error } = await q;
      if (!alive) return;
      if (error) {
        setError(error.message);
        setRows([]);
        return;
      }
      let list = (data ?? []) as Row[];
      if (spec.method) list = list.filter((r) => normalizePaymentMethod(r.original_payment_method) === spec.method);
      if (spec.company)
        list = list.filter((r) => (normalizeShippingCompany(r.shipping_company) ?? "غير محدد") === spec.company);
      if (spec.partialOnly)
        list = list.filter(
          (r) => r.payment_status === "partially_paid" && Number(r.paid_amount) > 0 && Number(r.remaining_amount) > 0,
        );
      setRows(list);
    })();
    return () => {
      alive = false;
    };
  }, [spec]);

  return (
    <div className="fixed inset-0 z-50 flex" dir="rtl">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative ms-auto h-full w-full max-w-3xl overflow-y-auto border-s border-white/10 bg-background p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-sm font-semibold">{spec.title}</div>
            <div className="text-[11px] text-muted-foreground font-mono">
              {spec.from} → {spec.to}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="إغلاق">
            <X size={16} />
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-300">{error}</div>}

        {rows === null ? (
          <div className="py-10 text-center text-xs text-muted-foreground">جاري التحميل…</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">لا توجد سجلات مطابقة.</div>
        ) : (
          <>
            <div className="mb-2 text-[11px] text-muted-foreground">
              {rows.length} سجل — الإجمالي{" "}
              <span className="font-mono text-foreground">
                {fmtSAR(rows.reduce((a, r) => a + Number(r.total_amount || r.original_gross_amount || 0), 0))}
              </span>{" "}
              ر.س
            </div>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-[12px]">
                <thead className="bg-white/5 text-muted-foreground">
                  <tr>
                    <th className="p-2 text-start">الفاتورة</th>
                    <th className="p-2 text-start">التاريخ</th>
                    <th className="p-2 text-start">العميل</th>
                    <th className="p-2 text-start">الطريقة</th>
                    <th className="p-2 text-start">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-white/5">
                      <td className="p-2 font-mono">{r.invoice_number || r.external_order_id || "—"}</td>
                      <td className="p-2 font-mono">{r.issue_date}</td>
                      <td className="p-2 truncate max-w-[180px]">{r.customer_name_snapshot || "—"}</td>
                      <td className="p-2">{normalizePaymentMethod(r.original_payment_method)}</td>
                      <td className="p-2 font-mono">{fmtSAR(r.total_amount || r.original_gross_amount || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
