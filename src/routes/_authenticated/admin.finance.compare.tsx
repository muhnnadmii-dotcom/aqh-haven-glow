import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtSAR, OWNER_DRAW_SLUG } from "@/lib/finance/constants";
import { monthRange, formatMonthAr, splitExpenses, splitIncomes, sum, pctChange } from "@/lib/finance/dashboard-data";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { getAccountingPerformance, type AccountingPerformance } from "@/lib/finance/accounting-performance";

export const Route = createFileRoute("/_authenticated/admin/finance/compare")({
  ssr: false,
  component: ComparePage,
});

function ymOffset(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ComparePage() {
  const [monthA, setMonthA] = useState(ymOffset(-1));
  const [monthB, setMonthB] = useState(ymOffset(0));
  const [cats, setCats] = useState<any[]>([]);
  const [incA, setIncA] = useState<any[]>([]);
  const [expA, setExpA] = useState<any[]>([]);
  const [incB, setIncB] = useState<any[]>([]);
  const [expB, setExpB] = useState<any[]>([]);
  const [acctA, setAcctA] = useState<AccountingPerformance | null>(null);
  const [acctB, setAcctB] = useState<AccountingPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  const ownerDrawCatId = useMemo(() => cats.find((c) => c.system_slug === OWNER_DRAW_SLUG)?.id ?? null, [cats]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const rA = monthRange(monthA), rB = monthRange(monthB);
      const [{ data: c }, { data: ia }, { data: ea }, { data: ib }, { data: eb }, aA, aB] = await Promise.all([
        supabase.from("finance_categories").select("id, name, kind, system_slug").eq("is_active", true),
        supabase.from("finance_incomes").select("*").is("deleted_at", null).gte("income_date", rA.dateFrom!).lte("income_date", rA.dateTo!),
        supabase.from("finance_expenses").select("*").is("deleted_at", null).gte("expense_date", rA.dateFrom!).lte("expense_date", rA.dateTo!),
        supabase.from("finance_incomes").select("*").is("deleted_at", null).gte("income_date", rB.dateFrom!).lte("income_date", rB.dateTo!),
        supabase.from("finance_expenses").select("*").is("deleted_at", null).gte("expense_date", rB.dateFrom!).lte("expense_date", rB.dateTo!),
        getAccountingPerformance(rA.dateFrom!, rA.dateTo!).catch(() => null),
        getAccountingPerformance(rB.dateFrom!, rB.dateTo!).catch(() => null),
      ]);
      setCats(c ?? []);
      setIncA(ia ?? []); setExpA(ea ?? []); setIncB(ib ?? []); setExpB(eb ?? []);
      setAcctA(aA); setAcctB(aB);
      setLoading(false);
    })();
  }, [monthA, monthB]);

  const A = useMemo(() => summarize(incA, expA, ownerDrawCatId), [incA, expA, ownerDrawCatId]);
  const B = useMemo(() => summarize(incB, expB, ownerDrawCatId), [incB, expB, ownerDrawCatId]);

  const labelA = formatMonthAr(monthA);
  const labelB = formatMonthAr(monthB);
  const sameLabel = labelA === labelB;
  const legendA = sameLabel ? `${labelA} (A)` : labelA;
  const legendB = sameLabel ? `${labelB} (B)` : labelB;

  type CashKey = "income" | "operating" | "netOp" | "ownerDraws" | "netAfter";
  const rows: { key: CashKey; label: string; invert: boolean; bold?: boolean }[] = [
    { key: "income", label: "إجمالي المقبوضات", invert: false },
    { key: "operating", label: "إجمالي المدفوعات", invert: true },
    { key: "netOp", label: "صافي التدفق قبل سحوبات المالك", invert: false, bold: true },
    { key: "ownerDraws", label: "مدفوعات المالك (سحوبات)", invert: true },
    { key: "netAfter", label: "صافي التدفق بعد سحوبات المالك", invert: false, bold: true },
  ];

  type AcctKey = "gross_sales" | "cogs" | "operating_expenses" | "net_profit" | "output_vat" | "deductible_input_vat";
  const acctRows: { key: AcctKey; label: string; invert: boolean; bold?: boolean }[] = [
    { key: "gross_sales", label: "المبيعات (قبل الضريبة)", invert: false },
    { key: "cogs", label: "تكلفة المبيعات", invert: true },
    { key: "operating_expenses", label: "المصروفات التشغيلية", invert: true },
    { key: "net_profit", label: "صافي الربح المحاسبي", invert: false, bold: true },
    { key: "output_vat", label: "ضريبة المخرجات", invert: true },
    { key: "deductible_input_vat", label: "ضريبة المدخلات القابلة للخصم", invert: false },
  ];

  const chartData = rows.map((r) => ({
    label: r.label,
    a: (A as any)[r.key],
    b: (B as any)[r.key],
  }));

  const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const nowY = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => nowY - 5 + i);

  const MonthPicker = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => {
    const [y, m] = value.split("-");
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">{label}:</span>
        <select value={m} onChange={(e) => onChange(`${y}-${e.target.value}`)} className="px-2 py-1.5 rounded-lg text-[12px] bg-background/60 border border-gold/40 text-gold">
          {MONTHS_AR.map((n, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{n}</option>)}
        </select>
        <select value={y} onChange={(e) => onChange(`${e.target.value}-${m}`)} className="px-2 py-1.5 rounded-lg text-[12px] bg-background/60 border border-gold/40 text-gold">
          {years.map((yy) => <option key={yy} value={String(yy)}>{yy}</option>)}
        </select>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-wrap items-center gap-3">
        <MonthPicker value={monthA} onChange={setMonthA} label="الشهر A" />
        <MonthPicker value={monthB} onChange={setMonthB} label="الشهر B" />
      </div>

      <div className="text-sm font-semibold text-gold/90 mt-2">مقارنة نقدية</div>
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-white/5 text-[11px] text-muted-foreground">
            <tr>
              <th className="text-right p-3">البند</th>
              <th className="text-right p-3">{labelA}</th>
              <th className="text-right p-3">{labelB}</th>
              <th className="text-right p-3">الفرق</th>
              <th className="text-right p-3">النمو %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const a = (A as any)[r.key] as number;
              const b = (B as any)[r.key] as number;
              const diff = b - a;
              const pct = pctChange(b, a);
              const dir = pct == null ? 0 : pct > 0.5 ? 1 : pct < -0.5 ? -1 : 0;
              const good = r.invert ? dir < 0 : dir > 0;
              const bad = r.invert ? dir > 0 : dir < 0;
              const tone = dir === 0 ? "text-muted-foreground" : good ? "text-emerald-300" : bad ? "text-red-300" : "";
              const Ico = dir === 0 ? Minus : dir > 0 ? ArrowUpRight : ArrowDownRight;
              const diffGood = r.invert ? diff < 0 : diff > 0;
              const diffTone = diff === 0 ? "text-muted-foreground" : diffGood ? "text-emerald-300" : "text-red-300";
              return (
                <tr key={r.key} className={`border-t border-white/5 ${r.bold ? "bg-white/[0.04]" : ""}`}>
                  <td className={`p-3 ${r.bold ? "font-bold text-foreground" : ""}`}>{r.label}</td>
                  <td className={`p-3 font-mono tabular-nums ${r.bold ? "font-bold" : ""}`}>{fmtSAR(a)}</td>
                  <td className={`p-3 font-mono tabular-nums ${r.bold ? "font-bold" : ""}`}>{fmtSAR(b)}</td>
                  <td className={`p-3 font-mono tabular-nums ${diffTone}`}>
                    <span dir="ltr" className="inline-block">{diff >= 0 ? "+" : ""}{fmtSAR(diff)}</span>
                  </td>
                  <td className={`p-3 font-mono tabular-nums ${tone}`}>
                    <span dir="ltr" className="inline-flex items-center gap-1">
                      <Ico size={12} /> {pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-sm font-semibold text-gold/90 mt-2">مقارنة محاسبية</div>
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        {!acctA || !acctB ? (
          <div className="p-4 text-xs text-muted-foreground">غير متاح — تعذر تحميل بيانات الأداء المحاسبي</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-white/5 text-[11px] text-muted-foreground">
              <tr>
                <th className="text-right p-3">البند</th>
                <th className="text-right p-3">{labelA}</th>
                <th className="text-right p-3">{labelB}</th>
                <th className="text-right p-3">الفرق</th>
                <th className="text-right p-3">النمو %</th>
              </tr>
            </thead>
            <tbody>
              {acctRows.map((r) => {
                const rawA = (acctA as any)[r.key];
                const rawB = (acctB as any)[r.key];
                const a = rawA == null ? 0 : Number(rawA);
                const b = rawB == null ? 0 : Number(rawB);
                const diff = b - a;
                const pct = pctChange(b, a);
                const dir = pct == null ? 0 : pct > 0.5 ? 1 : pct < -0.5 ? -1 : 0;
                const good = r.invert ? dir < 0 : dir > 0;
                const bad = r.invert ? dir > 0 : dir < 0;
                const tone = dir === 0 ? "text-muted-foreground" : good ? "text-emerald-300" : bad ? "text-red-300" : "";
                const Ico = dir === 0 ? Minus : dir > 0 ? ArrowUpRight : ArrowDownRight;
                const diffGood = r.invert ? diff < 0 : diff > 0;
                const diffTone = diff === 0 ? "text-muted-foreground" : diffGood ? "text-emerald-300" : "text-red-300";
                const unavailable = rawA == null || rawB == null;
                return (
                  <tr key={r.key} className={`border-t border-white/5 ${r.bold ? "bg-white/[0.04]" : ""}`}>
                    <td className={`p-3 ${r.bold ? "font-bold text-foreground" : ""}`}>{r.label}</td>
                    <td className={`p-3 font-mono tabular-nums ${r.bold ? "font-bold" : ""}`}>{rawA == null ? "—" : fmtSAR(a)}</td>
                    <td className={`p-3 font-mono tabular-nums ${r.bold ? "font-bold" : ""}`}>{rawB == null ? "—" : fmtSAR(b)}</td>
                    <td className={`p-3 font-mono tabular-nums ${diffTone}`}>
                      {unavailable ? "—" : <span dir="ltr">{diff >= 0 ? "+" : ""}{fmtSAR(diff)}</span>}
                    </td>
                    <td className={`p-3 font-mono tabular-nums ${tone}`}>
                      {unavailable ? "—" : (
                        <span dir="ltr" className="inline-flex items-center gap-1">
                          <Ico size={12} /> {pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold mb-3">مقارنة رسومية (نقدي)</div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: "#aaa", fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fill: "#888", fontSize: 10 }} width={80} tickFormatter={(v) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(Number(v))} />
              <Tooltip contentStyle={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => fmtSAR(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="a" name={legendA} fill="#7cc7b7" radius={[6, 6, 0, 0]} />
              <Bar dataKey="b" name={legendB} fill="#d4b26a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {loading && <div className="text-center text-xs text-muted-foreground">جاري التحميل…</div>}
    </div>
  );
}

function summarize(incomes: any[], expenses: any[], ownerDrawCatId: string | null) {
  const { operating, draws } = splitExpenses(expenses, ownerDrawCatId);
  const { operating: opIn } = splitIncomes(incomes);
  const income = sum(opIn, (x: any) => x.amount);
  const op = sum(operating, (x: any) => x.amount);
  const dw = sum(draws, (x: any) => x.amount);
  const personalIn = sum(opIn.filter((r: any) => r.account_type === "personal"), (x: any) => x.amount);
  const netOp = income - op;
  return { income, operating: op, draws: dw, ownerDraws: dw, netOp, netAfter: netOp - dw, personalIn };
}
