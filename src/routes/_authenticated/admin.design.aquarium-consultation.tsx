import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Loader2, Plus, Trash2, Eye, EyeOff, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import {
  fetchConsultationContent,
  saveConsultationContent,
  CONSULTATION_DEFAULTS,
  newCId,
  type ConsultationContent,
} from "@/lib/consultation-page";
import { ImageUploader } from "@/components/ImageUploader";
import { ICON_NAMES } from "@/lib/home-sections";

export const Route = createFileRoute("/_authenticated/admin/design/aquarium-consultation")({
  component: ConsultationAdmin,
});

function ConsultationAdmin() {
  const [c, setC] = useState<ConsultationContent>(CONSULTATION_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConsultationContent()
      .then((r) => setC(r))
      .catch((e: any) => toast.error(e?.message ?? "فشل التحميل"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await saveConsultationContent(c);
      toast.success("تم الحفظ");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    if (!confirm("استعادة المحتوى الافتراضي؟ سيتم استبدال ما هو معروض في المحرر (لن يُحفَظ إلا بعد الضغط على حفظ).")) return;
    setC(JSON.parse(JSON.stringify(CONSULTATION_DEFAULTS)));
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-gold" /></div>;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">استشارة الأحواض</h1>
          <p className="text-sm text-muted-foreground mt-1">التحكم الكامل بمحتوى صفحة <span dir="ltr">/services/aquarium-consultation</span>.</p>
        </div>
        <div className="flex gap-2">
          <a href="/services/aquarium-consultation" target="_blank" rel="noopener noreferrer"
            className="btn-outline-gold rounded-xl px-3 py-2 text-xs inline-flex items-center gap-1">
            <ExternalLink size={14} /> معاينة
          </a>
          <button onClick={resetDefaults} className="btn-outline-gold rounded-xl px-3 py-2 text-xs">استعادة الافتراضي</button>
          <button onClick={save} disabled={saving} className="btn-gold rounded-xl px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} حفظ
          </button>
        </div>
      </div>

      {/* HERO */}
      <Section title="القسم الرئيسي (Hero)">
        <Grid>
          <Field label="نص علوي (فوق العنوان)"><input className={inp} value={c.hero.kicker} onChange={(e) => setC({ ...c, hero: { ...c.hero, kicker: e.target.value } })} /></Field>
          <Field label="السطر الأول من العنوان"><input className={inp} value={c.hero.title_line1} onChange={(e) => setC({ ...c, hero: { ...c.hero, title_line1: e.target.value } })} /></Field>
          <Field label="الكلمات المميّزة (ذهبي)"><input className={inp} value={c.hero.title_highlight} onChange={(e) => setC({ ...c, hero: { ...c.hero, title_highlight: e.target.value } })} /></Field>
          <Field label="السطر الثاني من العنوان"><input className={inp} value={c.hero.title_line2} onChange={(e) => setC({ ...c, hero: { ...c.hero, title_line2: e.target.value } })} /></Field>
          <Field label="الوصف" full><textarea rows={3} className={ta} value={c.hero.description} onChange={(e) => setC({ ...c, hero: { ...c.hero, description: e.target.value } })} /></Field>
          <Field label="صورة الخلفية (اختياري — الافتراضي صورة الخدمة)" full>
            <ImageUploader value={c.hero.image_path || null} onChange={(p) => setC({ ...c, hero: { ...c.hero, image_path: p ?? "" } })} folder="consultation/hero" cropAspect={16/9} />
          </Field>
          <Field label="نص الزر الرئيسي"><input className={inp} value={c.hero.primary_button_label} onChange={(e) => setC({ ...c, hero: { ...c.hero, primary_button_label: e.target.value } })} /></Field>
          <Field label="رسالة واتساب للزر الرئيسي"><input className={inp} value={c.hero.primary_button_whatsapp} onChange={(e) => setC({ ...c, hero: { ...c.hero, primary_button_whatsapp: e.target.value } })} /></Field>
          <Field label="نص الزر الثانوي (واتساب)"><input className={inp} value={c.hero.secondary_button_label} onChange={(e) => setC({ ...c, hero: { ...c.hero, secondary_button_label: e.target.value } })} /></Field>
        </Grid>

        <div className="flex items-center justify-between mt-5">
          <h3 className="font-bold text-sm">شارات الثقة أسفل الأزرار ({c.hero.trust_chips.length})</h3>
          <button onClick={() => setC({ ...c, hero: { ...c.hero, trust_chips: [...c.hero.trust_chips, { id: newCId(), icon: "Sparkles", text: "شارة جديدة", visible: true }] } })}
            className="btn-gold rounded-xl px-3 py-1.5 text-xs flex items-center gap-2"><Plus size={14} /> إضافة</button>
        </div>
        <div className="grid gap-3 mt-3">
          {c.hero.trust_chips.map((it, i) => {
            const upd = (patch: Partial<typeof it>) => setC({ ...c, hero: { ...c.hero, trust_chips: c.hero.trust_chips.map((x) => x.id === it.id ? { ...x, ...patch } : x) } });
            const move = (dir: -1 | 1) => {
              const arr = [...c.hero.trust_chips]; const j = i + dir; if (j < 0 || j >= arr.length) return;
              [arr[i], arr[j]] = [arr[j], arr[i]]; setC({ ...c, hero: { ...c.hero, trust_chips: arr } });
            };
            return (
              <div key={it.id} className="glass rounded-xl p-3 flex items-end gap-2">
                <Field label="الأيقونة">
                  <select className={inp} value={it.icon} onChange={(e) => upd({ icon: e.target.value })}>
                    {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
                <Field label="النص"><input className={inp} value={it.text} onChange={(e) => upd({ text: e.target.value })} /></Field>
                <IconBtn onClick={() => move(-1)}><ArrowUp size={14} /></IconBtn>
                <IconBtn onClick={() => move(1)}><ArrowDown size={14} /></IconBtn>
                <IconBtn onClick={() => upd({ visible: !it.visible })}>{it.visible ? <Eye size={14} /> : <EyeOff size={14} />}</IconBtn>
                <IconBtn onClick={() => setC({ ...c, hero: { ...c.hero, trust_chips: c.hero.trust_chips.filter((x) => x.id !== it.id) } })} danger><Trash2 size={14} /></IconBtn>
              </div>
            );
          })}
        </div>
      </Section>

      {/* TRUST */}
      <Section title="قسم لماذا تثق فينا">
        <VisibleToggle checked={c.trust.visible} onChange={(v) => setC({ ...c, trust: { ...c.trust, visible: v } })} />
        <Grid>
          <Field label="نص علوي"><input className={inp} value={c.trust.kicker} onChange={(e) => setC({ ...c, trust: { ...c.trust, kicker: e.target.value } })} /></Field>
          <Field label="السطر الأول من العنوان"><input className={inp} value={c.trust.heading_line1} onChange={(e) => setC({ ...c, trust: { ...c.trust, heading_line1: e.target.value } })} /></Field>
          <Field label="الكلمات المميّزة"><input className={inp} value={c.trust.heading_highlight} onChange={(e) => setC({ ...c, trust: { ...c.trust, heading_highlight: e.target.value } })} /></Field>
          <Field label="النص" full><textarea rows={4} className={ta} value={c.trust.body} onChange={(e) => setC({ ...c, trust: { ...c.trust, body: e.target.value } })} /></Field>
          <Field label="ملاحظة صغيرة (تحذير/تنويه)" full><textarea rows={2} className={ta} value={c.trust.disclaimer} onChange={(e) => setC({ ...c, trust: { ...c.trust, disclaimer: e.target.value } })} /></Field>
        </Grid>
        <div className="flex items-center justify-between mt-5">
          <h3 className="font-bold text-sm">الإحصائيات ({c.trust.stats.length})</h3>
          <button onClick={() => setC({ ...c, trust: { ...c.trust, stats: [...c.trust.stats, { id: newCId(), big: "0", label: "تسمية", visible: true }] } })}
            className="btn-gold rounded-xl px-3 py-1.5 text-xs flex items-center gap-2"><Plus size={14} /> إضافة</button>
        </div>
        <div className="grid gap-3 mt-3">
          {c.trust.stats.map((it, i) => {
            const upd = (patch: Partial<typeof it>) => setC({ ...c, trust: { ...c.trust, stats: c.trust.stats.map((x) => x.id === it.id ? { ...x, ...patch } : x) } });
            const move = (dir: -1 | 1) => {
              const arr = [...c.trust.stats]; const j = i + dir; if (j < 0 || j >= arr.length) return;
              [arr[i], arr[j]] = [arr[j], arr[i]]; setC({ ...c, trust: { ...c.trust, stats: arr } });
            };
            return (
              <div key={it.id} className="glass rounded-xl p-3 flex items-end gap-2">
                <Field label="القيمة"><input className={inp} value={it.big} onChange={(e) => upd({ big: e.target.value })} /></Field>
                <Field label="التسمية"><input className={inp} value={it.label} onChange={(e) => upd({ label: e.target.value })} /></Field>
                <IconBtn onClick={() => move(-1)}><ArrowUp size={14} /></IconBtn>
                <IconBtn onClick={() => move(1)}><ArrowDown size={14} /></IconBtn>
                <IconBtn onClick={() => upd({ visible: !it.visible })}>{it.visible ? <Eye size={14} /> : <EyeOff size={14} />}</IconBtn>
                <IconBtn onClick={() => setC({ ...c, trust: { ...c.trust, stats: c.trust.stats.filter((x) => x.id !== it.id) } })} danger><Trash2 size={14} /></IconBtn>
              </div>
            );
          })}
        </div>
      </Section>

      {/* INCLUDES */}
      <Section title="ماذا تشمل الاستشارة؟ (بطاقات)">
        <VisibleToggle checked={c.includes.visible} onChange={(v) => setC({ ...c, includes: { ...c.includes, visible: v } })} />
        <Grid>
          <Field label="نص علوي"><input className={inp} value={c.includes.kicker} onChange={(e) => setC({ ...c, includes: { ...c.includes, kicker: e.target.value } })} /></Field>
          <Field label="العنوان"><input className={inp} value={c.includes.heading} onChange={(e) => setC({ ...c, includes: { ...c.includes, heading: e.target.value } })} /></Field>
        </Grid>
        <div className="flex items-center justify-between mt-5">
          <h3 className="font-bold text-sm">العناصر ({c.includes.items.length})</h3>
          <button onClick={() => setC({ ...c, includes: { ...c.includes, items: [...c.includes.items, { id: newCId(), icon: "Sparkles", title: "عنوان", desc: "وصف", visible: true }] } })}
            className="btn-gold rounded-xl px-3 py-1.5 text-xs flex items-center gap-2"><Plus size={14} /> إضافة</button>
        </div>
        <div className="grid gap-3 mt-3">
          {c.includes.items.map((it, i) => {
            const upd = (patch: Partial<typeof it>) => setC({ ...c, includes: { ...c.includes, items: c.includes.items.map((x) => x.id === it.id ? { ...x, ...patch } : x) } });
            const move = (dir: -1 | 1) => {
              const arr = [...c.includes.items]; const j = i + dir; if (j < 0 || j >= arr.length) return;
              [arr[i], arr[j]] = [arr[j], arr[i]]; setC({ ...c, includes: { ...c.includes, items: arr } });
            };
            return (
              <div key={it.id} className="glass rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold">{it.title || "—"}</div>
                  <div className="flex gap-1">
                    <IconBtn onClick={() => move(-1)}><ArrowUp size={14} /></IconBtn>
                    <IconBtn onClick={() => move(1)}><ArrowDown size={14} /></IconBtn>
                    <IconBtn onClick={() => upd({ visible: !it.visible })}>{it.visible ? <Eye size={14} /> : <EyeOff size={14} />}</IconBtn>
                    <IconBtn onClick={() => setC({ ...c, includes: { ...c.includes, items: c.includes.items.filter((x) => x.id !== it.id) } })} danger><Trash2 size={14} /></IconBtn>
                  </div>
                </div>
                <Grid>
                  <Field label="الأيقونة">
                    <select className={inp} value={it.icon} onChange={(e) => upd({ icon: e.target.value })}>
                      {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </Field>
                  <Field label="العنوان"><input className={inp} value={it.title} onChange={(e) => upd({ title: e.target.value })} /></Field>
                  <Field label="الوصف" full><textarea rows={2} className={ta} value={it.desc} onChange={(e) => upd({ desc: e.target.value })} /></Field>
                </Grid>
              </div>
            );
          })}
        </div>
      </Section>

      {/* SUITABLE */}
      <Section title="مناسبة لمن؟ (شارات)">
        <VisibleToggle checked={c.suitable.visible} onChange={(v) => setC({ ...c, suitable: { ...c.suitable, visible: v } })} />
        <Grid>
          <Field label="نص علوي"><input className={inp} value={c.suitable.kicker} onChange={(e) => setC({ ...c, suitable: { ...c.suitable, kicker: e.target.value } })} /></Field>
          <Field label="العنوان"><input className={inp} value={c.suitable.heading} onChange={(e) => setC({ ...c, suitable: { ...c.suitable, heading: e.target.value } })} /></Field>
        </Grid>
        <div className="flex items-center justify-between mt-5">
          <h3 className="font-bold text-sm">العناصر ({c.suitable.items.length})</h3>
          <button onClick={() => setC({ ...c, suitable: { ...c.suitable, items: [...c.suitable.items, { id: newCId(), icon: "Sparkles", label: "حالة جديدة", visible: true }] } })}
            className="btn-gold rounded-xl px-3 py-1.5 text-xs flex items-center gap-2"><Plus size={14} /> إضافة</button>
        </div>
        <div className="grid gap-3 mt-3">
          {c.suitable.items.map((it, i) => {
            const upd = (patch: Partial<typeof it>) => setC({ ...c, suitable: { ...c.suitable, items: c.suitable.items.map((x) => x.id === it.id ? { ...x, ...patch } : x) } });
            const move = (dir: -1 | 1) => {
              const arr = [...c.suitable.items]; const j = i + dir; if (j < 0 || j >= arr.length) return;
              [arr[i], arr[j]] = [arr[j], arr[i]]; setC({ ...c, suitable: { ...c.suitable, items: arr } });
            };
            return (
              <div key={it.id} className="glass rounded-xl p-3 flex items-end gap-2">
                <Field label="الأيقونة">
                  <select className={inp} value={it.icon} onChange={(e) => upd({ icon: e.target.value })}>
                    {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
                <Field label="التسمية"><input className={inp} value={it.label} onChange={(e) => upd({ label: e.target.value })} /></Field>
                <IconBtn onClick={() => move(-1)}><ArrowUp size={14} /></IconBtn>
                <IconBtn onClick={() => move(1)}><ArrowDown size={14} /></IconBtn>
                <IconBtn onClick={() => upd({ visible: !it.visible })}>{it.visible ? <Eye size={14} /> : <EyeOff size={14} />}</IconBtn>
                <IconBtn onClick={() => setC({ ...c, suitable: { ...c.suitable, items: c.suitable.items.filter((x) => x.id !== it.id) } })} danger><Trash2 size={14} /></IconBtn>
              </div>
            );
          })}
        </div>
      </Section>

      {/* PRICING */}
      <Section title="قسم الأسعار">
        <VisibleToggle checked={c.pricing.visible} onChange={(v) => setC({ ...c, pricing: { ...c.pricing, visible: v } })} />
        <Grid>
          <Field label="نص علوي"><input className={inp} value={c.pricing.kicker} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, kicker: e.target.value } })} /></Field>
          <Field label="العنوان"><input className={inp} value={c.pricing.heading} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, heading: e.target.value } })} /></Field>
        </Grid>

        {/* Highlight card */}
        <div className="mt-5 glass rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">الباقة المميّزة (الأخضر)</h3>
            <VisibleToggle inline checked={c.pricing.highlight.visible} onChange={(v) => setC({ ...c, pricing: { ...c.pricing, highlight: { ...c.pricing.highlight, visible: v } } })} />
          </div>
          <Grid>
            <Field label="نص الشارة (أعلى البطاقة)"><input className={inp} value={c.pricing.highlight.badge} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, highlight: { ...c.pricing.highlight, badge: e.target.value } } })} /></Field>
            <Field label="نص الوسم (Pill)"><input className={inp} value={c.pricing.highlight.pill} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, highlight: { ...c.pricing.highlight, pill: e.target.value } } })} /></Field>
            <Field label="العنوان"><input className={inp} value={c.pricing.highlight.title} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, highlight: { ...c.pricing.highlight, title: e.target.value } } })} /></Field>
            <Field label="السعر"><input className={inp} value={c.pricing.highlight.price} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, highlight: { ...c.pricing.highlight, price: e.target.value } } })} /></Field>
            <Field label="لاحقة السعر"><input className={inp} value={c.pricing.highlight.price_suffix} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, highlight: { ...c.pricing.highlight, price_suffix: e.target.value } } })} /></Field>
            <Field label="الوصف" full><textarea rows={2} className={ta} value={c.pricing.highlight.description} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, highlight: { ...c.pricing.highlight, description: e.target.value } } })} /></Field>
            <Field label="نص الزر"><input className={inp} value={c.pricing.highlight.button_label} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, highlight: { ...c.pricing.highlight, button_label: e.target.value } } })} /></Field>
            <Field label="رسالة واتساب للزر"><input className={inp} value={c.pricing.highlight.button_whatsapp} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, highlight: { ...c.pricing.highlight, button_whatsapp: e.target.value } } })} /></Field>
            <Field label="ملاحظة أسفل الزر" full><input className={inp} value={c.pricing.highlight.footnote} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, highlight: { ...c.pricing.highlight, footnote: e.target.value } } })} /></Field>
          </Grid>
          <FeaturesEditor
            items={c.pricing.highlight.features}
            onChange={(features) => setC({ ...c, pricing: { ...c.pricing, highlight: { ...c.pricing.highlight, features } } })}
          />
        </div>

        {/* Standard card */}
        <div className="mt-4 glass rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">الباقة الفردية (الذهبي)</h3>
            <VisibleToggle inline checked={c.pricing.standard.visible} onChange={(v) => setC({ ...c, pricing: { ...c.pricing, standard: { ...c.pricing.standard, visible: v } } })} />
          </div>
          <Grid>
            <Field label="نص الوسم (Pill)"><input className={inp} value={c.pricing.standard.pill} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, standard: { ...c.pricing.standard, pill: e.target.value } } })} /></Field>
            <Field label="العنوان"><input className={inp} value={c.pricing.standard.title} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, standard: { ...c.pricing.standard, title: e.target.value } } })} /></Field>
            <Field label="السعر"><input className={inp} value={c.pricing.standard.price} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, standard: { ...c.pricing.standard, price: e.target.value } } })} /></Field>
            <Field label="لاحقة السعر"><input className={inp} value={c.pricing.standard.price_suffix} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, standard: { ...c.pricing.standard, price_suffix: e.target.value } } })} /></Field>
            <Field label="الوصف" full><textarea rows={2} className={ta} value={c.pricing.standard.description} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, standard: { ...c.pricing.standard, description: e.target.value } } })} /></Field>
            <Field label="نص الزر"><input className={inp} value={c.pricing.standard.button_label} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, standard: { ...c.pricing.standard, button_label: e.target.value } } })} /></Field>
            <Field label="رسالة واتساب للزر"><input className={inp} value={c.pricing.standard.button_whatsapp} onChange={(e) => setC({ ...c, pricing: { ...c.pricing, standard: { ...c.pricing.standard, button_whatsapp: e.target.value } } })} /></Field>
          </Grid>
          <FeaturesEditor
            items={c.pricing.standard.features}
            onChange={(features) => setC({ ...c, pricing: { ...c.pricing, standard: { ...c.pricing.standard, features } } })}
          />
        </div>
      </Section>

      {/* FINAL CTA */}
      <Section title="بانر النهاية (Final CTA)">
        <VisibleToggle checked={c.final_cta.visible} onChange={(v) => setC({ ...c, final_cta: { ...c.final_cta, visible: v } })} />
        <Grid>
          <Field label="السطر الأول"><input className={inp} value={c.final_cta.heading_line1} onChange={(e) => setC({ ...c, final_cta: { ...c.final_cta, heading_line1: e.target.value } })} /></Field>
          <Field label="الكلمات المميّزة"><input className={inp} value={c.final_cta.heading_highlight} onChange={(e) => setC({ ...c, final_cta: { ...c.final_cta, heading_highlight: e.target.value } })} /></Field>
          <Field label="السطر الثاني"><input className={inp} value={c.final_cta.heading_line2} onChange={(e) => setC({ ...c, final_cta: { ...c.final_cta, heading_line2: e.target.value } })} /></Field>
          <Field label="الوصف" full><textarea rows={2} className={ta} value={c.final_cta.description} onChange={(e) => setC({ ...c, final_cta: { ...c.final_cta, description: e.target.value } })} /></Field>
          <Field label="نص الزر الرئيسي"><input className={inp} value={c.final_cta.primary_label} onChange={(e) => setC({ ...c, final_cta: { ...c.final_cta, primary_label: e.target.value } })} /></Field>
          <Field label="رسالة واتساب للزر الرئيسي"><input className={inp} value={c.final_cta.primary_whatsapp} onChange={(e) => setC({ ...c, final_cta: { ...c.final_cta, primary_whatsapp: e.target.value } })} /></Field>
          <Field label="نص الزر الثانوي"><input className={inp} value={c.final_cta.secondary_label} onChange={(e) => setC({ ...c, final_cta: { ...c.final_cta, secondary_label: e.target.value } })} /></Field>
          <Field label="رسالة واتساب للزر الثانوي (فارغ = الرسالة العامة)"><input className={inp} value={c.final_cta.secondary_whatsapp} onChange={(e) => setC({ ...c, final_cta: { ...c.final_cta, secondary_whatsapp: e.target.value } })} /></Field>
        </Grid>
      </Section>

      <Section title="خدمات مرتبطة (أسفل الصفحة)">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={c.show_related} onChange={(e) => setC({ ...c, show_related: e.target.checked })} />
          إظهار قسم "قد تهمّك أيضًا"
        </label>
      </Section>

      <div className="flex justify-end pt-2">
        <button onClick={save} disabled={saving} className="btn-gold rounded-xl px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} حفظ التغييرات
        </button>
      </div>
    </div>
  );
}

