// Tabby-only steps for the settlement import page.
// Rendered when the user picks provider = "tabby". Never used for Salla or Tamara files.
//
// Owns the entire Tabby flow: structure guard, auto-mapping preview, per-group
// preview, and the multi-settlement commit (one payment_settlement row per
// Transfer Date). No sales invoices, incomes, or accounting entries are created
// here — settlement rows and lines only.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, AlertTriangle, Loader2, ShieldAlert, Search, ExternalLink } from "lucide-react";
import {
  TABBY_FIELDS,
  TABBY_SIGNATURE_HEADERS,
  autoMapTabby,
  checkTabbyStructure,
  buildTabbyRows,
  groupTabbyLines,
  computeTabbyFileTotals,
  type TabbyParsedLine,
  type TabbyGroupTotals,
  type TabbyFileTotals,
} from "@/lib/finance/tabby-import";

type Props = {
  step: 2 | 3;
  aoa: any[][];
  headerRow: number;
  file: File | null;
  fileHash: string;
  providerRow: { id: string } | null;
  canManage: boolean;
  onBack: () => void;                       // back to previous step
  onGotoPreview: () => void;                // move step to 3
};

const fmt = (n: number) => (isFinite(n) ? n.toFixed(2) : "—");
const chunkArr = <T,>(a: T[], n: number) => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };

// A line only counts as "already imported" when it lives inside a settlement that
// was committed and kept. Cancelled/draft settlements must never block re-import.
const COMMITTED_SETTLEMENT_STATUSES = new Set([
  "imported", "under_review", "matched", "partially_matched",
  "awaiting_payout", "paid", "fully_matched", "closed",
]);

type ExistingLineInfo = {
  settlement_id: string;
  reference: string;
  status: string;
  settlement_date: string | null;
  source_file_name: string | null;
  line_id: string;
  imported_at: string | null;
};

