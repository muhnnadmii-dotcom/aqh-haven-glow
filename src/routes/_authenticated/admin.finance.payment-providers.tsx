import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/finance/payment-providers")({
  ssr: false,
  component: ProvidersPage,
});

const TYPE_LABEL: Record<string, string> = {
  payment_gateway: "بوابة دفع",
  bnpl: "دفع لاحق (BNPL)",
  marketplace: "متجر إلكتروني",
};

function ProvidersPage() {
  const roles = useFinanceRoles();
  const [rows, setRows] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);

  const load = async () => {
    const [p, coa, sup] = await Promise.all([
      supabase.from("payment_providers" as any).select("*").order("name"),
      supabase.from("chart_of_accounts").select("id,code,name_ar").eq("account_type", "asset").order("code"),
      supabase.from("finance_suppliers").select("id,name").eq("is_active", true).order("name"),
    ]);
    if (p.error) toast.error(p.error.message); else setRows(p.data ?? []);
    setAccounts(coa.data ?? []);
    setSuppliers(sup.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const patch: any = {
      name: editing.name,
      provider_type: editing.provider_type,
      supplier_id: editing.supplier_id || null,
      clearing_account_id: editing.clearing_account_id || null,
      rounding_tolerance: Number(editing.rounding_tolerance) || 0.05,
      is_active: editing.is_active,
      notes: editing.notes || null,
    };
    const { error } = await supabase.from("payment_providers" as any).update(patch).eq("id", editing.id);
    if (error) toast.error(error.message);
    else { toast.success("تم الحفظ"); setEditing(null); load(); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">بوابات الدفع</h2>
        <p className="text-[11px] text-muted-foreground mt-1">إدارة بوابات الدفع (سلة، تابي، تمارا) وربطها بالحسابات الوسيطة في دليل الحسابات.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-[12px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-start px-3 py-2">الاسم</th>
              <th className="text-start px-3 py-2">الرمز</th>
              <th className="text-start px-3 py-2">النوع</th>
              <th className="text-start px-3 py-2">الحساب الوسيط</th>
              <th className="text-start px-3 py-2">المورد المرتبط</th>
              <th className="text-start px-3 py-2">هامش التقريب</th>
              <th className="text-start px-3 py-2">نشط</th>
              <th className="text-start px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const acc = accounts.find((a) => a.id === r.clearing_account_id);
              const sup = suppliers.find((s) => s.id === r.supplier_id);
              return (
                <tr key={r.id} className={`border-t border-white/5 ${!r.is_active ? "opacity-60" : ""}`}>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.provider_code}</td>
                  <td className="px-3 py-2">{TYPE_LABEL[r.provider_type]}</td>
                  <td className="px-3 py-2">{acc ? `${acc.code} — ${acc.name_ar}` : <span className="text-red-400">غير محدد</span>}</td>
                  <td className="px-3 py-2">{sup?.name ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2">{Number(r.rounding_tolerance).toFixed(2)}</td>
                  <td className="px-3 py-2">{r.is_active ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-red-400" />}</td>
                  <td className="px-3 py-2">
                    {roles.canManage && (
                      <button onClick={() => setEditing({ ...r })} className="p-1.5 rounded hover:bg-white/10"><Pencil size={12} /></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0b1220] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">تعديل بوابة الدفع</h3>
              <button onClick={() => setEditing(null)}><X size={16} /></button>
            </div>
            <label className="block text-[11px]">الاسم
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]" />
            </label>
            <label className="block text-[11px]">النوع
              <select value={editing.provider_type} onChange={(e) => setEditing({ ...editing, provider_type: e.target.value })} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
                <option value="payment_gateway">بوابة دفع</option>
                <option value="bnpl">دفع لاحق (BNPL)</option>
                <option value="marketplace">متجر إلكتروني</option>
              </select>
            </label>
            <label className="block text-[11px]">الحساب الوسيط
              <select value={editing.clearing_account_id ?? ""} onChange={(e) => setEditing({ ...editing, clearing_account_id: e.target.value })} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
                <option value="">—</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name_ar}</option>)}
              </select>
            </label>
            <label className="block text-[11px]">المورد المرتبط (لفواتير الرسوم)
              <select value={editing.supplier_id ?? ""} onChange={(e) => setEditing({ ...editing, supplier_id: e.target.value })} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
                <option value="">—</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="block text-[11px]">هامش التقريب المسموح (ريال)
              <input type="number" step="0.01" value={editing.rounding_tolerance} onChange={(e) => setEditing({ ...editing, rounding_tolerance: e.target.value })} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]" />
            </label>
            <label className="inline-flex items-center gap-2 text-[12px]">
              <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> نشط
            </label>
            <label className="block text-[11px]">ملاحظات
              <textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]" rows={2} />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded border border-white/10 text-[12px]">إلغاء</button>
              <button onClick={save} className="px-3 py-1.5 rounded bg-gold/20 border border-gold/40 text-gold text-[12px]">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
