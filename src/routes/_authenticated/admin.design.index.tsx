import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Plus, Trash2, Eye, EyeOff, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import {
  fetchHomeSections, saveHomeSection, genId, ICON_NAMES,
  type HeroContent, type ExploreContent, type ExploreItem,
  type ServicesContent, type ServiceItem,
  type WhyUsContent, type WhyUsItem,
  type ProcessContent, type ProcessItem,
  type FaqContent, type FaqItem,
  type CtaContent, type SectionHeader,
} from "@/lib/home-sections";
import { ImageUploader } from "@/components/ImageUploader";

export const Route = createFileRoute("/_authenticated/admin/design/")({
  component: DesignAdmin,
});

const TABS = [
  { key: "hero", label: "البانر" },
  { key: "explore", label: "استكشف" },
  { key: "services", label: "ماذا نقدم" },
  { key: "why_us", label: "لماذا نحن" },
  { key: "process", label: "كيف نعمل" },
  { key: "faq", label: "الأسئلة الشائعة" },
  { key: "cta", label: "CTA الأخير" },
  { key: "headers", label: "عناوين أقسام" },
] as const;

const DEFAULT_HERO: HeroContent = {
  title: "عالمك المائي", subtitle: "يبدأ من هنا",
  description: "", primary_cta_label: "", primary_cta_href: "",
  secondary_cta_label: "", secondary_cta_href: "",
  image_path: "", overlay_enabled: true, overlay_opacity: 0.6,
};
const DEFAULT_WHY: WhyUsContent = { kicker: "", heading: "", description: "", link_label: "", link_href: "", items: [] };
const DEFAULT_PROCESS: ProcessContent = { kicker: "", heading: "", description: "", items: [] };
const DEFAULT_FAQ: FaqContent = { kicker: "", heading: "", items: [] };
const DEFAULT_CTA: CtaContent = { heading: "", description: "", primary_label: "", primary_href: "", secondary_label: "", secondary_href: "" };
const DEFAULT_HEADER: SectionHeader = { kicker: "", heading: "", subtitle: "", link_label: "" };

