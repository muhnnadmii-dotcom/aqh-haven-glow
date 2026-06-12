import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save, Star, Eye, EyeOff, Home as HomeIcon } from "lucide-react";
import { ImageUploader } from "@/components/ImageUploader";
import { publicUrl } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/admin/testimonials")({
  component: TestimonialsAdmin,
});

type T = {
  id?: string;
  name: string;
  role: string | null;
  rating: number;
  body: string;
  image_path: string | null;
  featured: boolean;
  visible: boolean;
  sort_order: number;
};

const blank: T = {
  name: "", role: "", rating: 5, body: "",
  image_path: null, featured: true, visible: true, sort_order: 0,
};

function TestimonialsAdmin() {
  const [list, setList] = useState<T[]>([]);
  const [editing, setEditing] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.from("testimonials").select("*")
      .order("sort_order").order("created_at", { ascending: false });
    if (error) setError(error.message);
    setList((data ?? []) as unknown as T[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.body.trim()) {
      toast.error("الاسم والنص مطلوبان"); return;
    }
    const payload = { ...editing, role: editing.role || null };
    const { error } = editing.id
      ? await supabase.from("testimonials").update(payload).eq("id", editing.id)
      : await supabase.from("testimonials").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ"); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف التقييم؟")) return;
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف"); load();
  };

  const toggle = async (t: T, field: "visible" | "featured") => {
    if (!t.id) return;
    const { error } = await supabase.from("testimonials").update({ [field]: !t[field] }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">التقييمات</h1>
        <button onClick={() => setEditing({ ...blank, sort_order: list.length })}
          className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2">
          <Plus size={16} /> تقييم جديد
        </button>
      </div>

      {editing && (
        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="text-sm font-bold text-gradient-gold">{editing.id ? "تعديل تقييم" : "تقييم جديد"}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="اسم العميل *">
              <input className={inp} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="الصفة / الدور">
              <input className={inp} value={editing.role ?? ""} placeholder="عميل، عميلة، هاوي..." onChange={(e) => setEditing({ ...editing, role: e.target.value })} />
            </Field>
            <Field label="عدد النجوم (1-5)">
              <input type="number" min={1} max={5} className={inp} value={editing.rating}
                onChange={(e) => setEditing({ ...editing, rating: Math.max(1, Math.min(5, Number(e.target.value))) })} />
            </Field>
            <Field label="ترتيب العرض">
              <input type="number" className={inp} value={editing.sort_order}
                onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
            </Field>
            <Field label="نص التقييم *" full>
              <textarea rows={4} className={inp + " resize-none"} value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            </Field>
            <Field label="صورة العميل (اختياري)" full>
              <ImageUploader
                value={editing.image_path}
                onChange={(p) => setEditing({ ...editing, image_path: p })}
                folder="testimonials"
              />
            </Field>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.visible}
                  onChange={(e) => setEditing({ ...editing, visible: e.target.checked })} />
                ظاهر
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.featured}
                  onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} />
                يظهر في الصفحة الرئيسية
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className="glass rounded-xl px-4 py-2 text-sm">إلغاء</button>
            <button onClick={save} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2">
              <Save size={16} /> حفظ
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-muted-foreground text-sm">جاري التحميل...</p>}
      {error && <p className="text-red-400 text-sm">خطأ: {error}</p>}
      {!loading && !error && list.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">
          لا توجد تقييمات بعد. أضف أول تقييم.
        </div>
      )}

      <div className="grid gap-3">
        {list.map((t) => (
          <div key={t.id} className={`glass rounded-2xl p-4 ${!t.visible ? "opacity-60" : ""}`}>
            <div className="flex items-start gap-3">
              {t.image_path ? (
                <img src={publicUrl(t.image_path)} alt={t.name} className="h-12 w-12 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-12 w-12 rounded-full glass-gold grid place-items-center text-gold text-sm shrink-0">
                  {t.name.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-bold">{t.name}</span>
                  {t.role && <span className="text-xs text-muted-foreground">— {t.role}</span>}
                  <span className="flex items-center gap-0.5 text-gold">
                    {Array.from({ length: t.rating }).map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
                  </span>
                  {t.featured && <span className="text-[10px] glass-gold px-2 py-0.5 rounded-full">رئيسية</span>}
                  {!t.visible && <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">مخفي</span>}
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.body}</p>
              </div>
              <div className="flex flex-col gap-2 items-end shrink-0">
                <button title={t.visible ? "إخفاء" : "إظهار"} onClick={() => toggle(t, "visible")} className="text-muted-foreground hover:text-foreground">
                  {t.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button title="إظهار في الرئيسية" onClick={() => toggle(t, "featured")} className={t.featured ? "text-gold" : "text-muted-foreground hover:text-gold"}>
                  <HomeIcon size={16} />
                </button>
                <button onClick={() => setEditing(t)} className="text-xs text-gold hover:underline">تعديل</button>
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
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs text-muted-foreground block mb-1">{label}</span>
      {children}
    </label>
  );
}
