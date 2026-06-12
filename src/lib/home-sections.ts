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

export type HeroContent = {
  title: string;
  subtitle: string;
  description: string;
  primary_cta_label: string;
  primary_cta_href: string;
  secondary_cta_label: string;
  secondary_cta_href: string;
  image_path: string;
  overlay_enabled: boolean;
  overlay_opacity: number;
};

export type ExploreItem = {
  id: string;
  icon: string | null;
  emoji: string | null;
  label: string;
  desc: string;
  href: string;
  order: number;
  visible: boolean;
};
export type ExploreContent = {
  kicker: string;
  heading: string;
  subtitle: string;
  items: ExploreItem[];
};

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

export type HomeSection<T = unknown> = {
  id: string;
  section_key: string;
  enabled: boolean;
  content: T;
  updated_at: string;
};

export async function fetchHomeSections() {
  const { data, error } = await supabase
    .from("home_sections")
    .select("*")
    .in("section_key", ["hero", "explore", "services"]);
  if (error) throw error;
  const map: Record<string, HomeSection> = {};
  (data ?? []).forEach((r: any) => { map[r.section_key] = r as HomeSection; });
  return {
    hero: map.hero as HomeSection<HeroContent> | undefined,
    explore: map.explore as HomeSection<ExploreContent> | undefined,
    services: map.services as HomeSection<ServicesContent> | undefined,
  };
}

export async function saveHomeSection(section_key: string, enabled: boolean, content: unknown) {
  const { error } = await supabase
    .from("home_sections")
    .upsert({ section_key, enabled, content: content as any }, { onConflict: "section_key" });
  if (error) throw error;
}

export function genId() {
  return Math.random().toString(36).slice(2, 10);
}