function DesignAdmin() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("hero");
  const [loading, setLoading] = useState(true);
  const [hero, setHero] = useState<{ enabled: boolean; content: HeroContent }>({ enabled: true, content: DEFAULT_HERO });
  const [explore, setExplore] = useState<{ enabled: boolean; content: ExploreContent }>({ enabled: true, content: { kicker: "", heading: "", subtitle: "", items: [] } });
  const [services, setServices] = useState<{ enabled: boolean; content: ServicesContent }>({ enabled: true, content: { kicker: "", heading: "", description: "", items: [] } });
  const [whyUs, setWhyUs] = useState<{ enabled: boolean; content: WhyUsContent }>({ enabled: true, content: DEFAULT_WHY });
  const [processS, setProcessS] = useState<{ enabled: boolean; content: ProcessContent }>({ enabled: true, content: DEFAULT_PROCESS });
  const [faq, setFaq] = useState<{ enabled: boolean; content: FaqContent }>({ enabled: true, content: DEFAULT_FAQ });
  const [cta, setCta] = useState<{ enabled: boolean; content: CtaContent }>({ enabled: true, content: DEFAULT_CTA });
  const [testHeader, setTestHeader] = useState<{ enabled: boolean; content: SectionHeader }>({ enabled: true, content: DEFAULT_HEADER });
  const [knowHeader, setKnowHeader] = useState<{ enabled: boolean; content: SectionHeader }>({ enabled: true, content: DEFAULT_HEADER });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchHomeSections();
        if (s.hero) setHero({ enabled: s.hero.enabled, content: { ...DEFAULT_HERO, ...s.hero.content } });
        if (s.explore) setExplore({ enabled: s.explore.enabled, content: s.explore.content });
        if (s.services) setServices({ enabled: s.services.enabled, content: s.services.content });
        if (s.why_us) setWhyUs({ enabled: s.why_us.enabled, content: { ...DEFAULT_WHY, ...s.why_us.content } });
        if (s.process) setProcessS({ enabled: s.process.enabled, content: { ...DEFAULT_PROCESS, ...s.process.content } });
        if (s.faq) setFaq({ enabled: s.faq.enabled, content: { ...DEFAULT_FAQ, ...s.faq.content } });
        if (s.cta) setCta({ enabled: s.cta.enabled, content: { ...DEFAULT_CTA, ...s.cta.content } });
        if (s.testimonials_header) setTestHeader({ enabled: s.testimonials_header.enabled, content: { ...DEFAULT_HEADER, ...s.testimonials_header.content } });
        if (s.knowledge_header) setKnowHeader({ enabled: s.knowledge_header.enabled, content: { ...DEFAULT_HEADER, ...s.knowledge_header.content } });
      } catch (e: any) { toast.error(e?.message ?? "فشل التحميل"); }
      finally { setLoading(false); }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      if (tab === "hero") await saveHomeSection("hero", hero.enabled, hero.content);
      else if (tab === "explore") await saveHomeSection("explore", explore.enabled, explore.content);
      else if (tab === "services") await saveHomeSection("services", services.enabled, services.content);
      else if (tab === "why_us") await saveHomeSection("why_us", whyUs.enabled, whyUs.content);
      else if (tab === "process") await saveHomeSection("process", processS.enabled, processS.content);
      else if (tab === "faq") await saveHomeSection("faq", faq.enabled, faq.content);
      else if (tab === "cta") await saveHomeSection("cta", cta.enabled, cta.content);
      else if (tab === "headers") {
        await saveHomeSection("testimonials_header", testHeader.enabled, testHeader.content);
        await saveHomeSection("knowledge_header", knowHeader.enabled, knowHeader.content);
      }
      toast.success("تم الحفظ");
    } catch (e: any) { toast.error(e?.message ?? "فشل الحفظ"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-gold" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">تصميم المتجر</h1>
          <p className="text-sm text-muted-foreground mt-1">تعديل محتوى الصفحة الرئيسية مباشرةً.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-gold rounded-xl px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          حفظ التغييرات
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm ${tab === t.key ? "btn-gold" : "glass"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "hero" && <HeroEditor value={hero} onChange={setHero} />}
      {tab === "explore" && <ExploreEditor value={explore} onChange={setExplore} />}
      {tab === "services" && <ServicesEditor value={services} onChange={setServices} />}
      {tab === "why_us" && <WhyUsEditor value={whyUs} onChange={setWhyUs} />}
      {tab === "process" && <ProcessEditor value={processS} onChange={setProcessS} />}
      {tab === "faq" && <FaqEditor value={faq} onChange={setFaq} />}
      {tab === "cta" && <CtaEditor value={cta} onChange={setCta} />}
      {tab === "headers" && (
        <div className="space-y-4">
          <HeaderEditor title="عنوان قسم التقييمات" value={testHeader} onChange={setTestHeader} />
          <HeaderEditor title="عنوان قسم المقالات" value={knowHeader} onChange={setKnowHeader} showLinkLabel />
        </div>
      )}
    </div>
  );
}


