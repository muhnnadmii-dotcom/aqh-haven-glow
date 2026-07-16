import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { fetchPeriods, fetchSummary, fmtSAR, fmtDate, validateReturn, fetchPendingDocumentInvoices, fetchRefundReview } from "@/lib/finance/vat-helpers";
import { AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, FileEdit, Paperclip, Undo2, ChevronDown, ChevronLeft, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/vat/")({
  ssr: false,
  component: VatDashboard,
});

// Map validation-issue `code` → destination for click-through.
// Only produce a Link when we have a trustworthy destination; otherwise render plain text.
function issueLinkProps(code: string, relatedId: number | string | null | undefined): { to: string; params?: any; search?: any } | null {
  if (relatedId == null) return null;
  const idStr = String(relatedId);
  switch (code) {
    // purchase invoice destinations
    case "missing_attachment":
    case "deductible_over_total":
    case "vat_rate_mismatch":
    case "provider_fees_unmatched":
    case "pending_review":
    case "duplicate_invoice":
      return { to: "/admin/finance/purchase-invoices/$id", params: { id: idStr } };
    // sales invoice destinations
    case "refund_needs_credit_note":
    case "refund_amount_mismatch":
      return { to: "/admin/finance/sales-invoices/$id", params: { id: idStr } };
    // refund_without_credit_note → related_id is sales_refunds.id; no direct route we can guarantee
    default:
      return null;
  }
}


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

  const { data: refundReview } = useQuery({
    queryKey: ["vat-refund-review", activeId],
    queryFn: () => fetchRefundReview(activeId),
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

          <RefundReviewPanel rows={refundReview ?? []} />





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
              <IssueList
                title="أخطاء حرجة"
                items={errors}
                loading={issuesLoading}
                tone="error"
                emptyText="لا توجد أخطاء تمنع الاعتماد."
              />
              <IssueList
                title="تنبيهات"
                items={warnings}
                loading={issuesLoading}
                tone="warning"
                emptyText="لا توجد تنبيهات."
              />
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

function IssueList({
  title, items, loading, tone, emptyText,
}: { title: string; items: any[]; loading: boolean; tone: "error" | "warning"; emptyText: string }) {
  const [showAll, setShowAll] = useState(false);
  const count = items.length;
  const shown = showAll ? items : items.slice(0, 6);
  const errorBorder = tone === "error"
    ? (count ? "border-rose-500/40 bg-rose-500/10" : "border-emerald-500/30 bg-emerald-500/5")
    : (count ? "border-amber-500/30 bg-amber-500/10" : "border-white/10 bg-white/5");
  const iconColor = tone === "error"
    ? (count ? "text-rose-300" : "text-emerald-300")
    : (count ? "text-amber-300" : "text-muted-foreground");
  const linkColor = tone === "error" ? "text-rose-200 hover:text-rose-100" : "text-amber-200 hover:text-amber-100";

  return (
    <div className={`rounded-xl border p-4 ${errorBorder}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        {loading ? (
          <AlertTriangle size={14} className="text-muted-foreground" />
        ) : count === 0 && tone === "error" ? (
          <CheckCircle2 size={14} className="text-emerald-300" />
        ) : (
          <AlertTriangle size={14} className={iconColor} />
        )}
        {title} {loading ? "(جاري التحقق…)" : `(${count})`}
      </div>
      <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground pr-1">
        {loading && <li>جاري تشغيل التحقق…</li>}
        {!loading && count === 0 && <li>{emptyText}</li>}
        {!loading && shown.map((e: any, i: number) => {
          const link = issueLinkProps(e.code, e.related_id);
          if (link) {
            return (
              <li key={i}>
                <Link
                  to={link.to}
                  params={link.params}
                  className={`flex items-start gap-1 rounded-md px-2 py-1 -mx-1 transition hover:bg-white/5 ${linkColor}`}
                >
                  <ExternalLink size={11} className="mt-0.5 opacity-70 shrink-0" />
                  <span className="flex-1">{e.message}</span>
                  <span className="text-[10px] opacity-70 shrink-0">فتح</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={i} className="flex items-start gap-1 px-2 py-1 -mx-1">
              <span className="w-2.5 shrink-0">•</span>
              <span className="flex-1">{e.message}</span>
            </li>
          );
        })}
      </ul>
      {!loading && count > 6 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-gold hover:underline"
        >
          {showAll ? (<><ChevronDown size={12} /> عرض أقل</>) : (<><ChevronLeft size={12} /> إظهار الكل ({count})</>)}
        </button>
      )}
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

const REFUND_CLASS_LABEL: Record<string, string> = {
  cancelled_order_no_invoice: "طلب ملغي بدون فاتورة",
  netted_in_source: "مُصفَّى من المصدر",
  credit_note_recorded: "إشعار دائن مسجل",
  needs_credit_note: "يحتاج إشعار دائن",
  amount_mismatch: "فرق مبالغ — يحتاج مراجعة",
};

const REFUND_CLASS_TONE: Record<string, string> = {
  cancelled_order_no_invoice: "text-muted-foreground",
  netted_in_source: "text-emerald-300",
  credit_note_recorded: "text-emerald-300",
  needs_credit_note: "text-amber-300",
  amount_mismatch: "text-rose-300",
};

function RefundReviewPanel({ rows }: { rows: any[] }) {
  if (!rows.length) return null;
  const counts = rows.reduce<Record<string, number>>((a, r) => {
    a[r.classification] = (a[r.classification] ?? 0) + 1;
    return a;
  }, {});
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Undo2 size={14} className="text-sky-300" />
          مراجعة المرتجعات ({rows.length})
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {Object.entries(counts).map(([k, v]) => (
            <span key={k} className={`px-2 py-0.5 rounded-md bg-white/5 border border-white/10 ${REFUND_CLASS_TONE[k] ?? ""}`}>
              {REFUND_CLASS_LABEL[k] ?? k}: <span className="font-mono">{v}</span>
            </span>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        تصنيف كل طلب فيه مرتجع داخل الفترة. الطلبات الملغاة والمُصفّاة من المصدر لا تحتاج أي إجراء ولا تُنشئ إشعارًا. الإجراءات
        <span className="text-amber-200"> يحتاج إشعار دائن </span>
        و
        <span className="text-rose-200"> فرق مبالغ </span>
        فقط هي التي تحتاج تدخّلًا يدويًا — لا يتم إنشاء أي إشعار تلقائيًا.
      </p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-[12px] min-w-[820px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-right p-2">الطلب</th>
              <th className="text-right p-2">الفاتورة</th>
              <th className="text-right p-2">المزوّد</th>
              <th className="text-right p-2">البيع</th>
              <th className="text-right p-2">المرتجع</th>
              <th className="text-right p-2">قيمة الفاتورة</th>
              <th className="text-right p-2">التصنيف</th>
              <th className="text-right p-2">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.external_order_id}-${i}`} className="border-t border-white/10 hover:bg-white/5">
                <td className="p-2 font-mono">{r.external_order_id}</td>
                <td className="p-2">
                  {r.sales_invoice_id ? (
                    <Link
                      to="/admin/finance/sales-invoices/$id"
                      params={{ id: String(r.sales_invoice_id) }}
                      className="text-gold hover:underline font-mono"
                    >
                      {r.invoice_number ?? `#${r.sales_invoice_id}`}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-2">{r.provider_name ?? "—"}</td>
                <td className="p-2 font-mono">{fmtSAR(r.gross_sale)}</td>
                <td className="p-2 font-mono text-rose-200">{fmtSAR(r.refund_total)}</td>
                <td className="p-2 font-mono">{r.invoice_total != null ? fmtSAR(r.invoice_total) : "—"}</td>
                <td className={`p-2 ${REFUND_CLASS_TONE[r.classification] ?? ""}`}>
                  {REFUND_CLASS_LABEL[r.classification] ?? r.classification}
                </td>
                <td className="p-2 text-[11px]">
                  {r.action_required === "create_credit_note" && <span className="text-amber-300">إنشاء إشعار دائن يدويًا</span>}
                  {r.action_required === "review" && <span className="text-rose-300">مراجعة يدوية</span>}
                  {r.action_required === "none" && <span className="text-muted-foreground">لا يوجد</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
