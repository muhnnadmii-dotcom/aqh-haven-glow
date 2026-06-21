import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { Paperclip, Download, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ATTACHMENT_TYPES } from "@/lib/finance/constants";

export const Route = createFileRoute("/_authenticated/admin/finance/attachments")({
  ssr: false,
  component: AttachmentsPage,
});

function AttachmentsPage() {
  const roles = useFinanceRoles();
  const [rows, setRows] = useState<any[]>([]);
  const [incomeMap, setIncomeMap] = useState<Record<string, any>>({});
  const [expenseMap, setExpenseMap] = useState<Record<string, any>>({});
  const [supplierMap, setSupplierMap] = useState<Record<string, any>>({});
  const [type, setType] = useState("");
  const [related, setRelated] = useState("");
  const [month, setMonth] = useState("");

  const load = async () => {
    const { data } = await supabase.from("finance_attachments").select("*").order("created_at", { ascending: false });
    const list = data ?? [];
    setRows(list);
    const incIds = list.filter((x: any) => x.related_type === "income").map((x: any) => x.related_id);
    const expIds = list.filter((x: any) => x.related_type === "expense").map((x: any) => x.related_id);
    const supIds = list.filter((x: any) => x.related_type === "supplier").map((x: any) => x.related_id);
    const [{ data: incs }, { data: exps }, { data: sups }] = await Promise.all([
      incIds.length ? supabase.from("finance_incomes").select("id, amount, income_date, month, note").in("id", incIds) : Promise.resolve({ data: [] } as any),
      expIds.length ? supabase.from("finance_expenses").select("id, amount, expense_date, month, item_name").in("id", expIds) : Promise.resolve({ data: [] } as any),
      supIds.length ? supabase.from("finance_suppliers").select("id, name").in("id", supIds) : Promise.resolve({ data: [] } as any),
    ]);
    setIncomeMap(Object.fromEntries((incs ?? []).map((x: any) => [x.id, x])));
    setExpenseMap(Object.fromEntries((exps ?? []).map((x: any) => [x.id, x])));
    setSupplierMap(Object.fromEntries((sups ?? []).map((x: any) => [x.id, x])));
  };
  useEffect(() => { load(); }, []);

  const open = async (a: any) => {
    const { data, error } = await supabase.storage.from("finance-attachments").createSignedUrl(a.file_url, 600);
    if (error || !data) { toast.error("تعذر فتح الملف"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const del = async (a: any) => {
    if (!confirm(`حذف المرفق "${a.file_name}"؟`)) return;
    await supabase.storage.from("finance-attachments").remove([a.file_url]);
    const { error } = await supabase.from("finance_attachments").delete().eq("id", a.id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); load(); }
  };

  const months = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      const m = (r.related_type === "income" ? incomeMap[r.related_id]?.month : r.related_type === "expense" ? expenseMap[r.related_id]?.month : null);
      if (m) s.add(m);
    });
    return Array.from(s).sort().reverse();
  }, [rows, incomeMap, expenseMap]);

  const labelOfRelated = (r: any) => {
    if (r.related_type === "income") {
      const x = incomeMap[r.related_id];
      return x ? `دخل · ${x.income_date} · ${Number(x.amount).toFixed(2)}` : "—";
    }
    if (r.related_type === "expense") {
      const x = expenseMap[r.related_id];
      return x ? `${x.item_name || "مصروف"} · ${x.expense_date}` : "—";
    }
    if (r.related_type === "supplier") {
      const x = supplierMap[r.related_id];
      return x ? `مورد: ${x.name}` : "—";
    }
    return r.related_type;
  };

  const filtered = rows.filter((r) => {
    if (type && r.attachment_type !== type) return false;
    if (related && r.related_type !== related) return false;
    if (month) {
      const m = r.related_type === "income" ? incomeMap[r.related_id]?.month : r.related_type === "expense" ? expenseMap[r.related_id]?.month : null;
      if (m !== month) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">المرفقات المالية</h2>
      <div className="flex flex-wrap gap-2">
        <select value={related} onChange={(e) => setRelated(e.target.value)} className="px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]">
          <option value="">كل الأنواع</option>
          <option value="income">دخل</option>
          <option value="expense">مصروف</option>
          <option value="supplier">مورد</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]">
          <option value="">كل أنواع المرفقات</option>
          {ATTACHMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]">
          <option value="">كل الأشهر</option>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-[12px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-start px-3 py-2">الملف</th>
              <th className="text-start px-3 py-2">نوع المرفق</th>
              <th className="text-start px-3 py-2">يخص</th>
              <th className="text-start px-3 py-2">تاريخ الرفع</th>
              <th className="text-start px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="px-3 py-2 flex items-center gap-1.5"><Paperclip size={11} className="text-muted-foreground" />{r.file_name}</td>
                <td className="px-3 py-2">{r.attachment_type ?? "—"}</td>
                <td className="px-3 py-2">{labelOfRelated(r)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("ar-SA")}</td>
                <td className="px-3 py-2 flex gap-1">
                  <button onClick={() => open(r)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px]"><Download size={11} /> تحميل</button>
                  {r.related_type === "income" && (
                    <Link to="/admin/finance/incomes" className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px]"><ExternalLink size={11} /> فتح</Link>
                  )}
                  {r.related_type === "expense" && (
                    <Link to="/admin/finance/expenses" className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px]"><ExternalLink size={11} /> فتح</Link>
                  )}
                  {r.related_type === "supplier" && (
                    <Link to="/admin/finance/suppliers" className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px]"><ExternalLink size={11} /> فتح</Link>
                  )}
                  {roles.canManage && (
                    <button onClick={() => del(r)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 text-red-300 hover:bg-red-500/20 text-[11px]"><Trash2 size={11} /></button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد مرفقات</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