/* ---------- HERO ---------- */
function HeroEditor({ value, onChange }: { value: { enabled: boolean; content: HeroContent }; onChange: (v: { enabled: boolean; content: HeroContent }) => void }) {
  const c = value.content;
  const set = <K extends keyof HeroContent>(k: K, v: HeroContent[K]) => onChange({ ...value, content: { ...c, [k]: v } });
  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <EnabledToggle enabled={value.enabled} onChange={(en) => onChange({ ...value, enabled: en })} label="إظهار البانر" />
      <Grid>
        <Field label="عنوان البانر"><input className={inp} value={c.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="العنوان الفرعي"><input className={inp} value={c.subtitle} onChange={(e) => set("subtitle", e.target.value)} /></Field>
        <Field label="الوصف" full><textarea rows={3} className={ta} value={c.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="نص الزر الأساسي"><input className={inp} value={c.primary_cta_label} onChange={(e) => set("primary_cta_label", e.target.value)} /></Field>
        <Field label="رابط الزر الأساسي"><input dir="ltr" className={inp} value={c.primary_cta_href} onChange={(e) => set("primary_cta_href", e.target.value)} /></Field>
        <Field label="نص الزر الثانوي"><input className={inp} value={c.secondary_cta_label} onChange={(e) => set("secondary_cta_label", e.target.value)} /></Field>
        <Field label="رابط الزر الثانوي"><input dir="ltr" className={inp} value={c.secondary_cta_href} onChange={(e) => set("secondary_cta_href", e.target.value)} /></Field>
        <Field label="صورة البانر" full>
          <ImageUploader value={c.image_path || null} onChange={(p) => set("image_path", p ?? "")} folder="home/hero" />
        </Field>
        <Field label="الطبقة الشفافة">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.overlay_enabled} onChange={(e) => set("overlay_enabled", e.target.checked)} /> تفعيل</label>
        </Field>
        <Field label={`شفافية الطبقة: ${Math.round(c.overlay_opacity * 100)}%`}>
          <input type="range" min={0} max={1} step={0.05} value={c.overlay_opacity} onChange={(e) => set("overlay_opacity", Number(e.target.value))} className="w-full" />
        </Field>
      </Grid>
    </div>
  );
}

