import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchPeriods, fetchExcluded, fmtSAR, fmtDate, exclusionLabel, exportCsv } from "@/lib/finance/vat-helpers";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/vat/excluded")({
  ssr: false,
  component: VatExcludedPage,
});

function VatExcludedPage() {
  const [selectedId, setSelectedId] = useState("");
  const { data: periods } = useQuery({ queryKey: ["vat-periods"], queryFn: fetchPeriods });
  const activeId = selectedId || periods?.[0]?.id || "";
  const { data: rows, isLoading } = useQuery({
    queryKey: ["vat-excluded", activeId],
    queryFn: () => fetchExcluded(activeId),
    enabled: !!activeId,
  });

  const doExport = () => {
    exportCsv(
      `vat-excluded-${activeId}.csv`,
      rows ?? [],
      [
        { key: "source", label: "النوع" },
        { key: "reference", label: "المرجع" },
        { key: "party_name", label: "الطرف" },
        { key: "invoice_date", label: "التاريخ" },
        { key: "amount", label: "الخاضع" },
        { key: "vat_amount", label: "الضريبة" },
        { key: "exclusion_reason", label: "سبب الاستبعاد" },
      ]
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-muted-foreground">الفترة</label>
          <select value={activeId} onChange={(e) => setSelectedId(e.target.value)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px]">
            {(periods ?? []).map((p) => (
              <option key={p.id} value={p.id}>{fmtDate(p.start_date)} → {fmtDate(p.end_date)}</option>
            ))}
          </select>
        </div>
        <button onClick={doExport} disabled={!rows?.length} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] disabled:opacity-40">
          <Download size={12} /> تصدير CSV
        </button>
      </div>

      <div className="text-[11px] text-muted-foreground">
        هذه الفواتير لم تُحتسب ضمن الإقرار لعدم اكتمال الاعتماد أو نقص المرفقات أو سبب آخر يجب معالجته قبل الإقرار.
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
        <table className="w-full text-[12px] min-w-[820px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-right p-2">النوع</th>
              <th className="text-right p-2">المرجع</th>
              <th className="text-right p-2">الطرف</th>
              <th className="text-right p-2">التاريخ</th>
              <th className="text-right p-2">الخاضع</th>
              <th className="text-right p-2">الضريبة</th>
              <th className="text-right p-2">سبب الاستبعاد</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">جاري التحميل…</td></tr>}
            {!isLoading && (rows ?? []).length === 0 && (
              <tr><td colSpan={7} className="p-4 text-center text-emerald-300">لا توجد فواتير مستبعدة — الإقرار نظيف.</td></tr>
            )}
            {(rows ?? []).map((r: any, i: number) => (
              <tr key={`${r.source}-${r.invoice_id}-${i}`} className="border-t border-white/10 hover:bg-white/5">
                <td className="p-2">{r.source === "sale" ? "مبيعات" : "مشتريات"}</td>
                <td className="p-2">
                  <Link
                    to={r.source === "sale" ? "/admin/finance/sales-invoices/$id" : "/admin/finance/purchase-invoices/$id"}
                    params={{ id: String(r.invoice_id) }}
                    className="text-gold hover:underline"
                  >
                    {r.reference || "—"}
                  </Link>
                </td>
                <td className="p-2">{r.party_name || "—"}</td>
                <td className="p-2">{fmtDate(r.invoice_date)}</td>
                <td className="p-2">{fmtSAR(r.amount)}</td>
                <td className="p-2">{fmtSAR(r.vat_amount)}</td>
                <td className="p-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-300">
                    {exclusionLabel(r.exclusion_reason)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
