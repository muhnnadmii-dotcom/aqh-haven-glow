import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save, Search, Eye, EyeOff, Home as HomeIcon } from "lucide-react";
import { MultiImageUploader } from "@/components/ImageUploader";
import { publicUrl } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/admin/projects")({
  component: ProjectsAdmin,
});

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
  specs: Record<string, string>;
  equipment: Record<string, string>;
  water_system: string[] | null;
  add_ons: string[] | null;
  service_packages: string[] | null;
  livestock_warranty: string | null;
  contents: { fish?: string[]; plantsOrCorals?: string[]; decor?: string };
  price_min: number | null;
  price_max: number | null;
  sort_order: number;
};

const CATEGORIES: { value: string; label: string }[] = [
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
const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

const blank: Project = {
  slug: "", title: "", category: "planted", category_label: "نباتي",
  featured: false, featured_on_home: false, home_order: 0,
  published: true, location: "", year: "", duration: "", description: "", cover: "",
  images: [], image_paths: [], cover_path: null,
  specs: { dimensions: "", volumeLiters: "", systemType: "" }, equipment: { filter: "", lighting: "" },
  water_system: [], add_ons: [], service_packages: [], livestock_warranty: "",
  contents: { fish: [], plantsOrCorals: [], decor: "" },
  price_min: null, price_max: null, sort_order: 0,
};

function ProjectsAdmin() {
  const [list, setList] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "published" | "draft">("all");

  const load = async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.from("projects").select("*")
      .order("sort_order").order("created_at", { ascending: false });
    if (error) setError(error.message);
    setList((data ?? []) as unknown as Project[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.slug.trim()) {
      toast.error("العنوان والـ slug مطلوبان"); return;
    }
    const payload = { ...editing, category_label: editing.category_label || catLabel(editing.category) };
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
    return <ProjectForm value={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} />;
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
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
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

function ProjectForm({ value, onChange, onSave, onCancel }: { value: Project; onChange: (v: Project) => void; onSave: () => void; onCancel: () => void }) {
  const v = value;
  const set = <K extends keyof Project>(k: K, val: Project[K]) => onChange({ ...v, [k]: val });
  const setSpec = (k: string, val: string) => onChange({ ...v, specs: { ...v.specs, [k]: val } });
  const setEq = (k: string, val: string) => onChange({ ...v, equipment: { ...v.equipment, [k]: val } });
  const list = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
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
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
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
        <Field label="الأبعاد"><input className={inp} value={v.specs.dimensions ?? ""} onChange={(e) => setSpec("dimensions", e.target.value)} /></Field>
        <Field label="الحجم (لتر)"><input className={inp} value={v.specs.volumeLiters ?? ""} onChange={(e) => setSpec("volumeLiters", e.target.value)} /></Field>
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
        <Field label="ضمان الكائنات الحية"><input className={inp} value={v.livestock_warranty ?? ""} onChange={(e) => set("livestock_warranty", e.target.value)} /></Field>
      </Section>

      <Section title="المحتويات">
        <Field label="الأسماك (سطر لكل عنصر)" full><textarea rows={3} className={ta} value={joined(v.contents.fish)} onChange={(e) => set("contents", { ...v.contents, fish: list(e.target.value) })} /></Field>
        <Field label="نباتات/مرجان (سطر لكل عنصر)" full><textarea rows={3} className={ta} value={joined(v.contents.plantsOrCorals)} onChange={(e) => set("contents", { ...v.contents, plantsOrCorals: list(e.target.value) })} /></Field>
        <Field label="ديكور"><input className={inp} value={v.contents.decor ?? ""} onChange={(e) => set("contents", { ...v.contents, decor: e.target.value })} /></Field>
      </Section>

      <Section title="السعر">
        <Field label="من (ريال)"><input type="number" className={inp} value={v.price_min ?? ""} onChange={(e) => set("price_min", e.target.value ? Number(e.target.value) : null)} /></Field>
        <Field label="إلى (ريال)"><input type="number" className={inp} value={v.price_max ?? ""} onChange={(e) => set("price_max", e.target.value ? Number(e.target.value) : null)} /></Field>
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