function FeaturesEditor({ items, onChange }: { items: { id: string; text: string }[]; onChange: (v: { id: string; text: string }[]) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold text-xs">قائمة المزايا ({items.length})</h4>
        <button onClick={() => onChange([...items, { id: newCId(), text: "" }])}
          className="btn-outline-gold rounded-lg px-2.5 py-1 text-xs flex items-center gap-1"><Plus size={12} /> ميزة</button>
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={it.id} className="flex items-center gap-2">
            <input className={inp} value={it.text} onChange={(e) => onChange(items.map((x) => x.id === it.id ? { ...x, text: e.target.value } : x))} />
            <IconBtn onClick={() => {
              const arr = [...items]; if (i === 0) return;
              [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; onChange(arr);
            }}><ArrowUp size={14} /></IconBtn>
            <IconBtn onClick={() => {
              const arr = [...items]; if (i === arr.length - 1) return;
              [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; onChange(arr);
            }}><ArrowDown size={14} /></IconBtn>
            <IconBtn onClick={() => onChange(items.filter((x) => x.id !== it.id))} danger><Trash2 size={14} /></IconBtn>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisibleToggle({ checked, onChange, inline }: { checked: boolean; onChange: (v: boolean) => void; inline?: boolean }) {
  return (
    <label className={`flex items-center gap-2 text-sm cursor-pointer ${inline ? "" : "mb-3"}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> إظهار هذا القسم
    </label>
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
