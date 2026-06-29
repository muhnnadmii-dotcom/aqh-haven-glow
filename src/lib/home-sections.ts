import { supabase } from "@/integrations/supabase/client";
import {
  Briefcase, Sparkles, Wrench, MessagesSquare, BookOpen, Users, Phone,
  Fish, Building2, Star, Quote, Search, PenTool, Hammer, LifeBuoy, BadgeCheck,
  Home, Settings, Heart, Shield, Mail, MapPin, Camera,
  type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  Briefcase, Sparkles, Wrench, MessagesSquare, BookOpen, Users, Phone,
  Fish, Building2, Star, Quote, Search, PenTool, Hammer, LifeBuoy, BadgeCheck,
  Home, Settings, Heart, Shield, Mail, MapPin, Camera,
};
export const ICON_NAMES = Object.keys(ICONS);

export type StatItem = { id: string; value: number; suffix: string; label: string };

export type HeroContent = {
  title: string;
  subtitle: string;
  description: string;
  primary_cta_label: string;
  primary_cta_href: string;
  secondary_cta_label: string;
  secondary_cta_href: string;
  image_path: string;
  image_path_mobile?: string;
  mobile_image_enabled?: boolean;
  overlay_enabled: boolean;
  overlay_opacity: number;
  stats?: StatItem[];
};

export type PartnerItem = {
  id: string;
  label: string;
  order: number;
  visible: boolean;
  display_type?: "text" | "image";
  logo_path?: string | null;
};
export type PartnersContent = { title: string; items: PartnerItem[] };

export type ExploreItem = {
  id: string;
  icon: string | null;
  emoji: string | null;
  label: string;
  desc: string;
  href: string;
  image_path: string;
  order: number;
  visible: boolean;
};
export type ExploreContent = {
  kicker: string;
  heading: string;
  subtitle: string;
  items: ExploreItem[];
};

export type HomeTestimonialItem = { id: string; name: string; rating: number; body: string };
export type HomeTestimonialsContent = { items: HomeTestimonialItem[] };


export type ServiceItem = {
  id: string;
  icon: string | null;
  title: string;
  desc: string;
  image_path: string;
  href: string;
  order: number;
  visible: boolean;
};
export type ServicesContent = {
  kicker: string;
  heading: string;
  description: string;
  items: ServiceItem[];
};

export type WhyUsItem = { id: string; icon: string | null; title: string; desc: string; order: number; visible: boolean };
export type WhyUsContent = { kicker: string; heading: string; description: string; link_label: string; link_href: string; items: WhyUsItem[] };

export type ProcessItem = { id: string; icon: string | null; number: string; title: string; desc: string; order: number; visible: boolean };
export type ProcessContent = { kicker: string; heading: string; description: string; items: ProcessItem[] };

export type FaqItem = { id: string; q: string; a: string; order: number; visible: boolean };
export type FaqContent = { kicker: string; heading: string; items: FaqItem[] };

export type CtaContent = {
  heading: string; description: string;
  primary_label: string; primary_href: string;
  secondary_label: string; secondary_href: string;
};

export type SectionHeader = { kicker: string; heading: string; subtitle?: string; link_label?: string; link_href?: string };

/* New CMS-managed section types (previously hardcoded on the homepage) */
export type ImageTextSplitContent = {
  kicker: string;
  kicker_icon: string | null;
  heading: string;
  description: string;
  image_path: string;
  image_side: "left" | "right";
  primary_label: string;
  primary_href: string;
  secondary_label: string;
  secondary_whatsapp: string;
};
export type WhatsappCtaContent = {
  heading: string;
  description: string;
  button_label: string;
  whatsapp_message: string;
};

export type HomeSection<T = unknown> = {
  id: string;
  section_key: string;
  section_type: string | null;
  sort_order: number;
  enabled: boolean;
  content: T;
  updated_at: string;
};

export type OrderedSection = {
  section_key: string;
  section_type: string | null;
  enabled: boolean;
  sort_order: number;
  content: any;
};

