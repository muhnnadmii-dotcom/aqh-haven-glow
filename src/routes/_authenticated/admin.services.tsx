import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import { ImageUploader } from "@/components/ImageUploader";

export const Route = createFileRoute("/_authenticated/admin/services")({
  component: ServicesAdmin,
});

type S = {
  id?: string; slug: string; title: string; description: string | null;
  icon: string | null; image_path: string | null; features: string[];
  sort_order: number; published: boolean;
};
const blank: S = { slug: "", title: "", description: "", icon: "", image_path: null, features: [], sort_order: 0, published: true };

function ServicesAdmin() {
  const [list, setList] = useState<S[]>([]);
  const [editing, setEditing] = useState<S | null>(null);

  const load = async () => {
    const { data } = await supabase.from("services").select("*").order("sort_order");
    setList((data ?? []) as unknown as S[]);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const payload = { ...editing, features: editing.features };
    const { error } = editing.id
      ? await supabase.from("services").update(payload).eq("id", editing.id)
      : await supabase.from("services").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ"); setEditing(null); load();
  };
  const remove = async (id: string) => {
    if (!confirm("حذف الخدمة؟")) return;
    await supabase.from("services").delete().eq("id", id); load();
  };

  if (editing) {
    const v = editing;
    const set = <K extends keyof S>(k: K, val: S[K]) => setEditing({ ...v, [k]: val });
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">{v.id ? "تعديل خدمة" : "خدمة جديدة"}</h1>
        <div className="glass rounded-2xl p-5 grid gap-4 sm:grid-cols-2">
          <label><span className="text-xs text-muted-foreground block mb-1">العنوان</span>
            <input className={inp} value={v.title} onChange={(e) => set("title", e.target.value)} /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">Slug</span>
            <input dir="ltr" className={inp} value={v.slug} onChange={(e) => set("slug", e.target.value)} /></label>
          <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">الوصف</span>
            <textarea rows={4} className={inp + " resize-none"} value={v.description ?? ""} onChange={(e) => set("description", e.target.value)} /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">أيقونة (اسم lucide)</span>
            <input dir="ltr" className={inp} value={v.icon ?? ""} onChange={(e) => set("icon", e.target.value)} placeholder="Fish, Sparkles..." /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">الترتيب</span>
            <input type="number" className={inp} value={v.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} /></label>
          <div className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">الصورة</span>
            <ImageUploader value={v.image_path} onChange={(p) => set("image_path", p)} folder="services" />
          </div>
          <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">الميزات (سطر لكل ميزة)</span>
            <textarea rows={5} className={inp + " resize-none"} value={v.features.join("\n")} onChange={(e) => set("features", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))} /></label>
          <label className="flex items-end gap-2"><input type="checkbox" checked={v.published} onChange={(e) => set("published", e.target.checked)} /> منشورة</label>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(null)} className="glass rounded-xl px-4 py-2 text-sm">إلغاء</button>
          <button onClick={save} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Save size={16} /> حفظ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">خدماتنا</h1>
        <button onClick={() => setEditing({ ...blank })} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Plus size={16} /> خدمة جديدة</button>
      </div>
      <div className="grid gap-3">
        {list.length === 0 && <p className="text-sm text-muted-foreground">لا توجد خدمات بعد.</p>}
        {list.map((s) => (
          <div key={s.id} className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-bold">{s.title}</div>
              <div className="text-xs text-muted-foreground">{s.slug} · {s.published ? "منشورة" : "مسودة"}</div>
            </div>
            <button onClick={() => setEditing(s)} className="text-sm text-gold hover:underline">تعديل</button>
            <button onClick={() => remove(s.id!)} className="text-red-400"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60";
