import { Eye, EyeOff, Trash2, ArrowUp, ArrowDown, Plus } from "lucide-react";
import { ImageUploader } from "@/components/ImageUploader";
import type {
  Section, HeroSection, BadgeGridSection, PricingGroupsSection,
  ChecklistSection, CtaBandSection, RichTextSection,
  LinkCardsSection, StepListSection, FaqSection, DynamicSlotSection,
  BusinessTabsSection,
  MediaHeroSection, StatBarSection, FeatureGridSection,
  CaseStudiesSection, SlaTiersSection, LeadFormSection, PortalMockupSection,
} from "./types";

import { SECTION_TYPE_LABELS, newId } from "./types";



const field = "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm focus:outline-none focus:border-[color:var(--gold)]/60";
const ta = field + " min-h-[80px]";
const lbl = "text-xs text-muted-foreground block mb-1";

type Props<T extends Section> = {
  section: T;
  onChange: (s: T) => void;
};

function HeroEditor({ section, onChange }: Props<HeroSection>) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2"><span className={lbl}>Kicker (نص فوقي)</span>
        <input className={field} value={section.kicker ?? ""} onChange={(e) => onChange({ ...section, kicker: e.target.value })} /></label>
      <label className="sm:col-span-2"><span className={lbl}>العنوان الرئيسي</span>
        <input className={field} value={section.title} onChange={(e) => onChange({ ...section, title: e.target.value })} /></label>
      <label className="sm:col-span-2"><span className={lbl}>الوصف</span>
        <textarea className={ta} value={section.description ?? ""} onChange={(e) => onChange({ ...section, description: e.target.value })} /></label>
      <div className="sm:col-span-2"><span className={lbl}>صورة (اختياري)</span>
        <ImageUploader value={section.image_path} onChange={(p) => onChange({ ...section, image_path: p ?? undefined })} folder="cms" cropAspect="free" /></div>
    </div>
  );
}

function BadgeGridEditor({ section, onChange }: Props<BadgeGridSection>) {
  const setItem = (i: number, patch: Partial<typeof section.items[number]>) => {
    const items = section.items.slice();
    items[i] = { ...items[i], ...patch };
    onChange({ ...section, items });
  };
  return (
    <div className="space-y-3">
      {section.items.map((it, i) => (
        <div key={it.id} className="rounded-xl border border-white/10 p-3 grid gap-2 sm:grid-cols-[120px_1fr_2fr_auto]">
          <input className={field} placeholder="أيقونة (مثلاً Calendar)" value={it.icon} onChange={(e) => setItem(i, { icon: e.target.value })} />
          <input className={field} placeholder="العنوان" value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} />
          <input className={field} placeholder="الوصف" value={it.desc} onChange={(e) => setItem(i, { desc: e.target.value })} />
          <button type="button" onClick={() => onChange({ ...section, items: section.items.filter((_, k) => k !== i) })}
            className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...section, items: [...section.items, { id: newId(), icon: "Sparkles", title: "جديد", desc: "" }] })}
        className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف عنصر</button>
      <p className="text-[11px] text-muted-foreground">أسماء الأيقونات من مكتبة <code>lucide-react</code>. أمثلة: Calendar, Wrench, ShieldCheck, Sparkles, Fish.</p>
    </div>
  );
}

