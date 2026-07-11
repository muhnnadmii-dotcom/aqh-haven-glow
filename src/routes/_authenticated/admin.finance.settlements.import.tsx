import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, ChevronLeft, Save, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/settlements/import")({
  ssr: false,
  component: SettlementImportPage,
});

// ---------- helpers ----------
const round2 = (n: number) => Math.round(n * 100) / 100;
const normStr = (s: any) => (s == null ? "" : String(s)).trim().toLowerCase();
const isBlank = (v: any) => {
  if (v == null) return true;
  const s = String(v).trim();
  return s === "" || s === "\\N" || s.toUpperCase() === "N/A";
};
function parseAmount(v: any): number | null {
  if (isBlank(v)) return null;
  if (typeof v === "number" && isFinite(v)) return round2(v);
  const s = String(v).replace(/[^\d\.\-,]/g, "").replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return isFinite(n) ? round2(n) : null;
}
const num0 = (v: any) => parseAmount(v) ?? 0;
function parseDate(v: any): string | null {
  if (isBlank(v)) return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dmy = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/.exec(s);
  if (dmy) {
    let y = dmy[3];
    if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
    return `${y}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  const t = new Date(s);
  return isNaN(t.getTime()) ? null : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- fields per provider ----------
type ProviderCode = "salla_payments" | "tabby" | "tamara";

type FieldDef = { key: FieldKey; label: string; required: boolean; aliases: string[] };
type FieldKey =
  | "external_order_id"
  | "transaction_date"
  | "gross_amount"
  | "original_payment_method"
  | "fees_before_vat"
  | "fees_vat_amount"
  | "net_amount"
  | "net_before_vat"
  | "provider_transaction_id"
  | "description";

const COMMON_FIELDS: FieldDef[] = [
  { key: "external_order_id", label: "رقم الطلب", required: false, aliases: ["رقم الطلب", "order id", "order_id", "order number", "الطلب"] },
  { key: "transaction_date", label: "التاريخ", required: false, aliases: ["التاريخ", "date", "transaction date", "تاريخ العملية"] },
  { key: "gross_amount", label: "إجمالي الطلب (ر.س)", required: true, aliases: ["إجمالي الطلب (ر.س)", "إجمالي الطلب", "المبلغ", "amount", "total", "gross"] },
  { key: "original_payment_method", label: "طريقة الدفع", required: false, aliases: ["طريقة الدفع", "payment method", "الدفع"] },
  { key: "fees_before_vat", label: "الرسوم (ر.س)", required: false, aliases: ["الرسوم (ر.س)", "الرسوم", "fees", "fee"] },
  { key: "fees_vat_amount", label: "الضريبة", required: false, aliases: ["الضريبة", "vat", "tax", "ضريبة الرسوم"] },
  { key: "net_amount", label: "المُستحق بعد الضريبة (ر.س)", required: false, aliases: ["المُستحق بعد الضريبة (ر.س)", "المستحق بعد الضريبة", "net", "net amount", "الصافي"] },
  { key: "net_before_vat", label: "المُستحق قبل الضريبة (ر.س) — للتحقق", required: false, aliases: ["المُستحق قبل الضريبة (ر.س)", "المستحق قبل الضريبة", "net before vat"] },
  { key: "provider_transaction_id", label: "معرّف عملية البوابة", required: false, aliases: ["transaction id", "txn", "reference", "المرجع"] },
  { key: "description", label: "وصف / ملاحظة", required: false, aliases: ["description", "note", "الوصف", "ملاحظات"] },
];

const PROVIDERS: { code: ProviderCode; label: string }[] = [
  { code: "salla_payments", label: "سلة" },
  { code: "tabby", label: "تابي" },
  { code: "tamara", label: "تمارا" },
];

// ---------- mapping template storage (localStorage) ----------
const TPL_KEY = "aqh:settlement_import_mappings:v1";
type Template = { id: string; provider: ProviderCode; name: string; mapping: Mapping; createdAt: number };
function loadTemplates(): Template[] {
  try { return JSON.parse(localStorage.getItem(TPL_KEY) || "[]"); } catch { return []; }
}
function saveTemplates(list: Template[]) { localStorage.setItem(TPL_KEY, JSON.stringify(list)); }

type Mapping = Partial<Record<FieldKey, number>>;

function autoMatch(headers: any[], aliases: string[]): number {
  const hs = headers.map(normStr);
  for (const a of aliases) { const i = hs.findIndex((h) => h === normStr(a)); if (i >= 0) return i; }
  for (const a of aliases) { const i = hs.findIndex((h) => h && h.includes(normStr(a))); if (i >= 0) return i; }
  return -1;
}
function detectHeaderRow(aoa: any[][], aliases: string[]): number {
  const maxScan = Math.min(aoa.length, 30);
  let best = 0, bestScore = 0;
  for (let i = 0; i < maxScan; i++) {
    const row = aoa[i] ?? [];
    let score = 0;
    for (const a of aliases) {
      const na = normStr(a);
      if (row.some((c) => normStr(c) === na || (normStr(c) && normStr(c).includes(na)))) score++;
    }
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return bestScore >= 2 ? best : 0;
}

// ---------- row model ----------
type LineType = "sale" | "refund" | "adjustment";
type MatchStatus =
  | "matched_invoice"
  | "matched_cancelled_order"
  | "cancelled_order_needs_refund_match"
  | "order_found_invoice_missing"
  | "order_not_found"
  | "needs_credit_note"
  | "unmatched_refund"
  | "orphan_line";

const MATCH_LABEL: Record<MatchStatus, string> = {
  matched_invoice: "مطابق لفاتورة",
  matched_cancelled_order: "طلب ملغي ومطابق",
  cancelled_order_needs_refund_match: "طلب ملغي ينتظر مطابقة الاسترجاع",
  order_found_invoice_missing: "الطلب موجود والفاتورة غير موجودة",
  order_not_found: "الطلب غير موجود في استيراد سلة",
  needs_credit_note: "يحتاج إشعار دائن (استرجاع جزئي)",
  unmatched_refund: "استرجاع بدون عملية أصلية",
  orphan_line: "سطر بدون رقم طلب",
};

const MATCH_TONE: Record<MatchStatus, string> = {
  matched_invoice: "text-emerald-300",
  matched_cancelled_order: "text-sky-300",
  cancelled_order_needs_refund_match: "text-amber-300",
  order_found_invoice_missing: "text-amber-300",
  order_not_found: "text-red-300",
  needs_credit_note: "text-amber-300",
  unmatched_refund: "text-red-300",
  orphan_line: "text-red-300",
};

// Statuses that BLOCK settlement approval (require human review before commit)
const BLOCKING_STATUSES = new Set<MatchStatus>([
  "order_not_found",
  "cancelled_order_needs_refund_match",
  "unmatched_refund",
  "orphan_line",
]);

type ReviewReason = "invalid_amount" | "duplicate_line" | "zero_amount" | "amount_mismatch";
const REVIEW_LABEL: Record<ReviewReason, string> = {
  invalid_amount: "قيمة غير صالحة",
  duplicate_line: "سطر مكرر",
  zero_amount: "قيمة = 0",
  amount_mismatch: "اختلاف مبالغ غير مفسر",
};

type ParsedLine = {
  rowNo: number;
  external_order_id: string | null;
  transaction_date: string | null;
  original_payment_method: string | null;
  provider_transaction_id: string | null;
  description: string | null;
  gross_amount: number;
  fees_before_vat: number;
  fees_vat_amount: number;
  net_amount: number | null;
  net_before_vat_check: number | null;
  line_type: LineType;
  sales_invoice_id: number | null;
  salla_order_status: string | null;
  match_status: MatchStatus;
  reasons: ReviewReason[];
  needs_review: boolean;
  raw: Record<string, any>;
};

// ---------- component ----------
function SettlementImportPage() {
  const { canManage } = useFinanceRoles();
  const nav = useNavigate();

  const [provider, setProvider] = useState<ProviderCode>("salla_payments");
  const [providerRow, setProviderRow] = useState<any | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState<string>("");
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheet, setSheet] = useState<string>("");
  const [aoa, setAoa] = useState<any[][]>([]);
  const [headerRow, setHeaderRow] = useState<number>(0);
  const [headers, setHeaders] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [rows, setRows] = useState<ParsedLine[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplName, setTplName] = useState("");
  const [committing, setCommitting] = useState(false);
  const [settlementRef, setSettlementRef] = useState("");
  const [settlementDate, setSettlementDate] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [payoutFee, setPayoutFee] = useState("0");
  const [statusFilter, setStatusFilter] = useState<MatchStatus | "">("");
  const fileRef = useRef<HTMLInputElement>(null);

  const providerLabel = PROVIDERS.find((p) => p.code === provider)?.label ?? "";
  const providerTemplates = templates.filter((t) => t.provider === provider);

  useEffect(() => { setTemplates(loadTemplates()); }, []);

  // Resolve provider_id from payment_providers table by code
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("payment_providers")
        .select("id,name,provider_code,is_active")
        .eq("provider_code", provider)
        .maybeSingle();
      setProviderRow(data ?? null);
    })();
  }, [provider]);

  // Auto-load default template on provider change
  useEffect(() => {
    if (headers.length === 0) return;
    const def = templates.find((t) => t.provider === provider);
    if (def) setMapping(def.mapping);
    else autoMap(headers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, headers.length]);

  function autoMap(hs: any[]) {
    const m: Mapping = {};
    for (const f of COMMON_FIELDS) {
      const idx = autoMatch(hs, f.aliases);
      if (idx >= 0) m[f.key] = idx;
    }
    setMapping(m);
  }

  async function onFile(f: File) {
    setFile(f);
    const buf = await f.arrayBuffer();
    setFileHash(await sha256Hex(buf));
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    setSheets(wb.SheetNames);
    const first = wb.SheetNames[0];
    setSheet(first);
    loadSheet(wb, first);
  }

  function loadSheet(wb: XLSX.WorkBook, name: string) {
    const ws = wb.Sheets[name];
    const arr = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null, raw: true }) as any[][];
    setAoa(arr);
    const aliases = COMMON_FIELDS.flatMap((f) => f.aliases);
    const hr = detectHeaderRow(arr, aliases);
    setHeaderRow(hr);
    const hs = arr[hr] ?? [];
    setHeaders(hs);
    autoMap(hs);
    setRows([]);
  }

  async function changeSheet(name: string) {
    setSheet(name);
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    loadSheet(wb, name);
  }

  useEffect(() => {
    if (!aoa.length) return;
    const hs = aoa[headerRow] ?? [];
    setHeaders(hs);
  }, [headerRow, aoa]);

  function buildRows(): ParsedLine[] {
    const body = aoa.slice(headerRow + 1).filter((r) => r.some((c) => c != null && c !== ""));
    const get = (raw: any[], k: FieldKey) => (mapping[k] != null ? raw[mapping[k]!] : null);
    // duplicate detection within file
    const seen = new Map<string, number>();
    return body.map((raw, idx) => {
      const rowNo = idx + 1;
      const orderId = String(get(raw, "external_order_id") ?? "").trim() || null;
      const gross = parseAmount(get(raw, "gross_amount"));
      const fees = num0(get(raw, "fees_before_vat"));
      const feesVat = num0(get(raw, "fees_vat_amount"));
      const net = parseAmount(get(raw, "net_amount"));
      const netBv = parseAmount(get(raw, "net_before_vat"));
      const txnId = String(get(raw, "provider_transaction_id") ?? "").trim() || null;
      const desc = String(get(raw, "description") ?? "").trim() || null;
      const paymethod = String(get(raw, "original_payment_method") ?? "").trim() || null;
      const date = parseDate(get(raw, "transaction_date"));

      const reasons: ReviewReason[] = [];
      let line_type: LineType = "sale";
      if (gross == null) reasons.push("invalid_amount");
      else if (gross === 0) { reasons.push("zero_amount"); line_type = "adjustment"; }
      else if (gross < 0) { line_type = orderId ? "refund" : "adjustment"; }

      const dupKey = `${orderId ?? ""}|${gross ?? ""}|${txnId ?? ""}|${date ?? ""}`;
      if (seen.has(dupKey) && dupKey !== "|||") reasons.push("duplicate_line");
      seen.set(dupKey, rowNo);

      const rawObj: Record<string, any> = {};
      headers.forEach((h, i) => { rawObj[String(h ?? `col_${i}`)] = raw[i] ?? null; });

      const initialMatch: MatchStatus = orderId ? "order_not_found" : "orphan_line";

      return {
        rowNo,
        external_order_id: orderId,
        transaction_date: date,
        original_payment_method: paymethod,
        provider_transaction_id: txnId,
        description: desc,
        gross_amount: gross ?? 0,
        fees_before_vat: fees,
        fees_vat_amount: feesVat,
        net_amount: net,
        net_before_vat_check: netBv,
        line_type,
        sales_invoice_id: null,
        salla_order_status: null,
        match_status: initialMatch,
        reasons,
        needs_review: reasons.length > 0,
        raw: rawObj,
      } as ParsedLine;
    });
  }

  async function goPreview() {
    if (!aoa.length) { toast.error("لم يتم رفع ملف"); return; }
    const req = COMMON_FIELDS.filter((f) => f.required).filter((f) => mapping[f.key] == null || mapping[f.key] === -1);
    if (req.length) { toast.error(`أعمدة مطلوبة غير مربوطة: ${req.map((r) => r.label).join("، ")}`); return; }

    const parsed = buildRows();

    // Group by order id for pair matching
    const byOrder = new Map<string, ParsedLine[]>();
    for (const p of parsed) {
      if (!p.external_order_id) continue;
      const arr = byOrder.get(p.external_order_id) ?? [];
      arr.push(p);
      byOrder.set(p.external_order_id, arr);
    }
    const orderIds = Array.from(byOrder.keys());

    if (orderIds.length) {
      const invMap = new Map<string, number>();
      const orderMap = new Map<string, { status: string | null; cancelled: boolean }>();
      const chunkArr = <T,>(a: T[], n: number) => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };
      for (const chunk of chunkArr(orderIds, 500)) {
        const [invRes, orderRes] = await Promise.all([
          (supabase as any).from("sales_invoices").select("id,external_order_id").in("external_order_id", chunk),
          (supabase as any).from("salla_orders").select("external_order_id,order_status").in("external_order_id", chunk),
        ]);
        (invRes.data ?? []).forEach((r: any) => invMap.set(String(r.external_order_id), r.id));
        (orderRes.data ?? []).forEach((r: any) => {
          const st: string = r.order_status ?? "";
          orderMap.set(String(r.external_order_id), { status: st, cancelled: /cancel|ملغى|ملغي|ملغاة|إلغاء|الغاء/i.test(st) });
        });
      }

      // Also search other settlements for refund/sale counterparts (cross-file pairing)
      const { data: crossLines } = await (supabase as any)
        .from("payment_settlement_lines")
        .select("external_order_id,line_type,amount")
        .in("external_order_id", orderIds);
      const crossByOrder = new Map<string, { sales: number; refunds: number }>();
      (crossLines ?? []).forEach((l: any) => {
        const key = String(l.external_order_id);
        const cur = crossByOrder.get(key) ?? { sales: 0, refunds: 0 };
        if (l.line_type === "sale") cur.sales = round2(cur.sales + Number(l.amount));
        else if (l.line_type === "refund") cur.refunds = round2(cur.refunds + Math.abs(Number(l.amount)));
        crossByOrder.set(key, cur);
      });

      for (const [oid, lines] of byOrder) {
        const invId = invMap.get(oid) ?? null;
        const info = orderMap.get(oid);
        const sales = lines.filter((l) => l.line_type === "sale");
        const refunds = lines.filter((l) => l.line_type === "refund");
        const totalSale = round2(sales.reduce((s, l) => s + l.gross_amount, 0));
        const totalRefundAbs = round2(refunds.reduce((s, l) => s + Math.abs(l.gross_amount), 0));
        const cross = crossByOrder.get(oid) ?? { sales: 0, refunds: 0 };
        const combinedSales = round2(totalSale + cross.sales);
        const combinedRefunds = round2(totalRefundAbs + cross.refunds);

        for (const l of lines) {
          l.sales_invoice_id = invId;
          l.salla_order_status = info?.status ?? null;

          if (info?.cancelled) {
            if (Math.abs(combinedSales - combinedRefunds) <= 0.02 && combinedSales > 0) {
              l.match_status = "matched_cancelled_order";
            } else if (l.line_type === "sale") {
              l.match_status = "cancelled_order_needs_refund_match";
              l.needs_review = true;
            } else if (l.line_type === "refund") {
              l.match_status = combinedSales > 0 ? "matched_cancelled_order" : "unmatched_refund";
              if (combinedSales <= 0) l.needs_review = true;
            } else {
              l.match_status = "matched_cancelled_order";
            }
          } else if (invId) {
            const partialRefund = l.line_type === "refund" && combinedRefunds > 0 && combinedRefunds + 0.02 < combinedSales;
            if (partialRefund) {
              l.match_status = "needs_credit_note";
              l.needs_review = true;
            } else {
              l.match_status = "matched_invoice";
            }
          } else if (info) {
            l.match_status = "order_found_invoice_missing";
            l.needs_review = true;
          } else if (l.line_type === "refund") {
            l.match_status = "unmatched_refund";
            l.needs_review = true;
          } else {
            l.match_status = "order_not_found";
            l.needs_review = true;
          }
        }
      }

      for (const p of parsed) {
        if (!p.external_order_id) { p.match_status = "orphan_line"; p.needs_review = true; }
      }
    }

    if (providerRow?.id) {
      const ref = settlementRef || `${provider}-${fileHash.slice(0, 12)}`;
      const { data: dup } = await (supabase as any)
        .from("payment_settlements")
        .select("id")
        .eq("provider_id", providerRow.id)
        .eq("settlement_reference", ref)
        .maybeSingle();
      if (dup) toast.warning("يوجد تسوية بنفس المرجع لهذه البوابة — غيّر المرجع قبل الاعتماد");
    }

    setRows(parsed);
    setStep(3);
  }

  const summary = useMemo(() => {
    const counts: Record<MatchStatus, number> = {
      matched_invoice: 0, matched_cancelled_order: 0, cancelled_order_needs_refund_match: 0,
      order_found_invoice_missing: 0, order_not_found: 0, needs_credit_note: 0,
      unmatched_refund: 0, orphan_line: 0,
    };
    let sales = 0, refunds = 0, adjustments = 0, blocking = 0, review = 0;
    let gross = 0, refundsAbs = 0, fees = 0, feesVat = 0, adjustmentsSigned = 0;
    for (const r of rows) {
      counts[r.match_status]++;
      if (r.line_type === "sale") { sales++; if (r.gross_amount > 0) gross = round2(gross + r.gross_amount); }
      else if (r.line_type === "refund") { refunds++; refundsAbs = round2(refundsAbs + Math.abs(r.gross_amount)); }
      else { adjustments++; adjustmentsSigned = round2(adjustmentsSigned + r.gross_amount); }
      fees = round2(fees + r.fees_before_vat);
      feesVat = round2(feesVat + r.fees_vat_amount);
      if (BLOCKING_STATUSES.has(r.match_status)) blocking++;
      if (r.needs_review) review++;
    }
    const payout = num0(payoutFee);
    const expected = round2(gross - refundsAbs - fees - feesVat - payout + adjustmentsSigned);
    return { count: rows.length, sales, refunds, adjustments, review, blocking, counts, gross, refundsAbs, fees, feesVat, adjustmentsSigned, expected };
  }, [rows, payoutFee]);

  async function commit() {
    if (!canManage) { toast.error("لا تملك صلاحية إدارة المالية"); return; }
    if (!providerRow?.id) { toast.error("البوابة غير مُعرّفة في النظام"); return; }
    if (!rows.length) { toast.error("لا توجد صفوف"); return; }
    setCommitting(true);
    try {
      const ref = (settlementRef || `${provider}-${fileHash.slice(0, 12)}`).slice(0, 120);
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;

      const hasBlocking = summary.blocking > 0;
      const status = hasBlocking ? "under_review" : "imported";

      const { data: s, error: sErr } = await (supabase as any)
        .from("payment_settlements")
        .insert({
          provider_id: providerRow.id,
          settlement_reference: ref,
          report_reference: settlementRef || null,
          source_file_name: file?.name ?? null,
          settlement_date: settlementDate || null,
          period_start: periodStart || null,
          period_end: periodEnd || null,
          gross_sales_amount: summary.gross,
          refunds_amount: summary.refundsAbs,
          adjustments_amount: summary.adjustmentsSigned,
          fees_before_vat: summary.fees,
          fees_vat_amount: summary.feesVat,
          payout_fee: num0(payoutFee),
          status,
          notes: `استيراد من ملف: ${file?.name} — hash=${fileHash.slice(0, 16)} — صفوف: ${rows.length} (يحتاج مراجعة: ${summary.review}، حجب: ${summary.blocking})`,
          created_by: uid,
        })
        .select("id")
        .single();
      if (sErr) throw sErr;
      const settlementId = s.id as string;

      // Insert lines
      const linesPayload = rows.map((r) => ({
        settlement_id: settlementId,
        line_type: (r.line_type === "sale" ? "sale" : r.line_type === "refund" ? "refund" : "adjustment") as any,
        external_order_id: r.external_order_id,
        sales_invoice_id: r.sales_invoice_id,
        provider_transaction_id: r.provider_transaction_id,
        amount: r.gross_amount,
        transaction_date: r.transaction_date,
        description: r.description ?? MATCH_LABEL[r.match_status],
        raw_row: {
          ...r.raw,
          _match_status: r.match_status,
          _needs_review: r.needs_review,
          _reasons: r.reasons,
          _salla_order_status: r.salla_order_status,
          _fees_before_vat: r.fees_before_vat,
          _fees_vat_amount: r.fees_vat_amount,
          _net_amount: r.net_amount,
          _net_before_vat_check: r.net_before_vat_check,
          _original_payment_method: r.original_payment_method,
        },
      }));

      // insert in chunks
      const chunk = 500;
      for (let i = 0; i < linesPayload.length; i += chunk) {
        const slice = linesPayload.slice(i, i + chunk);
        const { error } = await (supabase as any).from("payment_settlement_lines").insert(slice);
        if (error) throw error;
      }

      await (supabase as any).from("finance_audit_logs").insert({
        related_type: "payment_settlements",
        related_id: settlementId,
        action: "import_settlement",
        note: `provider=${provider} · file=${file?.name} · hash=${fileHash.slice(0, 16)} · lines=${rows.length} · review=${summary.review}`,
        changed_by: uid,
      });

      toast.success(`تم إنشاء التسوية بحالة ${status === "under_review" ? "قيد المراجعة" : "مستوردة"}`);
      nav({ to: "/admin/finance/settlement-lines", search: { settlement: settlementId } as any });
    } catch (e: any) {
      toast.error(`فشل الاعتماد: ${e.message ?? e}`);
    } finally {
      setCommitting(false);
    }
  }

  function saveTemplate() {
    const name = tplName.trim();
    if (!name) { toast.error("أدخل اسم القالب"); return; }
    const list = loadTemplates();
    const id = crypto.randomUUID();
    const next = [...list.filter((t) => !(t.provider === provider && t.name === name)), { id, provider, name, mapping, createdAt: Date.now() }];
    saveTemplates(next);
    setTemplates(next);
    setTplName("");
    toast.success("تم حفظ القالب");
  }
  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setMapping(t.mapping);
    toast.success(`تم تطبيق قالب: ${t.name}`);
  }
  function deleteTemplate(id: string) {
    const next = templates.filter((t) => t.id !== id);
    saveTemplates(next);
    setTemplates(next);
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Breadcrumb */}
      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Link to="/admin/finance" className="hover:text-foreground">المالية</Link>
        <ChevronLeft size={12} />
        <span>النقد والتسويات</span>
        <ChevronLeft size={12} />
        <Link to="/admin/finance/settlements" className="hover:text-foreground">التسويات</Link>
        <ChevronLeft size={12} />
        <span className="text-foreground">استيراد تسوية</span>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 text-[11px]">
        {[
          { n: 1, label: "الملف والبوابة" },
          { n: 2, label: "تعيين الأعمدة" },
          { n: 3, label: "المعاينة والاعتماد" },
        ].map((s) => (
          <div key={s.n} className={`px-2.5 py-1 rounded-full border ${step === s.n ? "bg-gold/20 border-gold/40 text-gold" : "bg-white/5 border-white/10 text-muted-foreground"}`}>
            {s.n}. {s.label}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-gold" />
            <h2 className="text-sm font-semibold">اختر البوابة وارفع ملف التسوية</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block text-[11px]">البوابة
              <select value={provider} onChange={(e) => setProvider(e.target.value as ProviderCode)} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
                {PROVIDERS.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
              {!providerRow && <div className="mt-1 text-amber-300 text-[11px]">لا يوجد سجل مفعّل لهذه البوابة في payment_providers</div>}
            </label>

            <label className="block text-[11px]">ملف Excel / CSV
              <div className="mt-1 flex items-center gap-2">
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold cursor-pointer hover:bg-gold/25">
                  <Upload size={14} /><span>اختر ملف</span>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
                </label>
                {file && <span className="text-muted-foreground text-[11px] truncate">{file.name}</span>}
              </div>
            </label>

            {sheets.length > 1 && (
              <label className="block text-[11px]">ورقة العمل
                <select value={sheet} onChange={(e) => changeSheet(e.target.value)} className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
                  {sheets.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            )}

            {aoa.length > 0 && (
              <label className="block text-[11px]">صف العناوين (تلقائي: {headerRow + 1})
                <input type="number" min={1} max={aoa.length} value={headerRow + 1} onChange={(e) => setHeaderRow(Math.max(0, Number(e.target.value) - 1))}
                  className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]" />
              </label>
            )}
          </div>

          {aoa.length > 0 && (
            <div className="overflow-x-auto rounded border border-white/10">
              <table className="w-full text-[11px]">
                <thead className="bg-white/5 text-muted-foreground">
                  <tr>{(headers ?? []).map((h, i) => <th key={i} className="px-2 py-1 text-start whitespace-nowrap">{String(h ?? "")}</th>)}</tr>
                </thead>
                <tbody>
                  {aoa.slice(headerRow + 1, headerRow + 21).map((r, i) => (
                    <tr key={i} className="border-t border-white/5">
                      {(headers ?? []).map((_, j) => <td key={j} className="px-2 py-1 whitespace-nowrap">{String(r[j] ?? "")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Link to="/admin/finance/settlements" className="px-3 py-1.5 rounded border border-white/10 text-[12px]">إلغاء</Link>
            <button
              onClick={() => setStep(2)}
              disabled={!aoa.length}
              className="px-3 py-1.5 rounded bg-gold/20 border border-gold/40 text-gold text-[12px] disabled:opacity-40"
            >متابعة</button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
          <h2 className="text-sm font-semibold">تعيين الأعمدة — {providerLabel}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {COMMON_FIELDS.map((f) => (
              <label key={f.key} className="block text-[11px]">
                {f.label} {f.required && <span className="text-red-400">*</span>}
                <select
                  value={mapping[f.key] ?? -1}
                  onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}
                  className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]"
                >
                  <option value={-1}>— بدون —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{String(h ?? `عمود ${i + 1}`)}</option>)}
                </select>
              </label>
            ))}
          </div>

          <div className="border-t border-white/10 pt-3 space-y-2">
            <div className="text-[12px] font-semibold">قوالب محفوظة ({providerLabel})</div>
            <div className="flex flex-wrap items-center gap-2">
              {providerTemplates.length === 0 && <span className="text-[11px] text-muted-foreground">لا يوجد قوالب محفوظة</span>}
              {providerTemplates.map((t) => (
                <div key={t.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-[11px]">
                  <button onClick={() => applyTemplate(t.id)} className="hover:text-gold">{t.name}</button>
                  <button onClick={() => deleteTemplate(t.id)} className="text-red-400 hover:text-red-300">×</button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="اسم القالب" className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]" />
              <button onClick={saveTemplate} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-[12px] hover:bg-white/10">
                <Save size={12} /> حفظ قالب
              </button>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="px-3 py-1.5 rounded border border-white/10 text-[12px]">رجوع</button>
            <button onClick={goPreview} className="px-3 py-1.5 rounded bg-gold/20 border border-gold/40 text-gold text-[12px]">معاينة</button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block text-[11px]">مرجع التسوية
              <input value={settlementRef} onChange={(e) => setSettlementRef(e.target.value)} placeholder={`${provider}-${fileHash.slice(0, 8)}`}
                className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]" />
            </label>
            <label className="block text-[11px]">تاريخ التسوية
              <input type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)}
                className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]" />
              {!settlementDate && <span className="mt-1 block text-[10px] text-amber-300">تاريخ التسوية غير محدد</span>}
            </label>
            <label className="block text-[11px]">بداية الفترة
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
                className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]" />
            </label>
            <label className="block text-[11px]">نهاية الفترة
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
                className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]" />
            </label>
            <label className="block text-[11px]">رسوم التحويل (اختياري)
              <input type="number" step="0.01" value={payoutFee} onChange={(e) => setPayoutFee(e.target.value)}
                className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]" />
            </label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <Kpi label="عدد الصفوف" value={String(summary.count)} />
            <Kpi label="مبيعات" value={String(summary.sales)} tone="text-emerald-300" />
            <Kpi label="مرتجعات" value={String(summary.refunds)} tone="text-amber-300" />
            <Kpi label="تعديلات" value={String(summary.adjustments)} tone="text-muted-foreground" />
            <Kpi label="مطابق لفاتورة" value={String(summary.counts.matched_invoice)} tone="text-emerald-300" />
            <Kpi label="طلب ملغي مطابق" value={String(summary.counts.matched_cancelled_order)} tone="text-sky-300" />
            <Kpi label="ينتظر استرجاع" value={String(summary.counts.cancelled_order_needs_refund_match)} tone="text-amber-300" />
            <Kpi label="طلب بدون فاتورة" value={String(summary.counts.order_found_invoice_missing)} tone="text-amber-300" />
            <Kpi label="طلب غير موجود" value={String(summary.counts.order_not_found)} tone="text-red-300" />
            <Kpi label="حجب اعتماد" value={String(summary.blocking)} tone={summary.blocking ? "text-red-300" : "text-muted-foreground"} />
            <Kpi label="إجمالي المبيعات" value={summary.gross.toFixed(2)} />
            <Kpi label="المرتجعات" value={summary.refundsAbs.toFixed(2)} />
            <Kpi label="الرسوم" value={summary.fees.toFixed(2)} />
            <Kpi label="ضريبة الرسوم" value={summary.feesVat.toFixed(2)} />
            <Kpi label="صافي متوقع" value={summary.expected.toFixed(2)} tone="text-gold" />
          </div>

          {/* Filter by match status */}
          <div className="flex flex-wrap gap-2 items-center text-[11px]">
            <span className="text-muted-foreground">فلتر:</span>
            <button
              onClick={() => setStatusFilter("")}
              className={`px-2 py-1 rounded border ${statusFilter === "" ? "bg-gold/20 border-gold/40 text-gold" : "bg-white/5 border-white/10"}`}
            >الكل ({rows.length})</button>
            {(Object.keys(MATCH_LABEL) as MatchStatus[]).filter((k) => summary.counts[k] > 0).map((k) => (
              <button key={k}
                onClick={() => setStatusFilter(k)}
                className={`px-2 py-1 rounded border ${statusFilter === k ? "bg-gold/20 border-gold/40 text-gold" : "bg-white/5 border-white/10"}`}
              >{MATCH_LABEL[k]} ({summary.counts[k]})</button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
            <table className="w-full text-[11px]">
              <thead className="bg-white/5 text-muted-foreground">
                <tr>
                  <th className="text-start px-2 py-1.5">#</th>
                  <th className="text-start px-2 py-1.5">رقم الطلب</th>
                  <th className="text-start px-2 py-1.5">التاريخ</th>
                  <th className="text-start px-2 py-1.5">النوع</th>
                  <th className="text-start px-2 py-1.5">طريقة الدفع</th>
                  <th className="text-start px-2 py-1.5">الإجمالي</th>
                  <th className="text-start px-2 py-1.5">الرسوم</th>
                  <th className="text-start px-2 py-1.5">ضريبة الرسوم</th>
                  <th className="text-start px-2 py-1.5">صافي السطر</th>
                  <th className="text-start px-2 py-1.5">الفاتورة</th>
                  <th className="text-start px-2 py-1.5">حالة المطابقة</th>
                </tr>
              </thead>
              <tbody>
                {rows.filter((r) => !statusFilter || r.match_status === statusFilter).slice(0, 500).map((r) => (
                  <tr key={r.rowNo} className={`border-t border-white/5 ${BLOCKING_STATUSES.has(r.match_status) ? "bg-red-500/5" : r.needs_review ? "bg-amber-500/5" : ""}`}>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.rowNo}</td>
                    <td className="px-2 py-1.5">{r.external_order_id ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.transaction_date ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.line_type === "sale" ? "بيع" : r.line_type === "refund" ? "مرتجع" : "تعديل"}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.original_payment_method ?? "—"}</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.gross_amount.toFixed(2)}</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.fees_before_vat.toFixed(2)}</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.fees_vat_amount.toFixed(2)}</td>
                    <td className="px-2 py-1.5 tabular-nums">{(r.net_amount ?? (r.gross_amount - r.fees_before_vat - r.fees_vat_amount)).toFixed(2)}</td>
                    <td className="px-2 py-1.5">
                      {r.sales_invoice_id
                        ? <span className="text-emerald-300">#{r.sales_invoice_id}</span>
                        : r.match_status === "matched_cancelled_order"
                          ? <span className="text-sky-300">— (ملغي)</span>
                          : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`inline-flex items-center gap-1 ${MATCH_TONE[r.match_status]}`}>
                        {BLOCKING_STATUSES.has(r.match_status)
                          ? <AlertTriangle size={11} />
                          : r.match_status === "matched_invoice" || r.match_status === "matched_cancelled_order"
                            ? <CheckCircle2 size={11} />
                            : <AlertTriangle size={11} />}
                        {MATCH_LABEL[r.match_status]}
                        {r.reasons.length > 0 && <span className="text-muted-foreground">· {r.reasons.map((x) => REVIEW_LABEL[x]).join("، ")}</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 500 && <div className="text-[11px] text-muted-foreground p-2">عُرض أول 500 صف — سيتم استيراد الجميع.</div>}
          </div>

          {summary.blocking > 0 && (
            <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-[12px] text-red-200">
              <AlertTriangle className="inline w-3.5 h-3.5 ml-1" />
              يوجد {summary.blocking} سطر يحجب الاعتماد النهائي (طلبات غير موجودة، بيع ملغي بدون استرجاع، استرجاع بدون بيع، أو سطر بدون رقم طلب). سيتم إنشاء التسوية بحالة "قيد المراجعة" حتى تُعالج هذه الحالات.
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="px-3 py-1.5 rounded border border-white/10 text-[12px]">رجوع للتعيين</button>
            <div className="flex items-center gap-2">
              <Link to="/admin/finance/settlements" className="px-3 py-1.5 rounded border border-white/10 text-[12px]">إلغاء</Link>
              <button
                onClick={commit}
                disabled={committing || !providerRow?.id || !rows.length}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gold/25 border border-gold/50 text-gold text-[12px] disabled:opacity-50"
              >
                {committing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                اعتماد الاستيراد
              </button>
            </div>
          </div>
        </div>
      )}
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
