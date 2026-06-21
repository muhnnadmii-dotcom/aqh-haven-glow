import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/finance/audit")({
  ssr: false,
  component: AuditPage,
});

function AuditPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [related, setRelated] = useState("");
  const [action, setAction] = useState("");
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("finance_audit_logs").select("*").order("changed_at", { ascending: false }).limit(500);
      setRows(data ?? []);
    })();
  }, []);
  const filtered = rows.filter((r) => (!related || r.related_type === related) && (!action || r.action === action));
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">سجل التعديلات المالية</h2>
      <div className="flex flex-wrap gap-2">
        <select value={related} onChange={(e) => setRelated(e.target.value)} className="px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]">
          <option value="">الكل</option>
          <option value="finance_incomes">دخل</option>
          <option value="finance_expenses">مصروفات</option>
          <option value="finance_suppliers">موردين</option>
          <option value="finance_attachments">مرفقات</option>
          <option value="finance_categories">تصنيفات</option>
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]">
          <option value="">كل الإجراءات</option>
          <option value="create">إنشاء</option>
          <option value="update">تعديل</option>
          <option value="delete">حذف</option>
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-[12px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-start px-3 py-2">الوقت</th>
              <th className="text-start px-3 py-2">الجدول</th>
              <th className="text-start px-3 py-2">الإجراء</th>
              <th className="text-start px-3 py-2">الحقل</th>
              <th className="text-start px-3 py-2">قبل</th>
              <th className="text-start px-3 py-2">بعد</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(r.changed_at).toLocaleString("ar-SA")}</td>
                <td className="px-3 py-2">{r.related_type}</td>
                <td className="px-3 py-2">{r.action}</td>
                <td className="px-3 py-2">{r.field_name ?? "—"}</td>
                <td className="px-3 py-2 max-w-[200px] truncate text-red-300/80">{r.old_value ?? "—"}</td>
                <td className="px-3 py-2 max-w-[200px] truncate text-emerald-300/80">{r.new_value ?? "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد سجلات</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