function PricingGroupsEditor({ section, onChange }: Props<PricingGroupsSection>) {
  const setGroup = (gi: number, patch: any) => {
    const items = section.items.slice();
    items[gi] = { ...items[gi], ...patch };
    onChange({ ...section, items });
  };
  const setTier = (gi: number, ti: number, patch: any) => {
    const items = section.items.slice();
    const tiers = items[gi].tiers.slice();
    tiers[ti] = { ...tiers[ti], ...patch };
    items[gi] = { ...items[gi], tiers };
    onChange({ ...section, items });
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className={lbl}>قالب رسالة واتساب</span>
          <input className={field} value={section.whatsapp_template} onChange={(e) => onChange({ ...section, whatsapp_template: e.target.value })} /></label>
        <label><span className={lbl}>نص زر الطلب</span>
          <input className={field} value={section.cta_label} onChange={(e) => onChange({ ...section, cta_label: e.target.value })} /></label>
      </div>
      <p className="text-[11px] text-muted-foreground">استخدم <code>{"{group}"}</code> و <code>{"{tier}"}</code> داخل الرسالة لتعويضها تلقائيًا.</p>
      {section.items.map((g, gi) => (
        <div key={g.id} className="rounded-2xl border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <input className={field + " font-bold"} value={g.heading} onChange={(e) => setGroup(gi, { heading: e.target.value })} placeholder="اسم المجموعة" />
            <button type="button" onClick={() => onChange({ ...section, items: section.items.filter((_, k) => k !== gi) })}
              className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
          </div>
          <input className={field} value={g.desc ?? ""} onChange={(e) => setGroup(gi, { desc: e.target.value })} placeholder="وصف المجموعة" />
          <div className="space-y-2">
            {g.tiers.map((t, ti) => (
              <div key={t.id} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
                <input className={field} value={t.size} onChange={(e) => setTier(gi, ti, { size: e.target.value })} placeholder="المقاس" />
                <input className={field} value={t.price} onChange={(e) => setTier(gi, ti, { price: e.target.value })} placeholder="السعر" />
                <input className={field} value={t.freq} onChange={(e) => setTier(gi, ti, { freq: e.target.value })} placeholder="التكرار" />
                <button type="button" onClick={() => setGroup(gi, { tiers: g.tiers.filter((_, k) => k !== ti) })}
                  className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setGroup(gi, { tiers: [...g.tiers, { id: newId(), size: "", price: "", freq: "" }] })}
              className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف باقة</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...section, items: [...section.items, { id: newId(), heading: "مجموعة جديدة", desc: "", tiers: [] }] })}
        className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف مجموعة</button>
    </div>
  );
}

function ChecklistEditor({ section, onChange }: Props<ChecklistSection>) {
  return (
    <div className="space-y-3">
      <label><span className={lbl}>العنوان</span>
        <input className={field} value={section.heading} onChange={(e) => onChange({ ...section, heading: e.target.value })} /></label>
      {section.items.map((it, i) => (
        <div key={it.id} className="flex gap-2">
          <input className={field} value={it.text}
            onChange={(e) => { const items = section.items.slice(); items[i] = { ...it, text: e.target.value }; onChange({ ...section, items }); }} />
          <button type="button" onClick={() => onChange({ ...section, items: section.items.filter((_, k) => k !== i) })}
            className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...section, items: [...section.items, { id: newId(), text: "" }] })}
        className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف بند</button>
    </div>
  );
}

function CtaBandEditor({ section, onChange }: Props<CtaBandSection>) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2"><span className={lbl}>العنوان</span>
        <input className={field} value={section.heading} onChange={(e) => onChange({ ...section, heading: e.target.value })} /></label>
      <label className="sm:col-span-2"><span className={lbl}>الوصف</span>
        <textarea className={ta} value={section.description ?? ""} onChange={(e) => onChange({ ...section, description: e.target.value })} /></label>
      <label><span className={lbl}>نص الزر الأساسي</span>
        <input className={field} value={section.primary_label} onChange={(e) => onChange({ ...section, primary_label: e.target.value })} /></label>
      <label><span className={lbl}>رسالة واتساب للزر الأساسي (اختياري)</span>
        <input className={field} value={section.primary_whatsapp_template ?? ""} onChange={(e) => onChange({ ...section, primary_whatsapp_template: e.target.value })} /></label>
      <label className="sm:col-span-2"><span className={lbl}>أو رابط مباشر للزر الأساسي (إذا تركت رسالة الواتساب فارغة)</span>
        <input className={field} value={section.primary_href ?? ""} onChange={(e) => onChange({ ...section, primary_href: e.target.value })} /></label>
      <label><span className={lbl}>نص الزر الثانوي</span>
        <input className={field} value={section.secondary_label ?? ""} onChange={(e) => onChange({ ...section, secondary_label: e.target.value })} /></label>
      <label><span className={lbl}>رابط الزر الثانوي</span>
        <input className={field} value={section.secondary_href ?? ""} onChange={(e) => onChange({ ...section, secondary_href: e.target.value })} /></label>
    </div>
  );
}

function RichTextEditor({ section, onChange }: Props<RichTextSection>) {
  return (
    <div className="space-y-3">
      <label><span className={lbl}>العنوان (اختياري)</span>
        <input className={field} value={section.heading ?? ""} onChange={(e) => onChange({ ...section, heading: e.target.value })} /></label>
      <label><span className={lbl}>النص</span>
        <textarea className={ta + " min-h-[160px]"} value={section.body} onChange={(e) => onChange({ ...section, body: e.target.value })} /></label>
    </div>
  );
}

function LinkCardsEditor({ section, onChange }: Props<LinkCardsSection>) {
  const setItem = (i: number, patch: Partial<LinkCardsSection["items"][number]>) => {
    const items = section.items.slice(); items[i] = { ...items[i], ...patch }; onChange({ ...section, items });
  };
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_120px]">
        <label><span className={lbl}>العنوان</span>
          <input className={field} value={section.heading ?? ""} onChange={(e) => onChange({ ...section, heading: e.target.value })} /></label>
        <label><span className={lbl}>عنوان فرعي</span>
          <input className={field} value={section.subheading ?? ""} onChange={(e) => onChange({ ...section, subheading: e.target.value })} /></label>
        <label><span className={lbl}>عدد الأعمدة (2-5)</span>
          <input type="number" min={2} max={5} className={field} value={section.columns ?? 5} onChange={(e) => onChange({ ...section, columns: Number(e.target.value) || 5 })} /></label>
      </div>
      {section.items.map((it, i) => (
        <div key={it.id} className="rounded-xl border border-white/10 p-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input className={field} placeholder="العنوان" value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} />
          <input className={field} placeholder="وصف قصير" value={it.desc ?? ""} onChange={(e) => setItem(i, { desc: e.target.value })} />
          <input className={field} placeholder="الرابط (مثل /services أو https://...)" value={it.href} onChange={(e) => setItem(i, { href: e.target.value })} />
          <button type="button" onClick={() => onChange({ ...section, items: section.items.filter((_, k) => k !== i) })}
            className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...section, items: [...section.items, { id: newId(), title: "بطاقة جديدة", desc: "", href: "/" }] })}
        className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف بطاقة</button>
    </div>
  );
}

