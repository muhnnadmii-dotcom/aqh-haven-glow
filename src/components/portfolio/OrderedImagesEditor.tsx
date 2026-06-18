import { useRef, useState } from "react";
import { Upload, X, Loader2, Star, ChevronLeft, ChevronRight, GripVertical, Crop as CropIcon } from "lucide-react";
import { uploadMedia, publicUrl, deleteMedia, onImageError } from "@/lib/storage";
import { ImageCropperDialog } from "@/components/ImageCropperDialog";
import { toast } from "sonner";

type Props = {
  images: string[]; // ordered, first = primary
  onChange: (next: string[]) => void;
  folder?: string;
};

/**
 * Ordered image manager with drag & drop, arrow buttons, set-primary, and delete.
 * The first item in the array is always the primary image.
 */
export function OrderedImagesEditor({ images, onChange, folder = "gallery" }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const addFiles = async (files: FileList) => {
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const f of Array.from(files)) {
        paths.push(await uploadMedia(f, folder));
      }
      onChange([...images, ...paths]); // new images go to the end
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الرفع");
    } finally {
      setBusy(false);
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };

  const setPrimary = (idx: number) => move(idx, 0);

  const remove = async (idx: number) => {
    const p = images[idx];
    if (!confirm("حذف هذه الصورة؟")) return;
    deleteMedia(p).catch(() => {});
    onChange(images.filter((_, i) => i !== idx));
  };

  const onDragStart = (i: number) => setDragIdx(i);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (i: number) => {
    if (dragIdx === null) return;
    move(dragIdx, i);
    setDragIdx(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button type="button" disabled={busy} onClick={() => ref.current?.click()}
          className="glass rounded-xl px-4 py-2 text-sm flex items-center gap-2 hover:bg-white/10 disabled:opacity-50">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
          {busy ? "جاري الرفع..." : "أضف صور"}
        </button>
        <p className="text-[11px] text-muted-foreground">
          الصورة الأولى = الرئيسية. اسحب الصور أو استخدم الأسهم لإعادة الترتيب.
        </p>
      </div>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} />

      {images.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-xs text-muted-foreground">
          لم يتم إضافة صور بعد.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {images.map((p, i) => {
            const isPrimary = i === 0;
            return (
              <div
                key={p}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(i)}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 ${isPrimary ? "border-gold" : "border-white/10"} group bg-black/30`}
              >
                <img src={publicUrl(p)} alt="" loading="lazy" onError={onImageError}
                  className="h-full w-full object-cover" />

                {/* Order badge */}
                <div className="absolute top-1 left-1 flex items-center gap-1">
                  <span className="text-[10px] bg-black/70 rounded px-1.5 py-0.5 text-white">#{i + 1}</span>
                  {isPrimary && (
                    <span className="text-[10px] glass-gold rounded px-1.5 py-0.5 flex items-center gap-0.5">
                      <Star size={9} fill="currentColor" /> رئيسية
                    </span>
                  )}
                </div>

                {/* Drag handle */}
                <div className="absolute top-1 right-1 bg-black/70 rounded p-1 text-white/80 cursor-grab active:cursor-grabbing" title="اسحب لإعادة الترتيب">
                  <GripVertical size={12} />
                </div>

                {/* Bottom action bar */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-1.5 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0}
                      className="bg-black/70 hover:bg-white/20 rounded p-1 text-white disabled:opacity-30" title="تقديم">
                      <ChevronRight size={12} />
                    </button>
                    <button type="button" onClick={() => move(i, i + 1)} disabled={i === images.length - 1}
                      className="bg-black/70 hover:bg-white/20 rounded p-1 text-white disabled:opacity-30" title="تأخير">
                      <ChevronLeft size={12} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isPrimary && (
                      <button type="button" onClick={() => setPrimary(i)}
                        className="bg-black/70 hover:bg-gold hover:text-black rounded p-1 text-gold" title="تعيين كرئيسية">
                        <Star size={12} />
                      </button>
                    )}
                    <button type="button" onClick={() => remove(i)}
                      className="bg-black/70 hover:bg-rose-500 rounded p-1 text-white" title="حذف">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
