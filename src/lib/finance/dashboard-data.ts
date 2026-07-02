// Dashboard aggregation helpers for the finance dashboard.
export type PeriodKey = "today" | "week" | "month" | "year" | "all" | "custom";

export type DateRange = { dateFrom: string | null; dateTo: string | null };

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function resolveRange(period: PeriodKey, from: string, to: string): DateRange {
  const now = new Date();
  if (period === "today") return { dateFrom: iso(now), dateTo: iso(now) };
  if (period === "week") {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    return { dateFrom: iso(d), dateTo: iso(now) };
  }
  if (period === "month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { dateFrom: iso(first), dateTo: iso(last) };
  }
  if (period === "year") {
    return { dateFrom: `${now.getFullYear()}-01-01`, dateTo: `${now.getFullYear()}-12-31` };
  }
  if (period === "custom") return { dateFrom: from || null, dateTo: to || null };
  return { dateFrom: null, dateTo: null };
}

/** Previous period of equal length ending the day before dateFrom. */
export function previousRange(cur: DateRange): DateRange {
  if (!cur.dateFrom || !cur.dateTo) return { dateFrom: null, dateTo: null };
  const from = new Date(cur.dateFrom);
  const to = new Date(cur.dateTo);
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - (days - 1));
  return { dateFrom: iso(prevFrom), dateTo: iso(prevTo) };
}

export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return cur === 0 ? 0 : null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export function sum<T>(arr: T[], get: (x: T) => number): number {
  return arr.reduce((a, b) => a + (Number(get(b)) || 0), 0);
}

/** Group expenses into operating vs owner-draw using the owner-draw main category id. */
export function splitExpenses(expenses: any[], ownerDrawCatId: string | null) {
  const draws = ownerDrawCatId ? expenses.filter((e) => e.main_category_id === ownerDrawCatId) : [];
  const operating = ownerDrawCatId ? expenses.filter((e) => e.main_category_id !== ownerDrawCatId) : expenses;
  return { operating, draws };
}

/** Build a time series (day or month buckets) for income / operating expense / net. */
export function buildTimeSeries(
  incomes: any[],
  operating: any[],
  range: DateRange,
): { label: string; income: number; expense: number; net: number }[] {
  if (!range.dateFrom || !range.dateTo) return [];
  const from = new Date(range.dateFrom);
  const to = new Date(range.dateTo);
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const useMonth = days > 62;

  const bucketKey = (dateStr: string) => (useMonth ? dateStr.slice(0, 7) : dateStr.slice(0, 10));

  const buckets = new Map<string, { income: number; expense: number }>();
  if (useMonth) {
    const cur = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cur <= end) {
      buckets.set(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`, { income: 0, expense: 0 });
      cur.setMonth(cur.getMonth() + 1);
    }
  } else {
    const cur = new Date(from);
    while (cur <= to) {
      buckets.set(iso(cur), { income: 0, expense: 0 });
      cur.setDate(cur.getDate() + 1);
    }
  }

  for (const r of incomes) {
    const k = bucketKey(r.income_date ?? "");
    const b = buckets.get(k); if (b) b.income += Number(r.amount ?? 0);
  }
  for (const r of operating) {
    const k = bucketKey(r.expense_date ?? "");
    const b = buckets.get(k); if (b) b.expense += Number(r.amount ?? 0);
  }

  return Array.from(buckets.entries()).map(([label, v]) => ({
    label,
    income: v.income,
    expense: v.expense,
    net: v.income - v.expense,
  }));
}

/** Cumulative running total of net (income - operating - draws) across the series. */
export function cumulativeCashflow(
  series: { label: string; income: number; expense: number }[],
  drawsByBucket: Map<string, number>,
): { label: string; cumulative: number }[] {
  let acc = 0;
  return series.map((s) => {
    const draws = drawsByBucket.get(s.label) ?? 0;
    acc += s.income - s.expense - draws;
    return { label: s.label, cumulative: acc };
  });
}

export function bucketDraws(draws: any[], useMonth: boolean): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of draws) {
    const dateStr = d.expense_date ?? "";
    const k = useMonth ? dateStr.slice(0, 7) : dateStr.slice(0, 10);
    m.set(k, (m.get(k) ?? 0) + Number(d.amount ?? 0));
  }
  return m;
}

/** Last N months of owner-draw totals, ending at "now". */
export function drawsByMonth(draws: any[], months = 6): { label: string; amount: number }[] {
  const out: { label: string; amount: number }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const amount = draws
      .filter((x) => (x.expense_date ?? "").slice(0, 7) === key)
      .reduce((a, b) => a + Number(b.amount ?? 0), 0);
    out.push({ label: key, amount });
  }
  return out;
}