function StepListEditor({ section, onChange }: Props<StepListSection>) {
  return (
    <div className="space-y-3">
      <label><span className={lbl}>العنوان</span>
        <input className={field} value={section.heading ?? ""} onChange={(e) => onChange({ ...section, heading: e.target.value })} /></label>
      {section.items.map((it, i) => (
        <div key={it.id} className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground w-6 text-center">{i + 1}</span>
          <input className={field} value={it.text}
            onChange={(e) => { const items = section.items.slice(); items[i] = { ...it, text: e.target.value }; onChange({ ...section, items }); }} />
          <button type="button" onClick={() => onChange({ ...section, items: section.items.filter((_, k) => k !== i) })}
            className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...section, items: [...section.items, { id: newId(), text: "" }] })}
        className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف خطوة</button>
    </div>
  );
}

function FaqEditor({ section, onChange }: Props<FaqSection>) {
  const setItem = (i: number, patch: Partial<FaqSection["items"][number]>) => {
    const items = section.items.slice(); items[i] = { ...items[i], ...patch }; onChange({ ...section, items });
  };
  return (
    <div className="space-y-3">
      <label><span className={lbl}>العنوان</span>
        <input className={field} value={section.heading ?? ""} onChange={(e) => onChange({ ...section, heading: e.target.value })} /></label>
      {section.items.map((it, i) => (
        <div key={it.id} className="rounded-xl border border-white/10 p-3 space-y-2">
          <div className="flex gap-2">
            <input className={field} placeholder="السؤال" value={it.q} onChange={(e) => setItem(i, { q: e.target.value })} />
            <button type="button" onClick={() => onChange({ ...section, items: section.items.filter((_, k) => k !== i) })}
              className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
          </div>
          <textarea className={ta} placeholder="الإجابة" value={it.a} onChange={(e) => setItem(i, { a: e.target.value })} />
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...section, items: [...section.items, { id: newId(), q: "", a: "" }] })}
        className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف سؤال</button>
    </div>
  );
}

const SLOT_OPTIONS: { value: string; label: string }[] = [
  { value: "services_grid", label: "شبكة الخدمات (تُدار من «الخدمات»)" },
];

