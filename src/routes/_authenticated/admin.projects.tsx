import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save, Search, Eye, EyeOff, Home as HomeIcon, Upload, Loader2, Star, X as XIcon, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { publicUrl, uploadMedia, deleteMedia, onImageError } from "@/lib/storage";


export const Route = createFileRoute("/_authenticated/admin/projects")({
  component: ProjectsAdmin,
});

type PriceType = "fixed" | "from" | "range" | "on_request" | "hidden";

type Project = {
  id?: string;
  slug: string;
  title: string;
  category: string;
  category_label: string | null;
  featured: boolean;
  featured_on_home: boolean;
  home_order: number;
  published: boolean;
  location: string | null;
  year: string | null;
  duration: string | null;
  description: string | null;
  cover: string | null;
  images: string[];
  image_paths: string[];
  cover_path: string | null;
  media_order: string[];
  specs: Record<string, string>;
  equipment: Record<string, string>;
  water_system: string[] | null;
  add_ons: string[] | null;
  service_packages: string[] | null;
  livestock_warranty: string | null;
  equipment_warranty_enabled: boolean;
  equipment_warranty_text: string | null;
  livestock_warranty_enabled: boolean;
  livestock_warranty_text: string | null;
  contents: { fish?: string[]; plantsOrCorals?: string[]; decor?: string };
  price_min: number | null;
  price_max: number | null;
  price_type: PriceType;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  volume_liters: number | null;
  sort_order: number;
};

type CategoryOpt = { value: string; label: string };

// Fallback used only until categories load from DB; the DB list is the source of truth.
const FALLBACK_CATEGORIES: CategoryOpt[] = [
  { value: "planted", label: "نباتي" },
  { value: "marine", label: "بحري" },
  { value: "betta", label: "فايتر" },
  { value: "shrimp", label: "جمبري" },
  { value: "custom", label: "مخصص" },
  { value: "other", label: "آخر" },
  { value: "living-room", label: "غرفة المعيشة" },
  { value: "office", label: "مكتب" },
  { value: "entrance", label: "مدخل" },
  { value: "commercial", label: "تجاري" },
];
const catLabelFrom = (cats: CategoryOpt[], v: string) =>
  cats.find((c) => c.value === v)?.label ?? v;


const blank: Project = {
  slug: "", title: "", category: "planted", category_label: "نباتي",
  featured: false, featured_on_home: false, home_order: 0,
  published: true, location: "", year: "", duration: "", description: "", cover: "",
  images: [], image_paths: [], cover_path: null, media_order: [],
  specs: { dimensions: "", volumeLiters: "", systemType: "" }, equipment: { filter: "", lighting: "" },
  water_system: [], add_ons: [], service_packages: [], livestock_warranty: "",
  equipment_warranty_enabled: false, equipment_warranty_text: "",
  livestock_warranty_enabled: false, livestock_warranty_text: "",
  contents: { fish: [], plantsOrCorals: [], decor: "" },
  price_min: null, price_max: null, price_type: "range",
  length_cm: null, width_cm: null, height_cm: null, volume_liters: null,
  sort_order: 0,
};

