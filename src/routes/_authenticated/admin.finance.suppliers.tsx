import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { Plus, X, Pencil, EyeOff, Eye, Info } from "lucide-react";
import { toast } from "sonner";
import { fmtSAR } from "@/lib/finance/constants";
import { AttachmentsPanel } from "@/components/finance/AttachmentsPanel";

export const Route = createFileRoute("/_authenticated/admin/finance/suppliers")({
  ssr: false,
  component: SuppliersPage,
});

function SuppliersPage() {
  const roles = useFinanceRoles();
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<Record<string, { total: number; count: number }>>({});
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const load = async () => {
    const [{ data: sups }, { data: exps }] = await Promise.all([
      supabase.from("finance_suppliers").select("*").order("name"),
      supabase.from("finance_expenses").select("supplier_id, amount"),
    ]);
    setRows(sups ?? []);
    const t: Record<string, { total: number; count: number }> = {};
    (exps ?? []).forEach((e: any) => {
      if (!e.supplier_id) return;
      t[e.supplier_id] = t[e.supplier_id] || { total: 0, count: 0 };
      t[e.supplier_id].total += Number(e.amount ?? 0);
      t[e.supplier_id].count += 1;
    });
    setTotals(t);
  };
  useEffect(() => { load(); }, []);

  const toggleActive = async (s: any) => {
    const { error } = await supabase.from("finance_suppliers").update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) toast.error(error.message); else { toast.success(s.is_active ? "تم التعطيل" : "تم التفعيل"); load(); }
  };

  const filtered = rows.filter((r) => {
    if (!showInactive && !r.is_active) return false;
    if (q && !`${r.name} ${r.company_name ?? ""} ${r.phone ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">الموردين</h2>
        {roles.canManage && (
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[12px] hover:bg-gold/25"><Plus size={14} /> إضافة مورد</button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الشركة أو الجوال…" className="flex-1 max-w-sm px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px]" />
        <label className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> عرض غير النشطين
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-[12px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-start px-3 py-2">الاسم</th>
              <th className="text-start px-3 py-2">الشركة</th>
              <th className="text-start px-3 py-2">الجوال</th>
              <th className="text-start px-3 py-2">النوع</th>
              <th className="text-start px-3 py-2">عدد العمليات</th>
              <th className="text-start px-3 py-2">إجمالي المصروفات</th>
              <th className="text-start px-3 py-2">نشط</th>
              <th className="text-start px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={`border-t border-white/5 hover:bg-white/5 ${!r.is_active ? "opacity-60" : ""}`}>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.company_name || "—"}</td>
                <td className="px-3 py-2">{r.phone || "—"}</td>
                <td className="px-3 py-2">{r.supplier_type || "—"}</td>
                <td className="px-3 py-2">{totals[r.id]?.count ?? 0}</td>
                <td className="px-3 py-2 font-mono">{fmtSAR(totals[r.id]?.total ?? 0)}</td>
                <td className="px-3 py-2">{r.is_active ? "نعم" : "لا"}</td>
                <td className="px-3 py-2 flex gap-1">
                  <button onClick={() => setDetails(r)} className="p-1.5 rounded bg-white/5 hover:bg-white/10" title="تفاصيل"><Info size={11} /></button>
                  {roles.canManage && <button onClick={() => setEditing(r)} className="p-1.5 rounded bg-white/5 hover:bg-white/10" title="تعديل"><Pencil size={11} /></button>}
                  {roles.canManage && (
                    <button onClick={() => toggleActive(r)} className="p-1.5 rounded bg-white/5 hover:bg-white/10" title={r.is_active ? "تعطيل" : "تفعيل"}>
                      {r.is_active ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">لا يوجد موردين</td></tr>}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <SupplierDialog row={editing} onClose={() => { setEditing(null); setCreating(false); }} onSaved={() => { setEditing(null); setCreating(false); load(); }} />
      )}
      {details && <SupplierDetails supplier={details} onClose={() => setDetails(null)} canManage={roles.canManage} />}
    </div>
  );
}

function SupplierDialog({ row, onClose, onSaved }: any) {
  const isNew = !row;
  const [f, setF] = useState({
    name: row?.name ?? "",
    company_name: row?.company_name ?? "",
    phone: row?.phone ?? "",
    email: row?.email ?? "",
    city: row?.city ?? "",
    country: row?.country ?? "",
    supplier_type: row?.supplier_type ?? "",
    notes: row?.notes ?? "",
    is_active: row?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      if (!f.name.trim()) throw new Error("الاسم مطلوب");
      const { data: u } = await supabase.auth.getUser();
      const payload: any = { ...f };
      if (isNew) payload.created_by = u.user?.id ?? null;
      const q = isNew
        ? supabase.from("finance_suppliers").insert(payload)
        : supabase.from("finance_suppliers").update(payload).eq("id", row.id);
      const { error } = await q;
      if (error) throw error;
      toast.success("تم الحفظ");
      onSaved();
    } catch (e: any) { toast.error("تعذر الحفظ: " + e.message); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-background border border-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="font-semibold">{isNew ? "مورد جديد" : "تعديل المورد"}</div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded"><X size={16} /></button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {[
            ["الاسم *", "name"], ["اسم الشركة", "company_name"], ["الجوال", "phone"], ["الإيميل", "email"],
            ["المدينة", "city"], ["الدولة", "country"], ["نوع المورد", "supplier_type"],
          ].map(([l, k]) => (
            <label key={k} className="block"><div className="text-[11px] text-muted-foreground mb-1">{l}</div>
              <input value={(f as any)[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]" /></label>
          ))}
          <label className="col-span-2 block"><div className="text-[11px] text-muted-foreground mb-1">ملاحظات</div>
            <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px] min-h-[60px]" /></label>
          <label className="col-span-2 inline-flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> نشط
          </label>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-white/10">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px] bg-white/5 hover:bg-white/10">إلغاء</button>
          <button disabled={saving} onClick={save} className="px-4 py-1.5 rounded-lg text-[12px] bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30">{saving ? "..." : "حفظ"}</button>
        </div>
      </div>
    </div>
  );
}

function SupplierDetails({ supplier, onClose, canManage }: any) {
  const [expenses, setExpenses] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("finance_expenses").select("*").eq("supplier_id", supplier.id).order("expense_date", { ascending: false });
      setExpenses(data ?? []);
    })();
  }, [supplier.id]);

  const total = expenses.reduce((a, b) => a + Number(b.amount ?? 0), 0);
  const byMonth: Record<string, number> = {};
  expenses.forEach((e) => { byMonth[e.month] = (byMonth[e.month] ?? 0) + Number(e.amount ?? 0); });
  const monthsSorted = Object.entries(byMonth).sort(([a], [b]) => (a > b ? -1 : 1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-background border border-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <div className="font-semibold">{supplier.name}</div>
            <div className="text-[11px] text-muted-foreground">{supplier.company_name || "—"} · {supplier.phone || "—"}</div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="إجمالي المصروفات" value={fmtSAR(total)} />
            <Stat label="عدد العمليات" value={String(expenses.length)} />
            <Stat label="المدينة" value={supplier.city || "—"} />
            <Stat label="الدولة" value={supplier.country || "—"} />
          </div>

          <div>
            <div className="text-[12px] font-semibold mb-2">إجمالي حسب الشهر</div>
            {monthsSorted.length === 0 ? (
              <div className="text-[11px] text-muted-foreground text-center py-3">لا توجد بيانات</div>
            ) : (
              <div className="space-y-1">
                {monthsSorted.map(([m, v]) => (
                  <div key={m} className="flex items-center justify-between px-3 py-1.5 rounded bg-white/5 text-[12px]"><span>{m}</span><span className="font-mono">{fmtSAR(v)}</span></div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="text-[12px] font-semibold mb-2">آخر 10 مصروفات</div>
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-white/5 text-muted-foreground">
                  <tr><th className="text-start px-2 py-1.5">التاريخ</th><th className="text-start px-2 py-1.5">البيان</th><th className="text-start px-2 py-1.5">المبلغ</th></tr>
                </thead>
                <tbody>
                  {expenses.slice(0, 10).map((e) => (
                    <tr key={e.id} className="border-t border-white/5"><td className="px-2 py-1.5">{e.expense_date}</td><td className="px-2 py-1.5 truncate max-w-[200px]">{e.item_name}</td><td className="px-2 py-1.5 font-mono">{fmtSAR(e.amount)}</td></tr>
                  ))}
                  {expenses.length === 0 && <tr><td colSpan={3} className="text-center py-4 text-muted-foreground">لا توجد مصروفات</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <AttachmentsPanel relatedType="supplier" relatedId={supplier.id} canManage={canManage} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-white/5 p-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className="text-sm font-semibold mt-1">{value}</div></div>;
}
