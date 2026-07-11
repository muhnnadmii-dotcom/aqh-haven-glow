import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtSAR, OWNER_DRAW_SLUG } from "@/lib/finance/constants";
import { formatMonthAr, monthRange, splitExpenses, splitIncomes, sum } from "@/lib/finance/dashboard-data";
import { exportXLSX } from "@/lib/finance/xlsx";
import { listCapital, computeInvestedCapital, computeCashOnHand, type CapitalEntry } from "@/lib/finance/capital";
import { getAccountingPerformance, type AccountingPerformance } from "@/lib/finance/accounting-performance";
import { Download, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/reports")({
  ssr: false,
  component: ReportsPage,
});

function ymNow(offset = 0) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type ReportKind = "cash" | "income_statement";

function ReportsPage() {
  const [month, setMonth] = useState(ymNow(0));
  const [reportKind, setReportKind] = useState<ReportKind>("cash");
  const [cats, setCats] = useState<any[]>([]);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [capital, setCapital] = useState<CapitalEntry[]>([]);
  const [allIncomes, setAllIncomes] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [businessName, setBusinessName] = useState("Aqua Haven");
  const [perf, setPerf] = useState<AccountingPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  const ownerDrawCatId = useMemo(() => cats.find((c) => c.system_slug === OWNER_DRAW_SLUG)?.id ?? null, [cats]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = monthRange(month);
      const [{ data: c }, { data: inc }, { data: exp }, cap, { data: allI }, { data: allE }, { data: biz }] = await Promise.all([
        supabase.from("finance_categories").select("id, name, kind, system_slug"),
        supabase.from("finance_incomes").select("*").is("deleted_at", null).gte("income_date", r.dateFrom!).lte("income_date", r.dateTo!),
        supabase.from("finance_expenses").select("*").is("deleted_at", null).gte("expense_date", r.dateFrom!).lte("expense_date", r.dateTo!),
        listCapital().catch(() => [] as CapitalEntry[]),
        supabase.from("finance_incomes").select("income_date, amount").is("deleted_at", null),
        supabase.from("finance_expenses").select("expense_date, amount, main_category_id").is("deleted_at", null),
        supabase.from("aqh_business_settings" as any).select("company_name").eq("id", 1).maybeSingle(),
      ]);
      setCats(c ?? []);
      setIncomes(inc ?? []);
      setExpenses(exp ?? []);
      setCapital(cap ?? []);
      setAllIncomes(allI ?? []);
      setAllExpenses(allE ?? []);
      if ((biz as any)?.company_name) setBusinessName((biz as any).company_name);
      setLoading(false);
    })();
  }, [month]);

  const { operating, draws } = useMemo(() => splitExpenses(expenses, ownerDrawCatId), [expenses, ownerDrawCatId]);
  const { operating: opIncomes } = useMemo(() => splitIncomes(incomes), [incomes]);
  const totIncome = sum(opIncomes, (x: any) => x.amount);
  const totOp = sum(operating, (x: any) => x.amount);
  const totDraws = sum(draws, (x: any) => x.amount);
  const netOp = totIncome - totOp;
  const netAfter = netOp - totDraws;

  const catRows = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of operating) {
      const id = e.main_category_id ?? "_none";
      totals.set(id, (totals.get(id) ?? 0) + Number(e.amount ?? 0));
    }
    return Array.from(totals.entries())
      .map(([id, total]) => ({ id, name: cats.find((c) => c.id === id)?.name ?? "بدون تصنيف", total }))
      .sort((a, b) => b.total - a.total);
  }, [operating, cats]);

  const r = monthRange(month);
  const cashAtEnd = useMemo(() => {
    const allOp = ownerDrawCatId ? allExpenses.filter((e) => e.main_category_id !== ownerDrawCatId) : allExpenses;
    const allDrawsAll = ownerDrawCatId ? allExpenses.filter((e) => e.main_category_id === ownerDrawCatId) : [];
    return computeCashOnHand({ capital, incomes: allIncomes as any, operating: allOp as any, draws: allDrawsAll as any, asOfDate: r.dateTo! });
  }, [capital, allIncomes, allExpenses, ownerDrawCatId, r.dateTo]);
  const invested = computeInvestedCapital(capital, r.dateTo!);

  const exportExcel = () => {
    const label = formatMonthAr(month);
    exportXLSX(`تقرير-${month}.xlsx`, [
      {
        name: `المقبوضات والمدفوعات ${label}`,
        headers: ["البند", "المبلغ (ر.س)"],
        rows: [
          ["إجمالي المقبوضات", totIncome],
          ["إجمالي المدفوعات", -totOp],
          ...catRows.map((c) => [`— ${c.name}`, -c.total] as [string, number]),
          ["صافي التدفق قبل سحوبات المالك", netOp],
          ["سحوبات المالك", -totDraws],
          ["صافي التدفق بعد سحوبات المالك", netAfter],
        ],
      },
      {
        name: `المركز النقدي ${label}`,
        headers: ["البند", "المبلغ (ر.س)"],
        rows: [
          ["رأس المال المستثمر حتى نهاية الشهر", invested],
          ["الرصيد النقدي في نهاية الشهر", cashAtEnd],
        ],
      },
    ]);
  };

  const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const nowY = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => nowY - 5 + i);
  const [my, mm] = month.split("-");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-wrap items-center gap-3 print:hidden">
        <span className="text-[11px] text-muted-foreground">شهر التقرير:</span>
        <select value={mm} onChange={(e) => setMonth(`${my}-${e.target.value}`)} className="px-2 py-1.5 rounded-lg text-[12px] bg-background/60 border border-gold/40 text-gold">
          {MONTHS_AR.map((n, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{n}</option>)}
        </select>
        <select value={my} onChange={(e) => setMonth(`${e.target.value}-${mm}`)} className="px-2 py-1.5 rounded-lg text-[12px] bg-background/60 border border-gold/40 text-gold">
          {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
        </select>
        <div className="ms-auto flex gap-2">
          <button onClick={exportExcel} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] bg-gold/15 border border-gold/30 text-gold">
            <Download size={13} /> تصدير Excel
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] bg-white/5 border border-white/10">
            <Printer size={13} /> طباعة
          </button>
        </div>
      </div>

      <div id="print-area" className="rounded-xl border border-white/10 bg-white/5 p-6 print:border-0 print:bg-white print:text-black print:shadow-none">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-[11px] tracking-[0.3em] text-gold/80 uppercase print:text-gray-600">Financial Report</div>
            <h1 className="text-2xl font-semibold mt-1">تقرير المقبوضات والمدفوعات — {formatMonthAr(month)}</h1>
            <div className="text-[12px] text-muted-foreground print:text-gray-600 mt-1">{businessName}</div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground print:text-gray-600">
            <div>الفترة: {r.dateFrom} — {r.dateTo}</div>
            <div>تاريخ الإصدار: {new Date().toISOString().slice(0, 10)}</div>
          </div>
        </div>

        <table className="w-full text-[13px] mb-8">
          <tbody>
            <TR label="إجمالي المقبوضات" v={totIncome} tone="text-emerald-300 print:text-black" bold />
            <TR label="إجمالي المدفوعات" v={-totOp} tone="text-red-300 print:text-black" />
            {catRows.map((c) => (
              <TR key={c.id} label={`— ${c.name}`} v={-c.total} muted />
            ))}
            <TR label="صافي التدفق قبل سحوبات المالك" v={netOp} tone={netOp >= 0 ? "text-emerald-300 print:text-black" : "text-red-300 print:text-black"} bold divider />
            <TR label="سحوبات المالك" v={-totDraws} tone="text-gold print:text-black" />
            <TR label="صافي التدفق بعد سحوبات المالك" v={netAfter} tone={netAfter >= 0 ? "text-emerald-300 print:text-black" : "text-red-300 print:text-black"} bold divider />
          </tbody>
        </table>

        <div className="border-t border-white/10 print:border-gray-300 pt-4">
          <h2 className="text-lg font-semibold mb-3">المركز النقدي</h2>
          <table className="w-full text-[13px]">
            <tbody>
              <TR label="رأس المال المستثمر حتى نهاية الشهر" v={invested} />
              <TR label="الرصيد النقدي في نهاية الشهر" v={cashAtEnd} tone={cashAtEnd >= 0 ? "text-gold print:text-black" : "text-red-300 print:text-black"} bold />
            </tbody>
          </table>
        </div>
      </div>

      {loading && <div className="text-center text-xs text-muted-foreground">جاري التحميل…</div>}

      <style>{`
        @media print {
          body { background: white; }
          nav, header, aside, footer, .print\\:hidden { display: none !important; }
          #print-area { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}

function TR({ label, v, tone, bold, muted, divider }: { label: string; v: number; tone?: string; bold?: boolean; muted?: boolean; divider?: boolean }) {
  return (
    <tr className={`${divider ? "border-t border-white/10 print:border-gray-300" : ""}`}>
      <td className={`py-2 pe-3 ${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground text-[12px] ps-4" : ""}`}>{label}</td>
      <td className={`py-2 text-left font-mono ${tone ?? ""} ${bold ? "font-semibold" : ""}`}>{fmtSAR(v)}</td>
    </tr>
  );
}
