import { supabase } from "@/integrations/supabase/client";

export type AboutContent = {
  hero: { kicker: string; heading: string; description: string; image_path: string };
  story: { kicker: string; heading: string; body: string };
  vision: { kicker: string; heading: string; body: string };
  values_kicker: string;
  values_heading: string;
  values: { id: string; icon: string; title: string; desc: string; order: number; visible: boolean }[];
  stats: { id: string; value: string; label: string; order: number; visible: boolean }[];
  cta: { kicker: string; heading: string; body: string; button_label: string; button_href: string; visible: boolean };
};

export type SocialItem = {
  id: string;
  platform: "instagram" | "tiktok" | "twitter" | "snapchat" | "youtube" | "facebook" | "linkedin" | "whatsapp" | "other";
  label: string;
  href: string;
  visible: boolean;
};

export type ContactContent = {
  hero: { kicker: string; heading: string; description: string };
  city: string;
  phone: string;
  whatsapp_number: string;
  email: string;
  working_hours: string;
  socials: SocialItem[];
  whatsapp_card: { title: string; subtitle: string; button_label: string; visible: boolean };
  form: { submit_label: string; success_message: string; intro: string };
  request_types: string[];
};

export async function fetchSitePage<T = unknown>(page_key: string): Promise<{ content: T; title: string | null } | null> {
  const { data, error } = await supabase
    .from("site_pages")
    .select("content, title")
    .eq("page_key", page_key)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { content: data.content as unknown as T, title: data.title };
}

export async function saveSitePage(page_key: string, content: unknown, title?: string) {
  const payload: any = { page_key, content: content as any };
  if (title !== undefined) payload.title = title;
  const { error } = await supabase.from("site_pages").upsert(payload, { onConflict: "page_key" });
  if (error) throw error;
}

export function newId() { return Math.random().toString(36).slice(2, 10); }
