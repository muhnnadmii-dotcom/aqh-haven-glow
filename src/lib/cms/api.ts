import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PageDoc } from "./types";
import { getPageMeta } from "./registry";
import { useLang } from "@/lib/i18n/LangProvider";

export async function fetchPageDoc(page_key: string, lang: "ar" | "en" = "ar"): Promise<PageDoc> {
  const { data, error } = await supabase
    .from("site_pages")
    .select("content, content_en")
    .eq("page_key", page_key)
    .maybeSingle();
  if (error) throw error;
  const meta = getPageMeta(page_key);
  const defaultsAr = meta?.defaults ?? { sections: [] };
  const defaultsEn = meta?.defaults_en ?? defaultsAr;

  const row: any = data ?? {};
  const pickedRaw = lang === "en" ? (row.content_en ?? row.content ?? null) : (row.content ?? null);
  const picked: any = pickedRaw;
  if (picked && Array.isArray(picked?.sections) && picked.sections.length > 0) {
    return picked as PageDoc;
  }
  return lang === "en" ? defaultsEn : defaultsAr;
}


export async function savePageDoc(page_key: string, doc: PageDoc, title?: string) {
  const payload: any = { page_key, content: doc as any };
  if (title !== undefined) payload.title = title;
  const { error } = await supabase
    .from("site_pages")
    .upsert(payload, { onConflict: "page_key" });
  if (error) throw error;
}

export async function savePageDocEn(page_key: string, doc: PageDoc, title_en?: string) {
  const payload: any = { page_key, content_en: doc as any };
  if (title_en !== undefined) payload.title_en = title_en;
  const { error } = await supabase
    .from("site_pages")
    .upsert(payload, { onConflict: "page_key" });
  if (error) throw error;
}

/** React hook: fetch a CMS page doc for the current language, with default fallback. */
export function usePageDoc(page_key: string) {
  const { lang } = useLang();
  const q = useQuery({
    queryKey: ["cms_page", page_key, lang],
    queryFn: () => fetchPageDoc(page_key, lang),
    staleTime: 30_000,
  });
  return { doc: q.data ?? null, loading: q.isLoading, error: q.error as Error | null };
}
