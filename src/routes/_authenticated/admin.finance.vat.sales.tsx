import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { fetchPeriods, fetchSalesLines, fmtSAR, fmtDate, exportCsv } from "@/lib/finance/vat-helpers";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/vat/sales")({
  ssr: false,
  component: VatSalesPage,
});

function VatSalesPage() {
  const [selectedId, setSelectedId] = useState("");
  const { data: periods } = useQuery({ queryKey: ["vat-periods"], queryFn: fetchPeriods });
  const activeId = selectedId || periods?.[0]?.id || "";
  const { data: lines, isLoading } = useQuery({
    queryKey: ["vat-sales", activeId],
    queryFn: () => fetchSalesLines(activeId),
    enabled: !!activeId,
  });

  const totals = useMemo(() => {
    const arr = lines ?? [];
    return arr.reduce(
      (a: any, r: any) => {
        a.taxable += Number(r.taxable_amount || 0);
        a.vat += Number(r.vat_amount || 0);
        a.total += Number(r.total_amount || 0);
        return a;
      },
      { taxable: 0, vat: 0, total: 0 }
    );
  }, [lines]);

  const doExport = () => {
    exportCsv(
      `vat-sales-${activeId}.csv`,
      lines ?? [],
      [
        { key: "invoice_number", label: "رقم الفاتورة" },
        { key: "customer_name", label: "العميل" },
        { key: "invoice_date", label: "التاريخ" },
        { key: "taxable_amount", label: "الخاضع" },
        { key: "vat_amount", label: "الضريبة" },
        { key: "total_amount", label: "الإجمالي" },
        { key: "status", label: "الحالة" },
      ]
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-muted-foreground">الفترة</label>
          <select
            value={activeId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px]"
          >
            {(periods ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {fmtDate(p.start_date)} → {fmtDate(p.end_date)}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={doExport}
          disabled={!lines?.length}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] disabled:opacity-40"
        >
          <Download size={12} /> تصدير CSV
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 text-[12px]">
        <Stat label="إجمالي الخاضع" value={fmtSAR(totals.taxable)} />
        <Stat label="إجمالي الضريبة" value={fmtSAR(totals.vat)} />
        <Stat label="إجمالي مع الضريبة" value={fmtSAR(totals.total)} />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
        <table className="w-full text-[12px] min-w-[720px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-right p-2">رقم الفاتورة</th>
              <th className="text-right p-2">العميل</th>
              <th className="text-right p-2">التاريخ</th>
              <th className="text-right p-2">الخاضع</th>
              <th className="text-right p-2">الضريبة</th>
              <th className="text-right p-2">الإجمالي</th>
              <th className="text-right p-2">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">جاري التحميل…</td></tr>}
            {!isLoading && (lines ?? []).length === 0 && (
              <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">لا توجد فواتير مبيعات معتمدة في هذه الفترة.</td></tr>
            )}
            {(lines ?? []).map((r: any) => (
              <tr key={r.invoice_id} className="border-t border-white/10 hover:bg-white/5">
                <td className="p-2">
                  <Link to="/admin/finance/sales-invoices/$id" params={{ id: String(r.invoice_id) }} className="text-gold hover:underline">
                    {r.invoice_number}
                  </Link>
                </td>
                <td className="p-2">{r.customer_name || "—"}</td>
                <td className="p-2">{fmtDate(r.invoice_date)}</td>
                <td className="p-2">{fmtSAR(r.taxable_amount)}</td>
                <td className="p-2">{fmtSAR(r.vat_amount)}</td>
                <td className="p-2 font-medium">{fmtSAR(r.total_amount)}</td>
                <td className="p-2 text-[11px] text-muted-foreground">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-semibold mt-0.5">{value}</div>
    </div>
  );
}
