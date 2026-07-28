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
  whatsapp_template: string;
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
  columns?: number;
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

export type DynamicSlotSection = SectionBase & {
  type: "dynamic_slot";
  slot: string;
  note?: string;
};

export type BusinessTabItem = {
  id: string;
  icon: string;
  title: string;
  tagline: string;
  idea: string;
  features: { id: string; text: string }[];
  concerns: { id: string; q: string; a: string }[];
  payment: { id: string; text: string }[];
  images: { id: string; path: string }[];
  cta: string;
};
export type BusinessTabsSection = SectionBase & {
  type: "business_tabs";
  heading?: string;
  kicker?: string;
  description?: string;
  tab_badge_prefix?: string;
  features_heading?: string;
  concerns_heading?: string;
  payment_heading?: string;
  cta_heading?: string;
  cta_button_label?: string;
  items: BusinessTabItem[];
};

// ─── B2B / enterprise reusable sections ─────────────────────────────────────
export type MediaHeroBadge = { id: string; text: string };
export type MediaHeroSection = SectionBase & {
  type: "media_hero";
  kicker?: string;
  title: string;
  title_highlight?: string;
  description?: string;
  image_path?: string;
  primary_label?: string;
  primary_href?: string;
  primary_whatsapp_template?: string;
  secondary_label?: string;
  secondary_href?: string;
  secondary_whatsapp_template?: string;
  badges?: MediaHeroBadge[];
  // Overlay controls (all optional; safe defaults preserve current look)
  overlay_enabled?: boolean;         // default true
  overlay_mode?: "solid" | "gradient"; // default "gradient"
  overlay_color?: string;            // solid mode color, e.g. "#000000"
  overlay_opacity?: number;          // 0..100, solid mode
  overlay_from_color?: string;       // gradient start color
  overlay_from_opacity?: number;     // 0..100
  overlay_to_color?: string;         // gradient end color
  overlay_to_opacity?: number;       // 0..100
};


export type StatItem = { id: string; icon: string; value: string; label: string };
export type StatBarSection = SectionBase & {
  type: "stat_bar";
  items: StatItem[];
};

export type FeatureItem = { id: string; icon: string; title: string; desc: string };
export type FeatureGridSection = SectionBase & {
  type: "feature_grid";
  kicker?: string;
  heading?: string;
  subheading?: string;
  columns?: number;
  items: FeatureItem[];
};

export type CaseStudyItem = {
  id: string;
  image_path: string;
  category: string;
  title: string;
  location?: string;
};
export type CaseStudiesSection = SectionBase & {
  type: "case_studies";
  kicker?: string;
  heading?: string;
  subheading?: string;
  items: CaseStudyItem[];
};

export type SlaFeature = { id: string; text: string };
export type SlaTierItem = {
  id: string;
  name: string;
  badge?: string;
  price?: string;
  price_note?: string;
  cta_label?: string;
  cta_whatsapp_template?: string;
  features: SlaFeature[];
  highlighted?: boolean;
};
export type SlaTiersSection = SectionBase & {
  type: "sla_tiers";
  kicker?: string;
  heading?: string;
  subheading?: string;
  items: SlaTierItem[];
};

export type LeadIndustry = { id: string; label: string };
export type LeadBudget = { id: string; label: string };
export type LeadTimeline = { id: string; label: string };
export type LeadFormSection = SectionBase & {
  type: "lead_form";
  kicker?: string;
  heading?: string;
  description?: string;
  form_anchor?: string;
  submit_label?: string;
  success_message?: string;
  whatsapp_fallback_label?: string;
  whatsapp_fallback_template?: string;
  contact_note?: string;
  // "default" = full corporate form; "business_visit" = reduced site-visit form
  fields_preset?: "default" | "business_visit";
  industries: LeadIndustry[];
  budgets: LeadBudget[];
  timelines: LeadTimeline[];
  // Used when fields_preset === "business_visit"
  facility_types?: LeadIndustry[];
  need_types?: LeadIndustry[];
  preferred_times?: LeadIndustry[];
  lead_source?: string;
};

