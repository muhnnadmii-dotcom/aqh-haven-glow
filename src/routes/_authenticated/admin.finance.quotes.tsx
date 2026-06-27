import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Copy, Trash2, FileText, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_authenticated/admin/finance/quotes")({
  ssr: false,
  component: QuotesList,
});

const SAR = (n: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(n || 0);

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة", sent: "مُرسل", accepted: "مقبول", rejected: "مرفوض",
};
const STATUS_CLASS: Record<string, string> = {
  draft: "bg-white/10 text-muted-foreground border-white/20",
  sent: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  accepted: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
};

function QuotesList() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const listQ = useQuery({
    queryKey: ["aqh_quotes_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_quotes")
        .select("id,quote_no,client_name,project_name,grand_total,status,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return listQ.data ?? [];
    return (listQ.data ?? []).filter((r: any) =>
      (r.quote_no ?? "").toLowerCase().includes(t) ||
      (r.client_name ?? "").toLowerCase().includes(t) ||
      (r.project_name ?? "").toLowerCase().includes(t)
    );
  }, [listQ.data, q]);

  const dupM = useMutation({
    mutationFn: async (id: number) => {
      const { data: src, error } = await supabase.from("aqh_quotes").select("*").eq("id", id).maybeSingle();
      if (error || !src) throw error ?? new Error("not found");
      const { id: _id, quote_no: _qn, created_at: _ca, updated_at: _ua, ...rest } = src as any;
      const { data: ins, error: e2 } = await supabase
        .from("aqh_quotes")
        .insert({ ...rest, quote_no: null, status: "draft" })
        .select("id")
        .single();
      if (e2) throw e2;
      return ins.id as number;
    },
    onSuccess: () => { toast.success("تم نسخ العرض"); qc.invalidateQueries({ queryKey: ["aqh_quotes_list"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل النسخ"),
  });

  const delM = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("aqh_quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["aqh_quotes_list"] }); },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحذف"),
  });

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText size={18} className="text-gold" /> عروض الأسعار
          </h2>
          <p className="text-xs text-muted-foreground">إنشاء وإدارة عروض الأسعار للعملاء</p>
        </div>
        <Link
          to="/admin/finance/quotes/$id"
          params={{ id: "new" }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30"
        >
          <Plus size={14} /> عرض جديد
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث برقم العرض أو العميل أو المشروع…" className="pr-9" />
      </div>

      {listQ.isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="inline-block animate-spin" size={16} /> جارٍ التحميل…
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground border border-dashed border-white/10 rounded-xl">
          لا توجد عروض بعد — أنشئ أول عرض سعر.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-[12px]">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="text-start px-3 py-2">رقم العرض</th>
                <th className="text-start px-3 py-2">العميل</th>
                <th className="text-start px-3 py-2">المشروع</th>
                <th className="text-start px-3 py-2">الإجمالي</th>
                <th className="text-start px-3 py-2">الحالة</th>
                <th className="text-start px-3 py-2">التاريخ</th>
                <th className="text-start px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-3 py-2 font-mono" dir="ltr">{r.quote_no ?? "—"}</td>
                  <td className="px-3 py-2">{r.client_name ?? "—"}</td>
                  <td className="px-3 py-2">{r.project_name ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{SAR(Number(r.grand_total) || 0)} ر.س</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={`text-[10px] ${STATUS_CLASS[r.status] ?? STATUS_CLASS.draft}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground" dir="ltr">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString("ar-SA") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Link
                        to="/admin/finance/quotes/$id"
                        params={{ id: String(r.id) }}
                        className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10"
                      >
                        فتح
                      </Link>
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => dupM.mutate(r.id)} title="نسخ">
                        <Copy size={11} />
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-7 px-2 text-red-300 border-red-500/30 hover:bg-red-500/10"
                        onClick={() => { if (confirm("حذف العرض؟")) delM.mutate(r.id); }} title="حذف"
                      >
                        <Trash2 size={11} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
