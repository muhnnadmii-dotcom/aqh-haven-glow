import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, fmtSAR } from "@/lib/finance/vat-helpers";
import { Lock, Eye, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/vat/filed")({
  ssr: false,
  component: VatFiledPage,
});

function VatFiledPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ["vat-snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_return_snapshots" as any)
        .select("id, status, summary, filed_at, override_reason, period_id, tax_periods:period_id(start_date, end_date, status)")
        .eq("status", "marked_as_filed")
        .order("filed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const open = snapshots?.find((s) => s.id === openId);

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground">
        الإقرارات المجمّدة لا يمكن تعديلها، ويتم حفظ الأرقام كما كانت لحظة الاعتماد الداخلي.
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
        <table className="w-full text-[12px] min-w-[680px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-right p-2">الفترة</th>
              <th className="text-right p-2">تاريخ التجميد</th>
              <th className="text-right p-2">ضريبة مخرجات</th>
              <th className="text-right p-2">قابل للخصم</th>
              <th className="text-right p-2">الصافي</th>
              <th className="text-right p-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">جاري التحميل…</td></tr>}
            {!isLoading && (snapshots ?? []).length === 0 && (
              <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">لا توجد إقرارات مجمّدة بعد.</td></tr>
            )}
            {(snapshots ?? []).map((s: any) => {
              const r = s.summary?.result ?? {};
              const p = s.tax_periods;
              return (
                <tr key={s.id} className="border-t border-white/10">
                  <td className="p-2">{p ? `${fmtDate(p.start_date)} → ${fmtDate(p.end_date)}` : "—"}</td>
                  <td className="p-2">{fmtDate(s.filed_at)}</td>
                  <td className="p-2">{fmtSAR(r.output_vat)}</td>
                  <td className="p-2">{fmtSAR(r.deductible_input_vat)}</td>
                  <td className="p-2 font-semibold">
                    {r.net_due > 0 ? (
                      <span className="text-rose-300">مستحق {fmtSAR(r.net_due)}</span>
                    ) : (
                      <span className="text-emerald-300">دائن {fmtSAR(r.net_credit)}</span>
                    )}
                  </td>
                  <td className="p-2 text-left">
                    <button onClick={() => setOpenId(s.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-[11px]">
                      <Eye size={11} /> عرض
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setOpenId(null)}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-auto rounded-2xl bg-background border border-white/10 p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-emerald-300" />
                <div className="text-sm font-semibold">إقرار مجمّد — {fmtDate(open.filed_at)}</div>
              </div>
              <button onClick={() => setOpenId(null)}><X size={16} /></button>
            </div>
            <SnapshotView summary={open.summary} overrideReason={open.override_reason} />
          </div>
        </div>
      )}
    </div>
  );
}

function SnapshotView({ summary, overrideReason }: { summary: any; overrideReason?: string | null }) {
  if (!summary) return <div className="text-[12px] text-muted-foreground">لا توجد بيانات.</div>;
  return (
    <div className="space-y-3 text-[12px]">
      <div className="text-[11px] text-muted-foreground">
        الفترة: {fmtDate(summary.start_date)} → {fmtDate(summary.end_date)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Box title="المبيعات">
          <li>مبيعات خاضعة: {fmtSAR(summary.sales?.standard_taxable)}</li>
          <li>ضريبة مخرجات: {fmtSAR(summary.sales?.output_vat)}</li>
          <li>صفرية: {fmtSAR(summary.sales?.zero_rated)}</li>
          <li>معفاة: {fmtSAR(summary.sales?.exempt)}</li>
        </Box>
        <Box title="المشتريات">
          <li>خاضعة: {fmtSAR(summary.purchases?.standard_taxable)}</li>
          <li>مدخلات: {fmtSAR(summary.purchases?.input_vat_total)}</li>
          <li>قابل للخصم: {fmtSAR(summary.purchases?.deductible)}</li>
          <li>غير قابل: {fmtSAR(summary.purchases?.non_deductible)}</li>
        </Box>
      </div>
      <div className="rounded-lg border border-gold/30 bg-gold/5 p-3">
        <div className="text-[11px] tracking-widest text-gold/80 uppercase mb-2">النتيجة</div>
        <ul className="space-y-1">
          <li>ضريبة المخرجات: {fmtSAR(summary.result?.output_vat)}</li>
          <li>القابل للخصم: {fmtSAR(summary.result?.deductible_input_vat)}</li>
          <li>الصافي المستحق: {fmtSAR(summary.result?.net_due)}</li>
          <li>الرصيد الدائن: {fmtSAR(summary.result?.net_credit)}</li>
        </ul>
      </div>
      {overrideReason && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
          <div className="text-[11px] font-semibold mb-1">سبب تجاوز الأخطاء الحرجة</div>
          <div className="text-[11px]">{overrideReason}</div>
        </div>
      )}
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] font-semibold text-gold/80 uppercase tracking-widest mb-2">{title}</div>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}
