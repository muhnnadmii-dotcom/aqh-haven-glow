import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { fetchPeriods, fetchPurchaseLines, fmtSAR, fmtDate, exportCsv } from "@/lib/finance/vat-helpers";
import { Download, PaperclipIcon, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/vat/purchases")({
  ssr: false,
  component: VatPurchasesPage,
});

const dedLabel = (d: string) =>
  ({ fully_deductible: "قابل كليًا", partially_deductible: "قابل جزئيًا", non_deductible: "غير قابل", pending_review: "قيد المراجعة" }[d] ?? d);

type FilterKind = "all" | "missing" | "nondeductible" | "recoverable";
type SortKey = "invoice_date" | "vat_amount" | "deductible_vat_amount";
type SortDir = "asc" | "desc";

function ymOf(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  // Expect YYYY-MM-DD; take first 7 chars for exact YYYY-MM
  return String(dateStr).slice(0, 7);
}

function VatPurchasesPage() {
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<FilterKind>("all");
  const [supplier, setSupplier] = useState<string>("");
  const [month, setMonth] = useState<string>(""); // YYYY-MM within selected period
  const [q, setQ] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("deductible_vat_amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: periods } = useQuery({ queryKey: ["vat-periods"], queryFn: fetchPeriods });
  const activeId = selectedId || periods?.[0]?.id || "";
  const activePeriod = (periods ?? []).find((p) => p.id === activeId);

  const { data: lines, isLoading } = useQuery({
    queryKey: ["vat-purchases", activeId],
    queryFn: () => fetchPurchaseLines(activeId),
    enabled: !!activeId,
  });

  // Show only invoices that actually carry VAT (vat_amount > 0).
  const taxable = useMemo(() => (lines ?? []).filter((r: any) => Number(r.vat_amount || 0) > 0), [lines]);

  // Distinct suppliers from current period's taxable rows
  const suppliers = useMemo(() => {
    const s = new Set<string>();
    for (const r of taxable) if (r.supplier_name) s.add(r.supplier_name);
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ar"));
  }, [taxable]);

  // Months available inside the current period (from invoice_date)
  const months = useMemo(() => {
    const s = new Set<string>();
    for (const r of taxable) {
      const ym = ymOf(r.invoice_date);
      if (ym) s.add(ym);
    }
    return Array.from(s).sort();
  }, [taxable]);

  // Reset sub-filters that don't match when period changes
  const filtered = useMemo(() => {
    let rows = taxable;
    if (month) rows = rows.filter((r: any) => ymOf(r.invoice_date) === month);
    if (supplier) rows = rows.filter((r: any) => (r.supplier_name || "") === supplier);
    if (filter === "missing") rows = rows.filter((r: any) => !r.has_attachment);
    else if (filter === "nondeductible") rows = rows.filter((r: any) => Number(r.non_deductible_vat_amount) > 0);
    else if (filter === "recoverable") rows = rows.filter((r: any) => Number(r.non_deductible_vat_amount) > 0 && !r.has_attachment);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      rows = rows.filter((r: any) =>
        [r.internal_reference, r.supplier_invoice_number, r.supplier_name]
          .filter(Boolean)
          .some((v: any) => String(v).toLowerCase().includes(needle))
      );
    }
    // Sort
    const dir = sortDir === "asc" ? 1 : -1;
    rows = [...rows].sort((a: any, b: any) => {
      if (sortKey === "invoice_date") {
        return (String(a.invoice_date || "").localeCompare(String(b.invoice_date || ""))) * dir;
      }
      const av = Number(a[sortKey] || 0);
      const bv = Number(b[sortKey] || 0);
      return (av - bv) * dir;
    });
    return rows;
  }, [taxable, month, supplier, filter, q, sortKey, sortDir]);

  const isNonTaxable = (_r: any) => false;

  const totals = useMemo(
    () =>
      filtered.reduce(
        (a: any, r: any) => {
          if (!isNonTaxable(r)) a.taxable += Number(r.taxable_amount || 0);
          a.vat += Number(r.vat_amount || 0);
          a.ded += Number(r.deductible_vat_amount || 0);
          a.nd += Number(r.non_deductible_vat_amount || 0);
          if (!r.has_attachment) a.recoverable += Number(r.non_deductible_vat_amount || 0);
          return a;
        },
        { taxable: 0, vat: 0, ded: 0, nd: 0, recoverable: 0 }
      ),
    [filtered]
  );

  const doExport = () => {
    const rowsForExport = filtered.map((r: any) => ({
      ...r,
      recoverable_vat_amount: !r.has_attachment ? Number(r.non_deductible_vat_amount || 0) : "",
    }));
    exportCsv(
      `vat-purchases-${activeId}${month ? `-${month}` : ""}.csv`,
      rowsForExport,
      [
        { key: "internal_reference", label: "المرجع الداخلي" },
        { key: "supplier_invoice_number", label: "رقم فاتورة المورد" },
        { key: "supplier_name", label: "المورد" },
        { key: "invoice_date", label: "التاريخ" },
        { key: "taxable_amount", label: "الخاضع" },
        { key: "vat_amount", label: "الضريبة" },
        { key: "deductible_vat_amount", label: "القابل للخصم" },
        { key: "non_deductible_vat_amount", label: "غير القابل" },
        { key: "recoverable_vat_amount", label: "قابلة للاسترداد" },
        { key: "vat_deductibility", label: "نوع الخصم" },
        { key: "has_attachment", label: "مرفق؟" },
      ]
    );
  };

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown size={11} className="inline opacity-50" />;
    return sortDir === "asc" ? <ArrowUp size={11} className="inline" /> : <ArrowDown size={11} className="inline" />;
  };

  // If selected month is not present in current period's months, clear it
  const monthOptions = useMemo(() => {
    if (month && !months.includes(month)) {
      // keep it visible but marked; won't match any row (rows already filtered by period)
    }
    return months;
  }, [months, month]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] text-muted-foreground">الفترة</label>
          <select
            value={activeId}
            onChange={(e) => { setSelectedId(e.target.value); setMonth(""); setSupplier(""); }}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px]"
          >
            {(periods ?? []).map((p) => (
              <option key={p.id} value={p.id}>{fmtDate(p.start_date)} → {fmtDate(p.end_date)}</option>
            ))}
          </select>

          <label className="text-[11px] text-muted-foreground">الشهر</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px]"
            title="فلترة داخل الفترة المختارة فقط"
          >
            <option value="">كل أشهر الفترة</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <label className="text-[11px] text-muted-foreground">المورد</label>
          <select
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] max-w-[220px]"
          >
            <option value="">كل الموردين</option>
            {suppliers.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select value={filter} onChange={(e) => setFilter(e.target.value as FilterKind)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px]">
            <option value="all">جميع الفواتير</option>
            <option value="missing">بدون مرفق</option>
            <option value="nondeductible">تحتوي غير قابل للخصم</option>
            <option value="recoverable">فرص الاسترداد</option>
          </select>

          <div className="relative">
            <Search size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث: مرجع/رقم فاتورة/مورد"
              className="pr-7 pl-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] w-[220px]"
            />
          </div>

          <span className="text-[11px] text-muted-foreground">النتائج: {filtered.length}</span>
        </div>
        <button onClick={doExport} disabled={!filtered.length} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] disabled:opacity-40">
          <Download size={12} /> تصدير CSV
        </button>
      </div>

      <div className="text-[11px] text-muted-foreground">
        تعرض هذه الصفحة فواتير المشتريات ذات ضريبة فعلية فقط (vat_amount &gt; 0) داخل الفترة المختارة{activePeriod ? ` (${fmtDate(activePeriod.start_date)} → ${fmtDate(activePeriod.end_date)})` : ""}. فلتر الشهر فرعي داخل هذه الفترة فقط.
      </div>

      <div className={`grid grid-cols-2 gap-3 text-[12px] ${filter === "recoverable" ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
        <Stat label="خاضع" value={fmtSAR(totals.taxable)} />
        <Stat label="إجمالي الضريبة" value={fmtSAR(totals.vat)} />
        <Stat label="قابل للخصم" value={fmtSAR(totals.ded)} />
        <Stat label="غير قابل" value={fmtSAR(totals.nd)} />
        {filter === "recoverable" && (
          <Stat label="إجمالي القابل للاسترداد" value={fmtSAR(totals.recoverable)} highlight />
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
        <table className="w-full text-[12px] min-w-[980px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-right p-2">المرجع</th>
              <th className="text-right p-2">المورد</th>
              <th className="text-right p-2 cursor-pointer select-none" onClick={() => toggleSort("invoice_date")}>
                التاريخ <SortIcon k="invoice_date" />
              </th>
              <th className="text-right p-2">الخاضع</th>
              <th className="text-right p-2 cursor-pointer select-none" onClick={() => toggleSort("vat_amount")}>
                ضريبة <SortIcon k="vat_amount" />
              </th>
              <th className="text-right p-2 cursor-pointer select-none" onClick={() => toggleSort("deductible_vat_amount")}>
                قابل للخصم <SortIcon k="deductible_vat_amount" />
              </th>
              <th className="text-right p-2">قابلة للاسترداد</th>
              <th className="text-right p-2">نوع الخصم</th>
              <th className="text-right p-2">مرفق</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">جاري التحميل…</td></tr>}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">لا توجد فواتير مطابقة.</td></tr>
            )}
            {filtered.map((r: any) => {
              const recoverable = !r.has_attachment ? Number(r.non_deductible_vat_amount || 0) : 0;
              return (
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
                  <td className="p-2">
                    {recoverable > 0 ? (
                      <span className="text-emerald-300" title="تُستردّ عند رفع المرفق">{fmtSAR(recoverable)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`font-semibold mt-0.5 ${highlight ? "text-emerald-300" : ""}`}>{value}</div>
    </div>
  );
}
