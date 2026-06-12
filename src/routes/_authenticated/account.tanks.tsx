import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save, Fish, Ruler, Filter as FilterIcon, Flame, Lightbulb, Wind, Leaf, Images, Waves, FlaskConical, Sparkles } from "lucide-react";
import { MultiImageUploader } from "@/components/ImageUploader";
import { publicUrl } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/account/tanks")({
  component: TanksPage,
});

type LivestockItem = { species: string; count: string };
type PlantItem = { name: string; count: string };
type CoralItem = { type: string; count: string; notes: string };

type Tank = {
  id?: string;
  name: string;
  tank_type: string;
  install_date: string | null;
  city: string;
  notes: string;
  width_cm: string;
  depth_cm: string;
  height_cm: string;
  volume_liters: number | null;
  filter_type: string;
  filter_model: string;
  has_heater: boolean;
  heater_watts: string;
  heater_model: string;
  lighting_type: string;
  lighting_hours: string;
  lighting_model: string;
  has_timer: boolean;
  has_co2: boolean;
  co2_type: string;
  co2_hours: string;
  livestock_items: LivestockItem[];
  has_plants: boolean;
  plants: PlantItem[];
  image_paths: string[];
  primary_image: string | null;
  // Marine equipment
  has_protein_skimmer: boolean;
  protein_skimmer_model: string;
  has_wave_maker: boolean;
  wave_maker_model: string;
  has_sump: boolean;
  has_ato: boolean;
  salt_brand: string;
  salinity: string;
  marine_temperature: string;
  last_water_change: string | null;
  water_change_percent: string;
  // Marine lighting
  marine_light_type: string;
  white_light_hours: string;
  blue_light_hours: string;
  coral_safe_light: string; // yes | no | unknown
  // Coral
  has_coral: boolean;
  corals: CoralItem[];
  // Tests
  test_salinity: string;
  test_ph: string;
  test_kh: string;
  test_calcium: string;
  test_magnesium: string;
  test_nitrate: string;
  test_phosphate: string;
  test_ammonia: string;
  test_nitrite: string;
};

const blank: Tank = {
  name: "", tank_type: "", install_date: null, city: "", notes: "",
  width_cm: "", depth_cm: "", height_cm: "", volume_liters: null,
  filter_type: "", filter_model: "",
  has_heater: false, heater_watts: "", heater_model: "",
  lighting_type: "", lighting_hours: "", lighting_model: "", has_timer: false,
  has_co2: false, co2_type: "", co2_hours: "",
  livestock_items: [], has_plants: false, plants: [],
  image_paths: [], primary_image: null,
  has_protein_skimmer: false, protein_skimmer_model: "",
  has_wave_maker: false, wave_maker_model: "",
  has_sump: false, has_ato: false,
  salt_brand: "", salinity: "", marine_temperature: "",
  last_water_change: null, water_change_percent: "",
  marine_light_type: "", white_light_hours: "", blue_light_hours: "", coral_safe_light: "",
  has_coral: false, corals: [],
  test_salinity: "", test_ph: "", test_kh: "", test_calcium: "", test_magnesium: "",
  test_nitrate: "", test_phosphate: "", test_ammonia: "", test_nitrite: "",
};

const TANK_TYPES = [
  { v: "freshwater", l: "عذب" }, { v: "planted", l: "نباتي" }, { v: "marine", l: "بحري" },
  { v: "betta", l: "فايتر" }, { v: "shrimp", l: "جمبري" }, { v: "other", l: "آخر" },
];
const FILTER_TYPES = ["إسفنجي", "كانستر", "شلال", "داخلي", "سامب", "بدون", "آخر"];

function fromRow(r: any): Tank {
  return {
    ...blank,
    id: r.id,
    name: r.name ?? "",
    tank_type: r.tank_type ?? "",
    install_date: r.install_date,
    city: r.city ?? "",
    notes: r.notes ?? "",
    width_cm: r.width_cm?.toString() ?? "",
    depth_cm: r.depth_cm?.toString() ?? "",
    height_cm: r.height_cm?.toString() ?? "",
    volume_liters: r.volume_liters ?? null,
    filter_type: r.filter_type ?? "",
    filter_model: r.filter_model ?? "",
    has_heater: !!r.has_heater,
    heater_watts: r.heater_watts?.toString() ?? "",
    heater_model: r.heater_model ?? "",
    lighting_type: r.lighting_type ?? "",
    lighting_hours: r.lighting_hours?.toString() ?? "",
    lighting_model: r.lighting_model ?? "",
    has_timer: !!r.has_timer,
    has_co2: !!r.has_co2,
    co2_type: r.co2_type ?? "",
    co2_hours: r.co2_hours?.toString() ?? "",
    livestock_items: Array.isArray(r.livestock_items) ? r.livestock_items : [],
    has_plants: !!r.has_plants,
    plants: Array.isArray(r.plants) ? r.plants : [],
    image_paths: Array.isArray(r.image_paths) ? r.image_paths : [],
    primary_image: r.primary_image ?? null,
  };
}

