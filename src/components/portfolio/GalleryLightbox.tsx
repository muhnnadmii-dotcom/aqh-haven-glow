import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, ChevronLeft, ChevronRight, Sparkles, ArrowLeft, ExternalLink } from "lucide-react";
import { publicUrl, onImageError } from "@/lib/storage";
import {
  TANK_TYPE_LABELS, SIZE_LABELS, STYLE_LABELS, CARE_LABELS, SUITABLE_FOR_LABELS,
  type WorkGalleryItem,
} from "@/lib/work-gallery";

function lbl(map: Record<string, string>, key: string | null): string | null {
  if (!key) return null;
  return map[key] ?? key;
}

function mapTankTypeToForm(t: string): string {
  const m: Record<string, string> = {
    river: "freshwater", marine: "saltwater", planted: "planted",
    nano: "nano", aquascape: "planted", before_after: "freshwater",
  };
  return m[t] ?? t;
}

export function GalleryLightbox({ item, projectSlug, onClose }: {
  item: WorkGalleryItem;
  projectSlug: string | null;
  onClose: () => void;
}) {
  // Build ordered images: primary first, then extras (de-duped).
  const allImages = [item.image_path, ...(item.extra_images ?? []).filter((p) => p && p !== item.image_path)];
  const [idx, setIdx] = useState(0);
  const count = allImages.length;
  const touchStart = useRef<number | null>(null);

  const go = (delta: number) => setIdx((i) => (i + delta + count) % count);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(-1); // RTL: right arrow = previous
      else if (e.key === "ArrowLeft") go(1);
    };
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", k); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const tags = [
    { label: "نوع الحوض", value: lbl(TANK_TYPE_LABELS, item.tank_type) },
    { label: "الحجم", value: lbl(SIZE_LABELS, item.size_category) },
    { label: "الستايل", value: lbl(STYLE_LABELS, item.style) },
    { label: "مستوى العناية", value: lbl(CARE_LABELS, item.care_level) },
  ].filter((t) => t.value);

  const refParams = new URLSearchParams();
  refParams.set("ref_gallery", item.id);
  if (item.title) refParams.set("ref_title", item.title);
  if (item.tank_type) refParams.set("tank_type", mapTankTypeToForm(item.tank_type));
  refParams.set("ref_image", item.image_path);
  const requestHref = `/services/custom-aquariums?${refParams.toString()}#request-form`;

  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(dx) < 50) return;
    // RTL: swipe right (positive dx) = previous, swipe left = next
    if (dx > 0) go(-1); else go(1);
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md overflow-y-auto p-2 sm:p-6">
      <div className="min-h-full flex items-start justify-center">
        <div onClick={(e) => e.stopPropagation()} className="glass rounded-2xl sm:rounded-3xl max-w-5xl w-full overflow-hidden relative">
          {/* Top bar */}
          <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/70 to-transparent">
            <button onClick={onClose} className="grid place-items-center h-9 w-9 rounded-full glass-gold" aria-label="إغلاق">
              <X size={18} />
            </button>
            <div className="text-xs glass rounded-full px-3 py-1.5 font-medium">
              {idx + 1} / {count}
            </div>
          </div>

          {/* Main image area */}
          <div
            className="relative bg-black flex items-center justify-center select-none"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <img
              src={publicUrl(allImages[idx]) || ""}
              alt={item.title ?? ""}
              onError={onImageError}
              className="w-full max-h-[65vh] sm:max-h-[70vh] object-contain"
              draggable={false}
            />
            {count > 1 && (
              <>
                <button
                  onClick={() => go(-1)}
                  aria-label="السابق"
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 grid place-items-center h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur"
                >
                  <ChevronRight size={22} />
                </button>
                <button
                  onClick={() => go(1)}
                  aria-label="التالي"
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 grid place-items-center h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur"
                >
                  <ChevronLeft size={22} />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {count > 1 && (
            <div className="bg-black/40 p-2 sm:p-3 border-y border-white/5">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {allImages.map((p, i) => (
                  <button
                    key={p + i}
                    onClick={() => setIdx(i)}
                    className={`relative shrink-0 h-16 w-16 sm:h-20 sm:w-20 rounded-lg overflow-hidden border-2 transition ${
                      i === idx ? "border-gold ring-2 ring-gold/40" : "border-white/10 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={publicUrl(p) || ""} onError={onImageError} alt=""
                      className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
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
                    {lbl(SUITABLE_FOR_LABELS, s)}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-1">
              <a href={requestHref} className="btn-gold rounded-xl px-5 py-2.5 text-sm inline-flex items-center gap-2">
                <Sparkles size={14} /> أبغى مثل هذا
              </a>
              {projectSlug && item.linked_project_id && (
                <Link
                  to="/portfolio"
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