/* ---------- EXPLORE ---------- */
function ExploreEditor({ value, onChange }: { value: { enabled: boolean; content: ExploreContent }; onChange: (v: { enabled: boolean; content: ExploreContent }) => void }) {
  const c = value.content;
  const setC = (next: ExploreContent) => onChange({ ...value, content: next });
  const updateItem = (id: string, patch: Partial<ExploreItem>) =>
    setC({ ...c, items: c.items.map((it) => it.id === id ? { ...it, ...patch } : it) });
  const remove = (id: string) => setC({ ...c, items: c.items.filter((it) => it.id !== id) });
  const move = (id: string, dir: -1 | 1) => {
    const sorted = [...c.items].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((x) => x.id === id);
    const swap = sorted[idx + dir]; if (!swap) return;
    const a = sorted[idx].order, b = swap.order;
    setC({ ...c, items: c.items.map((it) => it.id === sorted[idx].id ? { ...it, order: b } : it.id === swap.id ? { ...it, order: a } : it) });
  };
  const add = () => setC({ ...c, items: [...c.items, { id: genId(), icon: "Sparkles", emoji: null, label: "عنصر جديد", desc: "", href: "/", order: (Math.max(0, ...c.items.map(i => i.order)) + 1), visible: true }] });

  const sorted = [...c.items].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 space-y-4">
        <EnabledToggle enabled={value.enabled} onChange={(en) => onChange({ ...value, enabled: en })} label="إظهار القسم" />
        <Grid>
          <Field label="نص علوي (Kicker)"><input className={inp} value={c.kicker} onChange={(e) => setC({ ...c, kicker: e.target.value })} /></Field>
          <Field label="العنوان"><input className={inp} value={c.heading} onChange={(e) => setC({ ...c, heading: e.target.value })} /></Field>
          <Field label="النص الفرعي" full><input className={inp} value={c.subtitle} onChange={(e) => setC({ ...c, subtitle: e.target.value })} /></Field>
        </Grid>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-bold">المربعات ({sorted.length})</h3>
        <button onClick={add} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Plus size={14} /> إضافة مربع</button>
      </div>

      <div className="grid gap-3">
        {sorted.map((it) => (
          <div key={it.id} className="glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold">{it.label || "—"}</div>
              <div className="flex gap-1">
                <IconBtn onClick={() => move(it.id, -1)} title="أعلى"><ArrowUp size={14} /></IconBtn>
                <IconBtn onClick={() => move(it.id, 1)} title="أسفل"><ArrowDown size={14} /></IconBtn>
                <IconBtn onClick={() => updateItem(it.id, { visible: !it.visible })} title={it.visible ? "إخفاء" : "إظهار"}>
                  {it.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </IconBtn>
                <IconBtn onClick={() => remove(it.id)} title="حذف" danger><Trash2 size={14} /></IconBtn>
              </div>
            </div>
            <Grid>
              <Field label="العنوان"><input className={inp} value={it.label} onChange={(e) => updateItem(it.id, { label: e.target.value })} /></Field>
              <Field label="الوصف"><input className={inp} value={it.desc} onChange={(e) => updateItem(it.id, { desc: e.target.value })} /></Field>
              <Field label="الأيقونة (lucide)">
                <select className={inp} value={it.icon ?? ""} onChange={(e) => updateItem(it.id, { icon: e.target.value || null })}>
                  <option value="">— لا شيء —</option>
                  {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="إيموجي بديل"><input className={inp} value={it.emoji ?? ""} onChange={(e) => updateItem(it.id, { emoji: e.target.value || null })} placeholder="مثال: 🐠" /></Field>
              <Field label="الرابط"><input dir="ltr" className={inp} value={it.href} onChange={(e) => updateItem(it.id, { href: e.target.value })} /></Field>
              <Field label="الترتيب"><input type="number" className={inp} value={it.order} onChange={(e) => updateItem(it.id, { order: Number(e.target.value) })} /></Field>
            </Grid>
          </div>
        ))}
        {sorted.length === 0 && <p className="text-sm text-muted-foreground glass rounded-2xl p-5">لا توجد مربعات. اضغط "إضافة مربع".</p>}
      </div>
    </div>
  );
}

/* ---------- SERVICES ---------- */
function ServicesEditor({ value, onChange }: { value: { enabled: boolean; content: ServicesContent }; onChange: (v: { enabled: boolean; content: ServicesContent }) => void }) {
  const c = value.content;
  const setC = (next: ServicesContent) => onChange({ ...value, content: next });
  const updateItem = (id: string, patch: Partial<ServiceItem>) =>
    setC({ ...c, items: c.items.map((it) => it.id === id ? { ...it, ...patch } : it) });
  const remove = (id: string) => setC({ ...c, items: c.items.filter((it) => it.id !== id) });
  const move = (id: string, dir: -1 | 1) => {
    const sorted = [...c.items].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((x) => x.id === id);
    const swap = sorted[idx + dir]; if (!swap) return;
    const a = sorted[idx].order, b = swap.order;
    setC({ ...c, items: c.items.map((it) => it.id === sorted[idx].id ? { ...it, order: b } : it.id === swap.id ? { ...it, order: a } : it) });
  };
  const add = () => setC({ ...c, items: [...c.items, { id: genId(), icon: "Sparkles", title: "خدمة جديدة", desc: "", image_path: "", href: "/", order: (Math.max(0, ...c.items.map(i => i.order)) + 1), visible: true }] });

  const sorted = [...c.items].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 space-y-4">
        <EnabledToggle enabled={value.enabled} onChange={(en) => onChange({ ...value, enabled: en })} label="إظهار القسم" />
        <Grid>
          <Field label="نص علوي (Kicker)"><input className={inp} value={c.kicker} onChange={(e) => setC({ ...c, kicker: e.target.value })} /></Field>
          <Field label="العنوان"><input className={inp} value={c.heading} onChange={(e) => setC({ ...c, heading: e.target.value })} /></Field>
          <Field label="الوصف" full><textarea rows={2} className={ta} value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} /></Field>
        </Grid>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-bold">الخدمات ({sorted.length})</h3>
        <button onClick={add} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Plus size={14} /> إضافة خدمة</button>
      </div>

      <div className="grid gap-3">
        {sorted.map((it) => (
          <div key={it.id} className="glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold">{it.title || "—"}</div>
              <div className="flex gap-1">
                <IconBtn onClick={() => move(it.id, -1)}><ArrowUp size={14} /></IconBtn>
                <IconBtn onClick={() => move(it.id, 1)}><ArrowDown size={14} /></IconBtn>
                <IconBtn onClick={() => updateItem(it.id, { visible: !it.visible })}>
                  {it.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </IconBtn>
                <IconBtn onClick={() => remove(it.id)} danger><Trash2 size={14} /></IconBtn>
              </div>
            </div>
            <Grid>
              <Field label="العنوان"><input className={inp} value={it.title} onChange={(e) => updateItem(it.id, { title: e.target.value })} /></Field>
              <Field label="الوصف"><input className={inp} value={it.desc} onChange={(e) => updateItem(it.id, { desc: e.target.value })} /></Field>
              <Field label="الأيقونة">
                <select className={inp} value={it.icon ?? ""} onChange={(e) => updateItem(it.id, { icon: e.target.value || null })}>
                  <option value="">— لا شيء —</option>
                  {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="الرابط"><input dir="ltr" className={inp} value={it.href} onChange={(e) => updateItem(it.id, { href: e.target.value })} /></Field>
              <Field label="الترتيب"><input type="number" className={inp} value={it.order} onChange={(e) => updateItem(it.id, { order: Number(e.target.value) })} /></Field>
              <Field label="الصورة" full>
                <ImageUploader value={it.image_path || null} onChange={(p) => updateItem(it.id, { image_path: p ?? "" })} folder="home/services" />
              </Field>
            </Grid>
          </div>
        ))}
        {sorted.length === 0 && <p className="text-sm text-muted-foreground glass rounded-2xl p-5">لا توجد خدمات. اضغط "إضافة خدمة".</p>}
      </div>
    </div>
  );
}

/* ---------- shared ui ---------- */
const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60";
const ta = inp + " resize-none";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs text-muted-foreground block mb-1">{label}</span>
      {children}
    </label>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}
