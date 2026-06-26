// CMS section types — discriminated union by `type`.
// Each section: { id, type, enabled, ...data }

export type SectionBase = {
  id: string;
  enabled: boolean;
};

export type HeroSection = SectionBase & {
  type: "hero";
  kicker?: string;
  title: string;
  description?: string;
  image_path?: string;
};

export type BadgeItem = { id: string; icon: string; title: string; desc: string };
export type BadgeGridSection = SectionBase & {
  type: "badge_grid";
  items: BadgeItem[];
};

export type PricingTier = { id: string; size: string; price: string; freq: string };
export type PricingGroup = { id: string; heading: string; desc?: string; tiers: PricingTier[] };
export type PricingGroupsSection = SectionBase & {
  type: "pricing_groups";
  whatsapp_template: string; // "السلام عليكم، أرغب بباقة صيانة لحوض {group} — {tier}."
  cta_label: string;
  items: PricingGroup[];
};

export type ChecklistSection = SectionBase & {
  type: "checklist";
  heading: string;
  items: { id: string; text: string }[];
};

export type CtaBandSection = SectionBase & {
  type: "cta_band";
  heading: string;
  description?: string;
  primary_label: string;
  primary_whatsapp_template?: string;
  primary_href?: string;
  secondary_label?: string;
  secondary_href?: string;
};

export type RichTextSection = SectionBase & {
  type: "rich_text";
  heading?: string;
  body: string;
};

export type Section =
  | HeroSection
  | BadgeGridSection
  | PricingGroupsSection
  | ChecklistSection
  | CtaBandSection
  | RichTextSection;

export type SectionType = Section["type"];

export type PageDoc = {
  sections: Section[];
};

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  hero: "بانر علوي (Hero)",
  badge_grid: "شبكة مزايا (أيقونات)",
  pricing_groups: "مجموعات أسعار",
  checklist: "قائمة تحقق",
  cta_band: "شريط دعوة (CTA)",
  rich_text: "نص حر",
};

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function emptySection(type: SectionType): Section {
  const base = { id: newId(), enabled: true };
  switch (type) {
    case "hero":
      return { ...base, type, kicker: "", title: "عنوان جديد", description: "" };
    case "badge_grid":
      return { ...base, type, items: [] };
    case "pricing_groups":
      return { ...base, type, whatsapp_template: "السلام عليكم، أرغب بـ {group} — {tier}.", cta_label: "اطلب الآن", items: [] };
    case "checklist":
      return { ...base, type, heading: "ماذا يشمل؟", items: [] };
    case "cta_band":
      return { ...base, type, heading: "ابدأ الآن", description: "", primary_label: "تواصل واتساب", primary_whatsapp_template: "السلام عليكم", secondary_label: "نموذج التواصل", secondary_href: "/contact" };
    case "rich_text":
      return { ...base, type, heading: "", body: "" };
  }
}
