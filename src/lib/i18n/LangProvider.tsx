import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { baseT, type Lang, type StringKey } from "./strings";

type Ctx = {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  t: (key: StringKey | string) => string;
};

const LangContext = createContext<Ctx>({
  lang: "ar",
  dir: "rtl",
  setLang: () => {},
  t: (k) => baseT(k as StringKey, "ar"),
});

const STORAGE_KEY = "aqh_lang";

function readInitialLang(): Lang {
  if (typeof window === "undefined") return "ar";
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("lang");
    if (q === "en" || q === "ar") return q;
    if (url.pathname === "/en" || url.pathname.startsWith("/en/")) return "en";
    const s = window.localStorage.getItem(STORAGE_KEY);
    if (s === "en" || s === "ar") return s as Lang;
  } catch {
    /* ignore */
  }
  return "ar";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  const qc = useQueryClient();

  // Hydrate on mount (client only)
  useEffect(() => {
    const initial = readInitialLang();
    setLangState(initial);
  }, []);

  // Fetch UI translations overrides from DB
  const { data: overrides } = useQuery({
    queryKey: ["ui_translations_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ui_translations").select("key, ar, en");
      if (error) throw error;
      const map: Record<string, { ar: string; en: string }> = {};
      for (const r of data ?? []) map[r.key] = { ar: r.ar ?? "", en: r.en ?? "" };
      return map;
    },
    staleTime: 60_000,
  });

  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l);
      try {
        window.localStorage.setItem(STORAGE_KEY, l);
        const url = new URL(window.location.href);
        if (l === "en") url.searchParams.set("lang", "en");
        else url.searchParams.delete("lang");
        window.history.replaceState(null, "", url.toString());
      } catch {
        /* ignore */
      }
      // refetch CMS content in new language
      qc.invalidateQueries({ queryKey: ["cms_page"] });
    },
    [qc],
  );

  const dir: "ltr" | "rtl" = lang === "en" ? "ltr" : "rtl";

  // Sync <html lang/dir>
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const t = useCallback(
    (key: string) => {
      const o = overrides?.[key];
      if (o) {
        const v = lang === "en" ? o.en : o.ar;
        if (v && v.trim()) return v;
      }
      return baseT(key as StringKey, lang);
    },
    [lang, overrides],
  );

  const value = useMemo(() => ({ lang, dir, setLang, t }), [lang, dir, setLang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

export function useT() {
  return useContext(LangContext).t;
}
