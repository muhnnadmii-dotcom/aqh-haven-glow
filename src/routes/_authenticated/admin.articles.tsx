import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/articles")({
  component: ArticlesAdmin,
});

type Article = {
  id?: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  cover_image: string | null;
  tags: string[];
  published: boolean;
};

const blank: Article = { slug: "", title: "", excerpt: "", body: "", cover_image: "", tags: [], published: true };

function ArticlesAdmin() {
  const [list, setList] = useState<Article[]>([]);
  const [editing, setEditing] = useState<Article | null>(null);

  const load = async () => {
    const { data } = await supabase.from("articles").select("*").order("created_at", { ascending: false });
    setList((data ?? []) as unknown as Article[]);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const { error } = editing.id
      ? await supabase.from("articles").update(editing).eq("id", editing.id)
      : await supabase.from("articles").insert(editing);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ"); setEditing(null); load();
  };
  const remove = async (id: string) => {
    if (!confirm("حذف المقال؟")) return;
    await supabase.from("articles").delete().eq("id", id); load();
  };

  if (editing) {
    const v = editing;
    const set = <K extends keyof Article>(k: K, val: Article[K]) => setEditing({ ...v, [k]: val });
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{v.id ? "تعديل مقال" : "مقال جديد"}</h1>
        <div className="glass rounded-2xl p-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">العنوان</span>
            <input className={inp} value={v.title} onChange={(e) => set("title", e.target.value)} /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">Slug</span>
            <input dir="ltr" className={inp} value={v.slug} onChange={(e) => set("slug", e.target.value)} /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">صورة الغلاف (URL)</span>
            <input dir="ltr" className={inp} value={v.cover_image ?? ""} onChange={(e) => set("cover_image", e.target.value)} /></label>
          <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">مقتطف</span>
            <textarea rows={2} className={inp + " resize-none"} value={v.excerpt ?? ""} onChange={(e) => set("excerpt", e.target.value)} /></label>
          <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">المحتوى</span>
            <textarea rows={12} className={inp + " resize-none"} value={v.body ?? ""} onChange={(e) => set("body", e.target.value)} /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">وسوم (بفاصلة)</span>
            <input className={inp} value={v.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></label>
          <label className="flex items-end gap-2"><input type="checkbox" checked={v.published} onChange={(e) => set("published", e.target.checked)} /> منشور</label>
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
        <h1 className="text-3xl font-bold">المقالات</h1>
        <button onClick={() => setEditing({ ...blank })} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Plus size={16} /> مقال جديد</button>
      </div>
      <div className="grid gap-3">
        {list.length === 0 && <p className="text-muted-foreground text-sm">لا توجد مقالات.</p>}
        {list.map((a) => (
          <div key={a.id} className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{a.title}</div>
              <div className="text-xs text-muted-foreground">{a.slug} · {a.published ? "منشور" : "مسودة"}</div>
            </div>
            <button onClick={() => setEditing(a)} className="text-sm text-gold hover:underline">تعديل</button>
            <button onClick={() => remove(a.id!)} className="text-red-400"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60";
