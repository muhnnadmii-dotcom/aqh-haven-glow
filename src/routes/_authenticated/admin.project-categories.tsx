import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save, Eye, EyeOff, ArrowUp, ArrowDown, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/project-categories")({
  component: CategoriesAdmin,
});

type Cat = {
  id?: string;
  slug: string;
  label: string;
  published: boolean;
  sort_order: number;
};

const blank: Cat = { slug: "", label: "", published: true, sort_order: 0 };

const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60";

function CategoriesAdmin() {
  const [list, setList] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Cat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    const { data, error } = await (supabase as any)
      .from("project_categories").select("*")
      .order("sort_order").order("label");
    if (error) setError(error.message);
    setList((data ?? []) as Cat[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const slug = editing.slug.trim();
    const label = editing.label.trim();
    if (!slug || !label) { toast.error("الاسم والـ slug مطلوبان"); return; }
    if (!/^[a-z0-9-]+$/.test(slug)) { toast.error("الـ slug يقبل أحرف إنجليزية صغيرة وأرقام وشرطة فقط"); return; }
    const payload = { ...editing, slug, label };
    const { error } = editing.id
      ? await (supabase as any).from("project_categories").update(payload).eq("id", editing.id)
      : await (supabase as any).from("project_categories").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ"); setEditing(null); load();
  };

  const remove = async (c: Cat) => {
    if (!c.id) return;
    // Guard: don't delete a category that's in use
    const { count, error: ce } = await supabase
      .from("projects").select("id", { count: "exact", head: true }).eq("category", c.slug);
    if (ce) { toast.error(ce.message); return; }
    if ((count ?? 0) > 0) {
      toast.error(`لا يمكن حذف "${c.label}" — مستخدم في ${count} حوض. غيّر تصنيف الأحواض أولاً.`);
      return;
    }
    if (!confirm(`حذف التصنيف "${c.label}"؟`)) return;
    const { error } = await (supabase as any).from("project_categories").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف"); load();
  };

  const togglePublished = async (c: Cat) => {
    if (!c.id) return;
    const { error } = await (supabase as any).from("project_categories")
      .update({ published: !c.published }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const move = async (c: Cat, dir: -1 | 1) => {
    const idx = list.findIndex((x) => x.id === c.id);
    const swap = list[idx + dir];
    if (!swap || !c.id || !swap.id) return;
    const a = (supabase as any).from("project_categories").update({ sort_order: swap.sort_order }).eq("id", c.id);
    const b = (supabase as any).from("project_categories").update({ sort_order: c.sort_order }).eq("id", swap.id);
    await Promise.all([a, b]);
    load();
  };

  if (editing) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{editing.id ? "تعديل تصنيف" : "تصنيف جديد"}</h1>
          <div className="flex gap-2">
            <button onClick={() => setEditing(null)} className="glass rounded-xl px-4 py-2 text-sm flex items-center gap-2"><X size={16} /> إلغاء</button>
            <button onClick={save} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Save size={16} /> حفظ</button>
          </div>
        </div>
        <div className="glass rounded-2xl p-5 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-muted-foreground block mb-1">الاسم الظاهر *</span>
            <input className={inp} value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="مثل: نباتي" />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground block mb-1">Slug (بالإنجليزي، فريد) *</span>
            <input dir="ltr" className={inp} value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase() })} placeholder="planted" />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground block mb-1">الترتيب</span>
            <input type="number" className={inp} value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
          </label>
          <label className="flex items-center gap-2 text-sm self-end pb-2">
            <input type="checkbox" checked={editing.published} onChange={(e) => setEditing({ ...editing, published: e.target.checked })} /> ظاهر للزوار
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold">تصنيفات الأحواض</h1>
        <button onClick={() => setEditing({ ...blank, sort_order: list.length })}
          className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2">
          <Plus size={16} /> تصنيف جديد
        </button>
      </div>

      {loading && <p className="text-muted-foreground text-sm">جاري التحميل...</p>}
      {error && <p className="text-red-400 text-sm">خطأ: {error}</p>}
      {!loading && !error && list.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">
          لا توجد تصنيفات بعد. أضف أول تصنيف.
        </div>
      )}

      <div className="grid gap-3">
        {list.map((c, i) => (
          <div key={c.id} className={`glass rounded-2xl p-4 flex items-center gap-3 ${!c.published ? "opacity-60" : ""}`}>
            <div className="flex flex-col gap-1">
              <button onClick={() => move(c, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp size={14} /></button>
              <button onClick={() => move(c, 1)} disabled={i === list.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown size={14} /></button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold flex items-center gap-2 flex-wrap">
                {c.label}
                {!c.published && <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">مخفي</span>}
              </div>
              <div className="text-xs text-muted-foreground" dir="ltr">{c.slug}</div>
            </div>
            <button title={c.published ? "إخفاء" : "إظهار"} onClick={() => togglePublished(c)} className="text-muted-foreground hover:text-foreground">
              {c.published ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <button onClick={() => setEditing(c)} className="text-sm text-gold hover:underline">تعديل</button>
            <button onClick={() => remove(c)} className="text-red-400" title="حذف"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