function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title?: string; danger?: boolean }) {
  return <button type="button" onClick={onClick} title={title}
    className={`grid place-items-center h-8 w-8 rounded-lg glass hover:bg-white/10 ${danger ? "text-red-400" : ""}`}>{children}</button>;
}
function EnabledToggle({ enabled, onChange, label }: { enabled: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" checked={enabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/* ---------- WHY US ---------- */
function WhyUsEditor({ value, onChange }: { value: { enabled: boolean; content: WhyUsContent }; onChange: (v: { enabled: boolean; content: WhyUsContent }) => void }) {
  const c = value.content;
  const setC = (next: WhyUsContent) => onChange({ ...value, content: next });
  const updateItem = (id: string, patch: Partial<WhyUsItem>) => setC({ ...c, items: c.items.map((it) => it.id === id ? { ...it, ...patch } : it) });
  const remove = (id: string) => setC({ ...c, items: c.items.filter((it) => it.id !== id) });
  const move = (id: string, dir: -1 | 1) => moveOrdered(c.items, id, dir, (items) => setC({ ...c, items }));
  const add = () => setC({ ...c, items: [...c.items, { id: genId(), icon: "Sparkles", title: "بطاقة جديدة", desc: "", order: nextOrder(c.items), visible: true }] });
  const sorted = [...c.items].sort((a, b) => a.order - b.order);
  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 space-y-4">
        <EnabledToggle enabled={value.enabled} onChange={(en) => onChange({ ...value, enabled: en })} label="إظهار القسم" />
        <Grid>
          <Field label="نص علوي (Kicker)"><input className={inp} value={c.kicker} onChange={(e) => setC({ ...c, kicker: e.target.value })} /></Field>
          <Field label="العنوان"><input className={inp} value={c.heading} onChange={(e) => setC({ ...c, heading: e.target.value })} /></Field>
          <Field label="الوصف" full><textarea rows={2} className={ta} value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} /></Field>
          <Field label="نص الرابط الجانبي"><input className={inp} value={c.link_label} onChange={(e) => setC({ ...c, link_label: e.target.value })} /></Field>
          <Field label="رابط الجانب"><input dir="ltr" className={inp} value={c.link_href} onChange={(e) => setC({ ...c, link_href: e.target.value })} /></Field>
        </Grid>
      </div>
      <ItemsHeader count={sorted.length} onAdd={add} label="بطاقة" />
      <div className="grid gap-3">
        {sorted.map((it) => (
          <div key={it.id} className="glass rounded-2xl p-4 space-y-3">
            <RowActions title={it.title} onUp={() => move(it.id, -1)} onDown={() => move(it.id, 1)}
              visible={it.visible} onToggle={() => updateItem(it.id, { visible: !it.visible })} onRemove={() => remove(it.id)} />
            <Grid>
              <Field label="العنوان"><input className={inp} value={it.title} onChange={(e) => updateItem(it.id, { title: e.target.value })} /></Field>
              <Field label="الوصف"><input className={inp} value={it.desc} onChange={(e) => updateItem(it.id, { desc: e.target.value })} /></Field>
              <Field label="الأيقونة (lucide)">
                <select className={inp} value={it.icon ?? ""} onChange={(e) => updateItem(it.id, { icon: e.target.value || null })}>
                  <option value="">— لا شيء —</option>
                  {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="الترتيب"><input type="number" className={inp} value={it.order} onChange={(e) => updateItem(it.id, { order: Number(e.target.value) })} /></Field>
            </Grid>
          </div>
        ))}
        {sorted.length === 0 && <EmptyHint />}
      </div>
    </div>
  );
}

/* ---------- PROCESS ---------- */
function ProcessEditor({ value, onChange }: { value: { enabled: boolean; content: ProcessContent }; onChange: (v: { enabled: boolean; content: ProcessContent }) => void }) {
  const c = value.content;
  const setC = (next: ProcessContent) => onChange({ ...value, content: next });
  const updateItem = (id: string, patch: Partial<ProcessItem>) => setC({ ...c, items: c.items.map((it) => it.id === id ? { ...it, ...patch } : it) });
  const remove = (id: string) => setC({ ...c, items: c.items.filter((it) => it.id !== id) });
  const move = (id: string, dir: -1 | 1) => moveOrdered(c.items, id, dir, (items) => setC({ ...c, items }));
  const add = () => {
    const n = c.items.length + 1;
    setC({ ...c, items: [...c.items, { id: genId(), icon: "Sparkles", number: String(n).padStart(2, "0"), title: "خطوة جديدة", desc: "", order: nextOrder(c.items), visible: true }] });
  };
  const sorted = [...c.items].sort((a, b) => a.order - b.order);
  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 space-y-4">
        <EnabledToggle enabled={value.enabled} onChange={(en) => onChange({ ...value, enabled: en })} label="إظهار القسم" />
        <Grid>
          <Field label="نص علوي (Kicker)"><input className={inp} value={c.kicker} onChange={(e) => setC({ ...c, kicker: e.target.value })} /></Field>
          <Field label="العنوان"><input className={inp} value={c.heading} onChange={(e) => setC({ ...c, heading: e.target.value })} /></Field>
          <Field label="الوصف" full><textarea rows={2} className={ta} value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} /></Field>
        </Grid>
      </div>
      <ItemsHeader count={sorted.length} onAdd={add} label="خطوة" />
      <div className="grid gap-3">
        {sorted.map((it) => (
          <div key={it.id} className="glass rounded-2xl p-4 space-y-3">
            <RowActions title={`${it.number} — ${it.title}`} onUp={() => move(it.id, -1)} onDown={() => move(it.id, 1)}
              visible={it.visible} onToggle={() => updateItem(it.id, { visible: !it.visible })} onRemove={() => remove(it.id)} />
            <Grid>
              <Field label="الرقم"><input className={inp} value={it.number} onChange={(e) => updateItem(it.id, { number: e.target.value })} /></Field>
              <Field label="العنوان"><input className={inp} value={it.title} onChange={(e) => updateItem(it.id, { title: e.target.value })} /></Field>
              <Field label="الوصف" full><textarea rows={2} className={ta} value={it.desc} onChange={(e) => updateItem(it.id, { desc: e.target.value })} /></Field>
              <Field label="الأيقونة">
                <select className={inp} value={it.icon ?? ""} onChange={(e) => updateItem(it.id, { icon: e.target.value || null })}>
                  <option value="">— لا شيء —</option>
                  {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="الترتيب"><input type="number" className={inp} value={it.order} onChange={(e) => updateItem(it.id, { order: Number(e.target.value) })} /></Field>
            </Grid>
          </div>
        ))}
        {sorted.length === 0 && <EmptyHint />}
      </div>
    </div>
  );
}

