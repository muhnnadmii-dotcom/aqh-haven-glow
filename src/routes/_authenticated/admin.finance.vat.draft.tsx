import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchPeriods, fetchSummary, validateReturn, markAsFiled, fmtSAR, fmtDate } from "@/lib/finance/vat-helpers";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { AlertTriangle, CheckCircle2, Lock, Printer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/finance/vat/draft")({
  ssr: false,
  component: VatDraftPage,
});

function VatDraftPage() {
  const qc = useQueryClient();
  const roles = useFinanceRoles();
  const canManage = roles.canManage;

  const [selectedId, setSelectedId] = useState("");
  const { data: periods } = useQuery({ queryKey: ["vat-periods"], queryFn: fetchPeriods });
  const activeId = selectedId || periods?.[0]?.id || "";
  const activePeriod = periods?.find((p) => p.id === activeId);

  const { data: summary } = useQuery({
    queryKey: ["vat-summary", activeId],
    queryFn: () => fetchSummary(activeId),
    enabled: !!activeId,
  });
  const { data: issues, isLoading: issuesLoading, isError: issuesFailed, error: issuesError } = useQuery({
    queryKey: ["vat-validate", activeId],
    queryFn: () => validateReturn(activeId),
    enabled: !!activeId,
    retry: false,
  });
  const errors = (issues ?? []).filter((i: any) => i.severity === "error");
  const warnings = (issues ?? []).filter((i: any) => i.severity === "warning");
  const [overrideReason, setOverrideReason] = useState("");

  const fileIt = useMutation({
    mutationFn: () => markAsFiled(activeId, errors.length ? overrideReason : undefined),
    onSuccess: () => {
      toast.success("تم تجميد الإقرار وحفظ نسخة نهائية");
      setOverrideReason("");
      qc.invalidateQueries({ queryKey: ["vat-periods"] });
      qc.invalidateQueries({ queryKey: ["vat-snapshots"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const alreadyFiled = activePeriod && ["filed", "paid", "closed"].includes(activePeriod.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-muted-foreground">الفترة</label>
          <select value={activeId} onChange={(e) => setSelectedId(e.target.value)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px]">
            {(periods ?? []).map((p) => (
              <option key={p.id} value={p.id}>{fmtDate(p.start_date)} → {fmtDate(p.end_date)}</option>
            ))}
          </select>
        </div>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px]">
          <Printer size={12} /> طباعة
        </button>
      </div>

      {summary && (
        <div className="rounded-xl border border-gold/30 bg-gold/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] tracking-[0.3em] text-gold/80 uppercase">VAT Return Draft</div>
              <div className="text-sm font-semibold mt-1">مسودة إقرار ضريبة القيمة المضافة</div>
              <div className="text-[11px] text-muted-foreground">
                عن الفترة {fmtDate(summary.start_date)} → {fmtDate(summary.end_date)}
              </div>
            </div>
            {alreadyFiled && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px]">
                <Lock size={11} /> مجمّد
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Section title="المبيعات">
              <Line label="مبيعات خاضعة 15%" value={fmtSAR(summary.sales.standard_taxable)} />
              <Line label="ضريبة المخرجات" value={fmtSAR(summary.sales.output_vat)} strong />
              <Line label="مبيعات صفرية" value={fmtSAR(summary.sales.zero_rated)} />
              <Line label="مبيعات معفاة" value={fmtSAR(summary.sales.exempt)} />
              <Line label="خارج نطاق الضريبة" value={fmtSAR(summary.sales.out_of_scope)} />
            </Section>
            <Section title="المشتريات">
              <Line label="مشتريات خاضعة 15%" value={fmtSAR(summary.purchases.standard_taxable)} />
              <Line label="ضريبة المدخلات (إجمالي)" value={fmtSAR(summary.purchases.input_vat_total)} />
              <Line label="القابل للخصم" value={fmtSAR(summary.purchases.deductible)} strong />
              <Line label="غير القابل للخصم" value={fmtSAR(summary.purchases.non_deductible)} />
            </Section>
          </div>

          <div className="border-t border-white/10 pt-3">
            <Section title="نتيجة الإقرار">
              <Line label="ضريبة المخرجات" value={fmtSAR(summary.result.output_vat)} />
              <Line label="ضريبة المدخلات القابلة للخصم" value={`- ${fmtSAR(summary.result.deductible_input_vat)}`} />
              <Line label="رصيد دائن مرحّل سابق" value={`- ${fmtSAR(summary.result.carried_credit_used)}`} />
              {summary.result.net_due > 0 ? (
                <Line label="صافي المستحق للهيئة" value={fmtSAR(summary.result.net_due)} strong highlight="danger" />
              ) : (
                <Line label="رصيد دائن يُرحّل" value={fmtSAR(summary.result.net_credit)} strong highlight="success" />
              )}
            </Section>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={`rounded-xl border p-4 ${errors.length ? "border-rose-500/40 bg-rose-500/10" : "border-emerald-500/30 bg-emerald-500/5"}`}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            {errors.length ? <AlertTriangle size={14} className="text-rose-300" /> : <CheckCircle2 size={14} className="text-emerald-300" />}
            أخطاء حرجة ({errors.length})
          </div>
          <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground list-disc pr-4 max-h-40 overflow-auto">
            {errors.length === 0 && <li>لا توجد أخطاء تمنع الاعتماد.</li>}
            {errors.map((e: any, i: number) => <li key={i}>{e.message}</li>)}
          </ul>
        </div>
        <div className={`rounded-xl border p-4 ${warnings.length ? "border-amber-500/30 bg-amber-500/10" : "border-white/10 bg-white/5"}`}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle size={14} className={warnings.length ? "text-amber-300" : "text-muted-foreground"} />
            تنبيهات ({warnings.length})
          </div>
          <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground list-disc pr-4 max-h-40 overflow-auto">
            {warnings.length === 0 && <li>لا توجد تنبيهات.</li>}
            {warnings.map((e: any, i: number) => <li key={i}>{e.message}</li>)}
          </ul>
        </div>
      </div>

      {!alreadyFiled && canManage && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="text-sm font-semibold">تجميد الإقرار (تعليم كمقدَّم)</div>
          <p className="text-[11px] text-muted-foreground">
            بعد التجميد لا يمكن تغيير أرقام هذه الفترة، وسيتم حفظ نسخة نهائية للرجوع إليها.
            هذه الوحدة داخلية فقط ولا ترسل الإقرار للهيئة.
          </p>
          {errors.length > 0 && (
            <input
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="سبب تجاوز الأخطاء الحرجة (إلزامي)"
              className="w-full px-2 py-1.5 rounded bg-white/5 border border-rose-500/30 text-[12px]"
            />
          )}
          <div className="flex justify-end">
            <button
              onClick={() => fileIt.mutate()}
              disabled={fileIt.isPending || (errors.length > 0 && !overrideReason.trim())}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold/20 border border-gold/40 text-gold text-[12px] disabled:opacity-50"
            >
              <Lock size={13} /> {fileIt.isPending ? "جاري التجميد…" : "تجميد وحفظ الإقرار"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-gold/80 uppercase tracking-widest mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Line({ label, value, strong, highlight }: { label: string; value: string; strong?: boolean; highlight?: "success" | "danger" }) {
  const color = highlight === "success" ? "text-emerald-300" : highlight === "danger" ? "text-rose-300" : "";
  return (
    <div className="flex items-center justify-between text-[12px]">
      <div className="text-muted-foreground">{label}</div>
      <div className={`${strong ? "font-semibold" : ""} ${color}`}>{value}</div>
    </div>
  );
}
