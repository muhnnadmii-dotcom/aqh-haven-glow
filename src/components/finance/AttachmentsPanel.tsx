import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ATTACHMENT_TYPES } from "@/lib/finance/constants";
import { Paperclip, Upload, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

type Att = { id: string; file_url: string; file_name: string; file_type: string | null; attachment_type: string | null; created_at: string };

export function AttachmentsPanel({ relatedType, relatedId, canManage }: { relatedType: "income" | "expense" | "supplier"; relatedId: string; canManage: boolean }) {
  const [rows, setRows] = useState<Att[]>([]);
  const [uploading, setUploading] = useState(false);
  const [type, setType] = useState(ATTACHMENT_TYPES[0]);

  const load = async () => {
    const { data } = await supabase.from("finance_attachments").select("*").eq("related_type", relatedType).eq("related_id", relatedId).order("created_at", { ascending: false });
    setRows((data as any) ?? []);
  };
  useEffect(() => { load(); }, [relatedType, relatedId]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${relatedType}/${relatedId}/${Date.now()}_${safe}`;
      const up = await supabase.storage.from("finance-attachments").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const ins = await supabase.from("finance_attachments").insert({
        related_type: relatedType,
        related_id: relatedId,
        file_url: path,
        file_name: file.name,
        file_type: file.type || null,
        attachment_type: type,
        uploaded_by: u.user?.id ?? null,
      });
      if (ins.error) throw ins.error;
      toast.success("تم رفع المرفق");
      e.target.value = "";
      load();
    } catch (err: any) {
      toast.error("تعذر الرفع: " + (err.message ?? "خطأ"));
    } finally { setUploading(false); }
  };

  const del = async (a: Att) => {
    if (!confirm("حذف المرفق؟")) return;
    await supabase.storage.from("finance-attachments").remove([a.file_url]);
    const { error } = await supabase.from("finance_attachments").delete().eq("id", a.id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); load(); }
  };

  const open = async (a: Att) => {
    const { data, error } = await supabase.storage.from("finance-attachments").createSignedUrl(a.file_url, 60 * 10);
    if (error || !data) { toast.error("تعذر فتح الملف"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[12px] font-semibold flex items-center gap-1.5"><Paperclip size={13} /> المرفقات</div>
        {canManage && (
          <div className="flex items-center gap-2">
            <select value={type} onChange={(e) => setType(e.target.value)} className="px-2 py-1 rounded bg-background/60 border border-white/10 text-[11px]">
              {ATTACHMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gold/15 border border-gold/30 text-gold text-[11px] cursor-pointer hover:bg-gold/25">
              <Upload size={11} /> {uploading ? "..." : "رفع"}
              <input type="file" hidden onChange={onPick} disabled={uploading} accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.csv" />
            </label>
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="text-[11px] text-muted-foreground text-center py-3">لا توجد مرفقات</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-white/5 text-[11px]">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip size={11} className="text-muted-foreground shrink-0" />
                <div className="truncate">
                  <span className="text-foreground">{a.file_name}</span>
                  {a.attachment_type && <span className="text-muted-foreground"> · {a.attachment_type}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => open(a)} className="p-1 hover:bg-white/10 rounded" title="فتح"><Download size={11} /></button>
                {canManage && <button onClick={() => del(a)} className="p-1 hover:bg-red-500/20 text-red-300 rounded" title="حذف"><Trash2 size={11} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
