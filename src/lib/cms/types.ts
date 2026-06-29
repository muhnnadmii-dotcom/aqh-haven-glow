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

export type LinkCardItem = { id: string; title: string; desc?: string; href: string };
export type LinkCardsSection = SectionBase & {
  type: "link_cards";
  heading?: string;
  subheading?: string;
  columns?: number; // 2..5
  items: LinkCardItem[];
};

export type StepListSection = SectionBase & {
  type: "step_list";
  heading?: string;
  items: { id: string; text: string }[];
};

export type FaqItem = { id: string; q: string; a: string };
export type FaqSection = SectionBase & {
  type: "faq";
  heading?: string;
  items: FaqItem[];
};

// Renders a built-in dynamic block in place (e.g. the services list grid).
export type DynamicSlotSection = SectionBase & {
  type: "dynamic_slot";
  slot: string; // e.g. "services_grid"
  note?: string;
};

// Multi-tab business solutions block (cafes/restaurants/events/...).
export type BusinessTabItem = {
  id: string;
  icon: string; // lucide icon name
  title: string;
  tagline: string;
  idea: string;
  features: { id: string; text: string }[];
  concerns: { id: string; q: string; a: string }[];
  payment: { id: string; text: string }[];
  images: { id: string; path: string }[]; // storage path or absolute URL
  cta: string; // whatsapp message template
};
export type BusinessTabsSection = SectionBase & {
  type: "business_tabs";
  heading?: string;
  kicker?: string;
  description?: string;
  items: BusinessTabItem[];
};

export type Section =
  | HeroSection
  | BadgeGridSection
  | PricingGroupsSection
  | ChecklistSection
  | CtaBandSection
  | RichTextSection
  | LinkCardsSection
  | StepListSection
  | FaqSection
  | DynamicSlotSection
  | BusinessTabsSection;

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
  link_cards: "بطاقات روابط",
  step_list: "قائمة خطوات مرقّمة",
  faq: "أسئلة شائعة",
  dynamic_slot: "محتوى ديناميكي (قائمة تلقائية)",
  business_tabs: "تبويبات حلول الأعمال",
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
    case "link_cards":
      return { ...base, type, heading: "اختر ما يناسبك", subheading: "", columns: 5, items: [] };
    case "step_list":
      return { ...base, type, heading: "طريقة العمل", items: [] };
    case "faq":
      return { ...base, type, heading: "الأسئلة الشائعة", items: [] };
    case "dynamic_slot":
      return { ...base, type, slot: "services_grid", note: "" };
  }
}

