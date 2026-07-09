import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtSAR, OWNER_DRAW_SLUG } from "@/lib/finance/constants";
import { monthRange, formatMonthAr, splitExpenses, sum, pctChange } from "@/lib/finance/dashboard-data";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

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
  const [loading, setLoading] = useState(true);

  const ownerDrawCatId = useMemo(() => cats.find((c) => c.system_slug === OWNER_DRAW_SLUG)?.id ?? null, [cats]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const rA = monthRange(monthA), rB = monthRange(monthB);
      const [{ data: c }, { data: ia }, { data: ea }, { data: ib }, { data: eb }] = await Promise.all([
        supabase.from("finance_categories").select("id, name, kind, system_slug").eq("is_active", true),
        supabase.from("finance_incomes").select("*").is("deleted_at", null).gte("income_date", rA.dateFrom!).lte("income_date", rA.dateTo!),
        supabase.from("finance_expenses").select("*").is("deleted_at", null).gte("expense_date", rA.dateFrom!).lte("expense_date", rA.dateTo!),
        supabase.from("finance_incomes").select("*").is("deleted_at", null).gte("income_date", rB.dateFrom!).lte("income_date", rB.dateTo!),
        supabase.from("finance_expenses").select("*").is("deleted_at", null).gte("expense_date", rB.dateFrom!).lte("expense_date", rB.dateTo!),
      ]);
      setCats(c ?? []);
      setIncA(ia ?? []); setExpA(ea ?? []); setIncB(ib ?? []); setExpB(eb ?? []);
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

  const rows: { key: "income" | "operating" | "netOp" | "draws" | "netAfter"; label: string; invert: boolean; bold?: boolean }[] = [
    { key: "income", label: "إجمالي الدخل", invert: false },
    { key: "operating", label: "مصروفات التشغيل", invert: true },
    { key: "netOp", label: "صافي الربح قبل التوزيع", invert: false, bold: true },
    { key: "draws", label: "توزيع الأرباح (سحوبات المالك)", invert: true },
    { key: "netAfter", label: "الصافي بعد التوزيع", invert: false, bold: true },
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

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-white/5 text-[11px] text-muted-foreground">
            <tr>
              <th className="text-right p-3">البند</th>
              <th className="text-right p-3">{formatMonthAr(monthA)}</th>
              <th className="text-right p-3">{formatMonthAr(monthB)}</th>
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
              return (
                <tr key={r.key} className={`border-t border-white/5 ${r.bold ? "bg-white/[0.03]" : ""}`}>
                  <td className={`p-3 ${r.bold ? "font-semibold" : ""}`}>{r.label}</td>
                  <td className="p-3 font-mono">{fmtSAR(a)}</td>
                  <td className="p-3 font-mono">{fmtSAR(b)}</td>
                  <td className={`p-3 font-mono ${diff >= 0 ? "text-emerald-300" : "text-red-300"}`}>{diff >= 0 ? "+" : ""}{fmtSAR(diff)}</td>
                  <td className={`p-3 font-mono inline-flex items-center gap-1 ${tone}`}>
                    <Ico size={12} /> {pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold mb-3">مقارنة رسومية</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: "#888", fontSize: 10 }} />
              <YAxis tick={{ fill: "#888", fontSize: 10 }} width={70} />
              <Tooltip contentStyle={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => fmtSAR(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey={formatMonthAr(monthA)} fill="#7cc7b7" radius={[6, 6, 0, 0]} />
              <Bar dataKey={formatMonthAr(monthB)} fill="#d4b26a" radius={[6, 6, 0, 0]} />
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
  const income = sum(incomes, (x: any) => x.amount);
  const op = sum(operating, (x: any) => x.amount);
  const dw = sum(draws, (x: any) => x.amount);
  const netOp = income - op;
  return { income, operating: op, draws: dw, netOp, netAfter: netOp - dw };
}