/* ---------- FAQ ---------- */
function FaqEditor({ value, onChange }: { value: { enabled: boolean; content: FaqContent }; onChange: (v: { enabled: boolean; content: FaqContent }) => void }) {
  const c = value.content;
  const setC = (next: FaqContent) => onChange({ ...value, content: next });
  const updateItem = (id: string, patch: Partial<FaqItem>) => setC({ ...c, items: c.items.map((it) => it.id === id ? { ...it, ...patch } : it) });
  const remove = (id: string) => setC({ ...c, items: c.items.filter((it) => it.id !== id) });
  const move = (id: string, dir: -1 | 1) => moveOrdered(c.items, id, dir, (items) => setC({ ...c, items }));
  const add = () => setC({ ...c, items: [...c.items, { id: genId(), q: "سؤال جديد", a: "", order: nextOrder(c.items), visible: true }] });
  const sorted = [...c.items].sort((a, b) => a.order - b.order);
  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 space-y-4">
        <EnabledToggle enabled={value.enabled} onChange={(en) => onChange({ ...value, enabled: en })} label="إظهار القسم" />
        <Grid>
          <Field label="نص علوي (Kicker)"><input className={inp} value={c.kicker} onChange={(e) => setC({ ...c, kicker: e.target.value })} /></Field>
          <Field label="العنوان"><input className={inp} value={c.heading} onChange={(e) => setC({ ...c, heading: e.target.value })} /></Field>
        </Grid>
      </div>
      <ItemsHeader count={sorted.length} onAdd={add} label="سؤال" />
      <div className="grid gap-3">
        {sorted.map((it) => (
          <div key={it.id} className="glass rounded-2xl p-4 space-y-3">
            <RowActions title={it.q} onUp={() => move(it.id, -1)} onDown={() => move(it.id, 1)}
              visible={it.visible} onToggle={() => updateItem(it.id, { visible: !it.visible })} onRemove={() => remove(it.id)} />
            <Field label="السؤال"><input className={inp} value={it.q} onChange={(e) => updateItem(it.id, { q: e.target.value })} /></Field>
            <Field label="الإجابة"><textarea rows={3} className={ta} value={it.a} onChange={(e) => updateItem(it.id, { a: e.target.value })} /></Field>
            <Field label="الترتيب"><input type="number" className={inp + " w-24"} value={it.order} onChange={(e) => updateItem(it.id, { order: Number(e.target.value) })} /></Field>
          </div>
        ))}
        {sorted.length === 0 && <EmptyHint />}
      </div>
    </div>
  );
}