// ─── Portal mockup (visual dashboard preview, editable content) ─────────────
export type PortalMockupTileItem = { id: string; icon: string; label: string; value: string };
export type PortalMockupSection = SectionBase & {
  type: "portal_mockup";
  kicker?: string;
  heading?: string;
  description?: string;
  status_label?: string;      // e.g. "حالة الحوض"
  status_value?: string;      // e.g. "ممتازة"
  score_label?: string;       // e.g. "Health Score"
  score_value?: string;       // e.g. "94"
  last_visit_label?: string;  // e.g. "آخر زيارة"
  last_visit_value?: string;  // e.g. "قبل 5 أيام"
  tiles: PortalMockupTileItem[]; // side tiles (reports, photos, invoices, contract, log …)
  note?: string;              // e.g. "المحتوى المعروض تصوري"
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
  | BusinessTabsSection
  | MediaHeroSection
  | StatBarSection
  | FeatureGridSection
  | CaseStudiesSection
  | SlaTiersSection
  | LeadFormSection
  | PortalMockupSection;


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
  media_hero: "بانر مؤسسي (خلفية صورة + CTA)",
  stat_bar: "شريط أرقام (Stats)",
  feature_grid: "شبكة ميزات موسّعة",
  case_studies: "معرض مشاريع (Case Studies)",
  sla_tiers: "باقات SLA / خدمة",
  lead_form: "نموذج طلب عرض سعر (Lead)",
  portal_mockup: "بوابة العميل (Portal Mockup)",
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
    case "business_tabs":
      return { ...base, type, heading: "حلول لأصحاب الأعمال", kicker: "BUSINESS", description: "", items: [] };
    case "media_hero":
      return {
        ...base, type,
        kicker: "ENTERPRISE",
        title: "شريكك الموثوق في",
        title_highlight: "أنظمة الأحواض المؤسسية",
        description: "نصمم وننفذ ونصون أنظمة أحواض بمعايير عالمية.",
        image_path: "",
        primary_label: "اطلب عرض سعر",
        primary_href: "#quote",
        secondary_label: "احجز استشارة",
        secondary_whatsapp_template: "السلام عليكم، أرغب بحجز استشارة مؤسسية.",
        badges: [],
      };
    case "stat_bar":
      return { ...base, type, items: [] };
    case "feature_grid":
      return { ...base, type, kicker: "", heading: "", subheading: "", columns: 3, items: [] };
    case "case_studies":
      return { ...base, type, kicker: "PORTFOLIO", heading: "معرض مشاريع", items: [] };
    case "sla_tiers":
      return { ...base, type, kicker: "SLA", heading: "باقات الخدمة", items: [] };
    case "lead_form":
      return {
        ...base, type,
        kicker: "REQUEST QUOTE",
        heading: "اطلب عرض سعر مؤسسي",
        description: "عبّئ التفاصيل التالية وسيتواصل معك مدير حسابات خلال يوم عمل.",
        form_anchor: "quote",
        submit_label: "إرسال الطلب",
        success_message: "تم استلام طلبك — سيتواصل معك فريقنا قريبًا.",
        whatsapp_fallback_label: "أو تواصل عبر واتساب",
        whatsapp_fallback_template: "السلام عليكم، أرغب بالاستفسار عن حلول أكوا هيفن المؤسسية.",
        contact_note: "بياناتك سرّية ولا تُشارك مع أي جهة خارجية.",
        industries: [
          { id: newId(), label: "جهة حكومية" },
          { id: newId(), label: "فندق / منتجع" },
          { id: newId(), label: "مطعم / كافيه" },
          { id: newId(), label: "مكتب / شركة" },
          { id: newId(), label: "مول / مركز تسوق" },
          { id: newId(), label: "مستشفى / عيادة" },
          { id: newId(), label: "مدرسة / جامعة" },
          { id: newId(), label: "أخرى" },
        ],
        budgets: [
          { id: newId(), label: "أقل من 25,000 ر.س" },
          { id: newId(), label: "25,000 – 75,000 ر.س" },
          { id: newId(), label: "75,000 – 200,000 ر.س" },
          { id: newId(), label: "أكثر من 200,000 ر.س" },
        ],
        timelines: [
          { id: newId(), label: "خلال شهر" },
          { id: newId(), label: "خلال 1–3 أشهر" },
          { id: newId(), label: "خلال 3–6 أشهر" },
          { id: newId(), label: "غير محدد" },
        ],
        lead_source: "business_lead",
      };
    case "portal_mockup":
      return {
        ...base, type,
        kicker: "CLIENT PORTAL",
        heading: "كل تفاصيل تجربتك في مكان واحد",
        description: "يحصل كل عميل على بوابة مخصصة لمتابعة حالة الحوض والزيارات والتقارير والملفات.",
        status_label: "حالة الحوض",
        status_value: "ممتازة",
        score_label: "Health Score",
        score_value: "94",
        last_visit_label: "آخر زيارة",
        last_visit_value: "قبل 5 أيام",
        note: "المحتوى المعروض تصوري لعرض شكل البوابة.",
        tiles: [
          { id: newId(), icon: "Camera",       label: "الصور",         value: "12 صورة" },
          { id: newId(), icon: "FileText",     label: "التقارير",      value: "3 تقارير" },
          { id: newId(), icon: "Receipt",      label: "الفواتير",      value: "متوفرة" },
          { id: newId(), icon: "ClipboardList",label: "سجل الخدمة",    value: "8 زيارات" },
          { id: newId(), icon: "FileCheck2",   label: "العقد",         value: "ساري" },
          { id: newId(), icon: "Wrench",       label: "طلبات الدعم",   value: "بدون طلبات مفتوحة" },
        ],
      };
  }
}

