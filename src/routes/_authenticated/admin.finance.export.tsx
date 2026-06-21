import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { ACCOUNTANT_STATUS, ATTACHMENT_STATUS, ACCOUNT_TYPES, INTERNAL_REVIEW, labelOf } from "@/lib/finance/constants";

export const Route = createFileRoute("/_authenticated/admin/finance/export")({
  ssr: false,
  component: ExportPage,
});

function toCSV(headers: string[], rows: (string | number | null)[][]) {
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + [headers.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}
function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function ExportPage() {
  const roles = useFinanceRoles();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [account, setAccount] = useState("");
  const canExport = roles.canExport;

  if (!canExport) return <div className="text-sm text-muted-foreground">لا تملك صلاحية التصدير.</div>;

  const exportIncomes = async () => {
    let q = supabase.from("finance_incomes").select("*").order("income_date");
    if (from) q = q.gte("income_date", from);
    if (to) q = q.lte("income_date", to);
    if (account) q = q.eq("account_type", account as any);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    const { data: srcs } = await supabase.from("finance_income_sources").select("id, name");
    const srcName = (id: string) => srcs?.find((s: any) => s.id === id)?.name ?? "";
    const headers = ["التاريخ","المبلغ","مصدر الدخل","الشهر","نوع الحساب","الملاحظة","مراجعة داخلية","حالة المحاسب","ملاحظة المحاسب","حالة المرفق"];
    const rows = (data ?? []).map((r: any) => [
      r.income_date, r.amount, srcName(r.income_source_id), r.month,
      labelOf(ACCOUNT_TYPES, r.account_type), r.note ?? "",
      labelOf(INTERNAL_REVIEW, r.internal_review_status),
      labelOf(ACCOUNTANT_STATUS, r.accountant_status),
      r.accountant_note ?? "", labelOf(ATTACHMENT_STATUS, r.attachment_status),
    ]);
    download(`incomes_${Date.now()}.csv`, toCSV(headers, rows));
    toast.success("تم التصدير");
  };

  const exportExpenses = async () => {
    let q = supabase.from("finance_expenses").select("*").order("expense_date");
    if (from) q = q.gte("expense_date", from);
    if (to) q = q.lte("expense_date", to);
    if (account) q = q.eq("account_type", account as any);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    const [{ data: sups }, { data: cats }] = await Promise.all([
      supabase.from("finance_suppliers").select("id, name"),
      supabase.from("finance_categories").select("id, name"),
    ]);
    const nameOf = (arr: any[], id: string) => arr?.find((x: any) => x.id === id)?.name ?? "";
    const headers = ["التاريخ","المبلغ","البيان","المورد","التصنيف الرئيسي","التصنيف الفرعي","الشهر","نوع الحساب","الملاحظة","مراجعة داخلية","حالة المحاسب","ملاحظة المحاسب","حالة المرفق"];
    const rows = (data ?? []).map((r: any) => [
      r.expense_date, r.amount, r.item_name, nameOf(sups ?? [], r.supplier_id) || r.supplier_name || "",
      nameOf(cats ?? [], r.main_category_id), nameOf(cats ?? [], r.sub_category_id),
      r.month, labelOf(ACCOUNT_TYPES, r.account_type), r.note ?? "",
      labelOf(INTERNAL_REVIEW, r.internal_review_status),
      labelOf(ACCOUNTANT_STATUS, r.accountant_status),
      r.accountant_note ?? "", labelOf(ATTACHMENT_STATUS, r.attachment_status),
    ]);
    download(`expenses_${Date.now()}.csv`, toCSV(headers, rows));
    toast.success("تم التصدير");
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-base font-semibold">التصدير للمحاسب</h2>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label><div className="text-[11px] text-muted-foreground mb-1">من تاريخ</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full px-2 py-1.5 rounded bg-background/60 border border-white/10 text-[12px]" /></label>
        <label><div className="text-[11px] text-muted-foreground mb-1">إلى تاريخ</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full px-2 py-1.5 rounded bg-background/60 border border-white/10 text-[12px]" /></label>
        <label><div className="text-[11px] text-muted-foreground mb-1">نوع الحساب</div>
          <select value={account} onChange={(e) => setAccount(e.target.value)} className="w-full px-2 py-1.5 rounded bg-background/60 border border-white/10 text-[12px]">
            <option value="">الكل</option>
            {ACCOUNT_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select></label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={exportIncomes} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[12px]"><Download size={13} /> تصدير الدخل (CSV)</button>
        <button onClick={exportExpenses} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[12px]"><Download size={13} /> تصدير المصروفات (CSV)</button>
      </div>
    </div>
  );
}