/* ---------- CTA ---------- */
function CtaEditor({ value, onChange }: { value: { enabled: boolean; content: CtaContent }; onChange: (v: { enabled: boolean; content: CtaContent }) => void }) {
  const c = value.content;
  const set = <K extends keyof CtaContent>(k: K, v: CtaContent[K]) => onChange({ ...value, content: { ...c, [k]: v } });
  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <EnabledToggle enabled={value.enabled} onChange={(en) => onChange({ ...value, enabled: en })} label="إظهار القسم" />
      <Grid>
        <Field label="العنوان" full><input className={inp} value={c.heading} onChange={(e) => set("heading", e.target.value)} /></Field>
        <Field label="الوصف" full><textarea rows={2} className={ta} value={c.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="نص الزر الأساسي"><input className={inp} value={c.primary_label} onChange={(e) => set("primary_label", e.target.value)} /></Field>
        <Field label="رابط الزر الأساسي"><input dir="ltr" className={inp} value={c.primary_href} onChange={(e) => set("primary_href", e.target.value)} /></Field>
        <Field label="نص الزر الثانوي"><input className={inp} value={c.secondary_label} onChange={(e) => set("secondary_label", e.target.value)} /></Field>
        <Field label="رابط الزر الثانوي"><input dir="ltr" className={inp} value={c.secondary_href} onChange={(e) => set("secondary_href", e.target.value)} placeholder="https://aqh.sa" /></Field>
      </Grid>
    </div>
  );
}

