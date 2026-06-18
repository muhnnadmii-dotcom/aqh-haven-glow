import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import { Crop as CropIcon, X, Check, Loader2 } from "lucide-react";
import { cropImageToFile, type PixelCrop } from "@/lib/image-crop";
import { toast } from "sonner";

type AspectKey = "1:1" | "16:9" | "4:3" | "4:5" | "free";
const ASPECTS: { key: AspectKey; label: string; value: number | undefined }[] = [
  { key: "1:1", label: "مربع 1:1", value: 1 },
  { key: "16:9", label: "أفقي 16:9", value: 16 / 9 },
  { key: "4:3", label: "أفقي 4:3", value: 4 / 3 },
  { key: "4:5", label: "عمودي 4:5", value: 4 / 5 },
  { key: "free", label: "حر", value: undefined },
];

function aspectToKey(a: number | "free" | undefined): AspectKey {
  if (a === "free" || a === undefined) return "free";
  if (Math.abs(a - 1) < 0.01) return "1:1";
  if (Math.abs(a - 16 / 9) < 0.01) return "16:9";
  if (Math.abs(a - 4 / 3) < 0.01) return "4:3";
  if (Math.abs(a - 4 / 5) < 0.01) return "4:5";
  return "free";
}

export type ImageCropperDialogProps = {
  open: boolean;
  source: File | string | null;
  defaultAspect?: number | "free";
  onCancel: () => void;
  onCropped: (file: File) => Promise<void> | void;
};

export function ImageCropperDialog({ open, source, defaultAspect = 1, onCancel, onCropped }: ImageCropperDialogProps) {
  const [aspectKey, setAspectKey] = useState<AspectKey>(aspectToKey(defaultAspect));
  const [zoom, setZoom] = useState(1);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [pixels, setPixels] = useState<PixelCrop | null>(null);
  const [busy, setBusy] = useState(false);

  // Build a URL for File sources
  const url = useMemo(() => {
    if (!source) return null;
    return typeof source === "string" ? source : URL.createObjectURL(source);
  }, [source]);

  useEffect(() => {
    return () => {
      if (source && typeof source !== "string" && url) URL.revokeObjectURL(url);
    };
  }, [source, url]);

  useEffect(() => {
    if (open) {
      setAspectKey(aspectToKey(defaultAspect));
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setPixels(null);
    }
  }, [open, defaultAspect]);

  const aspectValue = ASPECTS.find((a) => a.key === aspectKey)?.value;

  const onCropComplete = useCallback((_: unknown, p: PixelCrop) => setPixels(p), []);

  const apply = async () => {
    if (!source || !pixels || !url) {
      toast.error("لم يتم تحديد منطقة القص");
      return;
    }
    setBusy(true);
    try {
      const file = await cropImageToFile(typeof source === "string" ? url : source, pixels);
      await onCropped(file);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر قص الصورة");
    } finally {
      setBusy(false);
    }
  };

  if (!open || !url) return null;

  return (
    <div onClick={() => !busy && onCancel()} className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-6">
      <div onClick={(e) => e.stopPropagation()} className="glass rounded-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CropIcon size={16} /> قص الصورة
          </div>
          <button type="button" onClick={onCancel} disabled={busy}
            className="grid place-items-center h-8 w-8 rounded-full hover:bg-white/10 disabled:opacity-50" aria-label="إغلاق">
            <X size={16} />
          </button>
        </div>

        <div className="relative bg-black flex-1 min-h-[300px] sm:min-h-[420px]">
          <Cropper
            image={url}
            crop={crop}
            zoom={zoom}
            aspect={aspectValue}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            restrictPosition
            objectFit="contain"
            showGrid
          />
        </div>

        <div className="p-3 sm:p-4 space-y-3 border-t border-white/10">
          <div className="flex flex-wrap gap-1.5">
            {ASPECTS.map((a) => (
              <button key={a.key} type="button" onClick={() => setAspectKey(a.key)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  aspectKey === a.key ? "bg-gold text-black border-gold" : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}>
                {a.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground shrink-0">تكبير</span>
            <input type="range" min={1} max={4} step={0.01} value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-gold" />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onCancel} disabled={busy}
              className="px-4 py-2 rounded-xl text-sm bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50">
              إلغاء
            </button>
            <button type="button" onClick={apply} disabled={busy || !pixels}
              className="btn-gold rounded-xl px-5 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {busy ? "جاري الحفظ..." : "تطبيق القص"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
