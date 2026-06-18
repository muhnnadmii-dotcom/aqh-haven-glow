import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save, ArrowUp, ArrowDown, Eye, EyeOff, Star } from "lucide-react";
import { ImageUploader } from "@/components/ImageUploader";

export const Route = createFileRoute("/_authenticated/admin/services")({
  component: ServicesAdmin,
});

type S = {
  id?: string;
  slug: string;
  title: string;
  short_description: string | null;
  full_description: string | null;
  description: string | null;
  icon: string | null;
  image_path: string | null;
  category: string | null;
  service_type: string | null;
  price_label: string | null;
  starting_price: number | null;
  features: string[];
  includes: string[];
  suitable_for: string[];
  process_steps: string[];
  faqs: { q: string; a: string }[];
  cta_label: string | null;
  cta_type: string | null;
  cta_url: string | null;
  linked_page_type: string;
  linked_page_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  is_featured: boolean;
  sort_order: number;
  published: boolean;
};

const blank: S = {
  slug: "", title: "", short_description: "", full_description: "", description: "",
  icon: "", image_path: null, category: "", service_type: "",
  price_label: "", starting_price: null,
  features: [], includes: [], suitable_for: [], process_steps: [], faqs: [],
  cta_label: "اطلب الخدمة", cta_type: "whatsapp", cta_url: "",
  linked_page_type: "custom_service_page", linked_page_url: "",
  meta_title: "", meta_description: "",
  is_featured: false, sort_order: 100, published: true,
};

const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60";
const lines = (arr: any) => Array.isArray(arr) ? arr.join("\n") : "";
// Live-editing: keep raw newlines and spaces. Cleanup happens at save time.
const toLines = (s: string) => s.split("\n");
const cleanLines = (a: string[] | null | undefined) =>
  (a ?? []).map((x) => x.trim()).filter(Boolean);

