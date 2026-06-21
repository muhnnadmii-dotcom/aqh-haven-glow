import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtSAR, labelOf, toneOf, ACCOUNTANT_STATUS, ATTACHMENT_STATUS } from "@/lib/finance/constants";
import { TrendingUp, TrendingDown, Scale, AlertTriangle, FileWarning, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/")({
  ssr: false,
  component: FinanceDashboard,
});

type Stat = { income: number; expense: number; incUnreviewed: number; expUnreviewed: number; acctNotReviewed: number; needsFix: number; missingAtt: number; };

function FinanceDashboard() {
  const [period, setPeriod] = useState<"month" | "week" | "today" | "all">("month");
  const [stats, setStats] = useState<Stat>({ income: 0, expense: 0, incUnreviewed: 0, expUnreviewed: 0, acctNotReviewed: 0, needsFix: 0, missingAtt: 0 });
  const [recentIncomes, setRecentIncomes] = useState<any[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const now = new Date();
      let from: string | null = null;
      if (period === "today") from = now.toISOString().slice(0, 10);
      else if (period === "week") { const d = new Date(now); d.setDate(d.getDate() - 7); from = d.toISOString().slice(0, 10); }
      else if (period === "month") from = now.toISOString().slice(0, 7) + "-01";

      const incQ = supabase.from("finance_incomes").select("*").order("income_date", { ascending: false });
      const expQ = supabase.from("finance_expenses").select("*").order("expense_date", { ascending: false });
      if (from) { incQ.gte("income_date", from); expQ.gte("expense_date", from); }
      const [{ data: inc }, { data: exp }] = await Promise.all([incQ, expQ]);
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
        missingAtt: expenses.filter((x) => x.attachment_status === "not_attached").length,
      });
      setRecentIncomes(incomes.slice(0, 5));
      setRecentExpenses(expenses.slice(0, 5));
      setLoading(false);
    })();
  }, [period]);

  const net = stats.income - stats.expense;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { v: "today", l: "اليوم" },
          { v: "week", l: "هذا الأسبوع" },
          { v: "month", l: "هذا الشهر" },
          { v: "all", l: "كل الفترة" },
        ].map((o) => (
          <button
            key={o.v}
            onClick={() => setPeriod(o.v as any)}
            className={`px-3 py-1.5 rounded-lg text-[12px] border ${period === o.v ? "bg-gold/15 border-gold/30 text-gold" : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"}`}
          >{o.l}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card icon={TrendingUp} label="الدخل" value={fmtSAR(stats.income)} tone="text-emerald-300" />
        <Card icon={TrendingDown} label="المصروفات" value={fmtSAR(stats.expense)} tone="text-red-300" />
        <Card icon={Scale} label="الصافي التقريبي" value={fmtSAR(net)} tone={net >= 0 ? "text-emerald-300" : "text-red-300"} />
        <Card icon={ClipboardCheck} label="دخل غير مراجع داخليًا" value={String(stats.incUnreviewed)} />
        <Card icon={ClipboardCheck} label="مصروفات غير مراجعة داخليًا" value={String(stats.expUnreviewed)} />
        <Card icon={AlertTriangle} label="لم يراجعها المحاسب" value={String(stats.acctNotReviewed)} />
        <Card icon={AlertTriangle} label="تحتاج تعديل" value={String(stats.needsFix)} tone="text-red-300" />
        <Card icon={FileWarning} label="مصروفات بدون مرفق" value={String(stats.missingAtt)} tone="text-amber-300" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentList title="آخر عمليات الدخل" rows={recentIncomes} dateField="income_date" subField="account_type" />
        <RecentList title="آخر المصروفات" rows={recentExpenses} dateField="expense_date" subField="item_name" />
      </div>
      {loading && <div className="text-center text-xs text-muted-foreground">جاري التحميل…</div>}
    </div>
  );
}

function Card({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <Icon size={15} />
      </div>
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
