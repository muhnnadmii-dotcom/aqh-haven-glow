import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtSAR, labelOf, toneOf, ACCOUNTANT_STATUS, OWNER_DRAW_SLUG } from "@/lib/finance/constants";
import {
  TrendingUp, TrendingDown, Scale, Wallet, PiggyBank,
  AlertTriangle, FileWarning, ClipboardCheck, RefreshCw, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { FinanceRowsDrawer, type DrawerSpec } from "@/components/finance/FinanceRowsDrawer";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
} from "recharts";
import {
  type PeriodKey, resolveRange, previousRange, pctChange, sum, splitExpenses, splitIncomes,
  buildTimeSeries, cumulativeCashflow, bucketDraws, drawsByMonth,
} from "@/lib/finance/dashboard-data";
import { listCapital, computeInvestedCapital, type CapitalEntry } from "@/lib/finance/capital";
import { getManualBalances, updateManualBalances, type ManualBalances } from "@/lib/finance/manual-balances";
import { isOwnerDraw } from "@/lib/finance/transaction-types";
import { Banknote, Coins, Package, Building2, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AccountingPanel } from "@/components/finance/AccountingPanel";
import { CashExtraKpis } from "@/components/finance/CashExtraKpis";
import { SettlementsPanel } from "@/components/finance/SettlementsPanel";
import { VatDashPanel } from "@/components/finance/VatDashPanel";

export const Route = createFileRoute("/_authenticated/admin/finance/")({
  ssr: false,
  component: FinanceDashboard,
});

const PIE_COLORS = ["#d4b26a", "#7cc7b7", "#e07a7a", "#8ab4f8", "#b39ddb", "#f6ad55", "#68d391", "#fc8181", "#63b3ed", "#a0aec0"];

