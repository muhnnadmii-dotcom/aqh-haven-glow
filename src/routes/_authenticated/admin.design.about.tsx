import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Loader2, Plus, Trash2, Eye, EyeOff, ArrowUp, ArrowDown } from "lucide-react";
import { fetchSitePage, saveSitePage, newId, type AboutContent } from "@/lib/site-pages";
import { ImageUploader } from "@/components/ImageUploader";
import { ICON_NAMES } from "@/lib/home-sections";

export const Route = createFileRoute("/_authenticated/admin/design/about")({
  component: AboutAdmin,
});

const DEFAULT: AboutContent = {
  hero: { kicker: "ABOUT", heading: "من نحن", description: "", image_path: "" },
  story: { kicker: "قصتنا", heading: "", body: "" },
  vision: { kicker: "رؤيتنا", heading: "", body: "" },
  values_kicker: "قيمنا", values_heading: "ما يحركنا",
  values: [], stats: [],
  cta: { kicker: "", heading: "", body: "", button_label: "", button_href: "/contact", visible: true },
};

function AboutAdmin() {
  const [c, setC] = useState<AboutContent>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchSitePage<AboutContent>("about");
        if (r?.content) setC({ ...DEFAULT, ...r.content });
      } catch (e: any) { toast.error(e?.message ?? "فشل التحميل"); }
      finally { setLoading(false); }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try { await saveSitePage("about", c, "من نحن"); toast.success("تم الحفظ"); }
    catch (e: any) { toast.error(e?.message ?? "فشل الحفظ"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-gold" /></div>;

  const sortedValues = [...(c.values ?? [])].sort((a, b) => a.order - b.order);
  const sortedStats = [...(c.stats ?? [])].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">صفحة من نحن</h1>
          <p className="text-sm text-muted-foreground mt-1">تعديل محتوى الصفحة بالكامل.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-gold rounded-xl px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} حفظ
        </button>
      </div>

      <Section title="القسم الرئيسي (Hero)">
        <Grid>
          <Field label="نص علوي"><input className={inp} value={c.hero.kicker} onChange={(e) => setC({ ...c, hero: { ...c.hero, kicker: e.target.value } })} /></Field>
          <Field label="العنوان"><input className={inp} value={c.hero.heading} onChange={(e) => setC({ ...c, hero: { ...c.hero, heading: e.target.value } })} /></Field>
          <Field label="الوصف" full><textarea rows={3} className={ta} value={c.hero.description} onChange={(e) => setC({ ...c, hero: { ...c.hero, description: e.target.value } })} /></Field>
          <Field label="صورة الخلفية" full>
            <ImageUploader value={c.hero.image_path || null} onChange={(p) => setC({ ...c, hero: { ...c.hero, image_path: p ?? "" } })} folder="about/hero" />
          </Field>
        </Grid>
      </Section>

      <Section title="قصتنا">
        <Grid>
          <Field label="نص علوي"><input className={inp} value={c.story.kicker} onChange={(e) => setC({ ...c, story: { ...c.story, kicker: e.target.value } })} /></Field>
          <Field label="العنوان"><input className={inp} value={c.story.heading} onChange={(e) => setC({ ...c, story: { ...c.story, heading: e.target.value } })} /></Field>
          <Field label="النص" full><textarea rows={4} className={ta} value={c.story.body} onChange={(e) => setC({ ...c, story: { ...c.story, body: e.target.value } })} /></Field>
        </Grid>
      </Section>

      <Section title="رؤيتنا">
        <Grid>
          <Field label="نص علوي"><input className={inp} value={c.vision.kicker} onChange={(e) => setC({ ...c, vision: { ...c.vision, kicker: e.target.value } })} /></Field>
          <Field label="العنوان"><input className={inp} value={c.vision.heading} onChange={(e) => setC({ ...c, vision: { ...c.vision, heading: e.target.value } })} /></Field>
          <Field label="النص" full><textarea rows={4} className={ta} value={c.vision.body} onChange={(e) => setC({ ...c, vision: { ...c.vision, body: e.target.value } })} /></Field>
        </Grid>
      </Section>

      <Section title="القيم">
        <Grid>
          <Field label="نص علوي"><input className={inp} value={c.values_kicker} onChange={(e) => setC({ ...c, values_kicker: e.target.value })} /></Field>
          <Field label="عنوان القسم"><input className={inp} value={c.values_heading} onChange={(e) => setC({ ...c, values_heading: e.target.value })} /></Field>
        </Grid>
        <div className="flex items-center justify-between mt-4">
          <h3 className="font-bold text-sm">العناصر ({sortedValues.length})</h3>
          <button onClick={() => setC({ ...c, values: [...c.values, { id: newId(), icon: "Sparkles", title: "قيمة جديدة", desc: "", order: (Math.max(0, ...c.values.map(v => v.order)) + 1), visible: true }] })}
            className="btn-gold rounded-xl px-3 py-1.5 text-xs flex items-center gap-2"><Plus size={14} /> إضافة قيمة</button>
        </div>
        <div className="grid gap-3 mt-3">
          {sortedValues.map((it) => {
            const upd = (patch: Partial<typeof it>) => setC({ ...c, values: c.values.map((x) => x.id === it.id ? { ...x, ...patch } : x) });
            const move = (dir: -1 | 1) => {
              const arr = [...c.values].sort((a, b) => a.order - b.order);
              const i = arr.findIndex((x) => x.id === it.id); const swap = arr[i + dir]; if (!swap) return;
              setC({ ...c, values: c.values.map((x) => x.id === it.id ? { ...x, order: swap.order } : x.id === swap.id ? { ...x, order: it.order } : x) });
            };
            return (
              <div key={it.id} className="glass rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-bold">{it.title || "—"}</div>
                  <div className="flex gap-1">
                    <IconBtn onClick={() => move(-1)}><ArrowUp size={14} /></IconBtn>
                    <IconBtn onClick={() => move(1)}><ArrowDown size={14} /></IconBtn>
                    <IconBtn onClick={() => upd({ visible: !it.visible })}>{it.visible ? <Eye size={14} /> : <EyeOff size={14} />}</IconBtn>
                    <IconBtn onClick={() => setC({ ...c, values: c.values.filter((x) => x.id !== it.id) })} danger><Trash2 size={14} /></IconBtn>
                  </div>
                </div>
                <Grid>
                  <Field label="العنوان"><input className={inp} value={it.title} onChange={(e) => upd({ title: e.target.value })} /></Field>
                  <Field label="الأيقونة">
                    <select className={inp} value={it.icon} onChange={(e) => upd({ icon: e.target.value })}>
                      {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </Field>
                  <Field label="الوصف" full><input className={inp} value={it.desc} onChange={(e) => upd({ desc: e.target.value })} /></Field>
                </Grid>
              </div>
            );
          })}
          {sortedValues.length === 0 && <p className="text-xs text-muted-foreground">لا توجد قيم.</p>}
        </div>
      </Section>

      <Section title="الإحصائيات">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">العناصر ({sortedStats.length})</h3>
          <button onClick={() => setC({ ...c, stats: [...c.stats, { id: newId(), value: "0+", label: "إحصائية", order: (Math.max(0, ...c.stats.map(v => v.order)) + 1), visible: true }] })}
            className="btn-gold rounded-xl px-3 py-1.5 text-xs flex items-center gap-2"><Plus size={14} /> إضافة</button>
        </div>
        <div className="grid gap-3 mt-3">
          {sortedStats.map((it) => {
            const upd = (patch: Partial<typeof it>) => setC({ ...c, stats: c.stats.map((x) => x.id === it.id ? { ...x, ...patch } : x) });
            return (
              <div key={it.id} className="glass rounded-xl p-3 flex items-end gap-2">
                <Field label="القيمة"><input className={inp} value={it.value} onChange={(e) => upd({ value: e.target.value })} /></Field>
                <Field label="التسمية"><input className={inp} value={it.label} onChange={(e) => upd({ label: e.target.value })} /></Field>
                <IconBtn onClick={() => upd({ visible: !it.visible })}>{it.visible ? <Eye size={14} /> : <EyeOff size={14} />}</IconBtn>
                <IconBtn onClick={() => setC({ ...c, stats: c.stats.filter((x) => x.id !== it.id) })} danger><Trash2 size={14} /></IconBtn>
              </div>
            );
          })}
          {sortedStats.length === 0 && <p className="text-xs text-muted-foreground">لا توجد إحصائيات.</p>}
        </div>
      </Section>

      <Section title="بانر الدعوة (CTA)">
        <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
          <input type="checkbox" checked={c.cta.visible} onChange={(e) => setC({ ...c, cta: { ...c.cta, visible: e.target.checked } })} /> إظهار البانر
        </label>
        <Grid>
          <Field label="نص علوي"><input className={inp} value={c.cta.kicker} onChange={(e) => setC({ ...c, cta: { ...c.cta, kicker: e.target.value } })} /></Field>
          <Field label="العنوان"><input className={inp} value={c.cta.heading} onChange={(e) => setC({ ...c, cta: { ...c.cta, heading: e.target.value } })} /></Field>
          <Field label="النص" full><textarea rows={3} className={ta} value={c.cta.body} onChange={(e) => setC({ ...c, cta: { ...c.cta, body: e.target.value } })} /></Field>
          <Field label="نص الزر"><input className={inp} value={c.cta.button_label} onChange={(e) => setC({ ...c, cta: { ...c.cta, button_label: e.target.value } })} /></Field>
          <Field label="رابط الزر"><input dir="ltr" className={inp} value={c.cta.button_href} onChange={(e) => setC({ ...c, cta: { ...c.cta, button_href: e.target.value } })} /></Field>
        </Grid>
      </Section>
    </div>
  );
}

const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60";
const ta = inp + " resize-none";
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`block ${full ? "sm:col-span-2" : ""} flex-1`}><span className="text-xs text-muted-foreground block mb-1">{label}</span>{children}</label>;
}
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid gap-3 sm:grid-cols-2">{children}</div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="glass rounded-2xl p-5"><h2 className="font-bold mb-4">{title}</h2>{children}</div>;
}
function IconBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`grid place-items-center h-8 w-8 rounded-lg glass hover:bg-white/10 ${danger ? "text-red-400" : ""}`}>{children}</button>;
}
