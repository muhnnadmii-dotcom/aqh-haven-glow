import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { Download, FileSpreadsheet, FileText, AlertTriangle, FileWarning } from "lucide-react";
import { toast } from "sonner";
import { ACCOUNTANT_STATUS, ATTACHMENT_STATUS, ACCOUNT_TYPES, INTERNAL_REVIEW, labelOf, fmtSAR } from "@/lib/finance/constants";
import { exportCSV, exportXLSX } from "@/lib/finance/xlsx";

export const Route = createFileRoute("/_authenticated/admin/finance/export")({
  ssr: false,
  component: ExportPage,
});

const INC_HEADERS = ["التاريخ","المبلغ","مصدر الدخل","الشهر","نوع الحساب","الملاحظة","مراجعة داخلية","حالة المحاسب","ملاحظة المحاسب","حالة المرفق","أسماء المرفقات"];
const EXP_HEADERS = ["التاريخ","المبلغ","البيان","المورد","التصنيف الرئيسي","التصنيف الفرعي","الشهر","نوع الحساب","الملاحظة","مراجعة داخلية","حالة المحاسب","ملاحظة المحاسب","حالة المرفق","أسماء المرفقات"];

function ExportPage() {
  const roles = useFinanceRoles();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState("");
  const [account, setAccount] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [mainId, setMainId] = useState("");
  const [subId, setSubId] = useState("");
  const [internal, setInternal] = useState("");
  const [acct, setAcct] = useState("");
  const [att, setAtt] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [busy, setBusy] = useState(false);

  const [sources, setSources] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [mains, setMains] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: sp }, { data: c }] = await Promise.all([
        supabase.from("finance_income_sources").select("id, name").order("display_order"),
        supabase.from("finance_suppliers").select("id, name").order("name"),
        supabase.from("finance_categories").select("*").order("display_order"),
      ]);
      setSources(s ?? []);
      setSuppliers(sp ?? []);
      setMains((c ?? []).filter((x: any) => x.kind === "main"));
      setSubs((c ?? []).filter((x: any) => x.kind === "sub"));
    })();
  }, []);

  if (!roles.canExport) return <div className="text-sm text-muted-foreground">لا تملك صلاحية التصدير.</div>;

  const nameOf = (arr: any[], id: string | null) => arr.find((x) => x.id === id)?.name ?? "";
  const monthLabel = month || (from && to ? `${from}_${to}` : `${Date.now()}`);

  async function loadAttachmentsMap(type: "income" | "expense", ids: string[]) {
    if (!ids.length) return {} as Record<string, string[]>;
    const { data } = await supabase
      .from("finance_attachments")
      .select("related_id,file_name")
      .eq("related_type", type)
      .in("related_id", ids);
    const m: Record<string, string[]> = {};
    (data ?? []).forEach((r: any) => {
      (m[r.related_id] = m[r.related_id] || []).push(r.file_name);
    });
    return m;
  }

  async function getIncomes() {
    let q = supabase.from("finance_incomes").select("*").order("income_date");
    if (!includeArchived) q = q.is("deleted_at", null);
    if (from) q = q.gte("income_date", from);
    if (to) q = q.lte("income_date", to);
    if (month) q = q.eq("month", month);
    if (account) q = q.eq("account_type", account as any);
    if (sourceId) q = q.eq("income_source_id", sourceId);
    if (internal) q = q.eq("internal_review_status", internal as any);
    if (acct) q = q.eq("accountant_status", acct as any);
    if (att) q = q.eq("attachment_status", att as any);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }
  async function getExpenses() {
    let q = supabase.from("finance_expenses").select("*").order("expense_date");
    if (!includeArchived) q = q.is("deleted_at", null);
    if (from) q = q.gte("expense_date", from);
    if (to) q = q.lte("expense_date", to);
    if (month) q = q.eq("month", month);
    if (account) q = q.eq("account_type", account as any);
    if (supplierId) q = q.eq("supplier_id", supplierId);
    if (mainId) q = q.eq("main_category_id", mainId);
    if (subId) q = q.eq("sub_category_id", subId);
    if (internal) q = q.eq("internal_review_status", internal as any);
    if (acct) q = q.eq("accountant_status", acct as any);
    if (att) q = q.eq("attachment_status", att as any);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  function incRows(data: any[], atts: Record<string, string[]>) {
    return data.map((r: any) => [
      r.income_date, Number(r.amount ?? 0), nameOf(sources, r.income_source_id), r.month,
      labelOf(ACCOUNT_TYPES, r.account_type), r.note ?? "",
      labelOf(INTERNAL_REVIEW, r.internal_review_status),
      labelOf(ACCOUNTANT_STATUS, r.accountant_status),
      r.accountant_note ?? "", labelOf(ATTACHMENT_STATUS, r.attachment_status),
      (atts[r.id] ?? []).join(" | "),
    ] as (string | number | null)[]);
  }
  function expRows(data: any[], atts: Record<string, string[]>) {
    return data.map((r: any) => [
      r.expense_date, Number(r.amount ?? 0), r.item_name,
      nameOf(suppliers, r.supplier_id) || r.supplier_name || "",
      nameOf(mains, r.main_category_id), nameOf(subs, r.sub_category_id),
      r.month, labelOf(ACCOUNT_TYPES, r.account_type), r.note ?? "",
      labelOf(INTERNAL_REVIEW, r.internal_review_status),
      labelOf(ACCOUNTANT_STATUS, r.accountant_status),
      r.accountant_note ?? "", labelOf(ATTACHMENT_STATUS, r.attachment_status),
      (atts[r.id] ?? []).join(" | "),
    ] as (string | number | null)[]);
  }

  const subsForMain = mainId ? subs.filter((s) => s.parent_id === mainId) : subs;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e: any) { toast.error(e.message ?? "خطأ"); } finally { setBusy(false); }
  };

  const exportIncomes = (kind: "csv" | "xlsx") => run(async () => {
    const data = await getIncomes();
    const atts = await loadAttachmentsMap("income", data.map((x) => x.id));
    const rows = incRows(data, atts);
    if (kind === "csv") exportCSV(`incomes_${monthLabel}.csv`, INC_HEADERS, rows);
    else exportXLSX(`incomes_${monthLabel}.xlsx`, [{ name: "Incomes", headers: INC_HEADERS, rows }]);
    toast.success(`تم تصدير ${data.length} عملية دخل`);
  });

  const exportExpenses = (kind: "csv" | "xlsx") => run(async () => {
    const data = await getExpenses();
    const atts = await loadAttachmentsMap("expense", data.map((x) => x.id));
    const rows = expRows(data, atts);
    if (kind === "csv") exportCSV(`expenses_${monthLabel}.csv`, EXP_HEADERS, rows);
    else exportXLSX(`expenses_${monthLabel}.xlsx`, [{ name: "Expenses", headers: EXP_HEADERS, rows }]);
    toast.success(`تم تصدير ${data.length} مصروف`);
  });

  const exportMonthlyReport = () => run(async () => {
    const [incomes, expenses] = await Promise.all([getIncomes(), getExpenses()]);
    const incAtts = await loadAttachmentsMap("income", incomes.map((x: any) => x.id));
    const expAtts = await loadAttachmentsMap("expense", expenses.map((x: any) => x.id));
    const totalInc = incomes.reduce((a, b) => a + Number(b.amount ?? 0), 0);
    const totalExp = expenses.reduce((a, b) => a + Number(b.amount ?? 0), 0);
    const bySource: Record<string, number> = {};
    incomes.forEach((r: any) => {
      const k = nameOf(sources, r.income_source_id) || "—";
      bySource[k] = (bySource[k] ?? 0) + Number(r.amount ?? 0);
    });
    const byCategory: Record<string, number> = {};
    expenses.forEach((r: any) => {
      const k = nameOf(mains, r.main_category_id) || "—";
      byCategory[k] = (byCategory[k] ?? 0) + Number(r.amount ?? 0);
    });
    const needsFix = [...incomes, ...expenses].filter((r: any) => r.accountant_status === "needs_fix");
    const noAttachments = [...incomes, ...expenses].filter((r: any) => r.attachment_status === "not_attached");

    exportXLSX(`finance_report_${monthLabel}.xlsx`, [
      {
        name: "ملخص",
        headers: ["البند", "القيمة"],
        rows: [
          ["الفترة", `${from || "—"} إلى ${to || "—"} (شهر: ${month || "—"})`],
          ["إجمالي الدخل", totalInc],
          ["إجمالي المصروفات", totalExp],
          ["الصافي التقريبي", totalInc - totalExp],
          ["عدد عمليات الدخل", incomes.length],
          ["عدد المصروفات", expenses.length],
          ["تحتاج تعديل", needsFix.length],
          ["بدون مرفقات", noAttachments.length],
        ],
      },
      {
        name: "دخل حسب المصدر",
        headers: ["المصدر", "الإجمالي"],
        rows: Object.entries(bySource).map(([k, v]) => [k, v]),
      },
      {
        name: "مصروفات حسب التصنيف",
        headers: ["التصنيف الرئيسي", "الإجمالي"],
        rows: Object.entries(byCategory).map(([k, v]) => [k, v]),
      },
      { name: "Incomes", headers: INC_HEADERS, rows: incRows(incomes, incAtts) },
      { name: "Expenses", headers: EXP_HEADERS, rows: expRows(expenses, expAtts) },
    ]);
    toast.success("تم تصدير التقرير الشهري");
  });

  const exportNeedsFix = () => run(async () => {
    const [{ data: inc }, { data: exp }] = await Promise.all([
      supabase.from("finance_incomes").select("*").eq("accountant_status", "needs_fix").is("deleted_at", null),
      supabase.from("finance_expenses").select("*").eq("accountant_status", "needs_fix").is("deleted_at", null),
    ]);
    const ia = await loadAttachmentsMap("income", (inc ?? []).map((x) => x.id));
    const ea = await loadAttachmentsMap("expense", (exp ?? []).map((x) => x.id));
    exportXLSX(`needs_fix_${Date.now()}.xlsx`, [
      { name: "Incomes-NeedsFix", headers: INC_HEADERS, rows: incRows(inc ?? [], ia) },
      { name: "Expenses-NeedsFix", headers: EXP_HEADERS, rows: expRows(exp ?? [], ea) },
    ]);
    toast.success("تم التصدير");
  });

  const exportUnreviewed = () => run(async () => {
    const [{ data: inc }, { data: exp }] = await Promise.all([
      supabase.from("finance_incomes").select("*").eq("accountant_status", "not_reviewed").is("deleted_at", null),
      supabase.from("finance_expenses").select("*").eq("accountant_status", "not_reviewed").is("deleted_at", null),
    ]);
    const ia = await loadAttachmentsMap("income", (inc ?? []).map((x) => x.id));
    const ea = await loadAttachmentsMap("expense", (exp ?? []).map((x) => x.id));
    exportXLSX(`unreviewed_${Date.now()}.xlsx`, [
      { name: "Incomes-Unreviewed", headers: INC_HEADERS, rows: incRows(inc ?? [], ia) },
      { name: "Expenses-Unreviewed", headers: EXP_HEADERS, rows: expRows(exp ?? [], ea) },
    ]);
    toast.success("تم التصدير");
  });

  const exportNoAttachments = (type: "income" | "expense") => run(async () => {
    if (type === "income") {
      const { data } = await supabase.from("finance_incomes").select("*").eq("attachment_status", "not_attached").is("deleted_at", null);
      exportXLSX(`incomes_no_attachments_${Date.now()}.xlsx`, [{ name: "Incomes", headers: INC_HEADERS, rows: incRows(data ?? [], {}) }]);
    } else {
      const { data } = await supabase.from("finance_expenses").select("*").eq("attachment_status", "not_attached").is("deleted_at", null);
      exportXLSX(`expenses_no_attachments_${Date.now()}.xlsx`, [{ name: "Expenses", headers: EXP_HEADERS, rows: expRows(data ?? [], {}) }]);
    }
    toast.success("تم التصدير");
  });

  const exportSuppliers = () => run(async () => {
    const [{ data: sups }, { data: exps }] = await Promise.all([
      supabase.from("finance_suppliers").select("*").order("name"),
      supabase.from("finance_expenses").select("supplier_id, amount"),
    ]);
    const totals: Record<string, { sum: number; count: number }> = {};
    (exps ?? []).forEach((e: any) => {
      if (!e.supplier_id) return;
      totals[e.supplier_id] = totals[e.supplier_id] || { sum: 0, count: 0 };
      totals[e.supplier_id].sum += Number(e.amount ?? 0);
      totals[e.supplier_id].count += 1;
    });
    const headers = ["الاسم","الشركة","الجوال","الإيميل","المدينة","الدولة","النوع","نشط","عدد العمليات","إجمالي المصروفات","ملاحظات"];
    const rows = (sups ?? []).map((s: any) => [
      s.name, s.company_name ?? "", s.phone ?? "", s.email ?? "", s.city ?? "", s.country ?? "",
      s.supplier_type ?? "", s.is_active ? "نعم" : "لا",
      totals[s.id]?.count ?? 0, totals[s.id]?.sum ?? 0, s.notes ?? "",
    ]);
    exportXLSX(`suppliers_${Date.now()}.xlsx`, [{ name: "Suppliers", headers, rows }]);
    toast.success("تم تصدير الموردين");
  });

  return (
    <div className="space-y-5 max-w-4xl">
      <h2 className="text-base font-semibold">التصدير للمحاسب</h2>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="text-[12px] font-semibold text-muted-foreground">الفلاتر</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          <Fld label="من تاريخ"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="inp" /></Fld>
          <Fld label="إلى تاريخ"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="inp" /></Fld>
          <Fld label="الشهر (YYYY-MM)"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="inp" /></Fld>
          <Fld label="نوع الحساب"><select value={account} onChange={(e) => setAccount(e.target.value)} className="inp"><option value="">الكل</option>{ACCOUNT_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select></Fld>
          <Fld label="مصدر الدخل"><select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="inp"><option value="">الكل</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Fld>
          <Fld label="المورد"><select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="inp"><option value="">الكل</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Fld>
          <Fld label="تصنيف رئيسي"><select value={mainId} onChange={(e) => { setMainId(e.target.value); setSubId(""); }} className="inp"><option value="">الكل</option>{mains.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
          <Fld label="تصنيف فرعي"><select value={subId} onChange={(e) => setSubId(e.target.value)} className="inp" disabled={!mainId}><option value="">الكل</option>{subsForMain.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
          <Fld label="مراجعة داخلية"><select value={internal} onChange={(e) => setInternal(e.target.value)} className="inp"><option value="">الكل</option>{INTERNAL_REVIEW.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select></Fld>
          <Fld label="حالة المحاسب"><select value={acct} onChange={(e) => setAcct(e.target.value)} className="inp"><option value="">الكل</option>{ACCOUNTANT_STATUS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select></Fld>
          <Fld label="حالة المرفق"><select value={att} onChange={(e) => setAtt(e.target.value)} className="inp"><option value="">الكل</option>{ATTACHMENT_STATUS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select></Fld>
        </div>
      </div>

      <Section title="تصدير الدخل والمصروفات (يحترم الفلاتر)">
        <Btn onClick={() => exportIncomes("csv")} disabled={busy} icon={FileText}>دخل CSV</Btn>
        <Btn onClick={() => exportIncomes("xlsx")} disabled={busy} icon={FileSpreadsheet}>دخل XLSX</Btn>
        <Btn onClick={() => exportExpenses("csv")} disabled={busy} icon={FileText}>مصروفات CSV</Btn>
        <Btn onClick={() => exportExpenses("xlsx")} disabled={busy} icon={FileSpreadsheet}>مصروفات XLSX</Btn>
      </Section>

      <Section title="تقرير شهري شامل">
        <Btn onClick={exportMonthlyReport} disabled={busy} icon={FileSpreadsheet}>تقرير الشهر XLSX</Btn>
      </Section>

      <Section title="تقارير المحاسب (تشمل كل الفترات)">
        <Btn onClick={exportNeedsFix} disabled={busy} icon={AlertTriangle}>تحتاج تعديل</Btn>
        <Btn onClick={exportUnreviewed} disabled={busy} icon={AlertTriangle}>لم تتم مراجعتها</Btn>
        <Btn onClick={() => exportNoAttachments("expense")} disabled={busy} icon={FileWarning}>مصروفات بدون مرفق</Btn>
        <Btn onClick={() => exportNoAttachments("income")} disabled={busy} icon={FileWarning}>دخل بدون مرفق</Btn>
      </Section>

      <Section title="بيانات مرجعية">
        <Btn onClick={exportSuppliers} disabled={busy} icon={FileSpreadsheet}>الموردين</Btn>
      </Section>

      <style>{`.inp{width:100%;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);font-size:12px;color:inherit} .inp:disabled{opacity:.6}`}</style>
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="text-[11px] text-muted-foreground mb-1">{label}</div>{children}</label>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="text-[12px] font-semibold text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
function Btn({ onClick, disabled, icon: Icon, children }: { onClick: () => void; disabled?: boolean; icon: any; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[12px] hover:bg-gold/25 disabled:opacity-50">
      <Icon size={13} /> {children}
    </button>
  );
}
