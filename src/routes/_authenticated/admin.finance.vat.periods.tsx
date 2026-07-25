import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, CalendarRange } from "lucide-react";
import { fetchPeriods, labelStatus, fmtDate, type TaxPeriod } from "@/lib/finance/vat-helpers";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";

const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const Route = createFileRoute("/_authenticated/admin/finance/vat/periods")({
  ssr: false,
  component: VatPeriodsPage,
});

function VatPeriodsPage() {
  const qc = useQueryClient();
  const roles = useFinanceRoles();
  const canManage = roles.canManage;
  const [creating, setCreating] = useState(false);

  const { data: periods, isLoading } = useQuery({ queryKey: ["vat-periods"], queryFn: fetchPeriods });
  const { data: settings } = useQuery({
    queryKey: ["biz-settings-vat"],
    queryFn: async () => {
      const { data } = await supabase.from("aqh_business_settings" as any).select("*").eq("id", 1).maybeSingle();
      return data as any;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaxPeriod["status"] }) => {
      const { error } = await supabase.from("tax_periods" as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الحالة");
      qc.invalidateQueries({ queryKey: ["vat-periods"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">الفترات الضريبية</h3>
        {canManage && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[12px]"
          >
            <Plus size={12} /> إنشاء فترة جديدة
          </button>
        )}
      </div>

      {settings && !settings.vat_registered && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-200">
          المنشأة غير مسجلة في ضريبة القيمة المضافة حاليًا. فعّل «مسجل ضريبيًا» من إعدادات المالية لبدء إنشاء الفترات.
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
        <table className="w-full text-[12px] min-w-[720px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-right p-2">الفترة</th>
              <th className="text-right p-2">من</th>
              <th className="text-right p-2">إلى</th>
              <th className="text-right p-2">الاستحقاق</th>
              <th className="text-right p-2">الحالة</th>
              <th className="text-right p-2">تم التقديم</th>
              <th className="text-right p-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">جاري التحميل…</td></tr>
            )}
            {!isLoading && (periods ?? []).length === 0 && (
              <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">لا توجد فترات بعد.</td></tr>
            )}
            {(periods ?? []).map((p) => (
              <tr key={p.id} className="border-t border-white/10">
                <td className="p-2 font-medium">{fmtDate(p.start_date).slice(0, 7)}</td>
                <td className="p-2">{fmtDate(p.start_date)}</td>
                <td className="p-2">{fmtDate(p.end_date)}</td>
                <td className="p-2">{fmtDate(p.due_date)}</td>
                <td className="p-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] border ${
                    p.status === "filed" || p.status === "paid" || p.status === "closed"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : p.status === "ready" ? "bg-sky-500/10 border-sky-500/30 text-sky-300"
                      : p.status === "under_review" ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : "bg-white/5 border-white/10"
                  }`}>{labelStatus(p.status)}</span>
                </td>
                <td className="p-2">{fmtDate(p.filed_at)}</td>
                <td className="p-2 text-left">
                  {canManage && p.status !== "closed" && p.status !== "filed" && p.status !== "paid" && (
                    <select
                      value={p.status}
                      onChange={(e) => updateStatus.mutate({ id: p.id, status: e.target.value as any })}
                      className="px-2 py-1 rounded bg-background border border-white/10 text-[11px]"
                    >
                      <option value="open">مفتوحة</option>
                      <option value="under_review">قيد المراجعة</option>
                      <option value="ready">جاهزة</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <CreatePeriodDialog
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["vat-periods"] });
          }}
          defaultFrequency={settings?.filing_frequency ?? "monthly"}
        />
      )}
    </div>
  );
}

function CreatePeriodDialog({
  onClose,
  onSaved,
  defaultFrequency,
}: {
  onClose: () => void;
  onSaved: () => void;
  defaultFrequency: string;
}) {
  const today = new Date();
  const firstOfMonth = ymdLocal(new Date(today.getFullYear(), today.getMonth(), 1));
  const [freq, setFreq] = useState<"monthly" | "quarterly">(defaultFrequency as any);
  const [start, setStart] = useState(firstOfMonth);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const s = new Date(start);
    const months = freq === "monthly" ? 1 : 3;
    const end = new Date(s.getFullYear(), s.getMonth() + months, 0);
    const due = new Date(s.getFullYear(), s.getMonth() + months, 30);

    const { error } = await supabase.from("tax_periods" as any).insert({
      start_date: start,
      end_date: ymdLocal(end),
      due_date: ymdLocal(due),
      status: "open",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("تم إنشاء الفترة");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-background border border-white/10 p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <CalendarRange size={16} className="text-gold" />
          <div className="text-sm font-semibold">فترة ضريبية جديدة</div>
        </div>
        <label className="block">
          <div className="text-[11px] text-muted-foreground mb-1">التكرار</div>
          <select value={freq} onChange={(e) => setFreq(e.target.value as any)} className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]">
            <option value="monthly">شهري</option>
            <option value="quarterly">ربع سنوي</option>
          </select>
        </label>
        <label className="block">
          <div className="text-[11px] text-muted-foreground mb-1">تاريخ البداية</div>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px] bg-white/5">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-lg text-[12px] bg-gold/20 border border-gold/40 text-gold disabled:opacity-50">
            {saving ? "جاري الحفظ…" : "إنشاء"}
          </button>
        </div>
      </div>
    </div>
  );
}