function DynamicSlotEditor({ section, onChange }: Props<DynamicSlotSection>) {
  return (
    <div className="space-y-3">
      <label><span className={lbl}>نوع المحتوى الديناميكي</span>
        <select className={field} value={section.slot} onChange={(e) => onChange({ ...section, slot: e.target.value })}>
          {SLOT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label><span className={lbl}>ملاحظة داخلية (لا تظهر للزوار)</span>
        <input className={field} value={section.note ?? ""} onChange={(e) => onChange({ ...section, note: e.target.value })} /></label>
      <div className="text-[11px] text-muted-foreground">
        هذا القسم يعرض محتوى ديناميكيًا من قسم آخر بالإدارة. عدّل المحتوى من مصدره الأصلي.
      </div>
    </div>
  );
}

function BusinessTabsEditor({ section, onChange }: Props<BusinessTabsSection>) {
  const setItem = (i: number, patch: Partial<BusinessTabsSection["items"][number]>) => {
    const items = section.items.slice(); items[i] = { ...items[i], ...patch }; onChange({ ...section, items });
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label><span className={lbl}>Kicker</span>
          <input className={field} value={section.kicker ?? ""} onChange={(e) => onChange({ ...section, kicker: e.target.value })} /></label>
        <label className="sm:col-span-2"><span className={lbl}>عنوان القسم</span>
          <input className={field} value={section.heading ?? ""} onChange={(e) => onChange({ ...section, heading: e.target.value })} /></label>
        <label className="sm:col-span-3"><span className={lbl}>الوصف</span>
          <textarea className={ta} value={section.description ?? ""} onChange={(e) => onChange({ ...section, description: e.target.value })} /></label>
      </div>

      <details className="rounded-2xl border border-white/10 p-4">
        <summary className="cursor-pointer text-sm font-bold">تسميات ثابتة داخل التبويب (اتركها فارغة للافتراضي)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label><span className={lbl}>بادئة اسم التبويب (افتراضي: قسم)</span>
            <input className={field} placeholder="قسم" value={section.tab_badge_prefix ?? ""} onChange={(e) => onChange({ ...section, tab_badge_prefix: e.target.value })} /></label>
          <label><span className={lbl}>عنوان قائمة المزايا (افتراضي: ماذا نوفّر لك)</span>
            <input className={field} placeholder="ماذا نوفّر لك" value={section.features_heading ?? ""} onChange={(e) => onChange({ ...section, features_heading: e.target.value })} /></label>
          <label><span className={lbl}>عنوان قائمة المخاوف (افتراضي: أسئلة ومخاوف شائعة)</span>
            <input className={field} placeholder="أسئلة ومخاوف شائعة" value={section.concerns_heading ?? ""} onChange={(e) => onChange({ ...section, concerns_heading: e.target.value })} /></label>
          <label><span className={lbl}>عنوان طرق الدفع (افتراضي: طرق الدفع والاشتراك)</span>
            <input className={field} placeholder="طرق الدفع والاشتراك" value={section.payment_heading ?? ""} onChange={(e) => onChange({ ...section, payment_heading: e.target.value })} /></label>
          <label><span className={lbl}>عنوان شريط CTA (افتراضي: جاهز لمناقشة مشروعك؟)</span>
            <input className={field} placeholder="جاهز لمناقشة مشروعك؟" value={section.cta_heading ?? ""} onChange={(e) => onChange({ ...section, cta_heading: e.target.value })} /></label>
          <label><span className={lbl}>نص زر واتساب (افتراضي: تواصل عبر واتساب)</span>
            <input className={field} placeholder="تواصل عبر واتساب" value={section.cta_button_label ?? ""} onChange={(e) => onChange({ ...section, cta_button_label: e.target.value })} /></label>
        </div>
      </details>
      {section.items.map((it, i) => (
        <details key={it.id} className="rounded-2xl border border-white/10 p-4" open={i === 0}>
          <summary className="cursor-pointer text-sm font-bold flex items-center justify-between gap-2">
            <span>{it.title || "تبويب بدون اسم"}</span>
            <button type="button" onClick={(e) => { e.preventDefault(); onChange({ ...section, items: section.items.filter((_, k) => k !== i) }); }}
              className="px-3 py-1.5 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
          </summary>
          <div className="mt-4 space-y-3">
            <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
              <input className={field} placeholder="أيقونة (Coffee, Fish ...)" value={it.icon} onChange={(e) => setItem(i, { icon: e.target.value })} />
              <input className={field} placeholder="اسم التبويب" value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} />
            </div>
            <input className={field} placeholder="عنوان فرعي (Tagline)" value={it.tagline} onChange={(e) => setItem(i, { tagline: e.target.value })} />
            <textarea className={ta} placeholder="فكرة القسم" value={it.idea} onChange={(e) => setItem(i, { idea: e.target.value })} />
            <input className={field} placeholder="رسالة واتساب عند الضغط على CTA" value={it.cta} onChange={(e) => setItem(i, { cta: e.target.value })} />

            <div>
              <div className={lbl}>الصور</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {it.images.map((img, ii) => (
                  <div key={img.id} className="rounded-xl border border-white/10 p-3 space-y-2">
                    <ImageUploader value={img.path} onChange={(p) => {
                      const images = it.images.slice(); images[ii] = { ...img, path: p ?? "" }; setItem(i, { images });
                    }} folder="cms/business" cropAspect="free" />
                    <button type="button" onClick={() => setItem(i, { images: it.images.filter((_, k) => k !== ii) })}
                      className="text-xs px-3 py-1.5 rounded-xl border border-red-400/20 text-red-300 inline-flex items-center gap-1">
                      <Trash2 size={12} /> حذف الصورة
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setItem(i, { images: [...it.images, { id: newId(), path: "" }] })}
                className="mt-2 text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف صورة</button>
            </div>

            <div>
              <div className={lbl}>ماذا نوفّر (features)</div>
              {it.features.map((f, fi) => (
                <div key={f.id} className="flex gap-2 mb-2">
                  <input className={field} value={f.text}
                    onChange={(e) => { const features = it.features.slice(); features[fi] = { ...f, text: e.target.value }; setItem(i, { features }); }} />
                  <button type="button" onClick={() => setItem(i, { features: it.features.filter((_, k) => k !== fi) })}
                    className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setItem(i, { features: [...it.features, { id: newId(), text: "" }] })}
                className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف ميزة</button>
            </div>

            <div>
              <div className={lbl}>أسئلة ومخاوف</div>
              {it.concerns.map((c, ci) => (
                <div key={c.id} className="rounded-xl border border-white/10 p-3 mb-2 space-y-2">
                  <div className="flex gap-2">
                    <input className={field} placeholder="السؤال" value={c.q}
                      onChange={(e) => { const concerns = it.concerns.slice(); concerns[ci] = { ...c, q: e.target.value }; setItem(i, { concerns }); }} />
                    <button type="button" onClick={() => setItem(i, { concerns: it.concerns.filter((_, k) => k !== ci) })}
                      className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
                  </div>
                  <textarea className={ta} placeholder="الإجابة" value={c.a}
                    onChange={(e) => { const concerns = it.concerns.slice(); concerns[ci] = { ...c, a: e.target.value }; setItem(i, { concerns }); }} />
                </div>
              ))}
              <button type="button" onClick={() => setItem(i, { concerns: [...it.concerns, { id: newId(), q: "", a: "" }] })}
                className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف سؤال</button>
            </div>

            <div>
              <div className={lbl}>طرق الدفع</div>
              {it.payment.map((p, pi) => (
                <div key={p.id} className="flex gap-2 mb-2">
                  <input className={field} value={p.text}
                    onChange={(e) => { const payment = it.payment.slice(); payment[pi] = { ...p, text: e.target.value }; setItem(i, { payment }); }} />
                  <button type="button" onClick={() => setItem(i, { payment: it.payment.filter((_, k) => k !== pi) })}
                    className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setItem(i, { payment: [...it.payment, { id: newId(), text: "" }] })}
                className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف بند</button>
            </div>
          </div>
        </details>
      ))}
      <button type="button" onClick={() => onChange({ ...section, items: [...section.items, {
        id: newId(), icon: "Sparkles", title: "تبويب جديد", tagline: "", idea: "",
        features: [], concerns: [], payment: [], images: [], cta: "السلام عليكم",
      }] })} className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1">
        <Plus size={14} /> أضف تبويب
      </button>
      <p className="text-[11px] text-muted-foreground">أسماء الأيقونات من <code>lucide-react</code> (Coffee, UtensilsCrossed, PartyPopper, Fish ...).</p>
    </div>
  );
}

// ─── New B2B editors ────────────────────────────────────────────────────────
function MediaHeroEditor({ section, onChange }: Props<MediaHeroSection>) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label><span className={lbl}>Kicker</span>
        <input className={field} value={section.kicker ?? ""} onChange={(e) => onChange({ ...section, kicker: e.target.value })} /></label>
      <label><span className={lbl}>العنوان الرئيسي *</span>
        <input className={field} value={section.title} onChange={(e) => onChange({ ...section, title: e.target.value })} /></label>
      <label className="sm:col-span-2"><span className={lbl}>العنوان المُبرَز (سطر ذهبي)</span>
        <input className={field} value={section.title_highlight ?? ""} onChange={(e) => onChange({ ...section, title_highlight: e.target.value })} /></label>
      <label className="sm:col-span-2"><span className={lbl}>الوصف</span>
        <textarea className={ta} value={section.description ?? ""} onChange={(e) => onChange({ ...section, description: e.target.value })} /></label>
      <div className="sm:col-span-2"><span className={lbl}>صورة الخلفية</span>
        <ImageUploader value={section.image_path} onChange={(p) => onChange({ ...section, image_path: p ?? undefined })} folder="cms/business" cropAspect="free" /></div>
      <label><span className={lbl}>نص الزر الأساسي</span>
        <input className={field} value={section.primary_label ?? ""} onChange={(e) => onChange({ ...section, primary_label: e.target.value })} /></label>
      <label><span className={lbl}>رابط الزر الأساسي (مثل #quote)</span>
        <input className={field} value={section.primary_href ?? ""} onChange={(e) => onChange({ ...section, primary_href: e.target.value })} /></label>
      <label className="sm:col-span-2"><span className={lbl}>أو رسالة واتساب للزر الأساسي</span>
        <input className={field} value={section.primary_whatsapp_template ?? ""} onChange={(e) => onChange({ ...section, primary_whatsapp_template: e.target.value })} /></label>
      <label><span className={lbl}>نص الزر الثانوي</span>
        <input className={field} value={section.secondary_label ?? ""} onChange={(e) => onChange({ ...section, secondary_label: e.target.value })} /></label>
      <label><span className={lbl}>رابط الزر الثانوي</span>
        <input className={field} value={section.secondary_href ?? ""} onChange={(e) => onChange({ ...section, secondary_href: e.target.value })} /></label>
      <label className="sm:col-span-2"><span className={lbl}>أو رسالة واتساب للزر الثانوي</span>
        <input className={field} value={section.secondary_whatsapp_template ?? ""} onChange={(e) => onChange({ ...section, secondary_whatsapp_template: e.target.value })} /></label>
      <div className="sm:col-span-2 space-y-2">
        <div className={lbl}>شارات ثقة (نصوص قصيرة تحت الأزرار)</div>
        {(section.badges ?? []).map((b, i) => (
          <div key={b.id} className="flex gap-2">
            <input className={field} value={b.text}
              onChange={(e) => { const badges = (section.badges ?? []).slice(); badges[i] = { ...b, text: e.target.value }; onChange({ ...section, badges }); }} />
            <button type="button" onClick={() => onChange({ ...section, badges: (section.badges ?? []).filter((_, k) => k !== i) })}
              className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
          </div>
        ))}
        <button type="button" onClick={() => onChange({ ...section, badges: [...(section.badges ?? []), { id: newId(), text: "" }] })}
          className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف شارة</button>
      </div>
    </div>
  );
}

function StatBarEditor({ section, onChange }: Props<StatBarSection>) {
  return (
    <div className="space-y-3">
      {section.items.map((it, i) => (
        <div key={it.id} className="grid gap-2 sm:grid-cols-[120px_120px_1fr_auto]">
          <input className={field} placeholder="أيقونة (Award...)" value={it.icon}
            onChange={(e) => { const items = section.items.slice(); items[i] = { ...it, icon: e.target.value }; onChange({ ...section, items }); }} />
          <input className={field} placeholder="القيمة (+9)" value={it.value}
            onChange={(e) => { const items = section.items.slice(); items[i] = { ...it, value: e.target.value }; onChange({ ...section, items }); }} />
          <input className={field} placeholder="الوصف" value={it.label}
            onChange={(e) => { const items = section.items.slice(); items[i] = { ...it, label: e.target.value }; onChange({ ...section, items }); }} />
          <button type="button" onClick={() => onChange({ ...section, items: section.items.filter((_, k) => k !== i) })}
            className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...section, items: [...section.items, { id: newId(), icon: "Sparkles", value: "", label: "" }] })}
        className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف رقم</button>
    </div>
  );
}

function FeatureGridEditor({ section, onChange }: Props<FeatureGridSection>) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_100px]">
        <input className={field} placeholder="Kicker" value={section.kicker ?? ""} onChange={(e) => onChange({ ...section, kicker: e.target.value })} />
        <input className={field} placeholder="العنوان" value={section.heading ?? ""} onChange={(e) => onChange({ ...section, heading: e.target.value })} />
        <input className={field} placeholder="عنوان فرعي" value={section.subheading ?? ""} onChange={(e) => onChange({ ...section, subheading: e.target.value })} />
        <input type="number" min={2} max={4} className={field} value={section.columns ?? 3}
          onChange={(e) => onChange({ ...section, columns: Number(e.target.value) || 3 })} />
      </div>
      {section.items.map((it, i) => (
        <div key={it.id} className="rounded-xl border border-white/10 p-3 grid gap-2 sm:grid-cols-[120px_1fr_2fr_auto]">
          <input className={field} placeholder="أيقونة" value={it.icon}
            onChange={(e) => { const items = section.items.slice(); items[i] = { ...it, icon: e.target.value }; onChange({ ...section, items }); }} />
          <input className={field} placeholder="العنوان" value={it.title}
            onChange={(e) => { const items = section.items.slice(); items[i] = { ...it, title: e.target.value }; onChange({ ...section, items }); }} />
          <textarea className={field + " min-h-[52px]"} placeholder="الوصف" value={it.desc}
            onChange={(e) => { const items = section.items.slice(); items[i] = { ...it, desc: e.target.value }; onChange({ ...section, items }); }} />
          <button type="button" onClick={() => onChange({ ...section, items: section.items.filter((_, k) => k !== i) })}
            className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...section, items: [...section.items, { id: newId(), icon: "Sparkles", title: "", desc: "" }] })}
        className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف ميزة</button>
    </div>
  );
}

function CaseStudiesEditor({ section, onChange }: Props<CaseStudiesSection>) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <input className={field} placeholder="Kicker" value={section.kicker ?? ""} onChange={(e) => onChange({ ...section, kicker: e.target.value })} />
        <input className={field} placeholder="العنوان" value={section.heading ?? ""} onChange={(e) => onChange({ ...section, heading: e.target.value })} />
        <input className={field} placeholder="عنوان فرعي" value={section.subheading ?? ""} onChange={(e) => onChange({ ...section, subheading: e.target.value })} />
      </div>
      {section.items.map((it, i) => (
        <div key={it.id} className="rounded-xl border border-white/10 p-3 grid gap-3 sm:grid-cols-[220px_1fr_auto]">
          <ImageUploader value={it.image_path} onChange={(p) => { const items = section.items.slice(); items[i] = { ...it, image_path: p ?? "" }; onChange({ ...section, items }); }} folder="cms/business" cropAspect="free" />
          <div className="space-y-2">
            <input className={field} placeholder="التصنيف (فندق، مول ...)" value={it.category}
              onChange={(e) => { const items = section.items.slice(); items[i] = { ...it, category: e.target.value }; onChange({ ...section, items }); }} />
            <input className={field} placeholder="عنوان المشروع" value={it.title}
              onChange={(e) => { const items = section.items.slice(); items[i] = { ...it, title: e.target.value }; onChange({ ...section, items }); }} />
            <input className={field} placeholder="الموقع (المدينة)" value={it.location ?? ""}
              onChange={(e) => { const items = section.items.slice(); items[i] = { ...it, location: e.target.value }; onChange({ ...section, items }); }} />
          </div>
          <button type="button" onClick={() => onChange({ ...section, items: section.items.filter((_, k) => k !== i) })}
            className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs h-fit"><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...section, items: [...section.items, { id: newId(), image_path: "", category: "", title: "", location: "" }] })}
        className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف مشروع</button>
    </div>
  );
}

function SlaTiersEditor({ section, onChange }: Props<SlaTiersSection>) {
  const setTier = (i: number, patch: Partial<SlaTiersSection["items"][number]>) => {
    const items = section.items.slice(); items[i] = { ...items[i], ...patch }; onChange({ ...section, items });
  };
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <input className={field} placeholder="Kicker" value={section.kicker ?? ""} onChange={(e) => onChange({ ...section, kicker: e.target.value })} />
        <input className={field} placeholder="العنوان" value={section.heading ?? ""} onChange={(e) => onChange({ ...section, heading: e.target.value })} />
        <input className={field} placeholder="عنوان فرعي" value={section.subheading ?? ""} onChange={(e) => onChange({ ...section, subheading: e.target.value })} />
      </div>
      {section.items.map((t, i) => (
        <details key={t.id} className="rounded-2xl border border-white/10 p-4" open={i === 0}>
          <summary className="cursor-pointer text-sm font-bold flex items-center justify-between">
            <span>{t.name || "باقة بدون اسم"}{t.highlighted ? " ⭐" : ""}</span>
            <button type="button" onClick={(e) => { e.preventDefault(); onChange({ ...section, items: section.items.filter((_, k) => k !== i) }); }}
              className="px-3 py-1.5 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input className={field} placeholder="اسم الباقة" value={t.name} onChange={(e) => setTier(i, { name: e.target.value })} />
            <input className={field} placeholder="شارة (اختياري: الأكثر شيوعًا)" value={t.badge ?? ""} onChange={(e) => setTier(i, { badge: e.target.value })} />
            <input className={field} placeholder="السعر" value={t.price ?? ""} onChange={(e) => setTier(i, { price: e.target.value })} />
            <input className={field} placeholder="ملاحظة تحت السعر" value={t.price_note ?? ""} onChange={(e) => setTier(i, { price_note: e.target.value })} />
            <input className={field} placeholder="نص الزر" value={t.cta_label ?? ""} onChange={(e) => setTier(i, { cta_label: e.target.value })} />
            <input className={field} placeholder="رسالة واتساب للزر (اتركها فارغة للربط بـ #quote)" value={t.cta_whatsapp_template ?? ""} onChange={(e) => setTier(i, { cta_whatsapp_template: e.target.value })} />
            <label className="sm:col-span-2 inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!t.highlighted} onChange={(e) => setTier(i, { highlighted: e.target.checked })} /> إبراز هذه الباقة
            </label>
          </div>
          <div className="mt-3 space-y-2">
            <div className={lbl}>مزايا الباقة</div>
            {t.features.map((f, fi) => (
              <div key={f.id} className="flex gap-2">
                <input className={field} value={f.text}
                  onChange={(e) => { const features = t.features.slice(); features[fi] = { ...f, text: e.target.value }; setTier(i, { features }); }} />
                <button type="button" onClick={() => setTier(i, { features: t.features.filter((_, k) => k !== fi) })}
                  className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setTier(i, { features: [...t.features, { id: newId(), text: "" }] })}
              className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف ميزة</button>
          </div>
        </details>
      ))}
      <button type="button" onClick={() => onChange({ ...section, items: [...section.items, { id: newId(), name: "باقة جديدة", features: [] }] })}
        className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف باقة</button>
    </div>
  );
}

function LeadFormEditor({ section, onChange }: Props<LeadFormSection>) {
  const listEditor = (key: "industries" | "budgets" | "timelines" | "facility_types" | "need_types" | "preferred_times", title: string) => (
    <details className="rounded-xl border border-white/10 p-3" open>
      <summary className="cursor-pointer text-sm font-bold">{title}</summary>
      <div className="mt-2 space-y-2">
        {(section[key] ?? []).map((o, i) => (
          <div key={o.id} className="flex gap-2">
            <input className={field} value={o.label}
              onChange={(e) => { const items = (section[key] ?? []).slice(); items[i] = { ...o, label: e.target.value }; onChange({ ...section, [key]: items } as any); }} />
            <button type="button" onClick={() => onChange({ ...section, [key]: (section[key] ?? []).filter((_, k) => k !== i) } as any)}
              className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
          </div>
        ))}
        <button type="button" onClick={() => onChange({ ...section, [key]: [...(section[key] ?? []), { id: newId(), label: "" }] } as any)}
          className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف</button>
      </div>
    </details>
  );
  const preset = section.fields_preset || "default";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2"><span className={lbl}>نوع النموذج</span>
        <select className={field} value={preset}
          onChange={(e) => onChange({ ...section, fields_preset: e.target.value as any })}>
          <option value="default">قياسي (اسم/جوال/بريد/شركة/قطاع/مدينة/ميزانية/إطار زمني/رسالة)</option>
          <option value="business_visit">حجز زيارة موقعية (منشأة/مسؤول/جوال/نوع منشأة/مدينة/احتياج/وقت التواصل/ملاحظات)</option>
        </select>
      </label>
      <input className={field} placeholder="Kicker" value={section.kicker ?? ""} onChange={(e) => onChange({ ...section, kicker: e.target.value })} />
      <input className={field} placeholder="العنوان" value={section.heading ?? ""} onChange={(e) => onChange({ ...section, heading: e.target.value })} />
      <textarea className={ta + " sm:col-span-2"} placeholder="الوصف" value={section.description ?? ""} onChange={(e) => onChange({ ...section, description: e.target.value })} />
      <input className={field} placeholder="Anchor (افتراضي: quote)" value={section.form_anchor ?? ""} onChange={(e) => onChange({ ...section, form_anchor: e.target.value })} />
      <input className={field} placeholder="tag المصدر (افتراضي: business_lead)" value={section.lead_source ?? ""} onChange={(e) => onChange({ ...section, lead_source: e.target.value })} />
      <input className={field} placeholder="نص زر الإرسال" value={section.submit_label ?? ""} onChange={(e) => onChange({ ...section, submit_label: e.target.value })} />
      <input className={field} placeholder="رسالة النجاح" value={section.success_message ?? ""} onChange={(e) => onChange({ ...section, success_message: e.target.value })} />
      <input className={field} placeholder="نص زر واتساب البديل" value={section.whatsapp_fallback_label ?? ""} onChange={(e) => onChange({ ...section, whatsapp_fallback_label: e.target.value })} />
      <input className={field} placeholder="رسالة واتساب البديلة" value={section.whatsapp_fallback_template ?? ""} onChange={(e) => onChange({ ...section, whatsapp_fallback_template: e.target.value })} />
      <input className={field + " sm:col-span-2"} placeholder="ملاحظة تحت النموذج" value={section.contact_note ?? ""} onChange={(e) => onChange({ ...section, contact_note: e.target.value })} />
      <div className="sm:col-span-2 space-y-2">
        {preset === "business_visit" ? (
          <>
            {listEditor("facility_types", "أنواع المنشآت")}
            {listEditor("need_types", "أنواع الاحتياج")}
            {listEditor("preferred_times", "الأوقات المناسبة للتواصل")}
          </>
        ) : (
          <>
            {listEditor("industries", "قائمة القطاعات")}
            {listEditor("budgets", "شرائح الميزانية")}
            {listEditor("timelines", "الإطار الزمني")}
          </>
        )}
      </div>
    </div>
  );
}

function PortalMockupEditor({ section, onChange }: Props<PortalMockupSection>) {
  const setTile = (i: number, patch: Partial<PortalMockupSection["tiles"][number]>) => {
    const tiles = section.tiles.slice(); tiles[i] = { ...tiles[i], ...patch }; onChange({ ...section, tiles });
  };
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={field} placeholder="Kicker" value={section.kicker ?? ""} onChange={(e) => onChange({ ...section, kicker: e.target.value })} />
        <input className={field} placeholder="العنوان" value={section.heading ?? ""} onChange={(e) => onChange({ ...section, heading: e.target.value })} />
        <textarea className={ta + " sm:col-span-2"} placeholder="الوصف" value={section.description ?? ""} onChange={(e) => onChange({ ...section, description: e.target.value })} />
        <input className={field} placeholder="اسم مؤشر الحالة (حالة الحوض)" value={section.status_label ?? ""} onChange={(e) => onChange({ ...section, status_label: e.target.value })} />
        <input className={field} placeholder="قيمة الحالة (ممتازة)" value={section.status_value ?? ""} onChange={(e) => onChange({ ...section, status_value: e.target.value })} />
        <input className={field} placeholder="اسم المؤشر (Health Score)" value={section.score_label ?? ""} onChange={(e) => onChange({ ...section, score_label: e.target.value })} />
        <input className={field} placeholder="قيمة المؤشر (94)" value={section.score_value ?? ""} onChange={(e) => onChange({ ...section, score_value: e.target.value })} />
        <input className={field} placeholder="عنوان آخر زيارة" value={section.last_visit_label ?? ""} onChange={(e) => onChange({ ...section, last_visit_label: e.target.value })} />
        <input className={field} placeholder="قيمة آخر زيارة" value={section.last_visit_value ?? ""} onChange={(e) => onChange({ ...section, last_visit_value: e.target.value })} />
        <input className={field + " sm:col-span-2"} placeholder="ملاحظة أسفل البوابة" value={section.note ?? ""} onChange={(e) => onChange({ ...section, note: e.target.value })} />
      </div>
      <div className="text-xs text-muted-foreground">بطاقات جانبية:</div>
      {section.tiles.map((t, i) => (
        <div key={t.id} className="rounded-xl border border-white/10 p-3 grid gap-2 sm:grid-cols-[120px_1fr_1fr_auto]">
          <input className={field} placeholder="أيقونة" value={t.icon} onChange={(e) => setTile(i, { icon: e.target.value })} />
          <input className={field} placeholder="التسمية" value={t.label} onChange={(e) => setTile(i, { label: e.target.value })} />
          <input className={field} placeholder="القيمة" value={t.value} onChange={(e) => setTile(i, { value: e.target.value })} />
          <button type="button" onClick={() => onChange({ ...section, tiles: section.tiles.filter((_, k) => k !== i) })}
            className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ ...section, tiles: [...section.tiles, { id: newId(), icon: "Sparkles", label: "", value: "" }] })}
        className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1"><Plus size={14} /> أضف بطاقة</button>
    </div>
  );
}


export function SectionCard({

  section, index, total, onChange, onDelete, onMoveUp, onMoveDown,
}: {
  section: Section;
  index: number;
  total: number;
  onChange: (s: Section) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-md bg-white/5 border border-white/10">{SECTION_TYPE_LABELS[section.type]}</span>
          <span className="text-[11px] text-muted-foreground">#{index + 1}</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onChange({ ...section, enabled: !section.enabled })}
            title={section.enabled ? "إخفاء" : "إظهار"}
            className={`px-3 py-2 rounded-xl border text-xs ${section.enabled ? "border-white/10 bg-white/5" : "border-yellow-400/30 bg-yellow-400/10 text-yellow-300"}`}>
            {section.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button type="button" disabled={index === 0} onClick={onMoveUp}
            className="px-3 py-2 rounded-xl border border-white/10 text-xs disabled:opacity-40"><ArrowUp size={14} /></button>
          <button type="button" disabled={index === total - 1} onClick={onMoveDown}
            className="px-3 py-2 rounded-xl border border-white/10 text-xs disabled:opacity-40"><ArrowDown size={14} /></button>
          <button type="button" onClick={onDelete}
            className="px-3 py-2 rounded-xl border border-red-400/20 text-red-300 text-xs"><Trash2 size={14} /></button>
        </div>
      </div>
      {section.type === "hero" && <HeroEditor section={section} onChange={onChange as any} />}
      {section.type === "badge_grid" && <BadgeGridEditor section={section} onChange={onChange as any} />}
      {section.type === "pricing_groups" && <PricingGroupsEditor section={section} onChange={onChange as any} />}
      {section.type === "checklist" && <ChecklistEditor section={section} onChange={onChange as any} />}
      {section.type === "cta_band" && <CtaBandEditor section={section} onChange={onChange as any} />}
      {section.type === "rich_text" && <RichTextEditor section={section} onChange={onChange as any} />}
      {section.type === "link_cards" && <LinkCardsEditor section={section} onChange={onChange as any} />}
      {section.type === "step_list" && <StepListEditor section={section} onChange={onChange as any} />}
      {section.type === "faq" && <FaqEditor section={section} onChange={onChange as any} />}
      {section.type === "dynamic_slot" && <DynamicSlotEditor section={section} onChange={onChange as any} />}
      {section.type === "business_tabs" && <BusinessTabsEditor section={section} onChange={onChange as any} />}
      {section.type === "media_hero" && <MediaHeroEditor section={section} onChange={onChange as any} />}
      {section.type === "stat_bar" && <StatBarEditor section={section} onChange={onChange as any} />}
      {section.type === "feature_grid" && <FeatureGridEditor section={section} onChange={onChange as any} />}
      {section.type === "case_studies" && <CaseStudiesEditor section={section} onChange={onChange as any} />}
      {section.type === "sla_tiers" && <SlaTiersEditor section={section} onChange={onChange as any} />}
      {section.type === "lead_form" && <LeadFormEditor section={section} onChange={onChange as any} />}
      {section.type === "portal_mockup" && <PortalMockupEditor section={section} onChange={onChange as any} />}
    </div>
  );
}