export function TabbySettlementImport({
  step, aoa, headerRow, file, fileHash, providerRow, canManage, onBack, onGotoPreview,
}: Props) {
  const nav = useNavigate();
  const headers = aoa[headerRow] ?? [];

  const structure = useMemo(() => checkTabbyStructure(headers), [headers]);
  const mapping = useMemo(() => autoMapTabby(headers), [headers]);

  const [lines, setLines] = useState<TabbyParsedLine[] | null>(null);
  const [groups, setGroups] = useState<TabbyGroupTotals[] | null>(null);
  const [totals, setTotals] = useState<TabbyFileTotals | null>(null);
  const [existingByFp, setExistingByFp] = useState<Map<string, ExistingLineInfo>>(new Map());
  const [existingFileHash, setExistingFileHash] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string>("");   // payout_date filter
  const [orderQuery, setOrderQuery] = useState<string>("");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Full state reset whenever a different file (hash) is loaded — no parsed rows,
  // fingerprints or preview caches may survive from the previous file.
  useEffect(() => {
    setLines(null); setGroups(null); setTotals(null);
    setExistingByFp(new Map()); setExistingFileHash(null);
    setGroupFilter(""); setOrderQuery(""); setExpandedGroup(null);
  }, [fileHash]);

  const missingRequired = TABBY_FIELDS.filter((f) => f.required).filter((f) => mapping[f.key] == null);

  async function buildAndCheck() {
    if (!structure.isTabbyShape) {
      toast.error(`الملف لا يحمل توقيع كشف تابي. أعمدة مفقودة: ${structure.missingSignatures.join("، ")}`);
      return;
    }
    if (missingRequired.length) {
      toast.error(`أعمدة تابي مطلوبة غير مربوطة: ${missingRequired.map((r) => r.label).join("، ")}`);
      return;
    }
    const built = await buildTabbyRows(aoa, headerRow, mapping);
    if (!built.length) { toast.error("لم يتم استخراج أي صفوف من الملف — تحقق من صف العناوين"); return; }
    const g = groupTabbyLines(built);
    const t = computeTabbyFileTotals(built, g);
    setLines(built); setGroups(g); setTotals(t);

    // Duplicate probe: a fingerprint only blocks re-import when its line belongs to a
    // settlement that was actually committed and kept (not draft/cancelled).
    const fps = built.map((l) => l.row_fingerprint);
    const found = new Map<string, ExistingLineInfo>();
    try {
      for (const chunk of chunkArr(fps, 200)) {
        const { data, error } = await (supabase as any)
          .from("payment_settlement_lines")
          .select("id,created_at,raw_row,settlement_id,payment_settlements!inner(id,status,settlement_reference,report_reference,source_file_name,settlement_date)")
          .in("raw_row->>_row_fingerprint", chunk);
        if (error) throw error;
        (data ?? []).forEach((r: any) => {
          const fp = r?.raw_row?._row_fingerprint;
          const s = r?.payment_settlements;
          if (!fp || !s) return;
          if (!COMMITTED_SETTLEMENT_STATUSES.has(String(s.status))) return; // draft/cancelled → not a duplicate
          found.set(String(fp), {
            settlement_id: s.id,
            reference: s.report_reference || s.settlement_reference || s.source_file_name || s.settlement_date || s.id,
            status: String(s.status),
            settlement_date: s.settlement_date ?? null,
            source_file_name: s.source_file_name ?? null,
            line_id: r.id,
            imported_at: r.created_at ?? null,
          });
        });
      }
    } catch {
      // silently fall back — file-hash guard still prevents whole-file duplicates.
    }
    setExistingByFp(found);

    if (providerRow?.id) {
      const { data: sameFile } = await (supabase as any)
        .from("payment_settlements")
        .select("id,notes,source_file_name,status")
        .eq("provider_id", providerRow.id)
        .ilike("notes", `%file_hash=${fileHash.slice(0, 16)}%`)
        .limit(5);
      const kept = (sameFile ?? []).filter((s: any) => COMMITTED_SETTLEMENT_STATUSES.has(String(s.status)));
      setExistingFileHash(kept.length ? fileHash : null);
    }

    onGotoPreview();
  }

  const groupsToShow = useMemo(() => {
    if (!groups) return [];
    let g = groups;
    if (groupFilter) g = g.filter((x) => x.key.payout_date === groupFilter);
    return g;
  }, [groups, groupFilter]);

  const filteredLines = useMemo(() => {
    if (!lines) return [];
    let l = lines;
    if (groupFilter) l = l.filter((x) => x.payout_date === groupFilter);
    if (orderQuery.trim()) {
      const q = orderQuery.trim().toLowerCase();
      l = l.filter((x) => (x.external_order_id ?? "").toLowerCase().includes(q));
    }
    return l;
  }, [lines, groupFilter, orderQuery]);

  const newLinesCount = useMemo(
    () => lines ? lines.filter((l) => !existingByFp.has(l.row_fingerprint)).length : 0,
    [lines, existingByFp]
  );
  const skippedCount = (lines?.length ?? 0) - newLinesCount;

  async function commit() {
    if (!canManage) { toast.error("لا تملك صلاحية إدارة المالية"); return; }
    if (!providerRow?.id) { toast.error("البوابة غير مُعرّفة"); return; }
    if (!groups || !lines || !totals) { toast.error("يجب إجراء المعاينة أولاً"); return; }
    if (existingFileHash) { toast.error("تم استيراد هذا الملف مسبقاً (نفس البصمة). لن يُنشأ ازدواج."); return; }

    setCommitting(true);
    let createdSettlements = 0, insertedLines = 0, skippedLines = 0;
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;

      for (const g of groups) {
        const groupLines = g.lines.filter((l) => !existingByFp.has(l.row_fingerprint));
        if (!groupLines.length) { skippedLines += g.lines.length; continue; }

        const isPartial = groupLines.length !== g.lines.length;
        const settlementStatus = totals.needs_review_count > 0 || g.arithmetic_mismatch || isPartial ? "under_review" : "imported";
        const notes =
          `Tabby settlement — Transfer Date ${g.key.payout_date} · ${g.key.currency} · merchant=${g.key.merchant_code} · ` +
          `file=${file?.name ?? ""} · file_hash=${fileHash.slice(0, 16)} · lines=${groupLines.length}` +
          (isPartial ? ` (تجاوز ${g.lines.length - groupLines.length} صفوف مكررة)` : "") +
          (g.arithmetic_mismatch ? " · فارق حسابي بين مبلغ الطلب والصافي المحول" : "");

        const { data: s, error: sErr } = await (supabase as any)
          .from("payment_settlements")
          .insert({
            provider_id: providerRow.id,
            settlement_reference: g.internal_reference.slice(0, 120),
            report_reference: g.internal_reference,
            source_file_name: file?.name ?? null,
            settlement_date: g.key.payout_date,
            period_start: g.period_start,
            period_end: g.period_end,
            gross_sales_amount: g.gross_sales_amount,
            refunds_amount: Math.abs(g.refunds_amount),
            adjustments_amount: 0,
            fees_before_vat: g.fees_before_vat,
            fees_vat_amount: g.fees_vat_amount,
            payout_fee: 0,
            wallet_top_up_amount: 0,
            source_expected_net_amount: g.expected_net_amount,
            calculated_expected_net_amount: g.expected_net_amount,
            expected_net_amount: g.expected_net_amount,
            status: settlementStatus,
            notes,
            created_by: uid,
          })
          .select("id")
          .single();
        if (sErr) throw sErr;
        const settlementId = s.id as string;
        createdSettlements++;

        const payload = groupLines.map((l) => ({
          settlement_id: settlementId,
          line_type: l.line_type as any,
          external_order_id: l.external_order_id,
          sales_invoice_id: null,
          provider_transaction_id: l.external_order_id,       // Tabby has no per-txn id in this report
          amount: l.gross_amount,                              // signed: refunds negative
          transaction_date: l.event_date,
          description: `Tabby · ${l.event_type_raw ?? ""}${l.product_type ? " · " + l.product_type : ""}`.trim(),
          matching_status: undefined,
          raw_row: {
            ...l.raw,
            _tabby_event_type: l.event_type_raw,
            _tabby_event: l.event_type,
            _payout_date: l.payout_date,
            _merchant_code: l.merchant_code,
            _currency: l.currency,
            _refundable_commission: l.refundable_commission,
            _non_refundable_commission: l.non_refundable_commission,
            _fixed_fee: l.fixed_fee,
            _fees_before_vat: l.fees_before_vat,
            _fees_vat_amount: l.fees_vat_amount,
            _fee_vat_rate: l.fee_vat_rate,
            _total_deduction: l.total_deduction,
            _transferred_amount: l.net_amount,
            _row_fingerprint: l.row_fingerprint,
            _row_reasons: l.reasons,
            _needs_review: l.needs_review,
            _file_hash: fileHash.slice(0, 32),
          },
        }));

        for (const c of chunkArr(payload, 500)) {
          const { error } = await (supabase as any).from("payment_settlement_lines").insert(c);
          if (error) throw error;
          insertedLines += c.length;
        }

        await (supabase as any).rpc("finance_log_manual_audit", {
          p_related_type: "payment_settlements",
          p_related_id: settlementId,
          p_action: "import_settlement",
          p_note: `provider=tabby · transfer_date=${g.key.payout_date} · file=${file?.name ?? ""} · hash=${fileHash.slice(0, 16)} · lines=${groupLines.length}`,
        });
      }

      toast.success(`تم إنشاء ${createdSettlements} تسوية تابي · ${insertedLines} حركة${skippedLines ? ` (تجاوز ${skippedLines} حركة مكررة)` : ""}`);
      nav({ to: "/admin/finance/settlements" });
    } catch (e: any) {
      toast.error(`فشل الاعتماد: ${e.message ?? e}`);
    } finally {
      setCommitting(false);
    }
  }

  // ---------- render ----------
  if (step === 2) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4" dir="rtl">
        <h2 className="text-sm font-semibold">قالب تابي — الفحص والتعيين التلقائي</h2>

        {!structure.isTabbyShape && (
          <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-[12px] text-red-200 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold"><ShieldAlert size={14} /> الملف لا يبدو كشف تسويات تابي</div>
            <div>الأعمدة المميّزة المفقودة: <span className="font-mono">{structure.missingSignatures.join("، ")}</span></div>
            <div className="text-red-200/80">تأكد أنك تستخدم "Bulk Settlement Report" من لوحة تابي، وليس ملف طلبات سلة أو كشف تمارا.</div>
          </div>
        )}

        <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-[11px]">
          <div className="font-semibold text-gold mb-2">التوقيع المكتشف</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            {TABBY_SIGNATURE_HEADERS.map((sig) => (
              <div key={sig} className="flex items-center gap-1.5">
                {structure.matchedSignatures.includes(sig)
                  ? <CheckCircle2 size={11} className="text-emerald-300" />
                  : <AlertTriangle size={11} className="text-red-300" />}
                <span className="font-mono">{sig}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold text-gold mb-1">التعيين التلقائي</div>
          <div className="overflow-x-auto rounded border border-white/10">
            <table className="w-full text-[11px]">
              <thead className="bg-white/5 text-muted-foreground">
                <tr>
                  <th className="text-start px-2 py-1">الحقل</th>
                  <th className="text-start px-2 py-1">العمود في الملف</th>
                  <th className="text-start px-2 py-1">إلزامي</th>
                </tr>
              </thead>
              <tbody>
                {TABBY_FIELDS.map((f) => {
                  const idx = mapping[f.key];
                  const found = idx != null;
                  return (
                    <tr key={f.key} className="border-t border-white/5">
                      <td className="px-2 py-1">{f.label} <span className="text-muted-foreground">({f.header})</span></td>
                      <td className={`px-2 py-1 font-mono ${found ? "text-emerald-300" : "text-red-300"}`}>
                        {found ? String(headers[idx!] ?? `عمود ${idx! + 1}`) : "— غير موجود —"}
                      </td>
                      <td className="px-2 py-1">{f.required ? <span className="text-red-300">نعم</span> : <span className="text-muted-foreground">لا</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-between pt-2">
          <button onClick={onBack} className="px-3 py-1.5 rounded border border-white/10 text-[12px]">رجوع</button>
          <button
            onClick={buildAndCheck}
            disabled={!structure.isTabbyShape || missingRequired.length > 0}
            className="px-3 py-1.5 rounded bg-gold/20 border border-gold/40 text-gold text-[12px] disabled:opacity-40"
          >معاينة الدُفعات</button>
        </div>
      </div>
    );
  }

  // step === 3
  if (!lines || !groups || !totals) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-[12px] text-muted-foreground">
        لم يتم بناء المعاينة بعد. ارجع للخطوة السابقة واضغط "معاينة الدُفعات".
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {existingFileHash && (
        <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-[12px] text-red-200">
          <div className="flex items-center gap-1.5 font-semibold"><ShieldAlert size={14} /> هذا الملف تم استيراده مسبقاً</div>
          <div>نفس بصمة الملف (SHA-256 مختصر: <span className="font-mono">{fileHash.slice(0, 16)}</span>) موجودة في تسوية سابقة. الاعتماد معطّل.</div>
        </div>
      )}

      {/* File-level KPIs */}
      <div className="rounded-xl border border-gold/30 bg-gold/5 p-3">
        <div className="text-[11px] font-semibold text-gold mb-2">إجماليات ملف تابي</div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-[11px]">
          <Kpi label="عدد الحركات" value={String(totals.transactions_count)} />
          <Kpi label="طلبات فريدة" value={String(totals.unique_orders)} />
          <Kpi label="عدد الدفعات (Transfer Dates)" value={String(totals.transfer_dates)} tone="text-gold" />
          <Kpi label="مبيعات" value={String(totals.sale_count)} tone="text-emerald-300" />
          <Kpi label="مرتجعات كاملة" value={String(totals.refund_count)} tone="text-amber-300" />
          <Kpi label="مرتجعات جزئية" value={String(totals.partial_refund_count)} tone="text-amber-300" />
          <Kpi label="بحاجة مراجعة" value={String(totals.needs_review_count)} tone={totals.needs_review_count ? "text-amber-300" : "text-muted-foreground"} />
          <Kpi label="إجمالي المبيعات (Order Amount)" value={fmt(totals.gross_sales_amount)} tone="text-emerald-300" />
          <Kpi label="مرتجعات (Order Amount)" value={fmt(totals.refunds_amount)} tone="text-amber-300" />
          <Kpi label="صافي أوامر الملف" value={fmt(totals.net_order_amount)} />
          <Kpi label="عمولة قابلة للاسترجاع" value={fmt(totals.refundable_commission)} />
          <Kpi label="عمولة غير قابلة للاسترجاع" value={fmt(totals.non_refundable_commission)} />
          <Kpi label="Fixed Fee" value={fmt(totals.fixed_fee)} />
          <Kpi label="إجمالي الرسوم" value={fmt(totals.fees_before_vat)} />
          <Kpi label="ضريبة الرسوم" value={fmt(totals.fees_vat_amount)} />
          <Kpi label="إجمالي الخصومات" value={fmt(totals.total_deduction)} />
          <Kpi label="صافي التحويلات المتوقع" value={fmt(totals.expected_net_amount)} tone="text-gold" />
        </div>
        <div className="text-[10px] text-muted-foreground mt-2 flex flex-wrap gap-3">
          <span>بصمة الملف: <span className="font-mono">{fileHash.slice(0, 16)}</span></span>
          <span>بصمات مكرّرة من ملفات سابقة: <b className={existingByFp.size ? "text-amber-300" : "text-muted-foreground"}>{existingByFp.size}</b></span>
          <span>حركات جديدة ستُضاف: <b className="text-emerald-300">{newLinesCount}</b></span>
          {skippedCount > 0 && <span>سيتم تخطي: <b className="text-amber-300">{skippedCount}</b></span>}
        </div>
      </div>

      {/* Group list */}
      <div className="rounded-xl border border-white/10 bg-white/5">
        <div className="px-3 py-2 text-[11px] font-semibold border-b border-white/10 flex items-center justify-between">
          <span>الدفعات ({groups.length}) — كل دفعة = تسوية مستقلة</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGroupFilter("")}
              className={`px-2 py-0.5 rounded border text-[10px] ${groupFilter === "" ? "bg-gold/20 border-gold/40 text-gold" : "bg-white/5 border-white/10"}`}
            >الكل</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="text-start px-2 py-1.5">Transfer Date</th>
                <th className="text-start px-2 py-1.5">العملة</th>
                <th className="text-start px-2 py-1.5">المرجع الداخلي</th>
                <th className="text-end px-2 py-1.5">حركات</th>
                <th className="text-end px-2 py-1.5">مبيعات</th>
                <th className="text-end px-2 py-1.5">مرتجعات</th>
                <th className="text-end px-2 py-1.5">صافي الطلبات</th>
                <th className="text-end px-2 py-1.5">إجمالي الرسوم</th>
                <th className="text-end px-2 py-1.5">ض. الرسوم</th>
                <th className="text-end px-2 py-1.5">صافي التحويل</th>
                <th className="text-start px-2 py-1.5">فحص</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const key = g.internal_reference;
                const active = groupFilter === g.key.payout_date;
                return (
                  <tr
                    key={key}
                    onClick={() => { setGroupFilter(active ? "" : g.key.payout_date); setExpandedGroup(active ? null : key); }}
                    className={`border-t border-white/5 cursor-pointer hover:bg-white/5 ${active ? "bg-gold/10" : ""}`}
                  >
                    <td className="px-2 py-1.5 font-mono">{g.key.payout_date}</td>
                    <td className="px-2 py-1.5">{g.key.currency}</td>
                    <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">{g.internal_reference}</td>
                    <td className="px-2 py-1.5 text-end tabular-nums">{g.transactions_count}</td>
                    <td className="px-2 py-1.5 text-end tabular-nums text-emerald-300">{fmt(g.gross_sales_amount)}</td>
                    <td className="px-2 py-1.5 text-end tabular-nums text-amber-300">{fmt(g.refunds_amount)}</td>
                    <td className="px-2 py-1.5 text-end tabular-nums">{fmt(g.net_order_amount)}</td>
                    <td className="px-2 py-1.5 text-end tabular-nums">{fmt(g.fees_before_vat)}</td>
                    <td className="px-2 py-1.5 text-end tabular-nums">{fmt(g.fees_vat_amount)}</td>
                    <td className="px-2 py-1.5 text-end tabular-nums text-gold">{fmt(g.expected_net_amount)}</td>
                    <td className="px-2 py-1.5">
                      {g.arithmetic_mismatch
                        ? <span className="text-red-300 inline-flex items-center gap-1"><AlertTriangle size={11} /> فارق</span>
                        : <span className="text-emerald-300 inline-flex items-center gap-1"><CheckCircle2 size={11} /> متوازن</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Line-level preview */}
      <div className="rounded-xl border border-white/10 bg-white/5">
        <div className="px-3 py-2 text-[11px] font-semibold border-b border-white/10 flex items-center gap-2 flex-wrap">
          <span>معاينة الحركات {groupFilter ? `— دفعة ${groupFilter}` : ""}</span>
          <div className="ms-auto flex items-center gap-2">
            <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 rounded px-2">
              <Search size={11} className="text-muted-foreground" />
              <input
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                placeholder="بحث برقم الطلب"
                className="bg-transparent outline-none py-1 text-[11px] w-32"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-white/5 text-muted-foreground sticky top-0">
              <tr>
                <th className="text-start px-2 py-1.5">#</th>
                <th className="text-start px-2 py-1.5">Order</th>
                <th className="text-start px-2 py-1.5">Sale/Refund Date</th>
                <th className="text-start px-2 py-1.5">Transfer Date</th>
                <th className="text-start px-2 py-1.5">Type</th>
                <th className="text-end px-2 py-1.5">Order Amount</th>
                <th className="text-end px-2 py-1.5">Total Fee</th>
                <th className="text-end px-2 py-1.5">VAT</th>
                <th className="text-end px-2 py-1.5">Total Deduction</th>
                <th className="text-end px-2 py-1.5">Transferred</th>
                <th className="text-start px-2 py-1.5">حالة</th>
              </tr>
            </thead>
            <tbody>
              {filteredLines.slice(0, 500).map((r) => {
                const dup = existingByFp.has(r.row_fingerprint);
                return (
                  <tr key={r.rowNo} className={`border-t border-white/5 ${dup ? "bg-red-500/10" : r.needs_review ? "bg-amber-500/5" : ""}`}>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.rowNo}</td>
                    <td className="px-2 py-1.5 font-mono">{r.external_order_id ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.event_date ?? "—"}</td>
                    <td className="px-2 py-1.5 font-mono">{r.payout_date ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.event_type_raw ?? "—"}</td>
                    <td className={`px-2 py-1.5 text-end tabular-nums ${r.gross_amount < 0 ? "text-amber-300" : ""}`}>{fmt(r.gross_amount)}</td>
                    <td className="px-2 py-1.5 text-end tabular-nums">{fmt(r.fees_before_vat)}</td>
                    <td className="px-2 py-1.5 text-end tabular-nums">{fmt(r.fees_vat_amount)}</td>
                    <td className="px-2 py-1.5 text-end tabular-nums">{fmt(r.total_deduction)}</td>
                    <td className="px-2 py-1.5 text-end tabular-nums text-gold">{fmt(r.net_amount)}</td>
                    <td className="px-2 py-1.5">
                      {dup
                        ? <span className="text-red-300 inline-flex items-center gap-1"><AlertTriangle size={11} /> مكرر (سيُتخطى)</span>
                        : r.needs_review
                          ? <span className="text-amber-300 inline-flex items-center gap-1"><AlertTriangle size={11} /> {r.reasons.join("، ")}</span>
                          : <span className="text-emerald-300 inline-flex items-center gap-1"><CheckCircle2 size={11} /> جاهز</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredLines.length > 500 && (
            <div className="text-[11px] text-muted-foreground p-2">عُرض أول 500 صف — سيتم استيراد الجميع.</div>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-3 py-1.5 rounded border border-white/10 text-[12px]">رجوع للتعيين</button>
        <div className="flex items-center gap-2">
          <button
            onClick={commit}
            disabled={committing || !providerRow?.id || !newLinesCount || !!existingFileHash}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gold/25 border border-gold/50 text-gold text-[12px] disabled:opacity-50"
          >
            {committing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            اعتماد استيراد تابي ({groups.length} تسوية)
          </button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-mono font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
