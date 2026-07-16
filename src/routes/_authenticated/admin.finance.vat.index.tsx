import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { fetchPeriods, fetchSummary, fmtSAR, fmtDate, validateReturn, fetchPendingDocumentInvoices } from "@/lib/finance/vat-helpers";
import { AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, FileEdit, Paperclip } from "lucide-react";

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

  const { data: issues, isLoading: issuesLoading, isError: issuesFailed, error: issuesError } = useQuery({
    queryKey: ["vat-validate", activeId],
    queryFn: () => validateReturn(activeId),
    enabled: !!activeId,
    retry: false,
  });

  const { data: pendingDocs } = useQuery({
    queryKey: ["vat-pending-docs", activeId],
    queryFn: () => fetchPendingDocumentInvoices(activeId),
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
              sub={
                Number(summary.purchases.pending_document_vat ?? 0) > 0
                  ? `قبل الاستبعاد: ${fmtSAR(summary.purchases.deductible_gross ?? summary.purchases.deductible)} · معلّق مستند: ${fmtSAR(summary.purchases.pending_document_vat)}`
                  : `إجمالي مدخلات: ${fmtSAR(summary.purchases.input_vat_total)}`
              }
              icon={<TrendingDown size={14} className="text-rose-400" />}
            />
            <Kpi
              label={summary.result.net_due > 0 ? "صافي المستحق للهيئة" : "رصيد دائن مرحّل"}
              value={fmtSAR(summary.result.net_due > 0 ? summary.result.net_due : summary.result.net_credit)}
              sub={summary.result.carried_credit_in > 0 ? `رصيد سابق: ${fmtSAR(summary.result.carried_credit_in)}` : undefined}
              highlight={summary.result.net_due > 0 ? "danger" : "success"}
            />
            <Kpi
              label="معلّق مستند (لا يخصم مؤقتًا)"
              value={fmtSAR(summary.purchases.pending_document_vat ?? 0)}
              sub="ضريبة فواتير بدون مرفق — تُستعاد بعد رفع المستند"
              highlight={Number(summary.purchases.pending_document_vat ?? 0) > 0 ? "danger" : undefined}
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
              <Row label="قابل للخصم (فعلي)" value={fmtSAR(summary.purchases.deductible)} />
              <Row label="معلّق مستند" value={fmtSAR(summary.purchases.pending_document_vat ?? 0)} />
              <Row label="غير قابل للخصم" value={fmtSAR(summary.purchases.non_deductible)} />
              <Row label="صفري" value={fmtSAR(summary.purchases.zero_rated)} />
              <Row label="معفى" value={fmtSAR(summary.purchases.exempt)} />
            </Card>
            <Card title="مؤشرات المراجعة">
              <Row label="فواتير تنتظر المراجعة" value={String(summary.purchases.pending_review)} />
              <Row label="فواتير بدون مرفق" value={String(summary.purchases.missing_attachment)} />
              <Row label="فواتير مشتبه تكرارها" value={String(summary.purchases.suspected_duplicates)} />
              <div className="pt-2 mt-2 border-t border-white/10 flex gap-2">
                <Link to="/admin/finance/vat/excluded" className="text-[11px] text-gold hover:underline">مستندات تنتظر المراجعة</Link>
                <Link to="/admin/finance/vat/draft" className="text-[11px] text-gold hover:underline">مسودة الإقرار</Link>
              </div>
            </Card>
          </div>

          <PendingDocumentsPanel rows={pendingDocs ?? []} />



          {issuesFailed ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-200">
                <AlertTriangle size={14} className="text-rose-300" />
                تعذّر تشغيل التحقق من الإقرار
              </div>
              <p className="mt-2 text-[11px] text-rose-100/80">
                {(issuesError as any)?.message ?? "حدث خطأ أثناء تنفيذ vat_validate_return."}
              </p>
              <p className="mt-1 text-[11px] text-rose-100/60">
                لا يمكن اعتبار النتيجة "بدون أخطاء" ما دام التحقق فشل.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className={`rounded-xl border p-4 ${errors.length ? "border-rose-500/40 bg-rose-500/10" : "border-emerald-500/30 bg-emerald-500/5"}`}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {issuesLoading ? (
                    <AlertTriangle size={14} className="text-muted-foreground" />
                  ) : errors.length ? (
                    <AlertTriangle size={14} className="text-rose-300" />
                  ) : (
                    <CheckCircle2 size={14} className="text-emerald-300" />
                  )}
                  أخطاء حرجة {issuesLoading ? "(جاري التحقق…)" : `(${errors.length})`}
                </div>
                <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground list-disc pr-4 max-h-32 overflow-auto">
                  {issuesLoading && <li>جاري تشغيل التحقق…</li>}
                  {!issuesLoading && errors.length === 0 && <li>لا توجد أخطاء تمنع الاعتماد.</li>}
                  {!issuesLoading && errors.slice(0, 6).map((e: any, i: number) => <li key={i}>{e.message}</li>)}
                </ul>
              </div>
              <div className={`rounded-xl border p-4 ${warnings.length ? "border-amber-500/30 bg-amber-500/10" : "border-white/10 bg-white/5"}`}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle size={14} className={warnings.length ? "text-amber-300" : "text-muted-foreground"} />
                  تنبيهات {issuesLoading ? "(جاري التحقق…)" : `(${warnings.length})`}
                </div>
                <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground list-disc pr-4 max-h-32 overflow-auto">
                  {issuesLoading && <li>جاري تشغيل التحقق…</li>}
                  {!issuesLoading && warnings.length === 0 && <li>لا توجد تنبيهات.</li>}
                  {!issuesLoading && warnings.slice(0, 6).map((e: any, i: number) => <li key={i}>{e.message}</li>)}
                </ul>
              </div>
            </div>
          )}

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

function PendingDocumentsPanel({ rows }: { rows: any[] }) {
  const total = rows.reduce((s, r) => s + Number(r.pending_vat_amount || 0), 0);
  return (
    <div className={`rounded-xl border p-4 ${rows.length ? "border-amber-500/40 bg-amber-500/10" : "border-emerald-500/25 bg-emerald-500/5"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip size={14} className={rows.length ? "text-amber-300" : "text-emerald-300"} />
          فواتير تحتاج مستند {rows.length ? `(${rows.length})` : ""}
        </div>
        <div className="text-[12px] text-muted-foreground">
          إجمالي الضريبة المعلّقة:{" "}
          <span className={`font-mono font-semibold ${rows.length ? "text-amber-200" : "text-foreground"}`}>{fmtSAR(total)}</span>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          كل فواتير الفترة التي تخصم ضريبة لديها مرفق أو استثناء موثق.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[11px] text-muted-foreground">
            هذه الفواتير ضريبتها لا تُخصم في الإقرار إلى حين إرفاق فاتورة المورد. الضريبة تبقى ضمن إجمالي المدخلات ولا تُحسب ضمن غير القابل للخصم.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-[12px] min-w-[640px]">
              <thead className="bg-white/5 text-muted-foreground">
                <tr>
                  <th className="text-right p-2">المرجع</th>
                  <th className="text-right p-2">المورد</th>
                  <th className="text-right p-2">التاريخ</th>
                  <th className="text-right p-2">الضريبة المعلّقة</th>
                  <th className="text-right p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.invoice_id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="p-2">
                      <div className="font-mono">{r.internal_reference}</div>
                      {r.supplier_invoice_number && (
                        <div className="text-[10px] text-muted-foreground">مورد: {r.supplier_invoice_number}</div>
                      )}
                    </td>
                    <td className="p-2">{r.supplier_name || "—"}</td>
                    <td className="p-2">{fmtDate(r.invoice_date)}</td>
                    <td className="p-2 font-mono text-amber-200">{fmtSAR(r.pending_vat_amount)}</td>
                    <td className="p-2">
                      <Link
                        to="/admin/finance/purchase-invoices/$id"
                        params={{ id: String(r.invoice_id) }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gold/15 border border-gold/30 text-gold text-[11px]"
                      >
                        فتح ورفع المستند
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
