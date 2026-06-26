import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Plus, Save, ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { fetchPageDoc, savePageDoc } from "@/lib/cms/api";
import { getPageMeta } from "@/lib/cms/registry";
import type { PageDoc, Section, SectionType } from "@/lib/cms/types";
import { SECTION_TYPE_LABELS, emptySection } from "@/lib/cms/types";
import { SectionCard } from "@/lib/cms/SectionEditor";

export const Route = createFileRoute("/_authenticated/admin/content/$page")({
  component: ContentEditor,
});

const ALL_TYPES: SectionType[] = ["hero", "badge_grid", "pricing_groups", "checklist", "cta_band", "rich_text"];

function ContentEditor() {
  const { page } = Route.useParams();
  const meta = getPageMeta(page);
  const [doc, setDoc] = useState<PageDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchPageDoc(page).then(setDoc).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, [page]);

  if (!meta) {
    return <div className="text-sm text-muted-foreground">page_key غير معروف.</div>;
  }
  if (loading || !doc) {
    return <div className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> جاري التحميل...</div>;
  }

  const updateSection = (i: number, s: Section) => {
    const sections = doc.sections.slice();
    sections[i] = s;
    setDoc({ ...doc, sections });
  };

  const addSection = (type: SectionType) => {
    setDoc({ ...doc, sections: [...doc.sections, emptySection(type)] });
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= doc.sections.length) return;
    const sections = doc.sections.slice();
    [sections[i], sections[j]] = [sections[j], sections[i]];
    setDoc({ ...doc, sections });
  };

  const remove = (i: number) => {
    if (!confirm("حذف هذا القسم؟")) return;
    setDoc({ ...doc, sections: doc.sections.filter((_, k) => k !== i) });
  };

  const save = async () => {
    setSaving(true);
    try {
      await savePageDoc(page, doc, meta.label);
      toast.success("تم الحفظ");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link to="/admin/content" className="text-xs text-muted-foreground inline-flex items-center gap-1 mb-2 hover:text-foreground">
            <ArrowRight size={12} /> كل الصفحات
          </Link>
          <h1 className="text-2xl font-bold">{meta.label}</h1>
          <div className="text-xs text-muted-foreground mt-1">{meta.route}</div>
        </div>
        <div className="flex gap-2">
          <a href={meta.route} target="_blank" rel="noopener noreferrer"
            className="btn-outline-gold rounded-xl px-3 py-2 text-xs inline-flex items-center gap-1">
            <ExternalLink size={14} /> معاينة
          </a>
          <button
            type="button"
            onClick={() => {
              if (!confirm("سيتم استبدال الأقسام الحالية بالمحتوى الافتراضي للصفحة. متابعة؟")) return;
              setDoc({ sections: meta.defaults.sections.map((s) => ({ ...s })) });
              toast.message("تم تحميل المحتوى الافتراضي — اضغط حفظ لتثبيته");
            }}
            className="btn-outline-gold rounded-xl px-3 py-2 text-xs inline-flex items-center gap-1"
            title="استرجاع المحتوى الأصلي للصفحة">
            <RotateCcw size={14} /> تحميل المحتوى الافتراضي
          </button>
          <button onClick={save} disabled={saving}
            className="btn-gold rounded-xl px-4 py-2 text-xs inline-flex items-center gap-1">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            حفظ التغييرات
          </button>
        </div>
      </div>

      {doc.sections.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          لا توجد أقسام بعد. أضف قسمًا من الأسفل للبدء.
        </div>
      )}

      <div className="space-y-4">
        {doc.sections.map((s, i) => (
          <SectionCard
            key={s.id}
            section={s}
            index={i}
            total={doc.sections.length}
            onChange={(ns) => updateSection(i, ns)}
            onDelete={() => remove(i)}
            onMoveUp={() => move(i, -1)}
            onMoveDown={() => move(i, 1)}
          />
        ))}
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="text-xs text-muted-foreground mb-2">إضافة قسم جديد:</div>
        <div className="flex flex-wrap gap-2">
          {ALL_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => addSection(t)}
              className="text-xs btn-outline-gold rounded-xl px-3 py-2 inline-flex items-center gap-1">
              <Plus size={14} /> {SECTION_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
