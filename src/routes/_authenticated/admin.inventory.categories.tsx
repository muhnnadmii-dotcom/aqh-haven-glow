import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import { toast } from "sonner";
import { FolderTree, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/inventory/categories")({
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
  component: CategoriesPage,
});

type Category = {
  id: number; name_ar: string; slug: string;
  parent_id: number | null; sort_order: number; is_active: boolean;
};

function CategoriesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const listQ = useQuery({
    queryKey: ["aqh_cats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_product_categories")
        .select("id,name_ar,slug,parent_id,sort_order,is_active")
        .order("sort_order").order("name_ar");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const countsQ = useQuery({
    queryKey: ["aqh_cat_counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_products").select("category_id");
      if (error) throw error;
      const m = new Map<number, number>();
      (data ?? []).forEach((r: any) => {
        if (r.category_id != null) m.set(r.category_id, (m.get(r.category_id) ?? 0) + 1);
      });
      return m;
    },
  });

  const delM = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("aqh_product_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["aqh_cats"] });
      qc.invalidateQueries({ queryKey: ["aqh_cat_counts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحذف"),
  });

  return (
    <div className="space-y-5" dir="rtl">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 text-gold flex items-center justify-center">
          <FolderTree size={20} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">التصنيفات</h1>
          <p className="text-xs text-muted-foreground">تنظيم منتجات المخزون في تصنيفات</p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30">
          <Plus size={14} className="ml-1" /> تصنيف جديد
        </Button>
      </header>

      {listQ.isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="inline-block animate-spin" size={16} /> جارٍ التحميل…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-[12px]">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="text-start px-3 py-2">الاسم</th>
                <th className="text-start px-3 py-2 hidden md:table-cell">المفتاح</th>
                <th className="text-start px-3 py-2">الترتيب</th>
                <th className="text-start px-3 py-2">المنتجات</th>
                <th className="text-start px-3 py-2">الحالة</th>
                <th className="text-start px-3 py-2 w-24">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {(listQ.data ?? []).map((c) => (
                <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-3 py-2 font-medium">{c.name_ar}</td>
                  <td className="px-3 py-2 font-mono text-[11px] hidden md:table-cell" dir="ltr">{c.slug}</td>
                  <td className="px-3 py-2">{c.sort_order}</td>
                  <td className="px-3 py-2">{countsQ.data?.get(c.id) ?? 0}</td>
                  <td className="px-3 py-2">
                    {c.is_active
                      ? <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-300">نشط</Badge>
                      : <Badge variant="outline" className="text-[10px] border-white/20 text-muted-foreground">معطّل</Badge>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(c)}>
                        <Pencil size={12} />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-red-400"
                        onClick={() => {
                          if (confirm(`حذف "${c.name_ar}"؟ سيتم إلغاء ربط المنتجات.`)) delM.mutate(c.id);
                        }}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {(listQ.data ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">لا توجد تصنيفات</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <CategoryDialog
          category={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["aqh_cats"] })}
        />
      )}
    </div>
  );
}

function CategoryDialog({
  category, onClose, onSaved,
}: { category: Category | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name_ar: category?.name_ar ?? "",
    slug: category?.slug ?? "",
    sort_order: category?.sort_order ?? 10,
    is_active: category?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name_ar.trim()) { toast.error("الاسم مطلوب"); return; }
    const slug = (form.slug.trim() || form.name_ar.trim().replace(/\s+/g, "-").toLowerCase()).slice(0, 64);
    setSaving(true);
    const payload = {
      name_ar: form.name_ar.trim(),
      slug,
      sort_order: form.sort_order,
      is_active: form.is_active,
    };
    const { error } = category
      ? await supabase.from("aqh_product_categories").update(payload).eq("id", category.id)
      : await supabase.from("aqh_product_categories").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(category ? "تم التحديث" : "تمت الإضافة");
    onSaved(); onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader><DialogTitle>{category ? "تعديل تصنيف" : "تصنيف جديد"}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">الاسم بالعربية *</label>
            <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">المفتاح (slug)</label>
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="يتولّد تلقائياً" dir="ltr" />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">الترتيب</label>
            <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value || "0", 10) })} />
          </div>
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