function TanksPage() {
  const [list, setList] = useState<any[]>([]);
  const [editing, setEditing] = useState<Tank | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
    const { data } = await supabase.from("customer_tanks").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false });
    setList(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error("اسم الحوض مطلوب"); return; }
    if (!editing.tank_type) { toast.error("نوع الحوض مطلوب"); return; }
    if (!editing.filter_type) { toast.error("نوع الفلتر مطلوب"); return; }
    const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
    const payload: any = {
      user_id: u.user.id,
      name: editing.name.trim(),
      tank_type: editing.tank_type,
      install_date: editing.install_date || null,
      city: editing.city || null,
      notes: editing.notes || null,
      width_cm: editing.width_cm ? Number(editing.width_cm) : null,
      depth_cm: editing.depth_cm ? Number(editing.depth_cm) : null,
      height_cm: editing.height_cm ? Number(editing.height_cm) : null,
      volume_liters: editing.volume_liters,
      dimensions: editing.width_cm && editing.depth_cm && editing.height_cm
        ? `${editing.width_cm}×${editing.depth_cm}×${editing.height_cm} سم` : null,
      filter_type: editing.filter_type,
      filter_model: editing.filter_model || null,
      has_heater: editing.has_heater,
      heater_watts: editing.heater_watts ? Number(editing.heater_watts) : null,
      heater_model: editing.heater_model || null,
      lighting_type: editing.lighting_type || null,
      lighting_hours: editing.lighting_hours ? Number(editing.lighting_hours) : null,
      lighting_model: editing.lighting_model || null,
      has_timer: editing.has_timer,
      has_co2: editing.has_co2,
      co2_type: editing.co2_type || null,
      co2_hours: editing.co2_hours ? Number(editing.co2_hours) : null,
      livestock_items: editing.livestock_items,
      has_plants: editing.has_plants,
      plants: editing.has_plants ? editing.plants : [],
      image_paths: editing.image_paths,
      primary_image: editing.primary_image,
      image_path: editing.primary_image,
    };
    const { error } = editing.id
      ? await supabase.from("customer_tanks").update(payload).eq("id", editing.id)
      : await supabase.from("customer_tanks").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("تم حفظ بيانات الحوض بنجاح."); setEditing(null); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("حذف الحوض؟")) return;
    await supabase.from("customer_tanks").delete().eq("id", id); load();
  };

  if (editing) return <TankEditor v={editing} setV={setEditing} onSave={save} onCancel={() => setEditing(null)} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">أحواضي</h1>
        <button onClick={() => setEditing({ ...blank })} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Plus size={16} /> حوض جديد</button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">جاري التحميل...</p> :
        list.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد أحواض. أضف حوضك لمتابعة الصيانة والاستشارات.</p> :
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((t) => (
            <div key={t.id} className="glass rounded-2xl p-4 flex gap-3">
              {t.primary_image || t.image_path ? (
                <img src={publicUrl(t.primary_image || t.image_path)} alt="" className="h-20 w-20 rounded-xl object-cover" />
              ) : (
                <div className="h-20 w-20 rounded-xl bg-white/5 grid place-items-center text-gold"><Fish size={24} /></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.dimensions || "—"} · {t.volume_liters ? `${t.volume_liters}L` : ""}</div>
                <div className="flex gap-3 mt-2 text-xs flex-wrap">
                  <Link to="/account/tanks/$id" params={{ id: t.id }} className="text-gold hover:underline">عرض التفاصيل</Link>
                  <button onClick={() => setEditing(fromRow(t))} className="text-gold hover:underline">تعديل</button>
                  <button onClick={() => remove(t.id)} className="text-red-400 hover:underline">حذف</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60";
const lbl = "text-xs text-muted-foreground block mb-1";

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: any }) {
  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2"><Icon className="text-gold" size={18} /><h2 className="font-bold">{title}</h2></div>
      {children}
    </div>
  );
}