function ServicesAdmin() {
  const [list, setList] = useState<S[]>([]);
  const [editing, setEditing] = useState<S | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("services").select("*").order("sort_order");
    if (error) toast.error(error.message);
    const normalized = ((data ?? []) as any[]).map((r) => ({
      ...r,
      features: Array.isArray(r.features) ? r.features : [],
      includes: Array.isArray(r.includes) ? r.includes : [],
      suitable_for: Array.isArray(r.suitable_for) ? r.suitable_for : [],
      process_steps: Array.isArray(r.process_steps) ? r.process_steps : [],
      faqs: Array.isArray(r.faqs) ? r.faqs : [],
    })) as S[];
    setList(normalized);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.slug || !editing.title) { toast.error("العنوان وslug مطلوبان"); return; }
    const payload: any = { ...editing };
    delete payload.id;
    payload.features = cleanLines(payload.features);
    payload.includes = cleanLines(payload.includes);
    payload.suitable_for = cleanLines(payload.suitable_for);
    payload.process_steps = cleanLines(payload.process_steps);
    if (!payload.starting_price) payload.starting_price = null;
    const { error } = editing.id
      ? await supabase.from("services").update(payload).eq("id", editing.id)
      : await supabase.from("services").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ"); setEditing(null); load();
  };
  const remove = async (id: string) => {
    if (!confirm("حذف الخدمة؟")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف"); load();
  };
  const togglePublish = async (s: S) => {
    await supabase.from("services").update({ published: !s.published } as any).eq("id", s.id!);
    load();
  };
  const toggleFeatured = async (s: S) => {
    await supabase.from("services").update({ is_featured: !s.is_featured } as any).eq("id", s.id!);
    load();
  };
  const reorder = async (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= list.length) return;
    const a = list[idx], b = list[next];
    await Promise.all([
      supabase.from("services").update({ sort_order: b.sort_order } as any).eq("id", a.id!),
      supabase.from("services").update({ sort_order: a.sort_order } as any).eq("id", b.id!),
    ]);
    load();
  };

  if (editing) {
    const v = editing;
    const set = <K extends keyof S>(k: K, val: S[K]) => setEditing({ ...v, [k]: val });
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">{v.id ? "تعديل خدمة" : "خدمة جديدة"}</h1>

        <div className="glass rounded-2xl p-5 grid gap-4 sm:grid-cols-2">
          <label><span className="text-xs text-muted-foreground block mb-1">العنوان *</span>
            <input className={inp} value={v.title} onChange={(e) => set("title", e.target.value)} /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">Slug *</span>
            <input dir="ltr" className={inp} value={v.slug} onChange={(e) => set("slug", e.target.value)} placeholder="custom-aquariums" /></label>

          <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">الوصف المختصر (يظهر في البطاقات)</span>
            <textarea rows={2} className={inp + " resize-none"} value={v.short_description ?? ""} onChange={(e) => set("short_description", e.target.value)} /></label>

          <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">الوصف الكامل (داخل صفحة الخدمة)</span>
            <textarea rows={5} className={inp + " resize-none"} value={v.full_description ?? ""} onChange={(e) => set("full_description", e.target.value)} /></label>

          <label><span className="text-xs text-muted-foreground block mb-1">التصنيف</span>
            <input className={inp} value={v.category ?? ""} onChange={(e) => set("category", e.target.value)} /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">النوع</span>
            <input className={inp} value={v.service_type ?? ""} onChange={(e) => set("service_type", e.target.value)} /></label>

          <label><span className="text-xs text-muted-foreground block mb-1">عبارة السعر</span>
            <input className={inp} value={v.price_label ?? ""} onChange={(e) => set("price_label", e.target.value)} placeholder="يبدأ من ٢٥٠ ر.س" /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">السعر الرقمي (اختياري)</span>
            <input type="number" className={inp} value={v.starting_price ?? ""} onChange={(e) => set("starting_price", e.target.value ? Number(e.target.value) : null)} /></label>

          <label><span className="text-xs text-muted-foreground block mb-1">أيقونة (اسم lucide)</span>
            <input dir="ltr" className={inp} value={v.icon ?? ""} onChange={(e) => set("icon", e.target.value)} placeholder="Fish, Wrench, Sparkles..." /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">الترتيب</span>
            <input type="number" className={inp} value={v.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} /></label>

          <div className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">صورة الخدمة</span>
            <ImageUploader value={v.image_path} onChange={(p) => set("image_path", p)} folder="services" cropAspect={16/9} />
          </div>
        </div>

        <div className="glass rounded-2xl p-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">المميزات (سطر لكل ميزة)</span>
            <textarea rows={4} className={inp + " resize-none"} value={lines(v.features)} onChange={(e) => set("features", toLines(e.target.value))} /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">ماذا تشمل (سطر لكل بند)</span>
            <textarea rows={5} className={inp + " resize-none"} value={lines(v.includes)} onChange={(e) => set("includes", toLines(e.target.value))} /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">مناسبة لمن (سطر لكل بند)</span>
            <textarea rows={5} className={inp + " resize-none"} value={lines(v.suitable_for)} onChange={(e) => set("suitable_for", toLines(e.target.value))} /></label>
          <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">خطوات التنفيذ (سطر لكل خطوة)</span>
            <textarea rows={5} className={inp + " resize-none"} value={lines(v.process_steps)} onChange={(e) => set("process_steps", toLines(e.target.value))} /></label>
          <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">الأسئلة الشائعة (JSON: [{"{\"q\":\"...\",\"a\":\"...\"}"}])</span>
            <textarea dir="ltr" rows={5} className={inp + " resize-none font-mono text-xs"} value={JSON.stringify(v.faqs, null, 2)}
              onChange={(e) => { try { set("faqs", JSON.parse(e.target.value)); } catch {} }} /></label>
        </div>

        <div className="glass rounded-2xl p-5 grid gap-4 sm:grid-cols-2">
          <label><span className="text-xs text-muted-foreground block mb-1">نص زر الدعوة</span>
            <input className={inp} value={v.cta_label ?? ""} onChange={(e) => set("cta_label", e.target.value)} /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">نوع الربط</span>
            <select className={inp} value={v.linked_page_type} onChange={(e) => set("linked_page_type", e.target.value)}>
              <option value="custom_service_page">صفحة خدمة تلقائية (/services/slug)</option>
              <option value="existing_page">صفحة موجودة</option>
              <option value="external_link">رابط خارجي</option>
              <option value="whatsapp">واتساب</option>
            </select></label>
          <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">رابط الصفحة (للصفحة الموجودة أو الرابط الخارجي)</span>
            <input dir="ltr" className={inp} value={v.linked_page_url ?? ""} onChange={(e) => set("linked_page_url", e.target.value)} placeholder="/maintenance أو https://aqh.sa" /></label>

          <label><span className="text-xs text-muted-foreground block mb-1">Meta title</span>
            <input className={inp} value={v.meta_title ?? ""} onChange={(e) => set("meta_title", e.target.value)} /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">Meta description</span>
            <input className={inp} value={v.meta_description ?? ""} onChange={(e) => set("meta_description", e.target.value)} /></label>

          <label className="flex items-center gap-2"><input type="checkbox" checked={v.published} onChange={(e) => set("published", e.target.checked)} /> منشورة</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={v.is_featured} onChange={(e) => set("is_featured", e.target.checked)} /> مميزة في الرئيسية</label>
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">إدارة الخدمات</h1>
          <p className="text-sm text-muted-foreground mt-1">مصدر موحد لخدمات الموقع. ما يظهر في الصفحة الرئيسية وصفحة /services يأتي من هنا.</p>
        </div>
        <button onClick={() => setEditing({ ...blank })} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Plus size={16} /> خدمة جديدة</button>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1,2,3].map(i => <div key={i} className="glass rounded-2xl p-4 h-20 animate-pulse" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">لا توجد خدمات بعد. أضف خدمتك الأولى.</div>
      ) : (
        <div className="grid gap-3">
          {list.map((s, i) => (
            <div key={s.id} className="glass rounded-2xl p-4 flex items-center gap-3 flex-wrap">
              <div className="flex flex-col gap-1">
                <button onClick={() => reorder(i, -1)} disabled={i === 0} className="p-1 disabled:opacity-30"><ArrowUp size={14} /></button>
                <button onClick={() => reorder(i, 1)} disabled={i === list.length - 1} className="p-1 disabled:opacity-30"><ArrowDown size={14} /></button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold flex items-center gap-2">
                  {s.title}
                  {s.is_featured && <Star size={14} className="text-gold" fill="currentColor" />}
                </div>
                <div className="text-xs text-muted-foreground" dir="ltr">{s.slug} · {s.linked_page_type}{s.linked_page_url ? ` → ${s.linked_page_url}` : ""}</div>
              </div>
              <button onClick={() => toggleFeatured(s)} title="مميزة" className={`p-2 rounded-lg ${s.is_featured ? "text-gold" : "text-muted-foreground"}`}>
                <Star size={16} fill={s.is_featured ? "currentColor" : "none"} />
              </button>
              <button onClick={() => togglePublish(s)} title="نشر/إخفاء" className="p-2 rounded-lg text-muted-foreground hover:text-foreground">
                {s.published ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button onClick={() => setEditing(s)} className="text-sm text-gold hover:underline">تعديل</button>
              <button onClick={() => remove(s.id!)} className="text-red-400"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
