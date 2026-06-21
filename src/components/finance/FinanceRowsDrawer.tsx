import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fmtSAR, labelOf, toneOf, ACCOUNTANT_STATUS, ATTACHMENT_STATUS } from "@/lib/finance/constants";
import { X, ArrowLeft } from "lucide-react";

export type DrawerFilter = {
  internal?: "unreviewed";
  accountant?: "not_reviewed" | "needs_fix";
  attachment?: "not_attached";
  supplierId?: string;
  mainCategoryId?: string;
};

export type DrawerSpec = {
  title: string;
  show: "income" | "expense" | "both";
  dateFrom: string | null;
  dateTo: string | null;
  incomeFilter?: DrawerFilter;
  expenseFilter?: DrawerFilter;
};

type Row = any;

export function FinanceRowsDrawer({ spec, onClose }: { spec: DrawerSpec; onClose: () => void }) {
  const [tab, setTab] = useState<"income" | "expense">(spec.show === "expense" ? "expense" : "income");
  const [incomes, setIncomes] = useState<Row[]>([]);
  const [expenses, setExpenses] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const wantIncome = spec.show === "income" || spec.show === "both";
      const wantExpense = spec.show === "expense" || spec.show === "both";
      const tasks: Promise<any>[] = [];

      if (wantIncome) {
        let q = supabase.from("finance_incomes").select("*").is("deleted_at", null).order("income_date", { ascending: false });
        if (spec.dateFrom) q = q.gte("income_date", spec.dateFrom);
        if (spec.dateTo) q = q.lte("income_date", spec.dateTo);
        if (spec.incomeFilter?.internal) q = q.eq("internal_review_status", spec.incomeFilter.internal);
        if (spec.incomeFilter?.accountant) q = q.eq("accountant_status", spec.incomeFilter.accountant);
        if (spec.incomeFilter?.attachment) q = q.eq("attachment_status", spec.incomeFilter.attachment);
        tasks.push(Promise.resolve(q));
      } else tasks.push(Promise.resolve({ data: [] }));

      if (wantExpense) {
        let q = supabase.from("finance_expenses").select("*").is("deleted_at", null).order("expense_date", { ascending: false });
        if (spec.dateFrom) q = q.gte("expense_date", spec.dateFrom);
        if (spec.dateTo) q = q.lte("expense_date", spec.dateTo);
        if (spec.expenseFilter?.internal) q = q.eq("internal_review_status", spec.expenseFilter.internal);
        if (spec.expenseFilter?.accountant) q = q.eq("accountant_status", spec.expenseFilter.accountant);
        if (spec.expenseFilter?.attachment) q = q.eq("attachment_status", spec.expenseFilter.attachment);
        if (spec.expenseFilter?.supplierId) q = q.eq("supplier_id", spec.expenseFilter.supplierId);
        if (spec.expenseFilter?.mainCategoryId) q = q.eq("main_category_id", spec.expenseFilter.mainCategoryId);
        tasks.push(Promise.resolve(q));
      } else tasks.push(Promise.resolve({ data: [] }));

      tasks.push(Promise.resolve(supabase.from("finance_income_sources").select("id, name")));
      tasks.push(Promise.resolve(supabase.from("finance_suppliers").select("id, name")));
      tasks.push(Promise.resolve(supabase.from("finance_categories").select("id, name")));

      const [incRes, expRes, srcRes, supRes, catRes] = await Promise.all(tasks);
      setIncomes(incRes.data ?? []);
      setExpenses(expRes.data ?? []);
      setSources((srcRes.data as any) ?? []);
      setSuppliers((supRes.data as any) ?? []);
      setCats((catRes.data as any) ?? []);
      setLoading(false);
    })();
  }, [spec]);

  const incomeTotal = incomes.reduce((a, b) => a + Number(b.amount ?? 0), 0);
  const expenseTotal = expenses.reduce((a, b) => a + Number(b.amount ?? 0), 0);
  const srcName = (id: string | null) => sources.find((s) => s.id === id)?.name ?? "—";
  const supName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "—";
  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? "—";

  const periodLabel = (() => {
    if (!spec.dateFrom && !spec.dateTo) return "كل الفترة";
    if (spec.dateFrom && !spec.dateTo) return `من ${spec.dateFrom}`;
    if (!spec.dateFrom && spec.dateTo) return `حتى ${spec.dateTo}`;
    return `${spec.dateFrom} → ${spec.dateTo}`;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl h-full overflow-y-auto bg-background border-s border-white/10 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <div className="font-semibold text-sm">{spec.title}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{periodLabel}</div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded"><X size={16} /></button>
        </div>

        {spec.show === "both" && (
          <div className="flex items-center gap-1 px-3 pt-3">
            <button onClick={() => setTab("income")} className={`px-3 py-1.5 text-[12px] rounded-lg border ${tab === "income" ? "bg-gold/15 border-gold/30 text-gold" : "bg-white/5 border-white/10 text-muted-foreground"}`}>دخل ({incomes.length})</button>
            <button onClick={() => setTab("expense")} className={`px-3 py-1.5 text-[12px] rounded-lg border ${tab === "expense" ? "bg-gold/15 border-gold/30 text-gold" : "bg-white/5 border-white/10 text-muted-foreground"}`}>مصروفات ({expenses.length})</button>
          </div>
        )}

        <div className="flex-1 p-4 space-y-3">
          {loading && <div className="text-center text-xs text-muted-foreground py-8">جاري التحميل…</div>}

          {!loading && (spec.show === "income" || (spec.show === "both" && tab === "income")) && (
            <RowsTable
              kind="income"
              rows={incomes}
              total={incomeTotal}
              nameOf={srcName}
              dateField="income_date"
              labelField={(r) => srcName(r.income_source_id)}
            />
          )}
          {!loading && (spec.show === "expense" || (spec.show === "both" && tab === "expense")) && (
            <RowsTable
              kind="expense"
              rows={expenses}
              total={expenseTotal}
              nameOf={supName}
              dateField="expense_date"
              labelField={(r) => r.item_name || supName(r.supplier_id) || catName(r.main_category_id)}
            />
          )}

          {spec.show === "both" && !loading && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-[12px] grid grid-cols-3 gap-2">
              <div><div className="text-muted-foreground">إجمالي الدخل</div><div className="font-mono text-emerald-300">{fmtSAR(incomeTotal)}</div></div>
              <div><div className="text-muted-foreground">إجمالي المصروفات</div><div className="font-mono text-red-300">{fmtSAR(expenseTotal)}</div></div>
              <div><div className="text-muted-foreground">الصافي</div><div className={`font-mono ${incomeTotal - expenseTotal >= 0 ? "text-emerald-300" : "text-red-300"}`}>{fmtSAR(incomeTotal - expenseTotal)}</div></div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-3 border-t border-white/10">
          {(spec.show === "income" || spec.show === "both") && (
            <Link to="/admin/finance/incomes" onClick={onClose} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] bg-white/5 border border-white/10 hover:bg-white/10">
              <ArrowLeft size={12} /> فتح في صفحة الدخل
            </Link>
          )}
          {(spec.show === "expense" || spec.show === "both") && (
            <Link to="/admin/finance/expenses" onClick={onClose} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] bg-white/5 border border-white/10 hover:bg-white/10">
              <ArrowLeft size={12} /> فتح في صفحة المصروفات
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function RowsTable({
  kind,
  rows,
  total,
  dateField,
  labelField,
}: {
  kind: "income" | "expense";
  rows: Row[];
  total: number;
  nameOf: (id: string | null) => string;
  dateField: string;
  labelField: (r: Row) => string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5">
      <div className="px-3 py-2 flex items-center justify-between text-[12px] border-b border-white/10">
        <span className="text-muted-foreground">{rows.length} عملية</span>
        <span className="font-mono">{fmtSAR(total)}</span>
      </div>
      {rows.length === 0 ? (
        <div className="text-center text-xs text-muted-foreground py-8">لا توجد عمليات</div>
      ) : (
        <div className="max-h-[55vh] overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-white/5 text-muted-foreground sticky top-0">
              <tr>
                <th className="text-start px-3 py-1.5">التاريخ</th>
                <th className="text-start px-3 py-1.5">{kind === "income" ? "المصدر/البيان" : "البيان/المورد"}</th>
                <th className="text-start px-3 py-1.5">المبلغ</th>
                <th className="text-start px-3 py-1.5">المحاسب</th>
                <th className="text-start px-3 py-1.5">المرفق</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-3 py-1.5 whitespace-nowrap">{r[dateField]}</td>
                  <td className="px-3 py-1.5 max-w-[200px] truncate" title={labelField(r)}>{labelField(r)}</td>
                  <td className="px-3 py-1.5 font-mono">{fmtSAR(r.amount)}</td>
                  <td className="px-3 py-1.5"><span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border ${toneOf(ACCOUNTANT_STATUS, r.accountant_status)}`}>{labelOf(ACCOUNTANT_STATUS, r.accountant_status)}</span></td>
                  <td className="px-3 py-1.5"><span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border ${toneOf(ATTACHMENT_STATUS, r.attachment_status)}`}>{labelOf(ATTACHMENT_STATUS, r.attachment_status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
