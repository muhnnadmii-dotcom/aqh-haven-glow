import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";

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
  published: boolean;
  location: string | null;
  year: string | null;
  description: string | null;
  cover: string | null;
  images: string[];
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

const blank: Project = {
  slug: "", title: "", category: "living-room", category_label: "غرفة المعيشة", featured: false, published: true,
  location: "", year: "", description: "", cover: "", images: [],
  specs: { dimensions: "", volumeLiters: "", systemType: "" }, equipment: { filter: "", lighting: "" },
  water_system: [], add_ons: [], service_packages: [], livestock_warranty: "",
  contents: { fish: [], plantsOrCorals: [], decor: "" },
  price_min: null, price_max: null, sort_order: 0,
};

function ProjectsAdmin() {
  const [list, setList] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Project | null>(null);

  const load = async () => {
    const { data } = await supabase.from("projects").select("*").order("sort_order").order("created_at", { ascending: false });
    setList((data ?? []) as unknown as Project[]);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const payload = { ...editing };
    const { error } = editing.id
      ? await supabase.from("projects").update(payload).eq("id", editing.id)
      : await supabase.from("projects").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ"); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("حذف الحوض؟")) return;
    await supabase.from("projects").delete().eq("id", id); load();
  };

  if (editing) {
    return <ProjectForm value={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">الأحواض</h1>
        <button onClick={() => setEditing({ ...blank })} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2">
          <Plus size={16} /> حوض جديد
        </button>
      </div>
      <div className="grid gap-3">
        {list.length === 0 && <p className="text-muted-foreground text-sm">لا توجد أحواض بعد. أضف واحد.</p>}
        {list.map((p) => (
          <div key={p.id} className="glass rounded-2xl p-4 flex items-center gap-4">
            {p.cover && <img src={p.cover} alt="" className="h-16 w-16 rounded-xl object-cover" />}
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{p.title}</div>
              <div className="text-xs text-muted-foreground">{p.location} · {p.year} · {p.published ? "منشور" : "مسودة"} {p.featured && "· مميز"}</div>
            </div>
            <button onClick={() => setEditing(p)} className="text-sm text-gold hover:underline">تعديل</button>
            <button onClick={() => remove(p.id!)} className="text-red-400"><Trash2 size={16} /></button>
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
        <Field label="العنوان"><input className={inp} value={v.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Slug (بالإنجليزي، فريد)"><input dir="ltr" className={inp} value={v.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
        <Field label="الفئة"><input className={inp} value={v.category} onChange={(e) => set("category", e.target.value)} /></Field>
        <Field label="اسم الفئة"><input className={inp} value={v.category_label ?? ""} onChange={(e) => set("category_label", e.target.value)} /></Field>
        <Field label="الموقع"><input className={inp} value={v.location ?? ""} onChange={(e) => set("location", e.target.value)} /></Field>
        <Field label="السنة"><input className={inp} value={v.year ?? ""} onChange={(e) => set("year", e.target.value)} /></Field>
        <Field label="الوصف" full><textarea className={ta} rows={3} value={v.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="الترتيب"><input type="number" className={inp} value={v.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} /></Field>
        <Field label="خيارات">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.published} onChange={(e) => set("published", e.target.checked)} /> منشور</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.featured} onChange={(e) => set("featured", e.target.checked)} /> مميز</label>
          </div>
        </Field>
      </Section>

      <Section title="الصور">
        <Field label="رابط صورة الغلاف"><input dir="ltr" className={inp} value={v.cover ?? ""} onChange={(e) => set("cover", e.target.value)} /></Field>
        <Field label="روابط الصور (كل سطر رابط)" full>
          <textarea dir="ltr" rows={4} className={ta} value={v.images.join("\n")} onChange={(e) => set("images", list(e.target.value))} />
        </Field>
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
