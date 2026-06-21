import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Paperclip, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/finance/attachments")({
  ssr: false,
  component: AttachmentsPage,
});

function AttachmentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [type, setType] = useState("");
  const [related, setRelated] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("finance_attachments").select("*").order("created_at", { ascending: false });
      setRows(data ?? []);
    })();
  }, []);

  const open = async (a: any) => {
    const { data, error } = await supabase.storage.from("finance-attachments").createSignedUrl(a.file_url, 600);
    if (error || !data) { toast.error("تعذر فتح الملف"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const filtered = rows.filter((r) => (!type || r.attachment_type === type) && (!related || r.related_type === related));

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">كل المرفقات المالية</h2>
      <div className="flex flex-wrap gap-2">
        <select value={related} onChange={(e) => setRelated(e.target.value)} className="px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]">
          <option value="">كل الأنواع</option>
          <option value="income">دخل</option>
          <option value="expense">مصروف</option>
          <option value="supplier">مورد</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]">
          <option value="">كل أنواع المرفقات</option>
          {Array.from(new Set(rows.map((r) => r.attachment_type).filter(Boolean))).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-[12px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-start px-3 py-2">الاسم</th>
              <th className="text-start px-3 py-2">النوع</th>
              <th className="text-start px-3 py-2">يخص</th>
              <th className="text-start px-3 py-2">التاريخ</th>
              <th className="text-start px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="px-3 py-2 flex items-center gap-1.5"><Paperclip size={11} className="text-muted-foreground" />{r.file_name}</td>
                <td className="px-3 py-2">{r.attachment_type ?? "—"}</td>
                <td className="px-3 py-2">{r.related_type}</td>
                <td className="px-3 py-2">{new Date(r.created_at).toLocaleString("ar-SA")}</td>
                <td className="px-3 py-2"><button onClick={() => open(r)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px]"><Download size={11} /> فتح</button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد مرفقات</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
