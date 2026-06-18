import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, Filter as FilterIcon, Sparkles, ArrowLeft, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl, onImageError } from "@/lib/storage";
import {
  TANK_TYPE_OPTIONS, SIZE_OPTIONS, STYLE_OPTIONS, CARE_OPTIONS, SUITABLE_FOR_OPTIONS,
  TANK_TYPE_LABELS, SIZE_LABELS, STYLE_LABELS, CARE_LABELS, SUITABLE_FOR_LABELS,
  label, type WorkGalleryItem,
} from "@/lib/work-gallery";

type Filters = {
  tank_type: string;
  size_category: string;
  style: string;
  care_level: string;
  suitable_for: string;
};
const EMPTY: Filters = { tank_type: "all", size_category: "all", style: "all", care_level: "all", suitable_for: "all" };

export function GalleryTab() {
  const [items, setItems] = useState<WorkGalleryItem[] | null>(null);
  const [projectSlugs, setProjectSlugs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [open, setOpen] = useState<WorkGalleryItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("work_gallery_items")
        .select("*")
        .eq("is_published", true)
        .order("display_order", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) { setError(error.message); setItems([]); return; }
      const list = (data ?? []) as WorkGalleryItem[];
      setItems(list);
      const ids = Array.from(new Set(list.map((i) => i.linked_project_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: ps } = await supabase.from("projects").select("id,slug").in("id", ids);
        const map: Record<string, string> = {};
        (ps ?? []).forEach((p: any) => { if (p.slug) map[p.id] = p.slug; });
        setProjectSlugs(map);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((i) => {
      if (filters.tank_type !== "all" && i.tank_type !== filters.tank_type) return false;
      if (filters.size_category !== "all" && i.size_category !== filters.size_category) return false;
      if (filters.style !== "all" && i.style !== filters.style) return false;
      if (filters.care_level !== "all" && i.care_level !== filters.care_level) return false;
      if (filters.suitable_for !== "all" && !(i.suitable_for ?? []).includes(filters.suitable_for)) return false;
      return true;
    });
  }, [items, filters]);

  const activeCount = Object.values(filters).filter((v) => v !== "all").length;

  return (
    <div>
      {/* Desktop filters */}
      <div className="hidden md:flex flex-wrap items-end gap-3 mb-6 glass rounded-2xl p-4">
        <FilterSelect label="نوع الحوض" value={filters.tank_type} options={TANK_TYPE_OPTIONS} onChange={(v) => setFilters((f) => ({ ...f, tank_type: v }))} />
        <FilterSelect label="الحجم" value={filters.size_category} options={SIZE_OPTIONS} onChange={(v) => setFilters((f) => ({ ...f, size_category: v }))} />
        <FilterSelect label="الستايل" value={filters.style} options={STYLE_OPTIONS} onChange={(v) => setFilters((f) => ({ ...f, style: v }))} />
        <FilterSelect label="مستوى العناية" value={filters.care_level} options={CARE_OPTIONS} onChange={(v) => setFilters((f) => ({ ...f, care_level: v }))} />
        <FilterSelect label="مناسب لـ" value={filters.suitable_for} options={SUITABLE_FOR_OPTIONS} onChange={(v) => setFilters((f) => ({ ...f, suitable_for: v }))} />
        {activeCount > 0 && (
          <button onClick={() => setFilters(EMPTY)} className="text-xs text-muted-foreground hover:text-gold underline">
            مسح الفلاتر
          </button>
        )}
      </div>

      {/* Mobile filter button */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-full glass rounded-xl px-4 py-3 text-sm inline-flex items-center justify-center gap-2"
        >
          <FilterIcon size={16} /> فلترة {activeCount > 0 && <span className="text-gold">({activeCount})</span>}
        </button>
      </div>

      {error && <div className="text-center text-rose-400 py-8 text-sm">تعذر التحميل: {error}</div>}
      {items === null && <div className="text-center text-muted-foreground py-12 text-sm">جاري التحميل...</div>}
      {items && filtered.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground text-sm">
          لا توجد لقطات مطابقة. {activeCount > 0 && <button onClick={() => setFilters(EMPTY)} className="text-gold underline">مسح الفلاتر</button>}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {filtered.map((item) => (
          <button
            key={item.id}
            onClick={() => setOpen(item)}
            className="group relative aspect-square overflow-hidden rounded-xl sm:rounded-2xl glass"
          >
            <img
              src={publicUrl(item.image_path) || ""}
              alt={item.title ?? "لقطة من أعمالنا"}
              loading="lazy"
              onError={onImageError}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-60 group-hover:opacity-90 transition-opacity" />
            {item.is_featured && (
              <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold glass-gold text-[color:var(--gold)]">
                <Sparkles size={10} /> مميّز
              </div>
            )}
            {(item.title || item.tank_type) && (
              <div className="absolute bottom-0 right-0 left-0 p-2.5 text-right">
                {item.title && <div className="text-xs sm:text-sm font-semibold truncate">{item.title}</div>}
                {item.tank_type && <div className="text-[10px] text-gradient-gold">{label(TANK_TYPE_LABELS, item.tank_type)}</div>}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-background/85 backdrop-blur" onClick={() => setDrawerOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="absolute bottom-0 inset-x-0 bg-background border-t border-white/10 rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold">فلترة اللقطات</div>
              <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-white/5"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <FilterSelect label="نوع الحوض" value={filters.tank_type} options={TANK_TYPE_OPTIONS} onChange={(v) => setFilters((f) => ({ ...f, tank_type: v }))} block />
              <FilterSelect label="الحجم" value={filters.size_category} options={SIZE_OPTIONS} onChange={(v) => setFilters((f) => ({ ...f, size_category: v }))} block />
              <FilterSelect label="الستايل" value={filters.style} options={STYLE_OPTIONS} onChange={(v) => setFilters((f) => ({ ...f, style: v }))} block />
              <FilterSelect label="مستوى العناية" value={filters.care_level} options={CARE_OPTIONS} onChange={(v) => setFilters((f) => ({ ...f, care_level: v }))} block />
              <FilterSelect label="مناسب لـ" value={filters.suitable_for} options={SUITABLE_FOR_OPTIONS} onChange={(v) => setFilters((f) => ({ ...f, suitable_for: v }))} block />
            </div>
            <div className="mt-5 flex items-center gap-2">
              <button onClick={() => setFilters(EMPTY)} className="flex-1 rounded-xl px-4 py-2.5 text-sm bg-white/5 border border-white/10">مسح</button>
              <button onClick={() => setDrawerOpen(false)} className="flex-1 btn-gold rounded-xl px-4 py-2.5 text-sm">عرض النتائج</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {open && (
        <Lightbox item={open} projectSlug={open.linked_project_id ? projectSlugs[open.linked_project_id] ?? null : null} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange, block }: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
  block?: boolean;
}) {
  return (
    <div className={block ? "" : "min-w-[140px]"}>
      <label className="block text-[11px] text-muted-foreground mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60"
      >
        <option value="all">الكل</option>
        {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </div>
  );
}

function Lightbox({ item, projectSlug, onClose }: { item: WorkGalleryItem; projectSlug: string | null; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", k); };
  }, [onClose]);

  const tags: { label: string; value: string | null }[] = [
    { label: "نوع الحوض", value: label_(TANK_TYPE_LABELS, item.tank_type) },
    { label: "الحجم", value: label_(SIZE_LABELS, item.size_category) },
    { label: "الستايل", value: label_(STYLE_LABELS, item.style) },
    { label: "مستوى العناية", value: label_(CARE_LABELS, item.care_level) },
  ].filter((t) => t.value);

  const refParams = new URLSearchParams();
  refParams.set("ref_gallery", item.id);
  if (item.title) refParams.set("ref_title", item.title);
  if (item.tank_type) refParams.set("tank_type", mapTankTypeToForm(item.tank_type));
  const requestHref = `/services/custom-aquariums?${refParams.toString()}#request-form`;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md overflow-y-auto p-3 sm:p-6">
      <div className="min-h-full flex items-start justify-center">
        <div onClick={(e) => e.stopPropagation()} className="glass rounded-3xl max-w-4xl w-full overflow-hidden relative">
          <button onClick={onClose} className="absolute top-3 left-3 z-10 grid place-items-center h-9 w-9 rounded-full glass-gold" aria-label="إغلاق">
            <X size={18} />
          </button>
          <div className="relative bg-black">
            <img src={publicUrl(item.image_path) || ""} alt={item.title ?? ""} onError={onImageError}
              className="w-full max-h-[70vh] object-contain" />
          </div>
          <div className="p-5 sm:p-7 space-y-5">
            {item.title && <h3 className="text-xl sm:text-2xl font-bold">{item.title}</h3>}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t.label} className="glass-gold px-3 py-1.5 rounded-full text-xs">
                    <span className="text-muted-foreground">{t.label}:</span> <b>{t.value}</b>
                  </span>
                ))}
                {(item.suitable_for ?? []).map((s) => (
                  <span key={s} className="px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/10">
                    {label_(SUITABLE_FOR_LABELS, s)}
                  </span>
                ))}
              </div>
            )}
            {item.extra_images?.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {item.extra_images.map((p) => (
                  <img key={p} src={publicUrl(p) || ""} onError={onImageError} alt="" className="aspect-square w-full object-cover rounded-lg" />
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to={requestHref as any} className="btn-gold rounded-xl px-5 py-2.5 text-sm inline-flex items-center gap-2">
                <Sparkles size={14} /> أبغى مثل هذا
              </Link>
              {projectSlug && item.linked_project_id && (
                <Link
                  to="/portfolio"
                  search={{ project: projectSlug } as any}
                  className="rounded-xl px-5 py-2.5 text-sm inline-flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10"
                >
                  <ExternalLink size={14} /> عرض المشروع الكامل <ArrowLeft size={14} />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function label_(map: Record<string, string>, key: string | null): string | null {
  if (!key) return null;
  return map[key] ?? key;
}

// Map gallery tank_type to custom-aquariums form values (best-effort)
function mapTankTypeToForm(t: string): string {
  const m: Record<string, string> = {
    river: "freshwater",
    marine: "saltwater",
    planted: "planted",
    nano: "nano",
    aquascape: "planted",
    before_after: "freshwater",
  };
  return m[t] ?? t;
}