const ALL_KEYS = [
  "hero", "explore", "services", "why_us", "process", "faq", "cta", "partners",
  "testimonials_header", "knowledge_header", "homepage_testimonials",
  "featured_projects_header", "maintenance_teaser", "business_teaser", "final_whatsapp_cta",
] as const;

export async function fetchHomeSections() {
  const { data, error } = await supabase
    .from("home_sections")
    .select("*")
    .in("section_key", ALL_KEYS as unknown as string[]);
  if (error) throw error;
  const map: Record<string, HomeSection> = {};
  (data ?? []).forEach((r: any) => { map[r.section_key] = r as HomeSection; });
  return {
    hero: map.hero as HomeSection<HeroContent> | undefined,
    explore: map.explore as HomeSection<ExploreContent> | undefined,
    services: map.services as HomeSection<ServicesContent> | undefined,
    why_us: map.why_us as HomeSection<WhyUsContent> | undefined,
    process: map.process as HomeSection<ProcessContent> | undefined,
    faq: map.faq as HomeSection<FaqContent> | undefined,
    cta: map.cta as HomeSection<CtaContent> | undefined,
    partners: map.partners as HomeSection<PartnersContent> | undefined,
    testimonials_header: map.testimonials_header as HomeSection<SectionHeader> | undefined,
    knowledge_header: map.knowledge_header as HomeSection<SectionHeader> | undefined,
    homepage_testimonials: map.homepage_testimonials as HomeSection<HomeTestimonialsContent> | undefined,
    featured_projects_header: map.featured_projects_header as HomeSection<SectionHeader> | undefined,
    maintenance_teaser: map.maintenance_teaser as HomeSection<ImageTextSplitContent> | undefined,
    business_teaser: map.business_teaser as HomeSection<ImageTextSplitContent> | undefined,
    final_whatsapp_cta: map.final_whatsapp_cta as HomeSection<WhatsappCtaContent> | undefined,
  };
}

export async function fetchOrderedHomeSections(): Promise<OrderedSection[]> {
  const { data, error } = await supabase
    .from("home_sections")
    .select("section_key, section_type, enabled, sort_order, content")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as OrderedSection[];
}

export async function saveHomeSection(section_key: string, enabled: boolean, content: unknown) {
  const { error } = await supabase
    .from("home_sections")
    .upsert({ section_key, enabled, content: content as any }, { onConflict: "section_key" });
  if (error) throw error;
}

export async function updateSectionOrder(updates: { section_key: string; sort_order: number }[]) {
  for (const u of updates) {
    const { error } = await supabase
      .from("home_sections")
      .update({ sort_order: u.sort_order })
      .eq("section_key", u.section_key);
    if (error) throw error;
  }
}

export async function setSectionEnabled(section_key: string, enabled: boolean) {
  const { error } = await supabase
    .from("home_sections")
    .update({ enabled })
    .eq("section_key", section_key);
  if (error) throw error;
}

export const SECTION_LABELS: Record<string, string> = {
  customer_card: "بطاقة ترحيب العميل",
  hero: "البانر العلوي",
  explore: "استكشف أكوا هيفن",
  partners: "شريط الشركاء",
  services: "ماذا نقدم (هيدر + الخدمات)",
  why_us: "لماذا نحن",
  featured_projects_header: "هيدر المشاريع المميزة",
  process: "كيف نعمل",
  maintenance_teaser: "شريط الصيانة",
  business_teaser: "شريط حلول الأعمال",
  testimonials_header: "عنوان قسم التقييمات",
  homepage_testimonials: "تقييمات الرئيسية",
  knowledge_header: "عنوان قسم المقالات",
  faq: "الأسئلة الشائعة",
  cta: "شريط الدعوة (CTA)",
  final_whatsapp_cta: "شريط الواتساب النهائي",
};

export function genId() {
  return Math.random().toString(36).slice(2, 10);
}
