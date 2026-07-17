import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { Plus, X, Pencil, EyeOff, Eye, Building2, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/finance/accounts")({
  ssr: false,
  component: AccountsPage,
});

const OWNER_LABEL: Record<string, string> = { company: "حساب المنشأة", owner: "حساب شخصي للمالك" };
const KIND_LABEL: Record<string, string> = { bank: "بنك", cash: "نقد", wallet: "محفظة", payment_gateway: "بوابة دفع", other: "أخرى" };

function AccountsPage() {
  const roles = useFinanceRoles();
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("finance_accounts").select("*").order("sort_order").order("name");
    if (error) toast.error(error.message);
    else setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const toggleActive = async (r: any) => {
    const { error } = await supabase.from("finance_accounts").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) toast.error(error.message); else load();
  };

  const filtered = rows.filter((r) => showInactive || r.is_active);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">الحسابات المالية</h2>
          <p className="text-[11px] text-muted-foreground mt-1">أدر حسابات المنشأة والحسابات الشخصية للمالك المستخدمة في عمليات النشاط.</p>
        </div>
        {roles.canManage && (
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[12px] hover:bg-gold/25"><Plus size={14} /> إضافة حساب</button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> عرض غير النشطين
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-[12px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-start px-3 py-2">الاسم</th>
              <th className="text-start px-3 py-2">مالك الحساب</th>
              <th className="text-start px-3 py-2">النوع</th>
              <th className="text-start px-3 py-2">ضمن نقد المنشأة</th>
              <th className="text-start px-3 py-2">يسمح بمعاملات النشاط</th>
              <th className="text-start px-3 py-2">نشط</th>
              <th className="text-start px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className={`border-t border-white/5 hover:bg-white/5 ${!r.is_active ? "opacity-60" : ""}`}>
                <td className="px-3 py-2">
                  <div className="font-medium">{r.name_ar || r.name}</div>
                  {r.name_ar && <div className="text-[10px] text-muted-foreground">{r.name}</div>}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1">
                    {r.account_owner_type === "owner" ? <User size={12} className="text-amber-400" /> : <Building2 size={12} className="text-emerald-400" />}
                    {OWNER_LABEL[r.account_owner_type]}
                  </span>
                </td>
                <td className="px-3 py-2">{KIND_LABEL[r.account_kind]}</td>
                <td className="px-3 py-2">{r.include_in_company_cash_balance ? "نعم" : "لا"}</td>
                <td className="px-3 py-2">{r.allow_business_transactions ? "نعم" : "لا"}</td>
                <td className="px-3 py-2">{r.is_active ? "نعم" : "لا"}</td>
                <td className="px-3 py-2 flex gap-1">
                  {roles.canManage && <button onClick={() => setEditing(r)} className="p-1.5 rounded bg-white/5 hover:bg-white/10" title="تعديل"><Pencil size={11} /></button>}
                  {roles.canManage && (
                    <button onClick={() => toggleActive(r)} className="p-1.5 rounded bg-white/5 hover:bg-white/10" title={r.is_active ? "تعطيل" : "تفعيل"}>
                      {r.is_active ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">
                لا توجد حسابات بعد. أضف حساب المنشأة الرئيسي وحسابك الشخصي (إن كنت تستقبل تحصيلات النشاط عليه).
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-muted-foreground leading-relaxed">
        <div className="font-semibold text-amber-300 mb-1">قواعد مهمة</div>
        <ul className="list-disc ps-4 space-y-0.5">
          <li>الحساب التجاري: مالك = <b>المنشأة</b> ويُحتسب ضمن نقد المنشأة.</li>
          <li>الحساب الشخصي: مالك = <b>المالك</b>، <b>لا</b> يُحتسب ضمن نقد المنشأة، ويُسمح بتسجيل معاملات النشاط عليه.</li>
          <li>لا يدخل الرصيد الكامل للحساب الشخصي ضمن رصيد المنشأة، فقط الحركات المصنَّفة كحركات نشاط.</li>
        </ul>
      </div>

      {(editing || creating) && (
        <AccountDialog row={editing} onClose={() => { setEditing(null); setCreating(false); }} onSaved={() => { setEditing(null); setCreating(false); load(); }} />
      )}
    </div>
  );
}

function AccountDialog({ row, onClose, onSaved }: any) {
  const isNew = !row;
  const [f, setF] = useState({
    name: row?.name ?? "",
    name_ar: row?.name_ar ?? "",
    account_owner_type: row?.account_owner_type ?? "company",
    account_kind: row?.account_kind ?? "bank",
    include_in_company_cash_balance: row?.include_in_company_cash_balance ?? true,
    allow_business_transactions: row?.allow_business_transactions ?? true,
    is_active: row?.is_active ?? true,
    sort_order: row?.sort_order ?? 0,
    notes: row?.notes ?? "",
    opening_balance: row?.opening_balance ?? 0,
    opening_balance_date: row?.opening_balance_date ?? "",
  });
  const [saving, setSaving] = useState(false);

  // Enforce sensible defaults per owner type
  const setOwner = (v: "company" | "owner") => {
    setF((s) => ({
      ...s,
      account_owner_type: v,
      include_in_company_cash_balance: v === "company",
      allow_business_transactions: true,
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      if (!f.name.trim()) throw new Error("الاسم مطلوب");
      const payload = {
        ...f,
        name: f.name.trim(),
        name_ar: f.name_ar.trim() || null,
        opening_balance: Number(f.opening_balance) || 0,
        opening_balance_date: f.opening_balance_date || null,
      };
      const q = isNew
        ? supabase.from("finance_accounts").insert(payload)
        : supabase.from("finance_accounts").update(payload).eq("id", row.id);
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
          <div className="font-semibold">{isNew ? "حساب مالي جديد" : "تعديل الحساب"}</div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded"><X size={16} /></button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <label className="block col-span-2">
            <div className="text-[11px] text-muted-foreground mb-1">الاسم بالعربية *</div>
            <input value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} placeholder="مثال: بنك الأهلي - المنشأة" className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]" />
          </label>
          <label className="block col-span-2">
            <div className="text-[11px] text-muted-foreground mb-1">اسم مختصر (يظهر في القوائم) *</div>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="مثال: NCB-Business" className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]" />
          </label>

          <label className="block">
            <div className="text-[11px] text-muted-foreground mb-1">مالك الحساب</div>
            <select value={f.account_owner_type} onChange={(e) => setOwner(e.target.value as any)} className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]">
              <option value="company">حساب المنشأة</option>
              <option value="owner">حساب شخصي للمالك</option>
            </select>
          </label>
          <label className="block">
            <div className="text-[11px] text-muted-foreground mb-1">نوع الحساب</div>
            <select value={f.account_kind} onChange={(e) => setF({ ...f, account_kind: e.target.value })} className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]">
              <option value="bank">بنك</option>
              <option value="cash">نقد</option>
              <option value="wallet">محفظة (STC Pay …)</option>
              <option value="payment_gateway">بوابة دفع</option>
              <option value="other">أخرى</option>
            </select>
          </label>

          <label className="col-span-2 inline-flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={f.include_in_company_cash_balance} onChange={(e) => setF({ ...f, include_in_company_cash_balance: e.target.checked })} />
            يُحتسب ضمن نقد المنشأة
            <span className="text-[10px] text-muted-foreground">(يجب أن يكون معطّلًا للحسابات الشخصية)</span>
          </label>
          <label className="col-span-2 inline-flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={f.allow_business_transactions} onChange={(e) => setF({ ...f, allow_business_transactions: e.target.checked })} />
            يُسمح بتسجيل معاملات النشاط عليه
          </label>

          <label className="block">
            <div className="text-[11px] text-muted-foreground mb-1">ترتيب العرض</div>
            <input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]" />
          </label>
          <label className="block">
            <div className="text-[11px] text-muted-foreground mb-1">الحالة</div>
            <select value={f.is_active ? "1" : "0"} onChange={(e) => setF({ ...f, is_active: e.target.value === "1" })} className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]">
              <option value="1">نشط</option>
              <option value="0">غير نشط</option>
            </select>
          </label>

          <label className="block">
            <div className="text-[11px] text-muted-foreground mb-1">الرصيد الافتتاحي (ر.س)</div>
            <input
              type="number"
              step="0.01"
              value={f.opening_balance}
              onChange={(e) => setF({ ...f, opening_balance: e.target.value as any })}
              className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px] font-mono"
            />
            <div className="text-[10px] text-muted-foreground mt-1">الرصيد الفعلي في هذا التاريخ. تُضاف عليه الحركات بعد التاريخ.</div>
          </label>
          <label className="block">
            <div className="text-[11px] text-muted-foreground mb-1">تاريخ الرصيد الافتتاحي</div>
            <input
              type="date"
              value={f.opening_balance_date ?? ""}
              onChange={(e) => setF({ ...f, opening_balance_date: e.target.value })}
              className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]"
            />
          </label>

          <label className="col-span-2 block">
            <div className="text-[11px] text-muted-foreground mb-1">ملاحظات</div>
            <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px] min-h-[60px]" />
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
