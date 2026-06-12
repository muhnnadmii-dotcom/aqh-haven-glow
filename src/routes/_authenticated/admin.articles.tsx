import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl } from "@/lib/storage";
import { ImageUploader } from "@/components/ImageUploader";
import { toast } from "sonner";
import { Plus, Trash2, Save, Eye, EyeOff, Star, StarOff, Loader2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/articles")({
  component: ArticlesAdmin,
});

type Article = {
  id?: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  cover_path: string | null;
  tags: string[];
  category: string | null;
  published: boolean;
  visible: boolean;
  featured_on_home: boolean;
  home_order: number;
  seo_title: string | null;
  seo_description: string | null;
};

const blank: Article = {
  slug: "", title: "", excerpt: "", body: "", cover_path: "", tags: [], category: "",
  published: true, visible: true, featured_on_home: false, home_order: 0,
  seo_title: "", seo_description: "",
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function ArticlesAdmin() {
  const [list, setList] = useState<Article[]>([]);
  const [editing, setEditing] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.from("articles").select("*").order("created_at", { ascending: false });
    if (error) setError(error.message);
    setList((data ?? []) as unknown as Article[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim()) { toast.error("العنوان مطلوب"); return; }
    const payload: any = { ...editing };
    if (!payload.slug?.trim()) payload.slug = slugify(payload.title) || Math.random().toString(36).slice(2, 8);
    payload.tags = payload.tags ?? [];
    setSaving(true);
    const { error } = payload.id
      ? await supabase.from("articles").update(payload).eq("id", payload.id)
      : await supabase.from("articles").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ"); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف المقال نهائياً؟")) return;
    const { error } = await supabase.from("articles").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const togglePatch = async (a: Article, patch: Partial<Article>) => {
    const { error } = await supabase.from("articles").update(patch).eq("id", a.id!);
    if (error) { toast.error(error.message); return; }
    load();
  };

  if (editing) {
    const v = editing;
    const set = <K extends keyof Article>(k: K, val: Article[K]) => setEditing({ ...v, [k]: val });
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">{v.id ? "تعديل مقال" : "مقال جديد"}</h1>
          <div className="flex gap-2">
            <button onClick={() => setEditing(null)} className="glass rounded-xl px-4 py-2 text-sm">إلغاء</button>
            <button onClick={save} disabled={saving} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} حفظ
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 grid gap-4 sm:grid-cols-2">
          <Field label="العنوان" full>
            <input className={inp} value={v.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Slug">
            <input dir="ltr" className={inp} value={v.slug} onChange={(e) => set("slug", e.target.value)} placeholder="auto" />
          </Field>
          <Field label="التصنيف">
            <input className={inp} value={v.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="مثال: العناية بالأسماك" />
          </Field>
          <Field label="الوسوم (مفصولة بفاصلة)" full>
            <input className={inp} value={(v.tags ?? []).join(", ")}
              onChange={(e) => set("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
          </Field>
          <Field label="صورة الغلاف" full>
            <ImageUploader value={v.cover_path || null} onChange={(p) => set("cover_path", p ?? "")} folder="articles" />
          </Field>
          <Field label="الوصف المختصر" full>
            <textarea rows={2} className={ta} value={v.excerpt ?? ""} onChange={(e) => set("excerpt", e.target.value)} />
          </Field>
          <Field label="المحتوى (يدعم # و ##  للعناوين، الأسطر الفارغة = فقرات)" full>
            <textarea rows={14} className={ta} value={v.body ?? ""} onChange={(e) => set("body", e.target.value)} />
          </Field>

          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3">
            <label className="glass rounded-xl px-3 py-2.5 text-sm flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={v.published} onChange={(e) => set("published", e.target.checked)} /> منشور
            </label>
            <label className="glass rounded-xl px-3 py-2.5 text-sm flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={v.visible} onChange={(e) => set("visible", e.target.checked)} /> ظاهر
            </label>
            <label className="glass rounded-xl px-3 py-2.5 text-sm flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={v.featured_on_home} onChange={(e) => set("featured_on_home", e.target.checked)} /> ظهور في الرئيسية
            </label>
          </div>
          {v.featured_on_home && (
            <Field label="ترتيب في الرئيسية">
              <input type="number" className={inp} value={v.home_order} onChange={(e) => set("home_order", Number(e.target.value) || 0)} />
            </Field>
          )}

          <div className="sm:col-span-2 mt-2 pt-4 border-t border-white/10">
            <div className="text-sm font-bold mb-3 text-gradient-gold">SEO</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="SEO Title" full>
                <input className={inp} value={v.seo_title ?? ""} onChange={(e) => set("seo_title", e.target.value)} placeholder="إذا فارغ سيستخدم العنوان" />
              </Field>
              <Field label="SEO Description" full>
                <textarea rows={2} className={ta} value={v.seo_description ?? ""} onChange={(e) => set("seo_description", e.target.value)} placeholder="إذا فارغ سيستخدم الوصف المختصر" />
              </Field>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">المقالات</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة كاملة لمقالات مركز المعرفة.</p>
        </div>
        <button onClick={() => setEditing({ ...blank })} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2">
          <Plus size={16} /> مقال جديد
        </button>
      </div>

      {loading && <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-gold" /></div>}
      {error && <div className="glass rounded-2xl p-5 text-sm text-red-400">{error}</div>}
      {!loading && !error && list.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">لا توجد مقالات حتى الآن.</div>
      )}

      {!loading && !error && list.length > 0 && (
        <div className="grid gap-3">
          {list.map((a) => (
            <div key={a.id} className="glass rounded-2xl p-4 flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl overflow-hidden bg-white/5 shrink-0">
                {a.cover_path ? <img src={publicUrl(a.cover_path)} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{a.title}</div>
                <div className="text-xs text-muted-foreground flex gap-2 flex-wrap mt-1">
                  <span dir="ltr">{a.slug}</span>
                  {a.category && <span>· {a.category}</span>}
                  <span>· {a.published ? "منشور" : "مسودة"}</span>
                  {!a.visible && <span className="text-orange-400">· مخفي</span>}
                  {a.featured_on_home && <span className="text-gold">· في الرئيسية (#{a.home_order})</span>}
                </div>
              </div>
              <button onClick={() => togglePatch(a, { visible: !a.visible })} title={a.visible ? "إخفاء" : "إظهار"}
                className="glass rounded-lg p-2 hover:bg-white/10">
                {a.visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button onClick={() => togglePatch(a, { featured_on_home: !a.featured_on_home })} title="مميز في الرئيسية"
                className="glass rounded-lg p-2 hover:bg-white/10">
                {a.featured_on_home ? <Star size={15} className="text-gold" fill="currentColor" /> : <StarOff size={15} />}
              </button>
              <button onClick={() => setEditing(a)} className="text-sm text-gold hover:underline">تعديل</button>
              <a href={`/knowledge/${a.slug}`} target="_blank" rel="noopener" className="text-muted-foreground hover:text-foreground"><ArrowRight size={16} /></a>
              <button onClick={() => remove(a.id!)} className="text-red-400"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60";
const ta = inp + " resize-none font-mono leading-relaxed";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs text-muted-foreground block mb-1">{label}</span>
      {children}
    </label>
  );
}