function TankEditor({ v, setV, onSave, onCancel }: { v: Tank; setV: (t: Tank) => void; onSave: () => void; onCancel: () => void }) {
  const set = <K extends keyof Tank>(k: K, val: Tank[K]) => setV({ ...v, [k]: val });

  const autoVolume = useMemo(() => {
    const w = Number(v.width_cm), d = Number(v.depth_cm), h = Number(v.height_cm);
    if (w > 0 && d > 0 && h > 0) return Math.round((w * d * h) / 1000);
    return null;
  }, [v.width_cm, v.depth_cm, v.height_cm]);

  useEffect(() => {
    if (autoVolume && autoVolume !== v.volume_liters) setV({ ...v, volume_liters: autoVolume });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoVolume]);

  const showPlants = v.tank_type === "freshwater" || v.tank_type === "planted";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{v.id ? "تعديل الحوض" : "حوض جديد"}</h1>
      </div>

      <Section icon={Fish} title="البيانات الأساسية">
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={lbl}>اسم الحوض *</span>
            <input className={inp} value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="حوض الصالة" /></label>
          <label><span className={lbl}>نوع الحوض *</span>
            <select className={inp} value={v.tank_type} onChange={(e) => set("tank_type", e.target.value)}>
              <option value="" className="bg-background">—</option>
              {TANK_TYPES.map((t) => <option key={t.v} value={t.v} className="bg-background">{t.l}</option>)}
            </select></label>
          <label><span className={lbl}>تاريخ بداية الحوض</span>
            <input type="date" className={inp} value={v.install_date ?? ""} onChange={(e) => set("install_date", e.target.value || null)} /></label>
          <label><span className={lbl}>المدينة</span>
            <input className={inp} value={v.city} onChange={(e) => set("city", e.target.value)} placeholder="الرياض" /></label>
          <label className="sm:col-span-2"><span className={lbl}>ملاحظات عامة</span>
            <textarea rows={2} className={inp + " resize-none"} value={v.notes} onChange={(e) => set("notes", e.target.value)} /></label>
        </div>
      </Section>

      <Section icon={Ruler} title="مقاس الحوض">
        <div className="grid gap-4 sm:grid-cols-4">
          <label><span className={lbl}>📏 العرض (سم)</span>
            <input type="number" min="0" className={inp} value={v.width_cm} onChange={(e) => set("width_cm", e.target.value)} /></label>
          <label><span className={lbl}>📐 العمق (سم)</span>
            <input type="number" min="0" className={inp} value={v.depth_cm} onChange={(e) => set("depth_cm", e.target.value)} /></label>
          <label><span className={lbl}>⬆️ الارتفاع (سم)</span>
            <input type="number" min="0" className={inp} value={v.height_cm} onChange={(e) => set("height_cm", e.target.value)} /></label>
          <label><span className={lbl}>💧 السعة (لتر)</span>
            <input type="number" className={inp + " bg-gold/5"} value={v.volume_liters ?? ""} readOnly placeholder="تلقائي" /></label>
        </div>
        <p className="text-xs text-muted-foreground">السعة تنحسب تلقائيًا: العرض × العمق × الارتفاع ÷ 1000</p>
      </Section>

      <Section icon={FilterIcon} title="الفلتر">
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={lbl}>نوع الفلتر *</span>
            <select className={inp} value={v.filter_type} onChange={(e) => set("filter_type", e.target.value)}>
              <option value="" className="bg-background">—</option>
              {FILTER_TYPES.map((t) => <option key={t} value={t} className="bg-background">{t}</option>)}
            </select></label>
          <label><span className={lbl}>شركة / موديل الفلتر</span>
            <input className={inp} value={v.filter_model} onChange={(e) => set("filter_model", e.target.value)} /></label>
        </div>
      </Section>

      <Section icon={Flame} title="السخان">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.has_heater} onChange={(e) => set("has_heater", e.target.checked)} />
          يوجد سخان
        </label>
        {v.has_heater && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className={lbl}>القوة (واط)</span>
              <input type="number" className={inp} value={v.heater_watts} onChange={(e) => set("heater_watts", e.target.value)} /></label>
            <label><span className={lbl}>شركة / موديل</span>
              <input className={inp} value={v.heater_model} onChange={(e) => set("heater_model", e.target.value)} /></label>
          </div>
        )}
      </Section>

      <Section icon={Lightbulb} title="الإضاءة">
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={lbl}>نوع الإضاءة</span>
            <input className={inp} value={v.lighting_type} onChange={(e) => set("lighting_type", e.target.value)} placeholder="LED / T5..." /></label>
          <label><span className={lbl}>مدة التشغيل اليومية (ساعة)</span>
            <input type="number" className={inp} value={v.lighting_hours} onChange={(e) => set("lighting_hours", e.target.value)} /></label>
          <label><span className={lbl}>القوة / الموديل</span>
            <input className={inp} value={v.lighting_model} onChange={(e) => set("lighting_model", e.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm mt-6">
            <input type="checkbox" checked={v.has_timer} onChange={(e) => set("has_timer", e.target.checked)} />
            يوجد مؤقت
          </label>
        </div>
      </Section>

      <Section icon={Wind} title="نظام CO₂">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.has_co2} onChange={(e) => set("has_co2", e.target.checked)} />
          يوجد نظام CO₂
        </label>
        {v.has_co2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className={lbl}>نوع النظام</span>
              <input className={inp} value={v.co2_type} onChange={(e) => set("co2_type", e.target.value)} /></label>
            <label><span className={lbl}>مدة التشغيل اليومية (ساعة)</span>
              <input type="number" className={inp} value={v.co2_hours} onChange={(e) => set("co2_hours", e.target.value)} /></label>
          </div>
        )}
      </Section>

      <Section icon={Fish} title="الكائنات الحية">
        <div className="space-y-2">
          {v.livestock_items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2">
              <input className={inp} placeholder="النوع (نيون تترا...)" value={it.species}
                onChange={(e) => { const list = [...v.livestock_items]; list[i] = { ...it, species: e.target.value }; set("livestock_items", list); }} />
              <input className={inp} type="number" placeholder="العدد" value={it.count}
                onChange={(e) => { const list = [...v.livestock_items]; list[i] = { ...it, count: e.target.value }; set("livestock_items", list); }} />
              <button type="button" onClick={() => set("livestock_items", v.livestock_items.filter((_, idx) => idx !== i))}
                className="glass rounded-xl px-2 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" onClick={() => set("livestock_items", [...v.livestock_items, { species: "", count: "" }])}
            className="glass rounded-xl px-3 py-1.5 text-xs flex items-center gap-1 hover:bg-white/10"><Plus size={14} /> إضافة كائن</button>
        </div>
      </Section>

      {showPlants && (
        <Section icon={Leaf} title="النباتات">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.has_plants} onChange={(e) => set("has_plants", e.target.checked)} />
            يوجد نباتات
          </label>
          {v.has_plants && (
            <div className="space-y-2">
              {v.plants.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2">
                  <input className={inp} placeholder="اسم النبات" value={p.name}
                    onChange={(e) => { const list = [...v.plants]; list[i] = { ...p, name: e.target.value }; set("plants", list); }} />
                  <input className={inp} type="number" placeholder="الكمية" value={p.count}
                    onChange={(e) => { const list = [...v.plants]; list[i] = { ...p, count: e.target.value }; set("plants", list); }} />
                  <button type="button" onClick={() => set("plants", v.plants.filter((_, idx) => idx !== i))}
                    className="glass rounded-xl px-2 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => set("plants", [...v.plants, { name: "", count: "" }])}
                className="glass rounded-xl px-3 py-1.5 text-xs flex items-center gap-1 hover:bg-white/10"><Plus size={14} /> إضافة نبات</button>
            </div>
          )}
        </Section>
      )}

      <Section icon={Images} title="صور الحوض">
        <MultiImageUploader values={v.image_paths} cover={v.primary_image}
          onChange={(values, cover) => setV({ ...v, image_paths: values, primary_image: cover })}
          folder="tanks" />
      </Section>

      <div className="flex justify-end gap-2 sticky bottom-2">
        <button onClick={onCancel} className="glass rounded-xl px-4 py-2 text-sm">إلغاء</button>
        <button onClick={onSave} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Save size={16} /> حفظ</button>
      </div>
    </div>
  );
}
