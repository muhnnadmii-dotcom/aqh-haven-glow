import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lang } from "@/lib/i18n/strings";

export type NavLocation = "navbar" | "footer_quick";

export type SiteNavLink = {
  id: string;
  location: NavLocation;
  label: string;
  label_en?: string | null;
  href: string;
  sort_order: number;
  visible: boolean;
  external: boolean;
  open_in_new_tab: boolean;
};

/** Pick the label matching the current UI language, with graceful fallback. */
export function navLabel(l: SiteNavLink, lang: Lang): string {
  if (lang === "en") return (l.label_en && l.label_en.trim()) || l.label;
  return l.label || l.label_en || "";
}

export const NAVBAR_FALLBACK: SiteNavLink[] = [
  { id: "n1", location: "navbar", label: "الرئيسية",       label_en: "Home",               href: "/",                    sort_order: 10, visible: true, external: false, open_in_new_tab: false },
  { id: "n2", location: "navbar", label: "أعمالنا",        label_en: "Our Work",           href: "/portfolio",           sort_order: 20, visible: true, external: false, open_in_new_tab: false },
  { id: "n3", location: "navbar", label: "الخدمات",        label_en: "Services",           href: "/services",            sort_order: 30, visible: true, external: false, open_in_new_tab: false },
  { id: "n4", location: "navbar", label: "الصيانة",        label_en: "Maintenance",        href: "/maintenance",         sort_order: 40, visible: true, external: false, open_in_new_tab: false },
  { id: "n5", location: "navbar", label: "حلول الأعمال",   label_en: "Business Solutions", href: "/business-solutions",  sort_order: 50, visible: true, external: false, open_in_new_tab: false },
  { id: "n6", location: "navbar", label: "مركز المعرفة",   label_en: "Knowledge",          href: "/knowledge",           sort_order: 60, visible: true, external: false, open_in_new_tab: false },
  { id: "n7", location: "navbar", label: "تواصل معنا",     label_en: "Contact",            href: "/contact",             sort_order: 70, visible: true, external: false, open_in_new_tab: false },
];

export const FOOTER_FALLBACK: SiteNavLink[] = [
  { id: "f1", location: "footer_quick", label: "أعمالنا",      label_en: "Our Work",   href: "/portfolio", sort_order: 10, visible: true, external: false, open_in_new_tab: false },
  { id: "f2", location: "footer_quick", label: "خدماتنا",      label_en: "Services",   href: "/services",  sort_order: 20, visible: true, external: false, open_in_new_tab: false },
  { id: "f3", location: "footer_quick", label: "الكاتلوج",     label_en: "Catalog",    href: "/catalog",   sort_order: 30, visible: true, external: false, open_in_new_tab: false },
  { id: "f4", location: "footer_quick", label: "مركز المعرفة", label_en: "Knowledge",  href: "/knowledge", sort_order: 40, visible: true, external: false, open_in_new_tab: false },
  { id: "f5", location: "footer_quick", label: "من نحن",       label_en: "About",      href: "/about",     sort_order: 50, visible: true, external: false, open_in_new_tab: false },
];

export async function fetchNavLinks(location: NavLocation): Promise<SiteNavLink[]> {
  const { data, error } = await supabase
    .from("site_nav_links" as any)
    .select("*")
    .eq("location", location)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as SiteNavLink[];
}

export function useNavLinks(location: NavLocation, fallback: SiteNavLink[]) {
  const [links, setLinks] = useState<SiteNavLink[]>(fallback);
  useEffect(() => {
    let alive = true;
    fetchNavLinks(location)
      .then((rows) => { if (alive && rows.length) setLinks(rows.filter((r) => r.visible)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [location]);
  return links;
}

export async function createNavLink(input: Omit<SiteNavLink, "id">) {
  const { error } = await supabase.from("site_nav_links" as any).insert(input as any);
  if (error) throw error;
}

export async function updateNavLink(id: string, patch: Partial<Omit<SiteNavLink, "id" | "location">>) {
  const { error } = await supabase.from("site_nav_links" as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deleteNavLink(id: string) {
  const { error } = await supabase.from("site_nav_links" as any).delete().eq("id", id);
  if (error) throw error;
}

export async function reorderNavLinks(ids: string[]) {
  await Promise.all(
    ids.map((id, idx) =>
      supabase.from("site_nav_links" as any).update({ sort_order: (idx + 1) * 10 } as any).eq("id", id)
    )
  );
}
