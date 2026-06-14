import { useRef, useState } from "react";
import { Upload, X, Loader2, Star } from "lucide-react";
import { uploadMedia, publicUrl, deleteMedia, onImageError } from "@/lib/storage";
import { toast } from "sonner";

type SingleProps = {
  value: string | null | undefined;
  onChange: (path: string | null) => void;
  folder?: string;
  label?: string;
  className?: string;
};

export function ImageUploader({ value, onChange, folder = "uploads", label = "اختر صورة", className }: SingleProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    if (!file) return;
    setBusy(true);
    try {
      if (value) await deleteMedia(value).catch(() => {});
      const path = await uploadMedia(file, folder);
      onChange(path);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر رفع الصورة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      {value ? (
        <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-white/10 shrink-0">
          <img src={publicUrl(value)} alt="" className="h-full w-full object-cover" />
          <button type="button" onClick={() => onChange(null)} className="absolute top-1 left-1 bg-black/70 rounded-full p-1 text-white hover:bg-red-500">
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="h-20 w-20 rounded-xl border border-dashed border-white/15 grid place-items-center text-muted-foreground text-xs shrink-0">
          لا صورة
        </div>
      )}
      <div className="flex-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => ref.current?.click()}
          className="glass rounded-xl px-4 py-2 text-sm flex items-center gap-2 hover:bg-white/10 disabled:opacity-50"
        >
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
          {busy ? "جاري الرفع..." : label}
        </button>
        <input
          ref={ref} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
      </div>
    </div>
  );
}

type MultiProps = {
  values: string[];
  cover?: string | null;
  onChange: (values: string[], cover: string | null) => void;
  folder?: string;
};

export function MultiImageUploader({ values, cover, onChange, folder = "projects" }: MultiProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="space-y-3">
      <button type="button" disabled={busy} onClick={() => ref.current?.click()}
        className="glass rounded-xl px-4 py-2 text-sm flex items-center gap-2 hover:bg-white/10 disabled:opacity-50">
        {busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
        {busy ? "جاري الرفع..." : "أضف صور"}
      </button>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} />
      {values.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {values.map((p) => (
            <div key={p} className={`relative aspect-square rounded-xl overflow-hidden border-2 ${cover === p ? "border-gold" : "border-white/10"}`}>
              <img src={publicUrl(p)} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => onChange(values, p)} title="اجعلها الرئيسية"
                className="absolute top-1 right-1 bg-black/70 rounded-full p-1 text-gold hover:bg-gold hover:text-black">
                <Star size={12} fill={cover === p ? "currentColor" : "none"} />
              </button>
              <button type="button" onClick={() => remove(p)}
                className="absolute top-1 left-1 bg-black/70 rounded-full p-1 text-white hover:bg-red-500">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">انقر النجمة لاختيار الصورة الرئيسية. اضغط ✕ للحذف.</p>
    </div>
  );
}
