import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { fetchPeriods, fetchPurchaseLines, fmtSAR, fmtDate, exportCsv } from "@/lib/finance/vat-helpers";
import { Download, Paperclip, PaperclipIcon, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/vat/purchases")({
  ssr: false,
  component: VatPurchasesPage,
});

const dedLabel = (d: string) =>
  ({ fully_deductible: "قابل كليًا", partially_deductible: "قابل جزئيًا", non_deductible: "غير قابل", pending_review: "قيد المراجعة" }[d] ?? d);

function VatPurchasesPage() {
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<"all" | "missing" | "nondeductible">("all");
  const { data: periods } = useQuery({ queryKey: ["vat-periods"], queryFn: fetchPeriods });
  const activeId = selectedId || periods?.[0]?.id || "";
  const { data: lines, isLoading } = useQuery({
    queryKey: ["vat-purchases", activeId],
    queryFn: () => fetchPurchaseLines(activeId),
    enabled: !!activeId,
  });

  // Show only invoices that actually carry VAT (vat_amount > 0).
  const taxable = useMemo(() => (lines ?? []).filter((r: any) => Number(r.vat_amount || 0) > 0), [lines]);

  const filtered = useMemo(() => {
    if (filter === "missing") return taxable.filter((r: any) => !r.has_attachment);
    if (filter === "nondeductible") return taxable.filter((r: any) => Number(r.non_deductible_vat_amount) > 0);
    return taxable;
  }, [taxable, filter]);

  const isNonTaxable = (_r: any) => false;

  const totals = useMemo(
    () =>
      filtered.reduce(
        (a: any, r: any) => {
          if (!isNonTaxable(r)) a.taxable += Number(r.taxable_amount || 0);
          a.vat += Number(r.vat_amount || 0);
          a.ded += Number(r.deductible_vat_amount || 0);
          a.nd += Number(r.non_deductible_vat_amount || 0);
          return a;
        },
        { taxable: 0, vat: 0, ded: 0, nd: 0 }
      ),
    [filtered]
  );

  const doExport = () => {
    exportCsv(
      `vat-purchases-${activeId}.csv`,
      filtered,
      [
        { key: "internal_reference", label: "المرجع الداخلي" },
        { key: "supplier_invoice_number", label: "رقم فاتورة المورد" },
        { key: "supplier_name", label: "المورد" },
        { key: "invoice_date", label: "التاريخ" },
        { key: "taxable_amount", label: "الخاضع" },
        { key: "vat_amount", label: "الضريبة" },
        { key: "deductible_vat_amount", label: "القابل للخصم" },
        { key: "non_deductible_vat_amount", label: "غير القابل" },
        { key: "vat_deductibility", label: "نوع الخصم" },
        { key: "has_attachment", label: "مرفق؟" },
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
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px]">
            <option value="all">جميع الفواتير</option>
            <option value="missing">بدون مرفق</option>
            <option value="nondeductible">تحتوي غير قابل للخصم</option>
          </select>
        </div>
        <button onClick={doExport} disabled={!filtered.length} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] disabled:opacity-40">
          <Download size={12} /> تصدير CSV
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
        <Stat label="خاضع" value={fmtSAR(totals.taxable)} />
        <Stat label="إجمالي الضريبة" value={fmtSAR(totals.vat)} />
        <Stat label="قابل للخصم" value={fmtSAR(totals.ded)} />
        <Stat label="غير قابل" value={fmtSAR(totals.nd)} />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
        <table className="w-full text-[12px] min-w-[900px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-right p-2">المرجع</th>
              <th className="text-right p-2">المورد</th>
              <th className="text-right p-2">التاريخ</th>
              <th className="text-right p-2">الخاضع</th>
              <th className="text-right p-2">ضريبة</th>
              <th className="text-right p-2">قابل للخصم</th>
              <th className="text-right p-2">نوع الخصم</th>
              <th className="text-right p-2">مرفق</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">جاري التحميل…</td></tr>}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">لا توجد فواتير مطابقة.</td></tr>
            )}
            {filtered.map((r: any) => (
              <tr key={r.invoice_id} className="border-t border-white/10 hover:bg-white/5">
                <td className="p-2">
                  <Link to="/admin/finance/purchase-invoices/$id" params={{ id: String(r.invoice_id) }} className="text-gold hover:underline">
                    {r.internal_reference}
                  </Link>
                  {r.supplier_invoice_number && <div className="text-[10px] text-muted-foreground">مورد: {r.supplier_invoice_number}</div>}
                </td>
                <td className="p-2">{r.supplier_name || "—"}</td>
                <td className="p-2">{fmtDate(r.invoice_date)}</td>
                <td className="p-2">{isNonTaxable(r) ? <span className="text-[10.5px] text-muted-foreground">غير خاضعة</span> : fmtSAR(r.taxable_amount)}</td>
                <td className="p-2">{fmtSAR(r.vat_amount)}</td>
                <td className="p-2">
                  {fmtSAR(r.deductible_vat_amount)}
                  {Number(r.non_deductible_vat_amount) > 0 && (
                    <div className="text-[10px] text-amber-300">غير قابل: {fmtSAR(r.non_deductible_vat_amount)}</div>
                  )}
                </td>
                <td className="p-2 text-[11px]">{dedLabel(r.vat_deductibility)}</td>
                <td className="p-2">
                  {r.has_attachment ? (
                    <PaperclipIcon size={12} className="text-emerald-400" />
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-300 text-[10px]">
                      <AlertTriangle size={11} /> ناقص
                    </span>
                  )}
                </td>
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
