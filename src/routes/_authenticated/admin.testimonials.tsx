import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/testimonials")({
  component: TestimonialsAdmin,
});

type T = { id?: string; name: string; rating: number; body: string; featured: boolean; sort_order: number };
const blank: T = { name: "", rating: 5, body: "", featured: true, sort_order: 0 };

function TestimonialsAdmin() {
  const [list, setList] = useState<T[]>([]);
  const [editing, setEditing] = useState<T | null>(null);

  const load = async () => {
    const { data } = await supabase.from("testimonials").select("*").order("sort_order").order("created_at", { ascending: false });
    setList((data ?? []) as unknown as T[]);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const { error } = editing.id
      ? await supabase.from("testimonials").update(editing).eq("id", editing.id)
      : await supabase.from("testimonials").insert(editing);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ"); setEditing(null); load();
  };
  const remove = async (id: string) => {
    if (!confirm("حذف الشهادة؟")) return;
    await supabase.from("testimonials").delete().eq("id", id); load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">الشهادات</h1>
        <button onClick={() => setEditing({ ...blank })} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Plus size={16} /> شهادة جديدة</button>
      </div>

      {editing && (
        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="text-xs text-muted-foreground block mb-1">الاسم</span>
              <input className={inp} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
            <label><span className="text-xs text-muted-foreground block mb-1">التقييم (1-5)</span>
              <input type="number" min={1} max={5} className={inp} value={editing.rating} onChange={(e) => setEditing({ ...editing, rating: Number(e.target.value) })} /></label>
            <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">النص</span>
              <textarea rows={4} className={inp + " resize-none"} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></label>
            <label><span className="text-xs text-muted-foreground block mb-1">الترتيب</span>
              <input type="number" className={inp} value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></label>
            <label className="flex items-end gap-2"><input type="checkbox" checked={editing.featured} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} /> مميزة</label>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className="glass rounded-xl px-4 py-2 text-sm">إلغاء</button>
            <button onClick={save} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Save size={16} /> حفظ</button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {list.length === 0 && <p className="text-muted-foreground text-sm">لا توجد شهادات.</p>}
        {list.map((t) => (
          <div key={t.id} className="glass rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold">{t.name}</span>
                  <span className="flex items-center gap-0.5 text-gold">
                    {Array.from({ length: t.rating }).map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.body}</p>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <button onClick={() => setEditing(t)} className="text-sm text-gold hover:underline">تعديل</button>
                <button onClick={() => remove(t.id!)} className="text-red-400"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60";
