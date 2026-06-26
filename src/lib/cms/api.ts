import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PageDoc } from "./types";
import { getPageMeta } from "./registry";

export async function fetchPageDoc(page_key: string): Promise<PageDoc> {
  const { data, error } = await supabase
    .from("site_pages")
    .select("content")
    .eq("page_key", page_key)
    .maybeSingle();
  if (error) throw error;
  const meta = getPageMeta(page_key);
  const fallback = meta?.defaults ?? { sections: [] };
  if (!data?.content) return fallback;
  const c = data.content as any;
  if (Array.isArray(c?.sections) && c.sections.length > 0) return c as PageDoc;
  // empty sections or legacy/unknown shape → fallback to defaults
  return fallback;
}

export async function savePageDoc(page_key: string, doc: PageDoc, title?: string) {
  const payload: any = { page_key, content: doc as any };
  if (title !== undefined) payload.title = title;
  const { error } = await supabase
    .from("site_pages")
    .upsert(payload, { onConflict: "page_key" });
  if (error) throw error;
}

/** React hook: fetch a CMS page doc with default fallback. */
export function usePageDoc(page_key: string) {
  const [doc, setDoc] = useState<PageDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPageDoc(page_key)
      .then((d) => { if (alive) { setDoc(d); setError(null); } })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [page_key]);

  return { doc, loading, error };
}
