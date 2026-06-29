import { Eye, EyeOff, Trash2, ArrowUp, ArrowDown, Plus } from "lucide-react";
import { ImageUploader } from "@/components/ImageUploader";
import type {
  Section, HeroSection, BadgeGridSection, PricingGroupsSection,
  ChecklistSection, CtaBandSection, RichTextSection,
  LinkCardsSection, StepListSection, FaqSection, DynamicSlotSection,
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
    </div>
  );
}
