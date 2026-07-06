import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Sparkles, RefreshCw, Languages } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { STRINGS, ALL_UI_KEYS, baseT, type StringKey } from "@/lib/i18n/strings";
import { CMS_PAGES } from "@/lib/cms/registry";
import { fetchPageDoc, savePageDocEn } from "@/lib/cms/api";
import { translateBatch } from "@/lib/i18n/translate.functions";
import type { PageDoc, Section } from "@/lib/cms/types";

export const Route = createFileRoute("/_authenticated/admin/translations")({
  component: TranslationsAdmin,
});

type Tab = "ui" | "cms";

function TranslationsAdmin() {
  const [tab, setTab] = useState<Tab>("ui");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Languages size={22} className="text-gold" /> الترجمات (AR / EN)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          حرّر النصوص الإنجليزية لواجهة الموقع وصفحات المحتوى، أو استخدم الترجمة التلقائية عبر Lovable AI.
        </p>
      </div>

      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setTab("ui")}
          className={`px-4 py-2 text-sm border-b-2 -mb-px transition ${tab === "ui" ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          نصوص الواجهة
        </button>
        <button
          onClick={() => setTab("cms")}
          className={`px-4 py-2 text-sm border-b-2 -mb-px transition ${tab === "cms" ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          صفحات المحتوى
        </button>
      </div>

      {tab === "ui" ? <UiTab /> : <CmsTab />}
    </div>
  );
}

// ─── UI translations tab ────────────────────────────────────────────────
type UiRow = { key: string; ar: string; en: string; fromDb: boolean };

