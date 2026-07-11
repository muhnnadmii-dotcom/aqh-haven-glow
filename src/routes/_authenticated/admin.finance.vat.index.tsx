import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { fetchPeriods, fetchSummary, fmtSAR, fmtDate, validateReturn } from "@/lib/finance/vat-helpers";
import { AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, FileEdit } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/vat/")({
  ssr: false,
  component: VatDashboard,
});

function VatDashboard() {
  const [selectedId, setSelectedId] = useState<string>("");
  const { data: periods } = useQuery({ queryKey: ["vat-periods"], queryFn: fetchPeriods });

  const activeId = useMemo(() => {
    if (selectedId) return selectedId;
    return periods?.[0]?.id ?? "";
  }, [selectedId, periods]);

  const { data: summary, isLoading } = useQuery({
    queryKey: ["vat-summary", activeId],
    queryFn: () => fetchSummary(activeId),
    enabled: !!activeId,
  });

  const { data: issues } = useQuery({
    queryKey: ["vat-validate", activeId],
    queryFn: () => validateReturn(activeId),
    enabled: !!activeId,
  });

  const errors = (issues ?? []).filter((i: any) => i.severity === "error");
  const warnings = (issues ?? []).filter((i: any) => i.severity === "warning");

  if (!periods || periods.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center space-y-3">
        <div className="text-sm">لا توجد فترات ضريبية بعد.</div>
        <Link to="/admin/finance/vat/periods" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[12px]">
          إنشاء فترة أولى
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] text-muted-foreground">اختر الفترة</label>
        <select
          value={activeId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px]"
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {fmtDate(p.start_date)} → {fmtDate(p.end_date)}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <div className="text-[12px] text-muted-foreground">جاري الحساب…</div>}

      {summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              label="ضريبة المخرجات"
              value={fmtSAR(summary.sales.output_vat)}
              sub={`مبيعات خاضعة: ${fmtSAR(summary.sales.standard_taxable)}`}
              icon={<TrendingUp size={14} className="text-emerald-400" />}
            />
            <Kpi
              label="ضريبة المدخلات القابلة للخصم"
              value={fmtSAR(summary.purchases.deductible)}
              sub={`إجمالي مدخلات: ${fmtSAR(summary.purchases.input_vat_total)}`}
              icon={<TrendingDown size={14} className="text-rose-400" />}
            />
            <Kpi
              label={summary.result.net_due > 0 ? "صافي المستحق للهيئة" : "رصيد دائن مرحّل"}
              value={fmtSAR(summary.result.net_due > 0 ? summary.result.net_due : summary.result.net_credit)}
              sub={summary.result.carried_credit_in > 0 ? `رصيد سابق: ${fmtSAR(summary.result.carried_credit_in)}` : undefined}
              highlight={summary.result.net_due > 0 ? "danger" : "success"}
            />
            <Kpi
              label="غير قابل للخصم"
              value={fmtSAR(summary.purchases.non_deductible)}
              sub="لا يُخصم من الإقرار"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Card title="ملخص المبيعات">
              <Row label="خاضع 15%" value={fmtSAR(summary.sales.standard_taxable)} />
              <Row label="ضريبة مخرجات" value={fmtSAR(summary.sales.output_vat)} />
              <Row label="صفري" value={fmtSAR(summary.sales.zero_rated)} />
              <Row label="معفى" value={fmtSAR(summary.sales.exempt)} />
              <Row label="خارج نطاق الضريبة" value={fmtSAR(summary.sales.out_of_scope)} />
            </Card>
            <Card title="ملخص المشتريات">
              <Row label="خاضع 15%" value={fmtSAR(summary.purchases.standard_taxable)} />
              <Row label="ضريبة مدخلات" value={fmtSAR(summary.purchases.input_vat_total)} />
              <Row label="قابل للخصم" value={fmtSAR(summary.purchases.deductible)} />
              <Row label="غير قابل للخصم" value={fmtSAR(summary.purchases.non_deductible)} />
              <Row label="صفري" value={fmtSAR(summary.purchases.zero_rated)} />
              <Row label="معفى" value={fmtSAR(summary.purchases.exempt)} />
            </Card>
            <Card title="مؤشرات المراجعة">
              <Row label="فواتير تنتظر المراجعة" value={String(summary.purchases.pending_review)} />
              <Row label="فواتير بدون مرفق" value={String(summary.purchases.missing_attachment)} />
              <Row label="فواتير مشتبه تكرارها" value={String(summary.purchases.suspected_duplicates)} />
              <div className="pt-2 mt-2 border-t border-white/10 flex gap-2">
                <Link to="/admin/finance/vat/excluded" className="text-[11px] text-gold hover:underline">عرض المستبعدة</Link>
                <Link to="/admin/finance/vat/draft" className="text-[11px] text-gold hover:underline">مسودة الإقرار</Link>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`rounded-xl border p-4 ${errors.length ? "border-rose-500/40 bg-rose-500/10" : "border-emerald-500/30 bg-emerald-500/5"}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {errors.length ? <AlertTriangle size={14} className="text-rose-300" /> : <CheckCircle2 size={14} className="text-emerald-300" />}
                أخطاء حرجة ({errors.length})
              </div>
              <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground list-disc pr-4 max-h-32 overflow-auto">
                {errors.length === 0 && <li>لا توجد أخطاء تمنع الاعتماد.</li>}
                {errors.slice(0, 6).map((e: any, i: number) => <li key={i}>{e.message}</li>)}
              </ul>
            </div>
            <div className={`rounded-xl border p-4 ${warnings.length ? "border-amber-500/30 bg-amber-500/10" : "border-white/10 bg-white/5"}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle size={14} className={warnings.length ? "text-amber-300" : "text-muted-foreground"} />
                تنبيهات ({warnings.length})
              </div>
              <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground list-disc pr-4 max-h-32 overflow-auto">
                {warnings.length === 0 && <li>لا توجد تنبيهات.</li>}
                {warnings.slice(0, 6).map((e: any, i: number) => <li key={i}>{e.message}</li>)}
              </ul>
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              to="/admin/finance/vat/draft"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold/20 border border-gold/40 text-gold text-[12px]"
            >
              <FileEdit size={13} /> فتح مسودة الإقرار
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, icon, highlight }: { label: string; value: string; sub?: string; icon?: React.ReactNode; highlight?: "success" | "danger" }) {
  const cls =
    highlight === "success"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : highlight === "danger"
      ? "border-rose-500/30 bg-rose-500/5"
      : "border-white/10 bg-white/5";
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        {icon}
      </div>
      <div className="text-lg font-semibold mt-1">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
