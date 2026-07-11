import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, LockOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/finance/periods")({
  ssr: false,
  component: PeriodsPage,
});

function PeriodsPage() {
  const qc = useQueryClient();
  const [startDate, setStartDate] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["acct-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("accounting_settings").select("*").eq("id", 1).maybeSingle();
      if (data?.accounting_start_date) setStartDate(data.accounting_start_date);
      return data;
    },
  });

  const { data: periods, isLoading } = useQuery({
    queryKey: ["periods"],
    queryFn: async () => {
      const { data } = await supabase.from("accounting_periods").select("*").order("start_date", { ascending: false });
      return data || [];
    },
  });

  const saveSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("accounting_settings").update({ accounting_start_date: startDate || null }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["acct-settings"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const ensurePeriod = useMutation({
    mutationFn: async (date: string) => {
      const { error } = await supabase.rpc("ensure_accounting_period", { p_date: date });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["periods"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const close = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("close_accounting_period", { p_period_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الإغلاق"); qc.invalidateQueries({ queryKey: ["periods"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const reopen = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc("reopen_accounting_period", { p_period_id: id, p_reason: reason });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم فتح الفترة"); qc.invalidateQueries({ queryKey: ["periods"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">الفترات المحاسبية</h2>

      <div className="border border-gold/30 rounded-xl p-4 bg-gold/5 space-y-2">
        <label className="text-sm font-medium">تاريخ بداية المحاسبة</label>
        <p className="text-xs text-muted-foreground">لا ينشئ النظام قيودًا آلية للحركات قبل هذا التاريخ.</p>
        <div className="flex gap-2 items-center">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="max-w-xs" />
          <Button size="sm" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>حفظ</Button>
          <span className="text-xs text-muted-foreground">
            الحالي: {settings?.accounting_start_date || "غير محدد"}
          </span>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <Input type="date" id="new-period-date" placeholder="أنشئ فترة لتاريخ..." className="max-w-xs" />
        <Button size="sm" onClick={() => {
          const el = document.getElementById("new-period-date") as HTMLInputElement;
          if (el?.value) ensurePeriod.mutate(el.value);
        }}><Plus size={14} className="ml-1" /> إنشاء فترة الشهر</Button>
      </div>

      {isLoading ? <Loader2 className="animate-spin" /> : (
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs">
              <tr>
                <th className="p-2 text-right">الفترة</th>
                <th className="p-2 text-right">من</th>
                <th className="p-2 text-right">إلى</th>
                <th className="p-2 text-right">الحالة</th>
                <th className="p-2 text-right">سبب إعادة الفتح</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {(periods || []).map((p: any) => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="p-2 font-mono">{p.label}</td>
                  <td className="p-2">{p.start_date}</td>
                  <td className="p-2">{p.end_date}</td>
                  <td className="p-2"><Badge variant={p.status === "closed" ? "destructive" : "outline"}>{p.status === "closed" ? "مغلقة" : p.status === "under_review" ? "مراجعة" : "مفتوحة"}</Badge></td>
                  <td className="p-2 text-xs text-muted-foreground">{p.reopen_reason}</td>
                  <td className="p-2">
                    {p.status === "closed" ? (
                      <Button size="sm" variant="ghost" onClick={() => { const r = prompt("سبب إعادة الفتح:"); if (r) reopen.mutate({ id: p.id, reason: r }); }}>
                        <LockOpen size={12} className="ml-1" /> إعادة فتح
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("إغلاق الفترة؟ لن يمكن ترحيل قيود داخلها.")) close.mutate(p.id); }}>
                        <Lock size={12} className="ml-1" /> إغلاق
                      </Button>
                    )}
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