function ProjectsAdmin() {
  const [list, setList] = useState<Project[]>([]);
  const [categories, setCategories] = useState<CategoryOpt[]>(FALLBACK_CATEGORIES);
  const [editing, setEditing] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "published" | "draft">("all");

  const catLabel = (v: string) => catLabelFrom(categories, v);

  const loadCategories = async () => {
    const { data } = await (supabase as any)
      .from("project_categories").select("slug,label,published")
      .order("sort_order").order("label");
    const rows = (data ?? []) as { slug: string; label: string; published: boolean }[];
    if (rows.length > 0) {
      setCategories(rows.map((r) => ({ value: r.slug, label: r.label })));
    }
  };

  const load = async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.from("projects").select("*")
      .order("sort_order").order("created_at", { ascending: false });
    if (error) setError(error.message);
    setList((data ?? []) as unknown as Project[]);
    setLoading(false);
  };
  useEffect(() => { load(); loadCategories(); }, []);


  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.slug.trim()) {
      toast.error("العنوان والـ slug مطلوبان"); return;
    }
    // Normalize price fields based on selected type
    let price_min = editing.price_min;
    let price_max = editing.price_max;
    switch (editing.price_type) {
      case "fixed":
        if (price_min == null) { toast.error("أدخل السعر"); return; }
        price_max = price_min;
        break;
      case "from":
        if (price_min == null) { toast.error("أدخل السعر الابتدائي"); return; }
        price_max = null;
        break;
      case "range":
        if (price_min == null || price_max == null) { toast.error("أدخل سعر من وإلى"); return; }
        break;
      case "on_request":
      case "hidden":
        price_min = null; price_max = null;
        break;
    }
    // Mirror dimensions/volume into specs jsonb so legacy display stays in sync
    const l = editing.length_cm, w = editing.width_cm, h = editing.height_cm;
    const dimensionsStr = (l && w && h) ? `${l} × ${w} × ${h} سم` : (editing.specs.dimensions ?? "");
    const volumeStr = editing.volume_liters != null ? `${editing.volume_liters} لتر` : (editing.specs.volumeLiters ?? "");
    const nextSpecs = { ...editing.specs, dimensions: dimensionsStr, volumeLiters: volumeStr };
    const cleanList = (a: string[] | null | undefined) =>
      (a ?? []).map((x) => x.trim()).filter(Boolean);
    const payload = {
      ...editing,
      price_min, price_max,
      specs: nextSpecs,
      water_system: cleanList(editing.water_system),
      add_ons: cleanList(editing.add_ons),
      service_packages: cleanList(editing.service_packages),
      contents: {
        ...editing.contents,
        fish: cleanList(editing.contents?.fish),
        plantsOrCorals: cleanList(editing.contents?.plantsOrCorals),
      },
      equipment_warranty_text: editing.equipment_warranty_enabled
        ? (editing.equipment_warranty_text ?? "").trim() || null
        : null,
      livestock_warranty_text: editing.livestock_warranty_enabled
        ? (editing.livestock_warranty_text ?? "").trim() || null
        : null,
      category_label: editing.category_label || catLabel(editing.category),
    };
    const { error } = editing.id
      ? await supabase.from("projects").update(payload).eq("id", editing.id)
      : await supabase.from("projects").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ"); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف الحوض؟")) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف"); load();
  };

  const toggle = async (p: Project, field: "published" | "featured_on_home") => {
    if (!p.id) return;
    const patch: Partial<Project> = { [field]: !p[field] };
    const { error } = await supabase.from("projects").update(patch).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const filtered = useMemo(() => {
    return list.filter((p) => {
      if (filterCat !== "all" && p.category !== filterCat) return false;
      if (filterStatus === "published" && !p.published) return false;
      if (filterStatus === "draft" && p.published) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.title.toLowerCase().includes(q) && !(p.category_label ?? "").toLowerCase().includes(q) && !(p.slug ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [list, search, filterCat, filterStatus]);

  if (editing) {
    return <ProjectForm value={editing} categories={categories} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold">الأحواض / أعمالنا</h1>
        <button onClick={() => setEditing({ ...blank, sort_order: list.length })}
          className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2">
          <Plus size={16} /> حوض جديد
        </button>
      </div>

      <div className="glass rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالعنوان أو النوع..."
            className={`${inp} pr-9`} />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className={inp + " w-auto"}>
          <option value="all">كل التصنيفات</option>
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}

        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className={inp + " w-auto"}>
          <option value="all">كل الحالات</option>
          <option value="published">منشور</option>
          <option value="draft">مخفي</option>
        </select>
      </div>

      {loading && <p className="text-muted-foreground text-sm">جاري التحميل...</p>}
      {error && <p className="text-red-400 text-sm">خطأ: {error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">
          {list.length === 0 ? "لا توجد أعمال بعد. أضف أول حوض." : "لا توجد نتائج مطابقة."}
        </div>
      )}

      <div className="grid gap-3">
        {filtered.map((p) => (
          <div key={p.id} className={`glass rounded-2xl p-4 flex items-center gap-4 ${!p.published ? "opacity-60" : ""}`}>
            {(p.cover_path || p.cover) ? (
              <img src={publicUrl(p.cover_path) || p.cover || ""} alt="" className="h-16 w-16 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="h-16 w-16 rounded-xl glass-gold shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate flex items-center gap-2 flex-wrap">
                {p.title}
                <span className="text-[10px] glass-gold px-2 py-0.5 rounded-full">{catLabel(p.category)}</span>
                {p.featured_on_home && <span className="text-[10px] glass-gold px-2 py-0.5 rounded-full">رئيسية</span>}
                {!p.published && <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">مخفي</span>}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {[p.location, p.year, p.duration, p.specs?.volumeLiters ? `${p.specs.volumeLiters} لتر` : null].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button title={p.published ? "إخفاء" : "نشر"} onClick={() => toggle(p, "published")} className="text-muted-foreground hover:text-foreground">
                {p.published ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button title="إظهار في الرئيسية" onClick={() => toggle(p, "featured_on_home")} className={p.featured_on_home ? "text-gold" : "text-muted-foreground hover:text-gold"}>
                <HomeIcon size={16} />
              </button>
              <button onClick={() => setEditing(p)} className="text-sm text-gold hover:underline">تعديل</button>
              <button onClick={() => remove(p.id!)} className="text-red-400"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectForm({ value, categories, onChange, onSave, onCancel }: { value: Project; categories: CategoryOpt[]; onChange: (v: Project) => void; onSave: () => void; onCancel: () => void }) {
  const v = value;
  const catLabel = (slug: string) => catLabelFrom(categories, slug);
  const set = <K extends keyof Project>(k: K, val: Project[K]) => onChange({ ...v, [k]: val });
  const setSpec = (k: string, val: string) => onChange({ ...v, specs: { ...v.specs, [k]: val } });
  const setEq = (k: string, val: string) => onChange({ ...v, equipment: { ...v.equipment, [k]: val } });
  // Preserve spaces and empty lines while typing; cleanup happens on save.
  const list = (s: string) => s.split("\n");
  const joined = (a: string[] | null | undefined) => (a ?? []).join("\n");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{v.id ? "تعديل حوض" : "حوض جديد"}</h1>
        <div className="flex gap-2">
          <button onClick={onCancel} className="glass rounded-xl px-4 py-2 text-sm">إلغاء</button>
          <button onClick={onSave} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Save size={16} /> حفظ</button>
        </div>
      </div>

      <Section title="الأساسيات">
        <Field label="العنوان *"><input className={inp} value={v.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Slug (بالإنجليزي، فريد) *"><input dir="ltr" className={inp} value={v.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
        <Field label="التصنيف">
          <select className={inp} value={v.category} onChange={(e) => {
            const nv = e.target.value;
            onChange({ ...v, category: nv, category_label: catLabel(nv) });
          }}>
            {!categories.some((c) => c.value === v.category) && v.category && (
              <option value={v.category}>{v.category_label || v.category}</option>
            )}
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>

        <Field label="اسم التصنيف (للعرض)"><input className={inp} value={v.category_label ?? ""} onChange={(e) => set("category_label", e.target.value)} /></Field>
        <Field label="المدينة / الموقع"><input className={inp} value={v.location ?? ""} onChange={(e) => set("location", e.target.value)} /></Field>
        <Field label="السنة"><input className={inp} value={v.year ?? ""} onChange={(e) => set("year", e.target.value)} /></Field>
        <Field label="مدة التنفيذ"><input className={inp} value={v.duration ?? ""} placeholder="مثلاً: أسبوعان" onChange={(e) => set("duration", e.target.value)} /></Field>
        <Field label="الوصف المختصر / التفصيلي" full><textarea className={ta} rows={3} value={v.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="ترتيب القائمة"><input type="number" className={inp} value={v.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} /></Field>
        <Field label="ترتيب الصفحة الرئيسية"><input type="number" className={inp} value={v.home_order} onChange={(e) => set("home_order", Number(e.target.value))} /></Field>
        <Field label="خيارات" full>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.published} onChange={(e) => set("published", e.target.checked)} /> منشور</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.featured_on_home} onChange={(e) => set("featured_on_home", e.target.checked)} /> يظهر في الصفحة الرئيسية</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.featured} onChange={(e) => set("featured", e.target.checked)} /> مميز (شارة)</label>
          </div>
        </Field>
      </Section>

      <Section title="الصور">
        <div className="sm:col-span-2">
          <ProjectImagesManager value={v} onChange={onChange} />
        </div>
      </Section>


      <Section title="المواصفات">
        <Field label="الطول (سم)">
          <input type="number" min={0} step="0.1" className={inp}
            value={v.length_cm ?? ""}
            onChange={(e) => {
              const n = e.target.value === "" ? null : Number(e.target.value);
              const next = { ...v, length_cm: n };
              if (n != null && v.width_cm != null && v.height_cm != null) {
                next.volume_liters = Number(((n * v.width_cm * v.height_cm) / 1000).toFixed(2));
              }
              onChange(next);
            }} />
        </Field>
        <Field label="العرض (سم)">
          <input type="number" min={0} step="0.1" className={inp}
            value={v.width_cm ?? ""}
            onChange={(e) => {
              const n = e.target.value === "" ? null : Number(e.target.value);
              const next = { ...v, width_cm: n };
              if (n != null && v.length_cm != null && v.height_cm != null) {
                next.volume_liters = Number(((v.length_cm * n * v.height_cm) / 1000).toFixed(2));
              }
              onChange(next);
            }} />
        </Field>
        <Field label="الارتفاع (سم)">
          <input type="number" min={0} step="0.1" className={inp}
            value={v.height_cm ?? ""}
            onChange={(e) => {
              const n = e.target.value === "" ? null : Number(e.target.value);
              const next = { ...v, height_cm: n };
              if (n != null && v.length_cm != null && v.width_cm != null) {
                next.volume_liters = Number(((v.length_cm * v.width_cm * n) / 1000).toFixed(2));
              }
              onChange(next);
            }} />
        </Field>
        <Field label="الحجم (لتر) — يُحسب تلقائيًا ويمكن تعديله">
          <input type="number" min={0} step="0.1" className={inp}
            value={v.volume_liters ?? ""}
            onChange={(e) => set("volume_liters", e.target.value === "" ? null : Number(e.target.value))} />
        </Field>
        <Field label="نوع النظام"><input className={inp} value={v.specs.systemType ?? ""} onChange={(e) => setSpec("systemType", e.target.value)} /></Field>
        <Field label="نوع الزجاج"><input className={inp} value={v.specs.glassType ?? ""} onChange={(e) => setSpec("glassType", e.target.value)} /></Field>
        <Field label="PAR"><input className={inp} value={v.specs.parIntensity ?? ""} onChange={(e) => setSpec("parIntensity", e.target.value)} /></Field>
        <Field label="معدل التدوير"><input className={inp} value={v.specs.turnover ?? ""} onChange={(e) => setSpec("turnover", e.target.value)} /></Field>
      </Section>

      <Section title="المعدات">
        <Field label="الفلتر" full><textarea rows={2} className={ta} value={v.equipment.filter ?? ""} onChange={(e) => setEq("filter", e.target.value)} /></Field>
        <Field label="الإضاءة" full><textarea rows={2} className={ta} value={v.equipment.lighting ?? ""} onChange={(e) => setEq("lighting", e.target.value)} /></Field>
        <Field label="التدفئة/التبريد" full><textarea rows={2} className={ta} value={v.equipment.heatingCooling ?? ""} onChange={(e) => setEq("heatingCooling", e.target.value)} /></Field>
        <Field label="مضخة الرجوع"><input className={inp} value={v.equipment.returnPump ?? ""} onChange={(e) => setEq("returnPump", e.target.value)} /></Field>
        <Field label="السكيمر"><input className={inp} value={v.equipment.skimmer ?? ""} onChange={(e) => setEq("skimmer", e.target.value)} /></Field>
        <Field label="موجات"><input className={inp} value={v.equipment.waveMakers ?? ""} onChange={(e) => setEq("waveMakers", e.target.value)} /></Field>
        <Field label="CO₂"><input className={inp} value={v.equipment.co2 ?? ""} onChange={(e) => setEq("co2", e.target.value)} /></Field>
        <Field label="تسميد"><input className={inp} value={v.equipment.dosing ?? ""} onChange={(e) => setEq("dosing", e.target.value)} /></Field>
      </Section>

      <Section title="القوائم">
        <Field label="نظام المياه (سطر لكل عنصر)" full><textarea rows={3} className={ta} value={joined(v.water_system)} onChange={(e) => set("water_system", list(e.target.value))} /></Field>
        <Field label="إضافات (سطر لكل عنصر)" full><textarea rows={3} className={ta} value={joined(v.add_ons)} onChange={(e) => set("add_ons", list(e.target.value))} /></Field>
        <Field label="باقات الخدمة (سطر لكل عنصر)" full><textarea rows={3} className={ta} value={joined(v.service_packages)} onChange={(e) => set("service_packages", list(e.target.value))} /></Field>
      </Section>

      <Section title="الضمانات">
        <Field label="ضمان المعدات" full>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="checkbox" checked={v.equipment_warranty_enabled}
              onChange={(e) => set("equipment_warranty_enabled", e.target.checked)} />
            يشمل ضمان المعدات
          </label>
          {v.equipment_warranty_enabled && (
            <textarea rows={3} className={ta}
              placeholder="اكتب تفاصيل ضمان المعدات..."
              value={v.equipment_warranty_text ?? ""}
              onChange={(e) => set("equipment_warranty_text", e.target.value)} />
          )}
        </Field>
        <Field label="ضمان الكائنات الحية" full>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="checkbox" checked={v.livestock_warranty_enabled}
              onChange={(e) => set("livestock_warranty_enabled", e.target.checked)} />
            يشمل ضمان الكائنات الحية
          </label>
          {v.livestock_warranty_enabled && (
            <textarea rows={3} className={ta}
              placeholder="اكتب تفاصيل ضمان الكائنات الحية..."
              value={v.livestock_warranty_text ?? ""}
              onChange={(e) => set("livestock_warranty_text", e.target.value)} />
          )}
        </Field>
      </Section>

      <Section title="المحتويات">
        <Field label="الأسماك (سطر لكل عنصر)" full><textarea rows={3} className={ta} value={joined(v.contents.fish)} onChange={(e) => set("contents", { ...v.contents, fish: list(e.target.value) })} /></Field>
        <Field label="نباتات/مرجان (سطر لكل عنصر)" full><textarea rows={3} className={ta} value={joined(v.contents.plantsOrCorals)} onChange={(e) => set("contents", { ...v.contents, plantsOrCorals: list(e.target.value) })} /></Field>
        <Field label="ديكور"><input className={inp} value={v.contents.decor ?? ""} onChange={(e) => set("contents", { ...v.contents, decor: e.target.value })} /></Field>
      </Section>

      <Section title="السعر">
        <Field label="نوع السعر" full>
          <select className={inp} value={v.price_type}
            onChange={(e) => set("price_type", e.target.value as PriceType)}>
            <option value="fixed">سعر ثابت</option>
            <option value="from">سعر يبدأ من</option>
            <option value="range">سعر من إلى</option>
            <option value="on_request">حسب المعاينة</option>
            <option value="hidden">مخفي (لا يظهر للزائر)</option>
          </select>
        </Field>
        {v.price_type === "fixed" && (
          <Field label="السعر (ريال)">
            <input type="number" min={0} className={inp} value={v.price_min ?? ""}
              onChange={(e) => set("price_min", e.target.value ? Number(e.target.value) : null)} />
          </Field>
        )}
        {v.price_type === "from" && (
          <Field label="السعر الابتدائي (ريال)">
            <input type="number" min={0} className={inp} value={v.price_min ?? ""}
              onChange={(e) => set("price_min", e.target.value ? Number(e.target.value) : null)} />
          </Field>
        )}
        {v.price_type === "range" && (
          <>
            <Field label="من (ريال)">
              <input type="number" min={0} className={inp} value={v.price_min ?? ""}
                onChange={(e) => set("price_min", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="إلى (ريال)">
              <input type="number" min={0} className={inp} value={v.price_max ?? ""}
                onChange={(e) => set("price_max", e.target.value ? Number(e.target.value) : null)} />
            </Field>
          </>
        )}
        {(v.price_type === "on_request" || v.price_type === "hidden") && (
          <Field label="ملاحظة" full>
            <div className="text-xs text-muted-foreground glass rounded-xl px-3 py-2">
              {v.price_type === "on_request" ? "سيظهر للزائر: «السعر حسب المعاينة»" : "لن يظهر أي سعر للزائر."}
            </div>
          </Field>
        )}
      </Section>

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="glass rounded-xl px-4 py-2 text-sm">إلغاء</button>
        <button onClick={onSave} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Save size={16} /> حفظ</button>
      </div>
    </div>
  );
}

const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60";
const ta = inp + " resize-none";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-sm font-bold text-gradient-gold mb-3">{title}</div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs text-muted-foreground block mb-1">{label}</span>
      {children}
    </label>
  );
}

type MediaItem = { token: string; kind: "new" | "old"; src: string; ref: string };

function buildOrderedItems(value: Project): MediaItem[] {
  const paths = value.image_paths ?? [];
  const urls = value.images ?? [];
  const order = (value.media_order ?? []).filter((t) => {
    if (t.startsWith("p:")) return paths.includes(t.slice(2));
    if (t.startsWith("u:")) return urls.includes(t.slice(2));
    return false;
  });
  // Append any items missing from media_order at the end (paths first, then urls)
  for (const p of paths) {
    const t = `p:${p}`;
    if (!order.includes(t)) order.push(t);
  }
  for (const u of urls) {
    const t = `u:${u}`;
    if (!order.includes(t)) order.push(t);
  }
  return order.map((token) => {
    if (token.startsWith("p:")) {
      const ref = token.slice(2);
      return { token, kind: "new" as const, src: publicUrl(ref), ref };
    }
    const ref = token.slice(2);
    return { token, kind: "old" as const, src: ref, ref };
  });
}

function ProjectImagesManager({ value, onChange }: { value: Project; onChange: (v: Project) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const items = buildOrderedItems(value);
  const coverPath = value.cover_path ?? null;
  const coverUrl = value.cover ?? "";

  const isCover = (it: MediaItem) =>
    (it.kind === "new" && coverPath === it.ref) ||
    (it.kind === "old" && !coverPath && coverUrl === it.ref);

  const applyOrder = (next: MediaItem[]) => {
    onChange({ ...value, media_order: next.map((i) => i.token) });
  };

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    const next = items.slice();
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    applyOrder(next);
  };

  const addFiles = async (files: FileList) => {
    setBusy(true);
    try {
      const added: string[] = [];
      for (const f of Array.from(files)) {
        const p = await uploadMedia(f, `projects/${value.slug || "new"}`);
        added.push(p);
      }
      const nextPaths = [...(value.image_paths ?? []), ...added];
      const nextOrder = [...items.map((i) => i.token), ...added.map((p) => `p:${p}`)];
      const nextCoverPath = coverPath ?? (coverUrl ? null : added[0] ?? null);
      onChange({ ...value, image_paths: nextPaths, cover_path: nextCoverPath, media_order: nextOrder });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الرفع");
    } finally { setBusy(false); }
  };

  const addUrl = () => {
    const u = urlInput.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) { toast.error("الرابط يجب أن يبدأ بـ http(s)://"); return; }
    const urls = value.images ?? [];
    if (urls.includes(u)) { toast.error("الرابط موجود مسبقًا"); return; }
    const nextUrls = [...urls, u];
    const nextOrder = [...items.map((i) => i.token), `u:${u}`];
    onChange({
      ...value,
      images: nextUrls,
      cover: coverUrl || (!coverPath ? u : ""),
      media_order: nextOrder,
    });
    setUrlInput("");
  };

  const removeItem = async (it: MediaItem) => {
    if (items.length === 1) {
      if (!confirm("هذه آخر صورة. هل تريد حذفها فعلًا؟")) return;
    } else {
      if (!confirm("حذف هذه الصورة؟")) return;
    }
    if (it.kind === "new") {
      deleteMedia(it.ref).catch(() => {});
      const nextPaths = (value.image_paths ?? []).filter((p) => p !== it.ref);
      const nextOrder = items.filter((x) => x.token !== it.token).map((x) => x.token);
      const nextCoverPath = coverPath === it.ref
        ? (nextPaths[0] ?? null)
        : coverPath;
      onChange({ ...value, image_paths: nextPaths, cover_path: nextCoverPath, media_order: nextOrder });
    } else {
      const nextUrls = (value.images ?? []).filter((u) => u !== it.ref);
      const nextOrder = items.filter((x) => x.token !== it.token).map((x) => x.token);
      const nextCoverUrl = coverUrl === it.ref ? "" : coverUrl;
      onChange({ ...value, images: nextUrls, cover: nextCoverUrl, media_order: nextOrder });
    }
  };

  const setAsCover = (it: MediaItem) => {
    if (it.kind === "new") onChange({ ...value, cover_path: it.ref, cover: "" });
    else onChange({ ...value, cover_path: null, cover: it.ref });
  };

  const total = items.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" disabled={busy} onClick={() => ref.current?.click()}
          className="glass rounded-xl px-4 py-2 text-sm flex items-center gap-2 hover:bg-white/10 disabled:opacity-50">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
          {busy ? "جاري الرفع..." : "أضف صور"}
        </button>
        <input ref={ref} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} />
        <span className="text-xs text-muted-foreground">{total} صورة</span>
      </div>

      <div className="flex items-center gap-2">
        <input dir="ltr" className={inp} value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
          placeholder="رابط صورة خارجي https://..." />
        <button type="button" onClick={addUrl} className="glass rounded-xl px-3 py-2 text-sm hover:bg-white/10 shrink-0">
          أضف رابط
        </button>
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-xs text-muted-foreground">
          لا توجد صور بعد. ارفع صورًا جديدة أو أضف روابط خارجية.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {items.map((it, idx) => (
            <div
              key={it.token}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== idx) move(dragIdx, idx);
                setDragIdx(null);
              }}
              onDragEnd={() => setDragIdx(null)}
              className={`relative rounded-xl overflow-hidden border-2 ${isCover(it) ? "border-gold" : "border-white/10"} ${dragIdx === idx ? "opacity-50" : ""}`}
            >
              <div className="aspect-square relative">
                <img src={it.src} alt="" loading="lazy" onError={onImageError} className="h-full w-full object-cover" />
                {isCover(it) && (
                  <span className="absolute top-1 left-1 bg-gold text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
                    رئيسية
                  </span>
                )}
                <span className={`absolute bottom-1 right-1 text-[9px] px-1.5 py-0.5 rounded-full ${it.kind === "old" ? "bg-amber-500/80 text-black" : "bg-emerald-500/80 text-black"}`}>
                  {it.kind === "old" ? "قديم" : "جديد"}
                </span>
                <span className="absolute top-1 right-1 bg-black/70 rounded-full px-1.5 py-0.5 text-[10px] text-white">
                  {idx + 1}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 bg-black/60 px-1 py-1">
                <button type="button" onClick={() => move(idx, idx - 1)} disabled={idx === 0}
                  title="للأعلى" className="p-1 rounded hover:bg-white/10 disabled:opacity-30">
                  <ChevronUp size={14} />
                </button>
                <button type="button" onClick={() => move(idx, idx + 1)} disabled={idx === items.length - 1}
                  title="للأسفل" className="p-1 rounded hover:bg-white/10 disabled:opacity-30">
                  <ChevronDown size={14} />
                </button>
                <span className="opacity-60 cursor-grab" title="اسحب للترتيب">
                  <GripVertical size={14} />
                </span>
                <button type="button" onClick={() => setAsCover(it)} title="اجعلها الرئيسية"
                  className="p-1 rounded text-gold hover:bg-gold hover:text-black">
                  <Star size={14} fill={isCover(it) ? "currentColor" : "none"} />
                </button>
                <button type="button" onClick={() => removeItem(it)} title="حذف"
                  className="p-1 rounded text-white hover:bg-red-500">
                  <XIcon size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        رتّب الصور بالسحب والإفلات أو بأزرار الأسهم. اضغط النجمة لتعيين الصورة الرئيسية، ✕ للحذف. «قديم» = صورة برابط، «جديد» = صورة مرفوعة.
      </p>
    </div>
  );
}