function UiTab() {
  const [rows, setRows] = useState<UiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [translatingAll, setTranslatingAll] = useState(false);
  const translate = useServerFn(translateBatch);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("ui_translations").select("key, ar, en");
    const dbMap = new Map<string, { ar: string; en: string }>();
    for (const r of data ?? []) dbMap.set(r.key, { ar: r.ar ?? "", en: r.en ?? "" });

    const merged: UiRow[] = ALL_UI_KEYS.map((k) => {
      const s = STRINGS[k as StringKey];
      const db = dbMap.get(k);
      return {
        key: k,
        ar: db?.ar || s.ar,
        en: db?.en || s.en,
        fromDb: !!db,
      };
    });
    // include any DB keys not in dictionary
    for (const [k, v] of dbMap) {
      if (!ALL_UI_KEYS.includes(k as StringKey)) {
        merged.push({ key: k, ar: v.ar, en: v.en, fromDb: true });
      }
    }
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const update = (i: number, patch: Partial<UiRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const saveRow = async (i: number) => {
    const r = rows[i];
    setSavingKey(r.key);
    try {
      const { error } = await supabase
        .from("ui_translations")
        .upsert({ key: r.key, ar: r.ar, en: r.en }, { onConflict: "key" });
      if (error) throw error;
      update(i, { fromDb: true });
      toast.success(`تم حفظ ${r.key}`);
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحفظ");
    } finally {
      setSavingKey(null);
    }
  };

  const translateRow = async (i: number) => {
    const r = rows[i];
    if (!r.ar.trim()) return;
    setSavingKey(r.key);
    try {
      const res = await translate({ data: { texts: [r.ar], from: "ar", to: "en" } });
      const en = res.translations[0] ?? r.en;
      update(i, { en });
      toast.success("تمت الترجمة — لا تنس الحفظ");
    } catch (e: any) {
      toast.error(e?.message ?? "فشلت الترجمة");
    } finally {
      setSavingKey(null);
    }
  };

  const translateAllMissing = async () => {
    const targets = rows.filter((r) => r.ar.trim() && (!r.en.trim() || r.en === r.ar));
    if (!targets.length) {
      toast.message("لا توجد نصوص تحتاج ترجمة");
      return;
    }
    setTranslatingAll(true);
    try {
      // batch 30 at a time
      const CHUNK = 30;
      for (let i = 0; i < targets.length; i += CHUNK) {
        const slice = targets.slice(i, i + CHUNK);
        const res = await translate({
          data: { texts: slice.map((r) => r.ar), from: "ar", to: "en" },
        });
        setRows((rs) =>
          rs.map((r) => {
            const idx = slice.findIndex((s) => s.key === r.key);
            if (idx === -1) return r;
            return { ...r, en: res.translations[idx] ?? r.en };
          }),
        );
      }
      toast.success(`تمت ترجمة ${targets.length} نصًا — راجع واحفظ الكل`);
    } catch (e: any) {
      toast.error(e?.message ?? "فشلت الترجمة الجماعية");
    } finally {
      setTranslatingAll(false);
    }
  };

  const saveAll = async () => {
    setTranslatingAll(true);
    try {
      const payload = rows.map((r) => ({ key: r.key, ar: r.ar, en: r.en }));
      const { error } = await supabase.from("ui_translations").upsert(payload, { onConflict: "key" });
      if (error) throw error;
      toast.success(`تم حفظ ${payload.length} صفًا`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحفظ الجماعي");
    } finally {
      setTranslatingAll(false);
    }
  };

  const missingCount = useMemo(() => rows.filter((r) => !r.en.trim() || r.en === r.ar).length, [rows]);

  if (loading)
    return (
      <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> جارٍ التحميل…
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-muted-foreground">إجمالي المفاتيح:</span>{" "}
          <span className="font-semibold">{rows.length}</span>
          {" · "}
          <span className="text-muted-foreground">تحتاج ترجمة:</span>{" "}
          <span className={`font-semibold ${missingCount ? "text-amber-400" : "text-emerald-400"}`}>{missingCount}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={translateAllMissing}
            disabled={translatingAll || missingCount === 0}
            className="btn-outline-gold rounded-xl px-3 py-2 text-xs inline-flex items-center gap-1 disabled:opacity-50"
          >
            {translatingAll ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            ترجمة الناقص تلقائيًا
          </button>
          <button
            onClick={saveAll}
            disabled={translatingAll}
            className="btn-gold rounded-xl px-3 py-2 text-xs inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Save size={13} /> حفظ الكل
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-right w-56">المفتاح</th>
              <th className="px-3 py-2 text-right">العربية</th>
              <th className="px-3 py-2 text-right">English</th>
              <th className="px-3 py-2 w-40" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const needs = !r.en.trim() || r.en === r.ar;
              return (
                <tr key={r.key} className="border-t border-white/5 align-top">
                  <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                    {r.key}
                    {needs && <span className="ml-2 text-[10px] text-amber-400">•ناقص</span>}
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      dir="rtl"
                      value={r.ar}
                      onChange={(e) => update(i, { ar: e.target.value })}
                      className="w-full bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-sm resize-y min-h-[38px]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      dir="ltr"
                      value={r.en}
                      onChange={(e) => update(i, { en: e.target.value })}
                      className="w-full bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-sm resize-y min-h-[38px]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => translateRow(i)}
                        disabled={savingKey === r.key}
                        className="text-[11px] btn-outline-gold rounded-lg px-2 py-1 inline-flex items-center gap-1 justify-center disabled:opacity-50"
                      >
                        <Sparkles size={11} /> ترجمة تلقائية
                      </button>
                      <button
                        onClick={() => saveRow(i)}
                        disabled={savingKey === r.key}
                        className="text-[11px] btn-gold rounded-lg px-2 py-1 inline-flex items-center gap-1 justify-center disabled:opacity-50"
                      >
                        {savingKey === r.key ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                        حفظ
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── CMS pages tab ───────────────────────────────────────────────────────
function CmsTab() {
  const [selected, setSelected] = useState<string>(CMS_PAGES[0]?.key ?? "");
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="glass rounded-2xl p-2 h-fit sticky top-4">
        <div className="text-xs text-muted-foreground px-3 py-2">الصفحات</div>
        <div className="flex flex-col">
          {CMS_PAGES.map((p) => (
            <button
              key={p.key}
              onClick={() => setSelected(p.key)}
              className={`text-right px-3 py-2 rounded-lg text-sm transition ${
                selected === p.key ? "bg-gold/10 text-gold font-semibold" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </aside>
      {selected && <CmsPageEditor pageKey={selected} />}
    </div>
  );
}

function CmsPageEditor({ pageKey }: { pageKey: string }) {
  const [arDoc, setArDoc] = useState<PageDoc | null>(null);
  const [enDoc, setEnDoc] = useState<PageDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const translate = useServerFn(translateBatch);

  const load = async () => {
    setLoading(true);
    try {
      const [ar, en] = await Promise.all([fetchPageDoc(pageKey, "ar"), fetchPageDoc(pageKey, "en")]);
      setArDoc(ar);
      // if EN falls back to AR, start empty EN scaffold from AR structure
      setEnDoc(en);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [pageKey]);

  const save = async () => {
    if (!enDoc) return;
    setSaving(true);
    try {
      await savePageDocEn(pageKey, enDoc);
      toast.success("تم حفظ الترجمة الإنجليزية");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const autoTranslate = async () => {
    if (!arDoc) return;
    setTranslating(true);
    try {
      const texts = flattenStrings(arDoc);
      const nonEmpty = texts.map((t, i) => ({ t, i })).filter((x) => x.t.trim());
      if (!nonEmpty.length) {
        toast.message("لا يوجد نص للترجمة");
        return;
      }

      const results: string[] = texts.slice();
      const CHUNK = 25;
      for (let i = 0; i < nonEmpty.length; i += CHUNK) {
        const slice = nonEmpty.slice(i, i + CHUNK);
        const res = await translate({
          data: { texts: slice.map((x) => x.t), from: "ar", to: "en" },
        });
        slice.forEach((x, idx) => {
          results[x.i] = res.translations[idx] ?? x.t;
        });
      }

      const base: PageDoc = JSON.parse(JSON.stringify(arDoc));
      results.forEach((v, i) => setStringAt(base, i, v));
      setEnDoc(base);
      toast.success("تمت الترجمة — راجع ثم اضغط حفظ");
    } catch (e: any) {
      toast.error(e?.message ?? "فشلت الترجمة");
    } finally {
      setTranslating(false);
    }
  };

  if (loading || !arDoc || !enDoc)
    return (
      <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> جارٍ التحميل…
      </div>
    );

  const arTexts = flattenStrings(arDoc);
  const enTexts = flattenStrings(enDoc);
  const rows = arTexts.map((t, i) => ({ ar: t, en: enTexts[i] ?? "", index: i }));

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="font-semibold">{CMS_PAGES.find((p) => p.key === pageKey)?.label}</span>
          <span className="text-muted-foreground"> · {rows.length} نص</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="btn-outline-gold rounded-xl px-3 py-2 text-xs inline-flex items-center gap-1"
          >
            <RefreshCw size={13} /> إعادة تحميل
          </button>
          <button
            onClick={autoTranslate}
            disabled={translating}
            className="btn-outline-gold rounded-xl px-3 py-2 text-xs inline-flex items-center gap-1 disabled:opacity-50"
          >
            {translating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            ترجمة الصفحة كاملة
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="btn-gold rounded-xl px-3 py-2 text-xs inline-flex items-center gap-1 disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            حفظ الإنجليزية
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-right w-12">#</th>
              <th className="px-3 py-2 text-right">العربية (للقراءة)</th>
              <th className="px-3 py-2 text-right">English</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.index} className="border-t border-white/5 align-top">
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.index + 1}</td>
                <td className="px-3 py-2 text-foreground/80 whitespace-pre-line" dir="rtl">
                  {r.ar}
                </td>
                <td className="px-3 py-2">
                  <textarea
                    dir="ltr"
                    value={r.en}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEnDoc((doc) => {
                        if (!doc) return doc;
                        const clone: PageDoc = JSON.parse(JSON.stringify(doc));
                        setStringAt(clone, r.index, v);
                        return clone;
                      });
                    }}
                    className="w-full bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-sm resize-y min-h-[42px]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Helpers: walk PageDoc to extract/replace translatable strings ─────
// We walk sections in order and pick common text fields. Any additional
// unknown fields are ignored (safe: kept as-is in the EN doc).

const TEXT_FIELDS = [
  "kicker", "title", "description", "heading", "subheading", "body", "text",
  "label", "cta_label", "primary_label", "secondary_label", "cta_button_label",
  "tab_badge_prefix", "features_heading", "concerns_heading", "payment_heading",
  "cta_heading", "size", "price", "freq", "desc", "tagline", "idea", "q", "a",
  "whatsapp_template",
];

function walkSection(sec: Section, visit: (obj: any, key: string) => void) {
  visit(sec, "__self");
  for (const k of TEXT_FIELDS) {
    if (typeof (sec as any)[k] === "string") visit(sec as any, k);
  }
  const s: any = sec;
  const arrays = ["items", "tiers"];
  for (const a of arrays) {
    if (Array.isArray(s[a])) {
      for (const it of s[a]) {
        for (const k of TEXT_FIELDS) {
          if (typeof it[k] === "string") visit(it, k);
        }
        // nested tiers within pricing_groups items
        if (Array.isArray(it.tiers)) {
          for (const tier of it.tiers) {
            for (const k of TEXT_FIELDS) {
              if (typeof tier[k] === "string") visit(tier, k);
            }
          }
        }
        // nested features/concerns/payment/images in business_tabs items
        for (const sub of ["features", "concerns", "payment"]) {
          if (Array.isArray(it[sub])) {
            for (const item of it[sub]) {
              for (const k of TEXT_FIELDS) {
                if (typeof item[k] === "string") visit(item, k);
              }
            }
          }
        }
      }
    }
  }
}

function collectStrings(
  doc: PageDoc,
  paths: { get: (d: PageDoc) => string; set: (d: PageDoc, v: string) => void }[],
) {
  doc.sections.forEach((_, sIdx) => {
    const sec = doc.sections[sIdx];
    walkSection(sec as Section, (obj, key) => {
      if (key === "__self") return;
      // capture by walking again on target doc — simpler: use closure refs
      const val = obj[key];
      if (typeof val !== "string") return;
      // build accessor by re-walking the same section in the target doc.
      // We can't rely on object identity across clones, so store an index
      // into a per-doc flat list and reuse flattenStrings/setStringAt.
      paths.push({
        get: (d: PageDoc) => flattenStrings(d)[paths.length] ?? "",
        set: (d: PageDoc, v: string) => setStringAt(d, paths.length, v),
      });
    });
  });
}

function flattenStrings(doc: PageDoc): string[] {
  const out: string[] = [];
  doc.sections.forEach((sec) => {
    walkSection(sec as Section, (obj, key) => {
      if (key === "__self") return;
      const v = obj[key];
      if (typeof v === "string") out.push(v);
    });
  });
  return out;
}

function setStringAt(doc: PageDoc, targetIndex: number, value: string) {
  let idx = 0;
  for (const sec of doc.sections) {
    let done = false;
    walkSection(sec as Section, (obj, key) => {
      if (done) return;
      if (key === "__self") return;
      if (typeof obj[key] !== "string") return;
      if (idx === targetIndex) {
        obj[key] = value;
        done = true;
      }
      idx += 1;
    });
    if (done) return;
  }
}
