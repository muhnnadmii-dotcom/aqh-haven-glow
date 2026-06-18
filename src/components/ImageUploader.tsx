import { useRef, useState } from "react";
import { Upload, X, Loader2, Star, Crop as CropIcon } from "lucide-react";
import { uploadMedia, publicUrl, deleteMedia, onImageError } from "@/lib/storage";
import { ImageCropperDialog } from "@/components/ImageCropperDialog";
import { toast } from "sonner";

type SingleProps = {
  value: string | null | undefined;
  onChange: (path: string | null) => void;
  folder?: string;
  label?: string;
  className?: string;
  /** Default crop aspect ratio. Pass a number (e.g. 1, 16/9) or "free". Defaults to 1:1. */
  cropAspect?: number | "free";
  /** Disable the crop dialog entirely. */
  enableCrop?: boolean;
};

export function ImageUploader({
  value, onChange, folder = "uploads", label = "اختر صورة", className,
  cropAspect = 1, enableCrop = true,
}: SingleProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [cropSrc, setCropSrc] = useState<File | string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState<string | null>(null);

  const uploadFile = async (file: File, prevToDelete?: string | null) => {
    setBusy(true);
    try {
      if (prevToDelete) await deleteMedia(prevToDelete).catch(() => {});
      const path = await uploadMedia(file, folder);
      onChange(path);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر رفع الصورة");
    } finally {
      setBusy(false);
    }
  };

  const onPick = (file: File) => {
    if (!file) return;
    if (enableCrop) {
      setReplaceExisting(value ?? null);
      setCropSrc(file);
    } else {
      uploadFile(file, value ?? undefined);
    }
  };

  const editExisting = () => {
    if (!value) return;
    setReplaceExisting(value);
    setCropSrc(publicUrl(value));
  };

  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      {value ? (
        <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-white/10 shrink-0 group">
          <img src={publicUrl(value)} alt="معاينة" loading="lazy" onError={onImageError} className="h-full w-full object-cover" />
          <button type="button" onClick={() => onChange(null)} title="حذف"
            className="absolute top-1 left-1 bg-black/70 rounded-full p-1 text-white hover:bg-red-500">
            <X size={12} />
          </button>
          {enableCrop && (
            <button type="button" onClick={editExisting} title="تعديل القص"
              className="absolute bottom-1 left-1 bg-black/70 rounded-full p-1 text-gold hover:bg-gold hover:text-black">
              <CropIcon size={12} />
            </button>
          )}
        </div>
      ) : (
        <div className="h-20 w-20 rounded-xl border border-dashed border-white/15 grid place-items-center text-muted-foreground text-xs shrink-0">
          لا صورة
        </div>
      )}
      <div className="flex-1 flex items-center gap-2 flex-wrap">
        <button
          type="button" disabled={busy} onClick={() => ref.current?.click()}
          className="glass rounded-xl px-4 py-2 text-sm flex items-center gap-2 hover:bg-white/10 disabled:opacity-50"
        >
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
          {busy ? "جاري الرفع..." : label}
        </button>
        {enableCrop && value && (
          <button type="button" disabled={busy} onClick={editExisting}
            className="glass rounded-xl px-3 py-2 text-xs flex items-center gap-1.5 hover:bg-white/10 disabled:opacity-50">
            <CropIcon size={12} /> تعديل القص
          </button>
        )}
        <input
          ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }}
        />
      </div>

      <ImageCropperDialog
        open={!!cropSrc}
        source={cropSrc}
        defaultAspect={cropAspect}
        onCancel={() => { setCropSrc(null); setReplaceExisting(null); }}
        onCropped={async (file) => {
          const prev = replaceExisting;
          setCropSrc(null); setReplaceExisting(null);
          await uploadFile(file, prev);
        }}
      />
    </div>
  );
}

type MultiProps = {
  values: string[];
  cover?: string | null;
  onChange: (values: string[], cover: string | null) => void;
  folder?: string;
  cropAspect?: number | "free";
};

export function MultiImageUploader({ values, cover, onChange, folder = "projects", cropAspect = 1 }: MultiProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [cropPath, setCropPath] = useState<string | null>(null);

  const addFiles = async (files: FileList) => {
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const f of Array.from(files)) {
        const p = await uploadMedia(f, folder);
        paths.push(p);
      }
      const next = [...values, ...paths];
      onChange(next, cover ?? next[0] ?? null);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الرفع");
    } finally { setBusy(false); }
  };

  const remove = async (path: string) => {
    deleteMedia(path).catch(() => {});
    const next = values.filter((p) => p !== path);
    onChange(next, cover === path ? next[0] ?? null : cover ?? null);
  };

  const onCropped = async (file: File) => {
    if (!cropPath) return;
    try {
      const newPath = await uploadMedia(file, folder);
      const next = values.map((p) => (p === cropPath ? newPath : p));
      const newCover = cover === cropPath ? newPath : cover ?? null;
      deleteMedia(cropPath).catch(() => {});
      onChange(next, newCover);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر حفظ الصورة المقصوصة");
    } finally {
      setCropPath(null);
    }
  };

  return (
    <div className="space-y-3">
      <button type="button" disabled={busy} onClick={() => ref.current?.click()}
        className="glass rounded-xl px-4 py-2 text-sm flex items-center gap-2 hover:bg-white/10 disabled:opacity-50">
        {busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
        {busy ? "جاري الرفع..." : "أضف صور"}
      </button>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} />
      {values.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {values.map((p) => (
            <div key={p} className={`relative aspect-square rounded-xl overflow-hidden border-2 ${cover === p ? "border-gold" : "border-white/10"}`}>
              <img src={publicUrl(p)} alt="" loading="lazy" onError={onImageError} className="h-full w-full object-cover" />
              <button type="button" onClick={() => onChange(values, p)} title="اجعلها الرئيسية"
                className="absolute top-1 right-1 bg-black/70 rounded-full p-1 text-gold hover:bg-gold hover:text-black">
                <Star size={12} fill={cover === p ? "currentColor" : "none"} />
              </button>
              <button type="button" onClick={() => setCropPath(p)} title="تعديل القص"
                className="absolute bottom-1 right-1 bg-black/70 rounded-full p-1 text-gold hover:bg-gold hover:text-black">
                <CropIcon size={12} />
              </button>
              <button type="button" onClick={() => remove(p)}
                className="absolute top-1 left-1 bg-black/70 rounded-full p-1 text-white hover:bg-red-500">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">انقر النجمة لاختيار الصورة الرئيسية. أيقونة القص لتعديل الإطار.</p>

      <ImageCropperDialog
        open={!!cropPath}
        source={cropPath ? publicUrl(cropPath) : null}
        defaultAspect={cropAspect}
        onCancel={() => setCropPath(null)}
        onCropped={onCropped}
      />
    </div>
  );
}
