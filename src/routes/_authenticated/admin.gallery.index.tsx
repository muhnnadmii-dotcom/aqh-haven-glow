import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl, onImageError } from "@/lib/storage";
import { OrderedImagesEditor } from "@/components/portfolio/OrderedImagesEditor";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Eye, EyeOff, X, Save, Sparkles } from "lucide-react";
import {
  TANK_TYPE_OPTIONS, SIZE_OPTIONS, STYLE_OPTIONS, CARE_OPTIONS, SUITABLE_FOR_OPTIONS,
  TANK_TYPE_LABELS, type WorkGalleryItem,
} from "@/lib/work-gallery";

export const Route = createFileRoute("/_authenticated/admin/gallery/")({
  component: AdminGalleryPage,
});

type ProjectOpt = { id: string; title: string };

function AdminGalleryPage() {
  const [items, setItems] = useState<WorkGalleryItem[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<WorkGalleryItem> | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: g, error }, { data: ps }] = await Promise.all([
      (supabase as any).from("work_gallery_items").select("*")
        .order("display_order", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("projects").select("id,title").order("title"),
    ]);
    if (error) toast.error(error.message);
    setItems((g ?? []) as WorkGalleryItem[]);
    setProjects((ps ?? []) as ProjectOpt[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const togglePublish = async (it: WorkGalleryItem) => {
    const { error } = await (supabase as any).from("work_gallery_items").update({ is_published: !it.is_published }).eq("id", it.id);
    if (error) return toast.error(error.message);
    setItems((arr) => arr.map((x) => x.id === it.id ? { ...x, is_published: !it.is_published } : x));
  };

  const remove = async (it: WorkGalleryItem) => {
    if (!confirm("حذف هذه اللقطة؟")) return;
    const { error } = await (supabase as any).from("work_gallery_items").delete().eq("id", it.id);
    if (error) return toast.error(error.message);
    setItems((arr) => arr.filter((x) => x.id !== it.id));
    toast.success("تم الحذف");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">لقطات من أعمالنا</h1>
          <p className="text-xs text-muted-foreground mt-1">معرض سريع للصور — مستقل عن المشاريع الكاملة.</p>
        </div>
        <button
          onClick={() => setEditing({ is_published: true, is_featured: false, display_order: 0, extra_images: [], suitable_for: [] })}
          className="btn-gold rounded-xl px-4 py-2 text-sm inline-flex items-center gap-2"
        >
          <Plus size={16} /> إضافة لقطة
        </button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12 text-sm">جاري التحميل...</div>
      ) : items.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">لا توجد لقطات بعد.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div key={it.id} className="glass rounded-2xl overflow-hidden">
              <div className="relative aspect-square bg-black/30">
                <img src={publicUrl(it.image_path) || ""} onError={onImageError} alt={it.title ?? ""}
                  className="absolute inset-0 h-full w-full object-cover" />
                {it.is_featured && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] glass-gold text-[color:var(--gold)]">
                    <Sparkles size={10} /> مميّز
                  </div>
                )}
                {!it.is_published && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-200 border border-rose-500/30">مخفي</div>
                )}
              </div>
              <div className="p-3 space-y-2">
                <div className="text-sm font-semibold truncate">{it.title || <span className="text-muted-foreground">بدون عنوان</span>}</div>
                <div className="text-[11px] text-muted-foreground flex flex-wrap gap-1.5">
                  {it.tank_type && <span className="px-1.5 py-0.5 rounded bg-white/5">{TANK_TYPE_LABELS[it.tank_type as keyof typeof TANK_TYPE_LABELS] ?? it.tank_type}</span>}
                  {it.linked_project_id && <span className="px-1.5 py-0.5 rounded bg-gold/10 text-gold">مرتبطة بمشروع</span>}
                  <span className="px-1.5 py-0.5 rounded bg-white/5">ترتيب: {it.display_order}</span>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <button onClick={() => setEditing(it)} className="flex-1 text-xs rounded-lg bg-white/5 hover:bg-white/10 px-2 py-1.5 inline-flex items-center justify-center gap-1">
                    <Pencil size={12} /> تعديل
                  </button>
                  <button onClick={() => togglePublish(it)} className="text-xs rounded-lg bg-white/5 hover:bg-white/10 px-2 py-1.5 inline-flex items-center gap-1">
                    {it.is_published ? <><EyeOff size={12} /> إخفاء</> : <><Eye size={12} /> نشر</>}
                  </button>
                  <button onClick={() => remove(it)} className="text-xs rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-200 px-2 py-1.5">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <GalleryEditor
          initial={editing}
          projects={projects}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function GalleryEditor({ initial, projects, onClose, onSaved }: {
  initial: Partial<WorkGalleryItem>;
  projects: ProjectOpt[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<WorkGalleryItem>>(initial);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial.id;

  const set = <K extends keyof WorkGalleryItem>(k: K, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const toggleSuitable = (key: string) => {
    const arr = (form.suitable_for ?? []) as string[];
    set("suitable_for", arr.includes(key) ? arr.filter((x) => x !== key) : [...arr, key]);
  };

  const save = async () => {
    if (!form.image_path) return toast.error("ارفع الصورة الرئيسية أولًا");
    setSaving(true);
    try {
      const payload: any = {
        title: form.title?.trim() || null,
        image_path: form.image_path,
        extra_images: form.extra_images ?? [],
        tank_type: form.tank_type || null,
        size_category: form.size_category || null,
        style: form.style || null,
        care_level: form.care_level || null,
        suitable_for: form.suitable_for ?? [],
        linked_project_id: form.linked_project_id || null,
        is_published: form.is_published ?? true,
        is_featured: form.is_featured ?? false,
        display_order: Number(form.display_order ?? 0),
      };
      if (isEdit) {
        const { error } = await (supabase as any).from("work_gallery_items").update(payload).eq("id", initial.id);
        if (error) throw error;
        toast.success("تم الحفظ");
      } else {
        const { error } = await (supabase as any).from("work_gallery_items").insert(payload);
        if (error) throw error;
        toast.success("تمت الإضافة");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الحفظ");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md overflow-y-auto p-3 sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass rounded-3xl max-w-3xl mx-auto p-5 sm:p-7 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{isEdit ? "تعديل لقطة" : "إضافة لقطة جديدة"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5"><X size={18} /></button>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">صور اللقطة *</label>
          <OrderedImagesEditor
            images={[
              ...(form.image_path ? [form.image_path] : []),
              ...((form.extra_images ?? []) as string[]).filter((p) => p && p !== form.image_path),
            ]}
            onChange={(next) => {
              set("image_path", next[0] ?? null);
              set("extra_images", next.slice(1));
            }}
            folder="gallery"
          />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">عنوان قصير (اختياري)</label>
          <input className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
            value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Select label="نوع الحوض" value={form.tank_type ?? ""} options={TANK_TYPE_OPTIONS} onChange={(v) => set("tank_type", v)} />
          <Select label="الحجم" value={form.size_category ?? ""} options={SIZE_OPTIONS} onChange={(v) => set("size_category", v)} />
          <Select label="الستايل" value={form.style ?? ""} options={STYLE_OPTIONS} onChange={(v) => set("style", v)} />
          <Select label="مستوى العناية" value={form.care_level ?? ""} options={CARE_OPTIONS} onChange={(v) => set("care_level", v)} />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">مناسب لـ</label>
          <div className="flex flex-wrap gap-2">
            {SUITABLE_FOR_OPTIONS.map(([k, v]) => {
              const active = (form.suitable_for ?? []).includes(k);
              return (
                <button key={k} type="button" onClick={() => toggleSuitable(k)}
                  className={`px-3 py-1.5 rounded-full text-xs border ${active ? "btn-gold border-transparent" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                  {v}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">ربط بمشروع منفذ (اختياري)</label>
          <select className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
            value={form.linked_project_id ?? ""} onChange={(e) => set("linked_project_id", e.target.value || null)}>
            <option value="">بدون ربط</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_published ?? true} onChange={(e) => set("is_published", e.target.checked)} />
            منشور
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_featured ?? false} onChange={(e) => set("is_featured", e.target.checked)} />
            مميّز
          </label>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">ترتيب الظهور</label>
            <input type="number" className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
              value={form.display_order ?? 0} onChange={(e) => set("display_order", Number(e.target.value))} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm bg-white/5 border border-white/10">إلغاء</button>
          <button onClick={save} disabled={saving} className="btn-gold rounded-xl px-5 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-60">
            <Save size={14} /> {saving ? "جاري الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <select className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
        value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— اختر —</option>
        {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </div>
  );
}