/* ---------- HEADER (Testimonials / Knowledge) ---------- */
function HeaderEditor({ title, value, onChange, showLinkLabel }: { title: string; value: { enabled: boolean; content: SectionHeader }; onChange: (v: { enabled: boolean; content: SectionHeader }) => void; showLinkLabel?: boolean }) {
  const c = value.content;
  const set = <K extends keyof SectionHeader>(k: K, v: SectionHeader[K]) => onChange({ ...value, content: { ...c, [k]: v } });
  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-bold">{title}</h3>
        <EnabledToggle enabled={value.enabled} onChange={(en) => onChange({ ...value, enabled: en })} label="إظهار القسم" />
      </div>
      <Grid>
        <Field label="نص علوي (Kicker)"><input className={inp} value={c.kicker} onChange={(e) => set("kicker", e.target.value)} /></Field>
        <Field label="العنوان"><input className={inp} value={c.heading} onChange={(e) => set("heading", e.target.value)} /></Field>
        <Field label="النص الفرعي" full><input className={inp} value={c.subtitle ?? ""} onChange={(e) => set("subtitle", e.target.value)} /></Field>
        {showLinkLabel && <Field label="نص رابط (مثال: كل المقالات)"><input className={inp} value={c.link_label ?? ""} onChange={(e) => set("link_label", e.target.value)} /></Field>}
      </Grid>
    </div>
  );
}

/* ---------- shared helpers ---------- */
function nextOrder(items: { order: number }[]) { return (Math.max(0, ...items.map(i => i.order)) + 1); }
function moveOrdered<T extends { id: string; order: number }>(items: T[], id: string, dir: -1 | 1, set: (next: T[]) => void) {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((x) => x.id === id);
  const swap = sorted[idx + dir]; if (!swap) return;
  const a = sorted[idx].order, b = swap.order;
  set(items.map((it) => it.id === sorted[idx].id ? { ...it, order: b } : it.id === swap.id ? { ...it, order: a } : it));
}
function ItemsHeader({ count, onAdd, label }: { count: number; onAdd: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="font-bold">العناصر ({count})</h3>
      <button onClick={onAdd} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Plus size={14} /> إضافة {label}</button>
    </div>
  );
}
function RowActions({ title, onUp, onDown, visible, onToggle, onRemove }: { title: string; onUp: () => void; onDown: () => void; visible: boolean; onToggle: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-sm font-bold truncate">{title || "—"}</div>
      <div className="flex gap-1 shrink-0">
        <IconBtn onClick={onUp} title="أعلى"><ArrowUp size={14} /></IconBtn>
        <IconBtn onClick={onDown} title="أسفل"><ArrowDown size={14} /></IconBtn>
        <IconBtn onClick={onToggle} title={visible ? "إخفاء" : "إظهار"}>{visible ? <Eye size={14} /> : <EyeOff size={14} />}</IconBtn>
        <IconBtn onClick={onRemove} title="حذف" danger><Trash2 size={14} /></IconBtn>
      </div>
    </div>
  );
}
function EmptyHint() {
  return <p className="text-sm text-muted-foreground glass rounded-2xl p-5">لا توجد عناصر. اضغط زر "إضافة".</p>;
}

