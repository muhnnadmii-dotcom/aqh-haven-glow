import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtSAR, labelOf, toneOf, ACCOUNTANT_STATUS } from "@/lib/finance/constants";
import { TrendingUp, TrendingDown, Scale, AlertTriangle, FileWarning, ClipboardCheck, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/")({
  ssr: false,
  component: FinanceDashboard,
});

type Stat = {
  income: number; expense: number;
  incUnreviewed: number; expUnreviewed: number;
  acctNotReviewed: number; needsFix: number;
  missingAttExp: number; missingAttInc: number;
};

function FinanceDashboard() {
  const [period, setPeriod] = useState<"month" | "week" | "today" | "all" | "custom">("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stats, setStats] = useState<Stat>({ income: 0, expense: 0, incUnreviewed: 0, expUnreviewed: 0, acctNotReviewed: 0, needsFix: 0, missingAttExp: 0, missingAttInc: 0 });
  const [recentIncomes, setRecentIncomes] = useState<any[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [topCats, setTopCats] = useState<{ name: string; total: number }[]>([]);
  const [topSups, setTopSups] = useState<{ name: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const now = new Date();
      let dateFrom: string | null = null;
      let dateTo: string | null = null;
      if (period === "today") dateFrom = now.toISOString().slice(0, 10);
      else if (period === "week") { const d = new Date(now); d.setDate(d.getDate() - 7); dateFrom = d.toISOString().slice(0, 10); }
      else if (period === "month") dateFrom = now.toISOString().slice(0, 7) + "-01";
      else if (period === "custom") { dateFrom = from || null; dateTo = to || null; }

      let incQ = supabase.from("finance_incomes").select("*").order("income_date", { ascending: false });
      let expQ = supabase.from("finance_expenses").select("*").order("expense_date", { ascending: false });
      if (dateFrom) { incQ = incQ.gte("income_date", dateFrom); expQ = expQ.gte("expense_date", dateFrom); }
      if (dateTo) { incQ = incQ.lte("income_date", dateTo); expQ = expQ.lte("expense_date", dateTo); }
      const [{ data: inc }, { data: exp }, { data: cats }, { data: sups }] = await Promise.all([
        incQ, expQ,
        supabase.from("finance_categories").select("id, name"),
        supabase.from("finance_suppliers").select("id, name"),
      ]);
      const incomes = inc ?? [];
      const expenses = exp ?? [];
      const sum = (arr: any[]) => arr.reduce((a, b) => a + Number(b.amount ?? 0), 0);
      setStats({
        income: sum(incomes),
        expense: sum(expenses),
        incUnreviewed: incomes.filter((x) => x.internal_review_status === "unreviewed").length,
        expUnreviewed: expenses.filter((x) => x.internal_review_status === "unreviewed").length,
        acctNotReviewed: incomes.filter((x) => x.accountant_status === "not_reviewed").length + expenses.filter((x) => x.accountant_status === "not_reviewed").length,
        needsFix: incomes.filter((x) => x.accountant_status === "needs_fix").length + expenses.filter((x) => x.accountant_status === "needs_fix").length,
        missingAttExp: expenses.filter((x) => x.attachment_status === "not_attached").length,
        missingAttInc: incomes.filter((x) => x.attachment_status === "not_attached").length,
      });
      setRecentIncomes(incomes.slice(0, 5));
      setRecentExpenses(expenses.slice(0, 5));

      const catName = (id: string) => (cats ?? []).find((c: any) => c.id === id)?.name ?? "—";
      const supName = (id: string) => (sups ?? []).find((s: any) => s.id === id)?.name ?? "—";
      const catTotals: Record<string, number> = {};
      const supTotals: Record<string, number> = {};
      expenses.forEach((e: any) => {
        if (e.main_category_id) catTotals[e.main_category_id] = (catTotals[e.main_category_id] ?? 0) + Number(e.amount ?? 0);
        if (e.supplier_id) supTotals[e.supplier_id] = (supTotals[e.supplier_id] ?? 0) + Number(e.amount ?? 0);
      });
      setTopCats(Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, total]) => ({ name: catName(id), total })));
      setTopSups(Object.entries(supTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, total]) => ({ name: supName(id), total })));
      setLoading(false);
    })();
  }, [period, from, to]);

  const net = stats.income - stats.expense;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { v: "today", l: "اليوم" },
          { v: "week", l: "هذا الأسبوع" },
          { v: "month", l: "هذا الشهر" },
          { v: "all", l: "كل الفترة" },
          { v: "custom", l: "مخصص" },
        ].map((o) => (
          <button key={o.v} onClick={() => setPeriod(o.v as any)}
            className={`px-3 py-1.5 rounded-lg text-[12px] border ${period === o.v ? "bg-gold/15 border-gold/30 text-gold" : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"}`}>{o.l}</button>
        ))}
        {period === "custom" && (
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 rounded-lg text-[12px] bg-white/5 border border-white/10" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 rounded-lg text-[12px] bg-white/5 border border-white/10" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card icon={TrendingUp} label="الدخل" value={fmtSAR(stats.income)} tone="text-emerald-300" />
        <Card icon={TrendingDown} label="المصروفات" value={fmtSAR(stats.expense)} tone="text-red-300" />
        <Card icon={Scale} label="الصافي التقريبي" value={fmtSAR(net)} tone={net >= 0 ? "text-emerald-300" : "text-red-300"} />
        <Card icon={ClipboardCheck} label="دخل غير مراجع داخليًا" value={String(stats.incUnreviewed)} />
        <Card icon={ClipboardCheck} label="مصروفات غير مراجعة داخليًا" value={String(stats.expUnreviewed)} />
        <Card icon={AlertTriangle} label="لم يراجعها المحاسب" value={String(stats.acctNotReviewed)} />
        <Card icon={AlertTriangle} label="تحتاج تعديل" value={String(stats.needsFix)} tone="text-red-300" />
        <Card icon={FileWarning} label="مصروفات بدون مرفق" value={String(stats.missingAttExp)} tone="text-amber-300" />
        <Card icon={FileWarning} label="دخل بدون مرفق" value={String(stats.missingAttInc)} tone="text-amber-300" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentList title="آخر 5 عمليات دخل" rows={recentIncomes} dateField="income_date" subField="account_type" />
        <RecentList title="آخر 5 مصروفات" rows={recentExpenses} dateField="expense_date" subField="item_name" />
        <TopList title="أكثر 5 تصنيفات صرفًا" items={topCats} />
        <TopList title="أكثر 5 موردين صرفًا" items={topSups} />
      </div>
      {loading && <div className="text-center text-xs text-muted-foreground">جاري التحميل…</div>}
    </div>
  );
}

function Card({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span><Icon size={15} /></div>
      <div className={`mt-2 text-xl font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function RecentList({ title, rows, dateField, subField }: { title: string; rows: any[]; dateField: string; subField: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">لا يوجد بيانات</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 text-[12px] border-b border-white/5 pb-2 last:border-0">
              <div className="min-w-0">
                <div className="text-foreground truncate">{r[subField] || "—"}</div>
                <div className="text-muted-foreground/80">{r[dateField]}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="font-mono">{fmtSAR(r.amount)}</div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] border ${toneOf(ACCOUNTANT_STATUS, r.accountant_status)}`}>
                  {labelOf(ACCOUNTANT_STATUS, r.accountant_status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TopList({ title, items }: { title: string; items: { name: string; total: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.total));
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">لا يوجد بيانات</div>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="text-[12px]">
              <div className="flex items-center justify-between mb-1">
                <span className="truncate">{it.name}</span>
                <span className="font-mono text-muted-foreground">{fmtSAR(it.total)}</span>
              </div>
              <div className="h-1.5 rounded bg-white/5 overflow-hidden">
                <div className="h-full bg-gold/40" style={{ width: `${(it.total / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
