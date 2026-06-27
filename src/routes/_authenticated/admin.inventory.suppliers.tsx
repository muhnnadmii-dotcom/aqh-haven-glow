import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import { toast } from "sonner";
import { Truck, Plus, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/inventory/suppliers")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getSessionUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id)
      .in("role", ["admin", "staff"]).limit(1).maybeSingle();
    if (!data) throw redirect({ to: "/admin" });
    return { role: data.role as "admin" | "staff" };
  },
  component: SuppliersPage,
});

type Supplier = {
  id: number; key: string; name_ar: string; name_en: string | null;
  phone: string | null; email: string | null; notes: string | null; is_active: boolean;
};

function SuppliersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);

  const listQ = useQuery({
    queryKey: ["aqh_suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_suppliers")
        .select("id,key,name_ar,name_en,phone,email,notes,is_active")
        .order("name_ar", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Supplier[];
    },
  });

  const countsQ = useQuery({
    queryKey: ["aqh_supplier_counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_product_suppliers").select("supplier_id");
      if (error) throw error;
      const m = new Map<number, number>();
      (data ?? []).forEach((r: any) => m.set(r.supplier_id, (m.get(r.supplier_id) ?? 0) + 1));
      return m;
    },
  });

  const delM = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("aqh_suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف المورد");
      qc.invalidateQueries({ queryKey: ["aqh_suppliers"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحذف"),
  });

  const filtered = (listQ.data ?? []).filter((s) => {
    if (!q) return true;
    const t = q.toLowerCase();
    return s.name_ar.toLowerCase().includes(t) ||
      (s.name_en ?? "").toLowerCase().includes(t) ||
      s.key.toLowerCase().includes(t);
  });

  return (
    <div className="space-y-5" dir="rtl">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 text-gold flex items-center justify-center">
          <Truck size={20} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">الموردين</h1>
          <p className="text-xs text-muted-foreground">إدارة قائمة الموردين الرسميين</p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30">
          <Plus size={14} className="ml-1" /> مورد جديد
        </Button>
      </header>

      <div className="relative">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو المفتاح…" className="pr-9" />
      </div>

      {listQ.isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="inline-block animate-spin" size={16} /> جارٍ التحميل…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-[12px]">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="text-start px-3 py-2">المورد</th>
                <th className="text-start px-3 py-2 hidden md:table-cell">المفتاح</th>
                <th className="text-start px-3 py-2 hidden md:table-cell">الهاتف</th>
                <th className="text-start px-3 py-2 hidden lg:table-cell">البريد</th>
                <th className="text-start px-3 py-2">المنتجات</th>
                <th className="text-start px-3 py-2">الحالة</th>
                <th className="text-start px-3 py-2 w-24">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-3 py-2">
                    <div className="font-medium">{s.name_ar}</div>
                    {s.name_en && <div className="text-[10px] text-muted-foreground" dir="ltr">{s.name_en}</div>}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] hidden md:table-cell" dir="ltr">{s.key}</td>
                  <td className="px-3 py-2 font-mono text-[11px] hidden md:table-cell" dir="ltr">{s.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-[11px] hidden lg:table-cell" dir="ltr">{s.email ?? "—"}</td>
                  <td className="px-3 py-2">{countsQ.data?.get(s.id) ?? 0}</td>
                  <td className="px-3 py-2">
                    {s.is_active
                      ? <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-300">نشط</Badge>
                      : <Badge variant="outline" className="text-[10px] border-white/20 text-muted-foreground">معطّل</Badge>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(s)}>
                        <Pencil size={12} />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-red-400"
                        onClick={() => {
                          if (confirm(`حذف "${s.name_ar}"؟ سيتم إزالة الروابط بالمنتجات.`)) delM.mutate(s.id);
                        }}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">لا توجد نتائج</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <SupplierDialog
          supplier={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["aqh_suppliers"] })}
        />
      )}
    </div>
  );
}

function SupplierDialog({
  supplier, onClose, onSaved,
}: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    key: supplier?.key ?? "",
    name_ar: supplier?.name_ar ?? "",
    name_en: supplier?.name_en ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    notes: supplier?.notes ?? "",
    is_active: supplier?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name_ar.trim() || !form.key.trim()) {
      toast.error("الاسم والمفتاح مطلوبان");
      return;
    }
    setSaving(true);
    const payload = {
      key: form.key.trim(),
      name_ar: form.name_ar.trim(),
      name_en: form.name_en.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };
    const { error } = supplier
      ? await supabase.from("aqh_suppliers").update(payload).eq("id", supplier.id)
      : await supabase.from("aqh_suppliers").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(supplier ? "تم التحديث" : "تمت الإضافة");
    onSaved(); onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{supplier ? "تعديل مورد" : "مورد جديد"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Field label="المفتاح (key)" required>
            <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="dunya_rabee" dir="ltr" />
          </Field>
          <Field label="الاسم بالعربية" required>
            <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder="دنيا الربيع" />
          </Field>
          <Field label="الاسم بالإنجليزية">
            <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} dir="ltr" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="الهاتف"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" /></Field>
            <Field label="البريد"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" /></Field>
          </div>
          <Field label="ملاحظات"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            نشط
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={saving} className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30">
            {saving ? <Loader2 className="animate-spin" size={14} /> : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-[11px] text-muted-foreground mb-1">{label}{required && <span className="text-red-400"> *</span>}</label>
      {children}
    </div>
  );
}
