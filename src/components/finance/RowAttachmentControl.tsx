import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ATTACHMENT_STATUS, ATTACHMENT_TYPES, labelOf, toneOf } from "@/lib/finance/constants";
import { uploadOneAttachment } from "@/components/finance/AttachmentsPanel";
import { Paperclip, Upload, Download, Trash2, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";

type RelatedType = "income" | "expense";
type Att = { id: string; file_url: string; file_name: string; attachment_type: string | null };

export function RowAttachmentControl({
  relatedType,
  relatedId,
  status,
  canManage,
  canDelete,
  onChanged,
}: {
  relatedType: RelatedType;
  relatedId: string;
  status: string | null | undefined;
  canManage: boolean;
  canDelete: boolean;
  onChanged: (newStatus: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const table = relatedType === "income" ? "finance_incomes" : "finance_expenses";

  useEffect(() => {
    if (!menu) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [menu]);

  const setStatus = async (next: "attached" | "not_attached" | "not_required") => {
    setMenu(false);
    if (next === "attached") {
      const { count } = await supabase
        .from("finance_attachments")
        .select("id", { count: "exact", head: true })
        .eq("related_type", relatedType)
        .eq("related_id", relatedId);
      if (!count || count === 0) {
        toast.error("لا يمكن تعيين الحالة كمرفق بدون رفع ملف.");
        setOpen(true);
        return;
      }
    }
    const { error } = await supabase.from(table).update({ attachment_status: next }).eq("id", relatedId);
    if (error) {
      toast.error("تعذر تحديث الحالة: " + error.message);
      return;
    }
    toast.success("تم تحديث حالة المرفق");
    onChanged(next);
  };

  return (
    <div className="flex items-center gap-1 relative">
      <span
        onClick={() => canManage && setMenu((v) => !v)}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border whitespace-nowrap ${toneOf(ATTACHMENT_STATUS, status)} ${canManage ? "cursor-pointer hover:opacity-80" : ""}`}
        title={canManage ? "تغيير حالة المرفق" : ""}
      >
        {labelOf(ATTACHMENT_STATUS, status)}
        {canManage && <ChevronDown size={9} />}
      </span>
      {menu && (
        <div ref={menuRef} className="absolute z-30 top-full mt-1 right-0 rounded-lg border border-white/10 bg-background shadow-xl min-w-[140px] py-1">
          {(["attached", "not_attached", "not_required"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setStatus(v)}
              className="block w-full text-right px-3 py-1.5 text-[11px] hover:bg-white/5"
            >
              {labelOf(ATTACHMENT_STATUS, v)}
            </button>
          ))}
        </div>
      )}
      {canManage && (
        <button
          onClick={() => setOpen(true)}
          className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
          title="إرفاق ملف"
        >
          <Paperclip size={12} />
        </button>
      )}
      {open && (
        <QuickAttachDialog
          relatedType={relatedType}
          relatedId={relatedId}
          canDelete={canDelete}
          onClose={() => setOpen(false)}
          onAfter={async () => {
            // Re-read status from DB (trigger will have flipped it).
            const { data } = await supabase.from(table).select("attachment_status").eq("id", relatedId).maybeSingle();
            if (data?.attachment_status) onChanged(data.attachment_status);
          }}
        />
      )}
    </div>
  );
}

function QuickAttachDialog({
  relatedType,
  relatedId,
  canDelete,
  onClose,
  onAfter,
}: {
  relatedType: RelatedType;
  relatedId: string;
  canDelete: boolean;
  onClose: () => void;
  onAfter: () => void | Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [type, setType] = useState(ATTACHMENT_TYPES[0]);
  const [uploading, setUploading] = useState(false);
  const [existing, setExisting] = useState<Att[]>([]);

  const loadExisting = async () => {
    const { data } = await supabase
      .from("finance_attachments")
      .select("id, file_url, file_name, attachment_type")
      .eq("related_type", relatedType)
      .eq("related_id", relatedId)
      .order("created_at", { ascending: false });
    setExisting((data as any) ?? []);
  };
  useEffect(() => {
    loadExisting();
  }, [relatedType, relatedId]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(e.target.files ?? []);
    if (next.length) setFiles((prev) => [...prev, ...next]);
    e.target.value = "";
  };

  const save = async () => {
    if (files.length === 0) {
      toast.error("اختر ملفًا واحدًا على الأقل");
      return;
    }
    setUploading(true);
    let failed = 0;
    for (const f of files) {
      try {
        await uploadOneAttachment(relatedType, relatedId, f, type);
      } catch (e) {
        console.error("upload failed", e);
        failed++;
      }
    }
    setUploading(false);
    if (failed > 0) {
      toast.error("تعذر رفع المرفق، حاول مرة أخرى.");
    } else {
      toast.success("تم رفع المرفق");
    }
    setFiles([]);
    await loadExisting();
    await onAfter();
    if (failed === 0) onClose();
  };

  const openFile = async (a: Att) => {
    const { data, error } = await supabase.storage.from("finance-attachments").createSignedUrl(a.file_url, 60 * 10);
    if (error || !data) {
      toast.error("تعذر فتح الملف");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const del = async (a: Att) => {
    if (!confirm("حذف المرفق؟")) return;
    await supabase.storage.from("finance-attachments").remove([a.file_url]);
    const { error } = await supabase.from("finance_attachments").delete().eq("id", a.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم الحذف");
    await loadExisting();
    await onAfter();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-background border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="font-semibold text-sm flex items-center gap-2"><Paperclip size={14} /> إرفاق ملف</div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <select value={type} onChange={(e) => setType(e.target.value)} className="px-2 py-1.5 rounded bg-background/60 border border-white/10 text-[12px] flex-1">
              {ATTACHMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-white/5 border border-white/10 text-[12px] cursor-pointer hover:bg-white/10">
              <Upload size={12} /> اختيار ملفات
              <input type="file" hidden multiple onChange={onPick} accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.csv" />
            </label>
          </div>
          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-white/5 text-[11px]">
                  <span className="truncate">{f.name} <span className="text-muted-foreground">· {(f.size / 1024).toFixed(0)} KB</span></span>
                  <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="p-1 hover:bg-red-500/20 text-red-300 rounded"><X size={11} /></button>
                </div>
              ))}
            </div>
          )}
          {existing.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="text-[11px] text-muted-foreground mb-1.5">المرفقات الحالية</div>
              <div className="space-y-1">
                {existing.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-white/5 text-[11px]">
                    <span className="truncate">{a.file_name}{a.attachment_type ? ` · ${a.attachment_type}` : ""}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openFile(a)} className="p-1 hover:bg-white/10 rounded" title="فتح"><Download size={11} /></button>
                      {canDelete && <button onClick={() => del(a)} className="p-1 hover:bg-red-500/20 text-red-300 rounded" title="حذف"><Trash2 size={11} /></button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-white/10">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px] bg-white/5 hover:bg-white/10">إغلاق</button>
          <button disabled={uploading || files.length === 0} onClick={save} className="px-4 py-1.5 rounded-lg text-[12px] bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30 disabled:opacity-50">
            {uploading ? "..." : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}
