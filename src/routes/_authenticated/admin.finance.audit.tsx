import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/finance/audit")({
  ssr: false,
  component: AuditPage,
});

const RELATED_LABEL: Record<string, string> = {
  finance_incomes: "دخل",
  finance_expenses: "مصروفات",
  finance_suppliers: "موردين",
  finance_attachments: "مرفقات",
  finance_categories: "تصنيفات",
  finance_income_sources: "مصادر الدخل",
};

function AuditPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [related, setRelated] = useState("");
  const [action, setAction] = useState("");
  const [field, setField] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("finance_audit_logs")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(1000);
      setRows(data ?? []);
    })();
  }, []);

  const fields = useMemo(() => Array.from(new Set(rows.map((r) => r.field_name).filter(Boolean))).sort(), [rows]);

  const filtered = rows.filter((r) => {
    if (related && r.related_type !== related) return false;
    if (action && r.action !== action) return false;
    if (field && r.field_name !== field) return false;
    if (from && r.changed_at < from) return false;
    if (to && r.changed_at > to + "T23:59:59") return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">سجل التعديلات المالية</h2>
      <div className="text-[11px] text-muted-foreground">السجل قراءة فقط — لا حذف ولا تعديل.</div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        <Fld><select value={related} onChange={(e) => setRelated(e.target.value)} className="inp"><option value="">كل الجداول</option>{Object.entries(RELATED_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Fld>
        <Fld><select value={action} onChange={(e) => setAction(e.target.value)} className="inp"><option value="">كل الإجراءات</option><option value="create">إنشاء</option><option value="update">تعديل</option><option value="delete">حذف</option></select></Fld>
        <Fld><select value={field} onChange={(e) => setField(e.target.value)} className="inp"><option value="">كل الحقول</option>{fields.map((f) => <option key={f} value={f}>{f}</option>)}</select></Fld>
        <Fld><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="inp" placeholder="من" /></Fld>
        <Fld><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="inp" placeholder="إلى" /></Fld>
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
                <td className="px-3 py-2">{RELATED_LABEL[r.related_type] ?? r.related_type}</td>
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
      <style>{`.inp{width:100%;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);font-size:12px}`}</style>
    </div>
  );
}

function Fld({ children }: { children: React.ReactNode }) { return <div>{children}</div>; }