function FinanceDashboard() {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pickedMonth, setPickedMonth] = useState(""); // YYYY-MM specific month
  const [excludeDraws, setExcludeDraws] = useState(true);
  const [fMain, setFMain] = useState("");
  const [fSupplier, setFSupplier] = useState("");
  const [fSource, setFSource] = useState("");
  const [fAccount, setFAccount] = useState("");

  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [prevIncomes, setPrevIncomes] = useState<any[]>([]);
  const [prevExpenses, setPrevExpenses] = useState<any[]>([]);
  const [allDraws, setAllDraws] = useState<any[]>([]); // last-6-months owner draws for bar chart
  const [cats, setCats] = useState<any[]>([]);
  const [sups, setSups] = useState<any[]>([]);
  const [srcs, setSrcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState<DrawerSpec | null>(null);
  const [capital, setCapital] = useState<CapitalEntry[]>([]);
  const [allIncomes, setAllIncomes] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [manual, setManual] = useState<ManualBalances | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [editField, setEditField] = useState<null | "inventory_value" | "assets_value">(null);

  const range = useMemo(() => {
    if (pickedMonth) {
      const [y, m] = pickedMonth.split("-").map(Number);
      const pad = (n: number) => String(n).padStart(2, "0");
      const lastDay = new Date(y, m, 0).getDate();
      return { dateFrom: `${y}-${pad(m)}-01`, dateTo: `${y}-${pad(m)}-${pad(lastDay)}` };
    }
    return resolveRange(period, from, to);
  }, [period, from, to, pickedMonth]);
  const prev = useMemo(() => previousRange(range), [range]);
  const ownerDrawCatId = useMemo(() => cats.find((c) => c.system_slug === OWNER_DRAW_SLUG)?.id ?? null, [cats]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: allCats }, { data: allSups }, { data: allSrcs }] = await Promise.all([
      supabase.from("finance_categories").select("id, name, kind, parent_id, system_slug").eq("is_active", true).order("display_order"),
      supabase.from("finance_suppliers").select("id, name").eq("is_active", true).order("name"),
      supabase.from("finance_income_sources").select("id, name").eq("is_active", true).order("name"),
    ]);
    setCats(allCats ?? []);
    setSups(allSups ?? []);
    setSrcs(allSrcs ?? []);

    const buildIncQ = (r: { dateFrom: string | null; dateTo: string | null }) => {
      let q = supabase.from("finance_incomes").select("*").is("deleted_at", null).order("income_date", { ascending: false });
      if (r.dateFrom) q = q.gte("income_date", r.dateFrom);
      if (r.dateTo) q = q.lte("income_date", r.dateTo);
      if (fSource) q = q.eq("income_source_id", fSource);
      if (fAccount) q = q.eq("account_type", fAccount as "business" | "personal");
      return q;
    };
    const buildExpQ = (r: { dateFrom: string | null; dateTo: string | null }) => {
      let q = supabase.from("finance_expenses").select("*").is("deleted_at", null).order("expense_date", { ascending: false });
      if (r.dateFrom) q = q.gte("expense_date", r.dateFrom);
      if (r.dateTo) q = q.lte("expense_date", r.dateTo);
      if (fMain) q = q.eq("main_category_id", fMain);
      if (fSupplier) q = q.eq("supplier_id", fSupplier);
      if (fAccount) q = q.eq("account_type", fAccount as "business" | "personal");
      return q;
    };
    // last 6 months window for the owner-draws bar chart
    const drawsFrom = new Date(); drawsFrom.setMonth(drawsFrom.getMonth() - 5); drawsFrom.setDate(1);
    const drawsFromStr = `${drawsFrom.getFullYear()}-${String(drawsFrom.getMonth() + 1).padStart(2, "0")}-01`;

    const [{ data: inc }, { data: exp }, { data: incP }, { data: expP }, { data: drawsRaw }, capRows, { data: allInc }, { data: allExp }, manualRow, { data: accts }] = await Promise.all([
      buildIncQ(range),
      buildExpQ(range),
      buildIncQ(prev),
      buildExpQ(prev),
      supabase.from("finance_expenses").select("expense_date, amount, main_category_id, transaction_type, account_type, account_id").is("deleted_at", null).gte("expense_date", drawsFromStr),
      listCapital().catch(() => [] as CapitalEntry[]),
      supabase.from("finance_incomes").select("income_date, amount, transaction_type, account_type, account_id").is("deleted_at", null),
      supabase.from("finance_expenses").select("expense_date, amount, main_category_id, transaction_type, account_type, account_id").is("deleted_at", null),
      getManualBalances().catch(() => null),
      supabase.from("finance_accounts").select("id, opening_balance, opening_balance_date, include_in_company_cash_balance, is_active"),
    ]);
    setIncomes(inc ?? []);
    setExpenses(exp ?? []);
    setPrevIncomes(incP ?? []);
    setPrevExpenses(expP ?? []);
    setAllDraws(drawsRaw ?? []);
    setCapital(capRows ?? []);
    setAllIncomes(allInc ?? []);
    setAllExpenses(allExp ?? []);
    setManual(manualRow);
    setAccounts(accts ?? []);
    setLoading(false);
  }, [range, prev, fMain, fSupplier, fSource, fAccount]);

  useEffect(() => { load(); }, [load]);

  // Exclude personal-account rows from operational cash/expense/income analytics
  // unless the user explicitly filters by account_type=personal.
  const excludePersonal = fAccount !== "personal";
  const opIncomeRows = useMemo(
    () => (excludePersonal ? incomes.filter((r) => r.account_type !== "personal") : incomes),
    [incomes, excludePersonal],
  );
  const opExpenseRows = useMemo(
    () => (excludePersonal ? expenses.filter((r) => r.account_type !== "personal") : expenses),
    [expenses, excludePersonal],
  );
  const opPrevIncomeRows = useMemo(
    () => (excludePersonal ? prevIncomes.filter((r) => r.account_type !== "personal") : prevIncomes),
    [prevIncomes, excludePersonal],
  );
  const opPrevExpenseRows = useMemo(
    () => (excludePersonal ? prevExpenses.filter((r) => r.account_type !== "personal") : prevExpenses),
    [prevExpenses, excludePersonal],
  );

  // Derived aggregates
  const { operating, draws } = useMemo(() => splitExpenses(opExpenseRows, ownerDrawCatId), [opExpenseRows, ownerDrawCatId]);
  const { operating: prevOperating, draws: prevDraws } = useMemo(() => splitExpenses(opPrevExpenseRows, ownerDrawCatId), [opPrevExpenseRows, ownerDrawCatId]);
  const { operating: opIncomes } = useMemo(() => splitIncomes(opIncomeRows), [opIncomeRows]);
  const { operating: prevOpIncomes } = useMemo(() => splitIncomes(opPrevIncomeRows), [opPrevIncomeRows]);

  const totIncome = sum(opIncomes, (x: any) => x.amount);
  const totOpExpense = sum(operating, (x: any) => x.amount);
  const totDraws = sum(draws, (x: any) => x.amount);
  const netOp = totIncome - totOpExpense;
  const netAfterDraws = netOp - totDraws;

  const pTotIncome = sum(prevOpIncomes, (x: any) => x.amount);
  const pTotOpExpense = sum(prevOperating, (x: any) => x.amount);
  const pTotDraws = sum(prevDraws, (x: any) => x.amount);
  const pNetOp = pTotIncome - pTotOpExpense;
  const pNetAfterDraws = pNetOp - pTotDraws;

  // Capital-aware headline numbers (based on all-time data, not filter range)
  const investedCapital = useMemo(() => computeInvestedCapital(capital), [capital]);

  // Bank balance = sum of per-account (opening_balance + incomes after opening_date − expenses after opening_date)
  // across accounts flagged include_in_company_cash_balance. Owner draws are treated
  // like any other expense here (they leave the bank), but personal-account rows are excluded.
  const bankBalance = useMemo(() => {
    const eligible = accounts.filter((a) => a.include_in_company_cash_balance);
    let total = 0;
    for (const acc of eligible) {
      const openDate: string | null = acc.opening_balance_date ?? null;
      const opening = Number(acc.opening_balance ?? 0);
      const inc = allIncomes
        .filter((r: any) => r.account_id === acc.id && r.account_type !== "personal" && (!openDate || (r.income_date && r.income_date > openDate)))
        .reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
      const exp = allExpenses
        .filter((r: any) => r.account_id === acc.id && r.account_type !== "personal" && (!openDate || (r.expense_date && r.expense_date > openDate)))
        .reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
      total += opening + inc - exp;
    }
    return total;
  }, [accounts, allIncomes, allExpenses]);

  const openingTotal = useMemo(
    () => accounts.filter((a) => a.include_in_company_cash_balance).reduce((s, a) => s + Number(a.opening_balance ?? 0), 0),
    [accounts],
  );
  const earliestOpeningDate = useMemo(() => {
    const dates = accounts
      .filter((a) => a.include_in_company_cash_balance && a.opening_balance_date)
      .map((a) => a.opening_balance_date as string);
    return dates.length ? dates.sort()[0] : null;
  }, [accounts]);

  const liveNetWorth = bankBalance + Number(manual?.inventory_value ?? 0) + Number(manual?.assets_value ?? 0);


  // Time series
  const series = useMemo(() => buildTimeSeries(incomes, excludeDraws ? operating : expenses, range),
    [incomes, operating, expenses, excludeDraws, range]);
  const useMonth = series.length > 0 && series[0].label.length === 7;
  const cashflow = useMemo(() => cumulativeCashflow(
    series,
    bucketDraws(draws, useMonth),
  ), [series, draws, useMonth]);

  // Category donut
  const catDonut = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of operating) {
      if (!e.main_category_id) continue;
      totals.set(e.main_category_id, (totals.get(e.main_category_id) ?? 0) + Number(e.amount ?? 0));
    }
    return Array.from(totals.entries())
      .map(([id, value]) => ({ id, name: cats.find((c) => c.id === id)?.name ?? "—", value }))
      .sort((a, b) => b.value - a.value);
  }, [operating, cats]);

  // Top suppliers
  const topSups = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of operating) {
      if (!e.supplier_id) continue;
      totals.set(e.supplier_id, (totals.get(e.supplier_id) ?? 0) + Number(e.amount ?? 0));
    }
    return Array.from(totals.entries())
      .map(([id, total]) => ({ id, name: sups.find((s) => s.id === id)?.name ?? "—", total }))
      .sort((a, b) => b.total - a.total).slice(0, 5);
  }, [operating, sups]);

  // Draws by month (last 6 months) — use isOwnerDraw so transaction_type='owner_withdrawal' is included
  // even when the row is not linked to the owner-draw category.
  const drawSeries = useMemo(() => {
    const filtered = allDraws.filter((d) => d.account_type !== "personal" && isOwnerDraw(d, ownerDrawCatId));
    return drawsByMonth(filtered, 6);
  }, [allDraws, ownerDrawCatId]);

  // Review KPIs (all in filtered range, including draws)
  const incUnreviewed = incomes.filter((x) => x.internal_review_status === "unreviewed").length;
  const expUnreviewed = expenses.filter((x) => x.internal_review_status === "unreviewed").length;
  const needsFix = incomes.filter((x) => x.accountant_status === "needs_fix").length + expenses.filter((x) => x.accountant_status === "needs_fix").length;
  const missingAttExp = expenses.filter((x) => x.attachment_status === "not_attached").length;
  const missingAttInc = incomes.filter((x) => x.attachment_status === "not_attached").length;

  const open = (spec: Omit<DrawerSpec, "dateFrom" | "dateTo">) => setDrawer({ ...spec, dateFrom: range.dateFrom, dateTo: range.dateTo });
  const recentIncomes = incomes.slice(0, 5);
  const recentExpenses = expenses.slice(0, 5);

  const subs = cats.filter((c) => c.kind === "sub");
  const mains = cats.filter((c) => c.kind === "main");

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { v: "today", l: "اليوم" },
            { v: "week", l: "الأسبوع" },
            { v: "month", l: "الشهر" },
            { v: "year", l: "السنة" },
            { v: "all", l: "الكل" },
            { v: "custom", l: "مخصص" },
          ].map((o) => (
            <button key={o.v} onClick={() => { setPeriod(o.v as PeriodKey); setPickedMonth(""); }}
              className={`px-3 py-1.5 rounded-lg text-[12px] border ${!pickedMonth && period === o.v ? "bg-gold/15 border-gold/30 text-gold" : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"}`}>{o.l}</button>
          ))}
          {period === "custom" && !pickedMonth && (
            <>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 rounded-lg text-[12px] bg-background/60 border border-white/10" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 rounded-lg text-[12px] bg-background/60 border border-white/10" />
            </>
          )}
          <div className="inline-flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">شهر محدد:</span>
            {(() => {
              const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
              const nowY = new Date().getFullYear();
              const years = Array.from({ length: 7 }, (_, i) => nowY - 5 + i);
              const [py, pm] = pickedMonth ? pickedMonth.split("-") : ["", ""];
              const set = (y: string, m: string) => {
                if (y && m) setPickedMonth(`${y}-${m.padStart(2, "0")}`);
                else setPickedMonth("");
              };
              return (
                <>
                  <select value={pm} onChange={(e) => set(py || String(nowY), e.target.value)}
                    className={`px-2 py-1.5 rounded-lg text-[12px] bg-background/60 border ${pickedMonth ? "border-gold/40 text-gold" : "border-white/10"}`}>
                    <option value="">الشهر</option>
                    {MONTHS_AR.map((n, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{n}</option>)}
                  </select>
                  <select value={py} onChange={(e) => set(e.target.value, pm || "01")}
                    className={`px-2 py-1.5 rounded-lg text-[12px] bg-background/60 border ${pickedMonth ? "border-gold/40 text-gold" : "border-white/10"}`}>
                    <option value="">السنة</option>
                    {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                  </select>
                </>
              );
            })()}
            {pickedMonth && (
              <button onClick={() => setPickedMonth("")}
                className="px-2 py-1.5 rounded-lg text-[11px] border border-white/10 bg-white/5 hover:bg-white/10">مسح</button>
            )}
          </div>
          <label className={`ms-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] border cursor-pointer ${excludeDraws ? "bg-gold/10 border-gold/30 text-gold" : "bg-white/5 border-white/10 text-muted-foreground"}`}>
            <input type="checkbox" checked={excludeDraws} onChange={(e) => setExcludeDraws(e.target.checked)} className="accent-gold" />
            استثناء توزيع الأرباح من الحسابات
          </label>
          <button onClick={load} disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            تحديث
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <FilterSelect v={fMain} onChange={setFMain} ph="التصنيف الرئيسي" opts={mains.map((c) => ({ value: c.id, label: c.name }))} />
          <FilterSelect v={fSupplier} onChange={setFSupplier} ph="المورد" opts={sups.map((s) => ({ value: s.id, label: s.name }))} />
          <FilterSelect v={fSource} onChange={setFSource} ph="مصدر الدخل" opts={srcs.map((s) => ({ value: s.id, label: s.name }))} />
          <FilterSelect v={fAccount} onChange={setFAccount} ph="نوع الحساب" opts={[{ value: "business", label: "Business" }, { value: "personal", label: "Personal" }]} />
        </div>
      </div>

      <Tabs defaultValue="cash" className="space-y-5">
        <TabsList className="bg-white/5 border border-white/10 flex-wrap">
          <TabsTrigger value="cash">لوحة النقد</TabsTrigger>
          <TabsTrigger value="accounting">لوحة الأداء</TabsTrigger>
          <TabsTrigger value="settlements">لوحة التسويات</TabsTrigger>
          <TabsTrigger value="vat">لوحة الضريبة</TabsTrigger>
        </TabsList>

        <TabsContent value="cash" className="space-y-5 mt-0">
      {/* Headline: bank balance (opening + movements) + inventory + assets + net worth */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <BalanceCard
          icon={Banknote}
          label="رصيد البنك (افتتاحي + حركات)"
          value={bankBalance}
          tone="text-gold"
          accent="border-gold/30 bg-gradient-to-br from-gold/10 to-transparent"
          hint={
            accounts.some((a) => a.include_in_company_cash_balance)
              ? `الافتتاحي: ${fmtSAR(openingTotal)} ر.س · يُحدَّث من صفحة الحسابات`
              : "أضف الرصيد الافتتاحي من صفحة الحسابات المالية"
          }
          badge={earliestOpeningDate ? `منذ ${fmtArDate(earliestOpeningDate)}` : undefined}
        />
        <BalanceCard
          icon={Package}
          label="قيمة المخزون"
          value={Number(manual?.inventory_value ?? 0)}
          tone="text-emerald-300"
          onEdit={() => setEditField("inventory_value")}
        />
        <BalanceCard
          icon={Building2}
          label="قيمة الأصول"
          value={Number(manual?.assets_value ?? 0)}
          tone="text-sky-300"
          onEdit={() => setEditField("assets_value")}
        />
        <BalanceCard
          icon={PiggyBank}
          label="إجمالي الثروة"
          value={liveNetWorth}
          tone="text-foreground"
          accent="border-white/20 bg-white/10"
          hint="رصيد البنك + المخزون + الأصول"
        />
      </div>

      {/* Reference: invested capital */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>رأس المال المستثمر</span>
            <Coins size={14} className="text-sky-300" />
          </div>
          <div className="mt-1 text-lg font-semibold text-sky-300 font-mono">
            {fmtSAR(investedCapital)} <span className="text-[10px] text-muted-foreground">ر.س</span>
          </div>
        </div>
      </div>

      {editField && (
        <EditBalanceDialog
          field={editField}
          current={Number(manual?.[editField] ?? 0)}
          onClose={() => setEditField(null)}
          onSaved={(val) => {
            setManual((prev) => {
              if (!prev) return prev;
              return { ...prev, [editField]: val };
            });
            setEditField(null);
          }}
        />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">

        <Kpi icon={TrendingUp} label="إجمالي المقبوضات" value={fmtSAR(totIncome)} tone="text-emerald-300"
          change={pctChange(totIncome, pTotIncome)}
          onClick={() => open({ title: "المقبوضات", show: "income" })} />
        <Kpi icon={TrendingDown} label="إجمالي المدفوعات" value={fmtSAR(totOpExpense)} tone="text-red-300"
          change={pctChange(totOpExpense, pTotOpExpense)} invert
          onClick={() => open({ title: "المدفوعات", show: "expense" })} />
        <Kpi icon={Scale} label="صافي التدفق قبل سحوبات المالك" value={fmtSAR(netOp)} tone={netOp >= 0 ? "text-emerald-300" : "text-red-300"}
          change={pctChange(netOp, pNetOp)} />
        <Kpi icon={Wallet} label="سحوبات المالك" value={fmtSAR(totDraws)} tone="text-gold"
          change={pctChange(totDraws, pTotDraws)}
          onClick={() => ownerDrawCatId && open({ title: "سحوبات المالك", show: "expense", expenseFilter: { mainCategoryId: ownerDrawCatId } })} />
        <Kpi icon={PiggyBank} label="صافي التدفق النقدي" value={fmtSAR(netAfterDraws)} tone={netAfterDraws >= 0 ? "text-emerald-300" : "text-red-300"}
          change={pctChange(netAfterDraws, pNetAfterDraws)} />
      </div>
      <div className="text-[11px] text-muted-foreground -mt-1 px-1">
        * يمثل صافي التدفق النقدي الفرق بين المقبوضات والمدفوعات خلال الفترة، ولا يمثل صافي الربح المحاسبي.
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold mb-3">المقبوضات مقابل المدفوعات {excludeDraws ? "(تشغيلي)" : ""}</div>
          <div className="h-64">
            {series.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: "#888", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#888", fontSize: 10 }} width={70} />
                  <Tooltip contentStyle={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => fmtSAR(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="income" name="دخل" stroke="#7cc7b7" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expense" name="مصروفات" stroke="#e07a7a" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="net" name="صافي" stroke="#d4b26a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold mb-3">توزيع المصروفات التشغيلية</div>
          <div className="h-64">
            {catDonut.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={catDonut} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {catDonut.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => fmtSAR(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 space-y-1 text-[11px] max-h-24 overflow-y-auto">
            {catDonut.slice(0, 5).map((c, i) => (
              <button key={c.id} onClick={() => open({ title: `تصنيف: ${c.name}`, show: "expense", expenseFilter: { mainCategoryId: c.id } })}
                className="w-full flex items-center justify-between hover:bg-white/5 rounded px-1 py-0.5">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />{c.name}</span>
                <span className="font-mono text-muted-foreground">{fmtSAR(c.value)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold mb-3">توزيع الأرباح الشهري (آخر 6 أشهر)</div>
          <div className="h-56">
            {drawSeries.every((d) => d.amount === 0) ? <Empty label="لا توجد سحوبات مسجّلة" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={drawSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: "#888", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#888", fontSize: 10 }} width={70} />
                  <Tooltip contentStyle={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => fmtSAR(Number(v))} />
                  <Bar dataKey="amount" name="سحب" fill="#d4b26a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold mb-3">التدفق النقدي التراكمي (بعد السحوبات)</div>
          <div className="h-56">
            {cashflow.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashflow}>
                  <defs>
                    <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7cc7b7" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#7cc7b7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: "#888", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#888", fontSize: 10 }} width={70} />
                  <Tooltip contentStyle={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => fmtSAR(Number(v))} />
                  <Area type="monotone" dataKey="cumulative" name="تراكمي" stroke="#7cc7b7" fill="url(#cf)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Review KPIs (smaller) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <MiniCard icon={ClipboardCheck} label="دخل غير مراجع" value={incUnreviewed} onClick={() => open({ title: "دخل غير مراجع داخليًا", show: "income", incomeFilter: { internal: "unreviewed" } })} />
        <MiniCard icon={ClipboardCheck} label="مصروفات غير مراجعة" value={expUnreviewed} onClick={() => open({ title: "مصروفات غير مراجعة داخليًا", show: "expense", expenseFilter: { internal: "unreviewed" } })} />
        <MiniCard icon={AlertTriangle} label="تحتاج تعديل" value={needsFix} tone="text-red-300" onClick={() => open({ title: "عمليات تحتاج تعديل", show: "both", incomeFilter: { accountant: "needs_fix" }, expenseFilter: { accountant: "needs_fix" } })} />
        <MiniCard icon={FileWarning} label="مصروفات بدون مرفق" value={missingAttExp} tone="text-amber-300" onClick={() => open({ title: "مصروفات بدون مرفق", show: "expense", expenseFilter: { attachment: "not_attached" } })} />
        <MiniCard icon={FileWarning} label="دخل بدون مرفق" value={missingAttInc} tone="text-amber-300" onClick={() => open({ title: "دخل بدون مرفق", show: "income", incomeFilter: { attachment: "not_attached" } })} />
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentList title="آخر 5 عمليات دخل" rows={recentIncomes} dateField="income_date" subField="account_type" linkTo="/admin/finance/incomes" />
        <RecentList title="آخر 5 مصروفات" rows={recentExpenses} dateField="expense_date" subField="item_name" linkTo="/admin/finance/expenses" />
        <TopList title="أكثر 5 موردين صرفًا (تشغيلي)" items={topSups}
          onPick={(id, name) => open({ title: `مورد: ${name}`, show: "expense", expenseFilter: { supplierId: id } })} />
        <TopList title="أكثر 5 تصنيفات صرفًا (تشغيلي)" items={catDonut.slice(0, 5).map((c) => ({ id: c.id, name: c.name, total: c.value }))}
          onPick={(id, name) => open({ title: `تصنيف: ${name}`, show: "expense", expenseFilter: { mainCategoryId: id } })} />
      </div>

      {loading && <div className="text-center text-xs text-muted-foreground">جاري التحميل…</div>}
      {drawer && <FinanceRowsDrawer spec={drawer} onClose={() => setDrawer(null)} />}

      <CashExtraKpis from={range.dateFrom ?? null} to={range.dateTo ?? null} />
        </TabsContent>

        <TabsContent value="accounting" className="mt-0">
          <AccountingPanel from={range.dateFrom ?? "1970-01-01"} to={range.dateTo ?? new Date().toISOString().slice(0, 10)} />
        </TabsContent>

        <TabsContent value="settlements" className="mt-0">
          <SettlementsPanel from={range.dateFrom ?? null} to={range.dateTo ?? null} />
        </TabsContent>

        <TabsContent value="vat" className="mt-0">
          <VatDashPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone, change, invert, onClick }:
  { icon: any; label: string; value: string; tone?: string; change: number | null; invert?: boolean; onClick?: () => void }) {
  const dir = change === null ? 0 : change > 0.5 ? 1 : change < -0.5 ? -1 : 0;
  const positive = invert ? dir < 0 : dir > 0;
  const negative = invert ? dir > 0 : dir < 0;
  const chTone = dir === 0 ? "text-muted-foreground" : positive ? "text-emerald-300" : negative ? "text-red-300" : "text-muted-foreground";
  const ChIcon = dir === 0 ? Minus : dir > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={`text-right rounded-xl border border-white/10 bg-white/5 p-4 transition ${onClick ? "hover:bg-white/10 hover:border-gold/30 cursor-pointer" : "cursor-default"}`}>
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span><Icon size={15} /></div>
      <div className={`mt-2 text-xl font-semibold ${tone ?? ""}`}>{value}</div>
      <div className={`mt-1 flex items-center gap-1 text-[10px] ${chTone}`}>
        <ChIcon size={11} />
        {change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
        <span className="text-muted-foreground">مقابل الفترة السابقة</span>
      </div>
    </button>
  );
}

function MiniCard({ icon: Icon, label, value, tone, onClick }: { icon: any; label: string; value: number; tone?: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="text-right rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/10 hover:border-gold/30 transition">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>{label}</span><Icon size={13} /></div>
      <div className={`mt-1 text-lg font-semibold ${tone ?? ""}`}>{value}</div>
    </button>
  );
}

function FilterSelect({ v, onChange, ph, opts }: { v: string; onChange: (s: string) => void; ph: string; opts: { value: string; label: string }[] }) {
  return (
    <select value={v} onChange={(e) => onChange(e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-background/60 border border-white/10 text-[12px]">
      <option value="">{ph}</option>
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Empty({ label = "لا يوجد بيانات في الفترة المختارة" }: { label?: string }) {
  return <div className="w-full h-full flex items-center justify-center text-[11px] text-muted-foreground">{label}</div>;
}

function RecentList({ title, rows, dateField, subField, linkTo }: { title: string; rows: any[]; dateField: string; subField: string; linkTo: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">لا يوجد بيانات</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link key={r.id} to={linkTo}
              className="flex items-center justify-between gap-3 text-[12px] border-b border-white/5 pb-2 last:border-0 hover:bg-white/5 -mx-2 px-2 rounded">
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtArDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch { return iso; }
}

function BalanceCard({ icon: Icon, label, value, tone, accent, hint, badge, onEdit }: {
  icon: any; label: string; value: number; tone?: string; accent?: string; hint?: string; badge?: string; onEdit?: () => void;
}) {
  return (
    <div className={`rounded-2xl border p-5 relative ${accent ?? "border-white/10 bg-white/5"}`}>
      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <span>{label}</span>
        <div className="flex items-center gap-2">
          <Icon size={16} className={tone} />
          {onEdit && (
            <button onClick={onEdit} className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground" title="تعديل">
              <Pencil size={12} />
            </button>
          )}
        </div>
      </div>
      <div className={`mt-2 text-2xl font-semibold font-mono ${tone ?? ""}`}>
        {fmtSAR(value)} <span className="text-xs text-muted-foreground">ر.س</span>
      </div>
      {badge && (
        <div className="mt-2 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-muted-foreground font-mono">
          {badge}
        </div>
      )}
      {hint && <div className="mt-1 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function EditBalanceDialog({ field, current, onClose, onSaved }: {
  field: "cash_actual" | "inventory_value" | "assets_value";
  current: number;
  onClose: () => void;
  onSaved: (val: number) => void;
}) {
  const labels: Record<string, string> = {
    cash_actual: "النقد الفعلي (صرافة/بنك)",
    inventory_value: "قيمة المخزون",
    assets_value: "قيمة الأصول",
  };
  const [val, setVal] = useState(String(current));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const num = Number(val);
    if (!isFinite(num) || num < 0) { toast.error("مبلغ غير صحيح"); return; }
    setSaving(true);
    try {
      await updateManualBalances({ [field]: num } as any);
      toast.success("تم الحفظ");
      onSaved(num);
    } catch (e: any) {
      toast.error(e.message ?? "تعذر الحفظ");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-background border border-white/10 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-semibold text-sm">تعديل: {labels[field]}</div>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground mb-1">المبلغ (ر.س)</div>
          <input
            type="number"
            step="0.01"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 font-mono text-lg"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px] bg-white/5">إلغاء</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg text-[12px] bg-gold/20 border border-gold/40 text-gold disabled:opacity-50">
            <Check size={13} /> {saving ? "جاري…" : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TopList({ title, items, onPick }: { title: string; items: { id: string; name: string; total: number }[]; onPick: (id: string, name: string) => void }) {
  const max = Math.max(1, ...items.map((i) => i.total));
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">لا يوجد بيانات</div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <button key={it.id} onClick={() => onPick(it.id, it.name)} className="block w-full text-right text-[12px] -mx-2 px-2 py-1 rounded hover:bg-white/5">
              <div className="flex items-center justify-between mb-1">
                <span className="truncate">{it.name}</span>
                <span className="font-mono text-muted-foreground">{fmtSAR(it.total)}</span>
              </div>
              <div className="h-1.5 rounded bg-white/5 overflow-hidden">
                <div className="h-full bg-gold/40" style={{ width: `${(it.total / max) * 100}%` }} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
