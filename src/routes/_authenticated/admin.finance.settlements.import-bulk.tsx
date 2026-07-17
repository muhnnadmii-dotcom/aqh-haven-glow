import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, ChevronLeft, Loader2, CheckCircle2, AlertTriangle, X, Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/settlements/import-bulk")({
  ssr: false,
  component: BulkImportPage,
});

// ==================== helpers (mirrors single-file importer) ====================
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

type ProviderCode = "salla_payments" | "tabby" | "tamara";
type FieldKey =
  | "external_order_id" | "transaction_date" | "gross_amount" | "original_payment_method"
  | "fees_before_vat" | "fees_vat_amount" | "net_amount" | "net_before_vat"
  | "provider_transaction_id" | "description";
type FieldDef = { key: FieldKey; label: string; required: boolean; aliases: string[] };
type Mapping = Partial<Record<FieldKey, number>>;

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

const TPL_KEY = "aqh:settlement_import_mappings:v1";
type Template = { id: string; provider: ProviderCode; name: string; mapping: Mapping; createdAt: number };
function loadTemplates(): Template[] {
  try { return JSON.parse(localStorage.getItem(TPL_KEY) || "[]"); } catch { return []; }
}

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
function buildMapping(headers: any[], template?: Template): Mapping {
  if (template) {
    // verify template columns still exist; otherwise auto-map from headers
    const m: Mapping = {};
    for (const [k, idx] of Object.entries(template.mapping)) {
      if (idx != null && idx >= 0 && idx < headers.length) m[k as FieldKey] = idx as number;
    }
    // fill missing required by auto-match
    for (const f of COMMON_FIELDS) {
      if (m[f.key] == null || m[f.key] === -1) {
        const i = autoMatch(headers, f.aliases);
        if (i >= 0) m[f.key] = i;
      }
    }
    return m;
  }
  const m: Mapping = {};
  for (const f of COMMON_FIELDS) {
    const i = autoMatch(headers, f.aliases);
    if (i >= 0) m[f.key] = i;
  }
  return m;
}

type LineType =
  | "sale" | "refund" | "chargeback" | "reserve_held" | "reserve_released"
  | "payout_fee" | "manual_adjustment" | "unexplained_deduction" | "wallet_top_up";

const WALLET_TOPUP_RX = /(شحن\s*محفظة|wallet\s*top[\s-]*up|wallet\s*recharge|top\s*up\s*wallet)/i;

type MatchStatus =
  | "matched_invoice" | "matched_cancelled_order" | "cancelled_order_needs_refund_match"
  | "order_found_invoice_missing" | "order_not_found" | "needs_credit_note"
  | "unmatched_refund" | "needs_classification" | "wallet_internal_transfer";

const REVIEW_STATUSES = new Set<MatchStatus>([
  "order_not_found", "cancelled_order_needs_refund_match", "unmatched_refund",
  "needs_classification", "order_found_invoice_missing", "needs_credit_note",
]);

type ReviewReason = "invalid_amount" | "duplicate_line" | "zero_amount" | "amount_mismatch";

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

function buildRowsFromAoa(aoa: any[][], headerRow: number, headers: any[], mapping: Mapping): ParsedLine[] {
  const body = aoa.slice(headerRow + 1).filter((r) => r.some((c) => c != null && c !== ""));
  const get = (raw: any[], k: FieldKey) => (mapping[k] != null ? raw[mapping[k]!] : null);
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
    const looksLikeWalletTopUp =
      (desc && WALLET_TOPUP_RX.test(desc)) ||
      (paymethod && WALLET_TOPUP_RX.test(paymethod));

    if (gross == null) reasons.push("invalid_amount");
    else if (looksLikeWalletTopUp) { line_type = "wallet_top_up"; }
    else if (gross === 0) { reasons.push("zero_amount"); line_type = "manual_adjustment"; }
    else if (gross < 0) { line_type = orderId ? "refund" : "unexplained_deduction"; }

    const dupKey = `${orderId ?? ""}|${gross ?? ""}|${txnId ?? ""}|${date ?? ""}`;
    if (seen.has(dupKey) && dupKey !== "|||") reasons.push("duplicate_line");
    seen.set(dupKey, rowNo);

    const rawObj: Record<string, any> = {};
    headers.forEach((h, i) => { rawObj[String(h ?? `col_${i}`)] = raw[i] ?? null; });

    const initialMatch: MatchStatus =
      line_type === "wallet_top_up" ? "wallet_internal_transfer"
      : orderId ? "order_not_found" : "needs_classification";

    const feesFinal = line_type === "wallet_top_up" ? 0 : fees;
    const feesVatFinal = line_type === "wallet_top_up" ? 0 : feesVat;

    return {
      rowNo,
      external_order_id: orderId,
      transaction_date: date,
      original_payment_method: paymethod,
      provider_transaction_id: txnId,
      description: desc,
      gross_amount: gross ?? 0,
      fees_before_vat: feesFinal,
      fees_vat_amount: feesVatFinal,
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

async function matchRows(parsed: ParsedLine[]) {
  const byOrder = new Map<string, ParsedLine[]>();
  for (const p of parsed) {
    if (!p.external_order_id) continue;
    const arr = byOrder.get(p.external_order_id) ?? [];
    arr.push(p);
    byOrder.set(p.external_order_id, arr);
  }
  const orderIds = Array.from(byOrder.keys());
  if (!orderIds.length) {
    for (const p of parsed) {
      if (p.line_type === "wallet_top_up") continue;
      if (!p.external_order_id) { p.match_status = "needs_classification"; p.needs_review = true; }
    }
    return;
  }
  const invMap = new Map<string, number>();
  const orderMap = new Map<string, { status: string | null; cancelled: boolean }>();
  const chunk = <T,>(a: T[], n: number) => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };
  for (const c of chunk(orderIds, 500)) {
    const [invRes, orderRes] = await Promise.all([
      (supabase as any).from("sales_invoices").select("id,external_order_id").in("external_order_id", c),
      (supabase as any).from("salla_orders").select("external_order_id,order_status").in("external_order_id", c),
    ]);
    (invRes.data ?? []).forEach((r: any) => invMap.set(String(r.external_order_id), r.id));
    (orderRes.data ?? []).forEach((r: any) => {
      const st: string = r.order_status ?? "";
      orderMap.set(String(r.external_order_id), { status: st, cancelled: /cancel|ملغى|ملغي|ملغاة|إلغاء|الغاء/i.test(st) });
    });
  }
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
          l.match_status = "cancelled_order_needs_refund_match"; l.needs_review = true;
        } else if (l.line_type === "refund") {
          l.match_status = combinedSales > 0 ? "matched_cancelled_order" : "unmatched_refund";
          if (combinedSales <= 0) l.needs_review = true;
        } else { l.match_status = "matched_cancelled_order"; }
      } else if (invId) {
        const partialRefund = l.line_type === "refund" && combinedRefunds > 0 && combinedRefunds + 0.02 < combinedSales;
        if (partialRefund) { l.match_status = "needs_credit_note"; l.needs_review = true; }
        else { l.match_status = "matched_invoice"; }
      } else if (info) {
        l.match_status = "order_found_invoice_missing"; l.needs_review = true;
      } else if (l.line_type === "refund") {
        l.match_status = "unmatched_refund"; l.needs_review = true;
      } else {
        l.match_status = "order_not_found"; l.needs_review = true;
      }
    }
  }

  for (const p of parsed) {
    if (p.line_type === "wallet_top_up") continue;
    if (!p.external_order_id) { p.match_status = "needs_classification"; p.needs_review = true; }
  }
}

function summarize(rows: ParsedLine[]) {
  let sales = 0, refunds = 0, adjustments = 0, walletTopUps = 0, review = 0, blocking = 0;
  let gross = 0, refundsAbs = 0, fees = 0, feesVat = 0, adjustmentsSigned = 0, walletTopUpAbs = 0;
  const counts: Record<MatchStatus, number> = {
    matched_invoice: 0, matched_cancelled_order: 0, cancelled_order_needs_refund_match: 0,
    order_found_invoice_missing: 0, order_not_found: 0, needs_credit_note: 0,
    unmatched_refund: 0, needs_classification: 0, wallet_internal_transfer: 0,
  };
  for (const r of rows) {
    counts[r.match_status]++;
    if (r.line_type === "sale") { sales++; if (r.gross_amount > 0) gross = round2(gross + r.gross_amount); }
    else if (r.line_type === "refund") { refunds++; refundsAbs = round2(refundsAbs + Math.abs(r.gross_amount)); }
    else if (r.line_type === "wallet_top_up") { walletTopUps++; walletTopUpAbs = round2(walletTopUpAbs + Math.abs(r.gross_amount)); }
    else { adjustments++; adjustmentsSigned = round2(adjustmentsSigned + r.gross_amount); }
    fees = round2(fees + r.fees_before_vat);
    feesVat = round2(feesVat + r.fees_vat_amount);
    if (REVIEW_STATUSES.has(r.match_status)) blocking++;
    if (r.needs_review) review++;
  }
  const calculatedExpected = round2(gross - refundsAbs - fees - feesVat - walletTopUpAbs + adjustmentsSigned);
  return {
    count: rows.length, sales, refunds, adjustments, walletTopUps, review, blocking, counts,
    gross, refundsAbs, fees, feesVat, adjustmentsSigned, walletTopUpAbs, calculatedExpected,
  };
}

// ==================== component ====================
type FileStatus = "queued" | "parsing" | "matching" | "ready" | "committing" | "done" | "error" | "skipped";
type FileEntry = {
  id: string;
  file: File;
  hash: string;
  status: FileStatus;
  message: string;
  sheet: string;
  sheetOptions: string[];
  rowCount: number;
  reviewCount: number;
  gross: number;
  calculatedExpected: number;
  settlementId?: string;
  settlementRef?: string;
};

function BulkImportPage() {
  const { canManage } = useFinanceRoles();
  const nav = useNavigate();
  const [provider, setProvider] = useState<ProviderCode>("salla_payments");
  const [providerRow, setProviderRow] = useState<any | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTemplates(loadTemplates()); }, []);
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

  const providerLabel = PROVIDERS.find((p) => p.code === provider)?.label ?? "";
  const providerTemplates = templates.filter((t) => t.provider === provider);
  const template = templates.find((t) => t.id === templateId);

  async function onAddFiles(list: FileList | null) {
    if (!list || !list.length) return;
    const additions: FileEntry[] = [];
    for (const f of Array.from(list)) {
      const buf = await f.arrayBuffer();
      const hash = await sha256Hex(buf);
      if (files.some((x) => x.hash === hash) || additions.some((x) => x.hash === hash)) continue;
      additions.push({
        id: crypto.randomUUID(),
        file: f, hash,
        status: "queued", message: "بانتظار البدء",
        sheet: "", sheetOptions: [],
        rowCount: 0, reviewCount: 0, gross: 0, calculatedExpected: 0,
      });
    }
    setFiles((prev) => [...prev, ...additions]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }
  function clearDone() {
    setFiles((prev) => prev.filter((f) => f.status !== "done" && f.status !== "skipped"));
  }

  async function processOne(entry: FileEntry, uid: string | null): Promise<FileEntry> {
    try {
      // Duplicate check against DB (same provider + file hash in notes)
      const ref = `${provider}-${entry.hash.slice(0, 12)}`;
      const { data: existing } = await (supabase as any)
        .from("payment_settlements")
        .select("id,settlement_reference")
        .eq("provider_id", providerRow.id)
        .eq("settlement_reference", ref)
        .maybeSingle();
      if (existing) {
        return { ...entry, status: "skipped", message: `مكرر — تسوية بنفس البصمة موجودة (${existing.settlement_reference})`, settlementId: existing.id, settlementRef: existing.settlement_reference };
      }

      // Additional guard: same provider + same source_file_name (protects when
      // a re-downloaded file has a different byte-hash but the same name).
      const { data: dupByName } = await (supabase as any)
        .from("payment_settlements")
        .select("id,settlement_reference")
        .eq("provider_id", providerRow.id)
        .eq("source_file_name", entry.file.name)
        .limit(1)
        .maybeSingle();
      if (dupByName) {
        return { ...entry, status: "skipped", message: `ملف مكرر — تم تجاهله (${dupByName.settlement_reference})`, settlementId: dupByName.id, settlementRef: dupByName.settlement_reference };
      }

      // Parse
      const upd1 = { ...entry, status: "parsing" as FileStatus, message: "قراءة الملف…" };
      setFiles((prev) => prev.map((f) => f.id === entry.id ? upd1 : f));
      const buf = await entry.file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null, raw: true }) as any[][];
      if (!aoa.length) throw new Error("الملف فارغ");
      const aliases = COMMON_FIELDS.flatMap((f) => f.aliases);
      const hr = detectHeaderRow(aoa, aliases);
      const headers = aoa[hr] ?? [];
      const mapping = buildMapping(headers, template);

      const missing = COMMON_FIELDS.filter((f) => f.required).filter((f) => mapping[f.key] == null || mapping[f.key] === -1);
      if (missing.length) throw new Error(`أعمدة مطلوبة غير موجودة: ${missing.map((m) => m.label).join("، ")}`);

      const parsed = buildRowsFromAoa(aoa, hr, headers, mapping);
      if (!parsed.length) throw new Error("لا توجد صفوف بيانات");

      // Match
      setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...upd1, status: "matching", message: "مطابقة مع الطلبات والفواتير…", sheet: sheetName, sheetOptions: wb.SheetNames, rowCount: parsed.length } : f));
      await matchRows(parsed);
      const sm = summarize(parsed);

      // Commit
      setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: "committing", message: "إنشاء التسوية…", rowCount: parsed.length, reviewCount: sm.review, gross: sm.gross, calculatedExpected: sm.calculatedExpected } : f));
      const hasBlocking = sm.blocking > 0;
      const status = hasBlocking ? "under_review" : "imported";
      const { data: s, error: sErr } = await (supabase as any)
        .from("payment_settlements")
        .insert({
          provider_id: providerRow.id,
          settlement_reference: ref,
          report_reference: null,
          source_file_name: entry.file.name,
          settlement_date: null,
          period_start: null,
          period_end: null,
          gross_sales_amount: sm.gross,
          refunds_amount: sm.refundsAbs,
          adjustments_amount: sm.adjustmentsSigned,
          fees_before_vat: sm.fees,
          fees_vat_amount: sm.feesVat,
          payout_fee: 0,
          wallet_top_up_amount: sm.walletTopUpAbs,
          calculated_expected_net_amount: sm.calculatedExpected,
          expected_net_amount: sm.calculatedExpected,
          status,
          notes: `استيراد جماعي — ملف: ${entry.file.name} — hash=${entry.hash.slice(0, 16)} — صفوف: ${parsed.length} (مراجعة: ${sm.review})`,
          created_by: uid,
        })
        .select("id")
        .single();
      if (sErr) throw sErr;
      const settlementId = s.id as string;

      const linesPayload = parsed.map((r) => ({
        settlement_id: settlementId,
        line_type: r.line_type as any,
        external_order_id: r.external_order_id,
        sales_invoice_id: r.sales_invoice_id,
        provider_transaction_id: r.provider_transaction_id,
        amount: r.gross_amount,
        transaction_date: r.transaction_date,
        description: r.description ?? r.match_status,
        matching_status:
          r.line_type === "wallet_top_up" ? "classified"
          : r.match_status === "wallet_internal_transfer" ? "classified"
          : undefined,
        classification_reason: r.line_type === "wallet_top_up" ? "wallet_top_up" : undefined,
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
      const chunkSize = 500;
      for (let i = 0; i < linesPayload.length; i += chunkSize) {
        const slice = linesPayload.slice(i, i + chunkSize);
        const { error } = await (supabase as any).from("payment_settlement_lines").insert(slice);
        if (error) throw error;
      }
      await (supabase as any).rpc("finance_log_manual_audit", {
        p_related_type: "payment_settlements",
        p_related_id: settlementId,
        p_action: "import_settlement_bulk",
        p_note: `provider=${provider} · file=${entry.file.name} · hash=${entry.hash.slice(0, 16)} · lines=${parsed.length} · review=${sm.review}`,
      });

      return {
        ...entry,
        status: "done",
        message: `تم — ${status === "under_review" ? "قيد المراجعة" : "مستوردة"} · ${parsed.length} سطر`,
        sheet: sheetName, sheetOptions: wb.SheetNames,
        rowCount: parsed.length, reviewCount: sm.review,
        gross: sm.gross, calculatedExpected: sm.calculatedExpected,
        settlementId, settlementRef: ref,
      };
    } catch (e: any) {
      return { ...entry, status: "error", message: e?.message ?? String(e) };
    }
  }

  async function runAll() {
    if (!canManage) { toast.error("لا تملك صلاحية إدارة المالية"); return; }
    if (!providerRow?.id) { toast.error("البوابة غير مُعرّفة"); return; }
    const pending = files.filter((f) => f.status === "queued" || f.status === "error");
    if (!pending.length) { toast.info("لا توجد ملفات جاهزة"); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id ?? null;
    let ok = 0, skipped = 0, err = 0;
    for (const entry of pending) {
      const result = await processOne(entry, uid);
      setFiles((prev) => prev.map((f) => f.id === entry.id ? result : f));
      if (result.status === "done") ok++;
      else if (result.status === "skipped") skipped++;
      else if (result.status === "error") err++;
    }
    setBusy(false);
    toast.success(`اكتمل: نجح ${ok}${skipped ? ` · مكرر ${skipped}` : ""}${err ? ` · فشل ${err}` : ""}`);
  }

  const totals = useMemo(() => {
    const done = files.filter((f) => f.status === "done");
    return {
      files: files.length,
      done: done.length,
      skipped: files.filter((f) => f.status === "skipped").length,
      error: files.filter((f) => f.status === "error").length,
      queued: files.filter((f) => f.status === "queued").length,
      totalRows: done.reduce((s, f) => s + f.rowCount, 0),
      totalGross: round2(done.reduce((s, f) => s + f.gross, 0)),
      totalNet: round2(done.reduce((s, f) => s + f.calculatedExpected, 0)),
    };
  }, [files]);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Link to="/admin/finance" className="hover:text-foreground">المالية</Link>
        <ChevronLeft size={12} />
        <Link to="/admin/finance/settlements" className="hover:text-foreground">التسويات</Link>
        <ChevronLeft size={12} />
        <span className="text-foreground">استيراد جماعي</span>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={16} className="text-gold" />
          <h2 className="text-sm font-semibold">استيراد عدة ملفات تسوية دفعة واحدة</h2>
        </div>
        <p className="text-[11px] text-muted-foreground">
          يتم إنشاء تسوية مستقلة لكل ملف. يُعتمد المرجع تلقائيًا من بصمة الملف (SHA-256) لمنع التكرار.
          يستخدم قالب الأعمدة المختار — أو الاكتشاف التلقائي — لكل الملفات، مع مطابقة الطلبات والفواتير.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block text-[11px]">البوابة
            <select value={provider} onChange={(e) => { setProvider(e.target.value as ProviderCode); setTemplateId(""); }}
              className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
              {PROVIDERS.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
            </select>
            {!providerRow && <div className="mt-1 text-amber-300 text-[11px]">لا يوجد سجل مفعّل لهذه البوابة</div>}
          </label>
          <label className="block text-[11px]">قالب تعيين الأعمدة ({providerLabel})
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
              className="mt-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
              <option value="">— اكتشاف تلقائي —</option>
              {providerTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <span className="mt-1 block text-[10px] text-muted-foreground">
              تُدار القوالب من صفحة الاستيراد المفرد.
            </span>
          </label>
          <label className="block text-[11px]">اختر الملفات (متعددة)
            <div className="mt-1 flex items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold cursor-pointer hover:bg-gold/25">
                <Upload size={14} /><span>إضافة ملفات</span>
                <input ref={fileRef} type="file" multiple accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={(e) => onAddFiles(e.target.files)} />
              </label>
              <span className="text-[11px] text-muted-foreground">{files.length} ملف</span>
            </div>
          </label>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={runAll}
            disabled={busy || !providerRow?.id || files.filter((f) => f.status === "queued" || f.status === "error").length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gold/25 border border-gold/50 text-gold text-[12px] disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            بدء الاستيراد ({files.filter((f) => f.status === "queued" || f.status === "error").length})
          </button>
          <button onClick={clearDone} disabled={busy}
            className="px-3 py-1.5 rounded border border-white/10 text-[12px] hover:bg-white/5 disabled:opacity-50">
            مسح المكتمل
          </button>
          <div className="flex-1" />
          <div className="text-[11px] text-muted-foreground">
            نجح: <b className="text-emerald-300">{totals.done}</b> · مكرر: <b className="text-sky-300">{totals.skipped}</b> · فشل: <b className="text-red-300">{totals.error}</b> · بانتظار: <b>{totals.queued}</b>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
          <table className="w-full text-[12px]">
            <thead className="text-muted-foreground">
              <tr className="border-b border-white/10">
                <th className="p-2 text-right">الملف</th>
                <th className="p-2 text-right">الحالة</th>
                <th className="p-2 text-right">صفوف</th>
                <th className="p-2 text-right">تحتاج مراجعة</th>
                <th className="p-2 text-right">إجمالي المبيعات</th>
                <th className="p-2 text-right">صافي محسوب</th>
                <th className="p-2 text-right">مرجع التسوية</th>
                <th className="p-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className="border-b border-white/5">
                  <td className="p-2">
                    <div className="font-mono text-[11px] truncate max-w-[280px]" title={f.file.name}>{f.file.name}</div>
                    <div className="text-[10px] text-muted-foreground">{(f.file.size / 1024).toFixed(1)} KB · hash {f.hash.slice(0, 10)}</div>
                  </td>
                  <td className="p-2">
                    <div className={`inline-flex items-center gap-1 text-[11px] ${
                      f.status === "done" ? "text-emerald-300"
                      : f.status === "skipped" ? "text-sky-300"
                      : f.status === "error" ? "text-red-300"
                      : f.status === "queued" ? "text-muted-foreground"
                      : "text-amber-300"
                    }`}>
                      {f.status === "done" && <CheckCircle2 size={12} />}
                      {f.status === "error" && <AlertTriangle size={12} />}
                      {(f.status === "parsing" || f.status === "matching" || f.status === "committing") && <Loader2 size={12} className="animate-spin" />}
                      <span>{f.message}</span>
                    </div>
                  </td>
                  <td className="p-2 tabular-nums">{f.rowCount || "—"}</td>
                  <td className={`p-2 tabular-nums ${f.reviewCount ? "text-amber-300" : "text-muted-foreground"}`}>{f.reviewCount || "—"}</td>
                  <td className="p-2 tabular-nums">{f.gross ? f.gross.toFixed(2) : "—"}</td>
                  <td className="p-2 tabular-nums">{f.calculatedExpected ? f.calculatedExpected.toFixed(2) : "—"}</td>
                  <td className="p-2">
                    {f.settlementId ? (
                      <button
                        onClick={() => nav({ to: "/admin/finance/settlement-lines", search: { settlement: f.settlementId } as any })}
                        className="text-gold hover:underline text-[11px] font-mono">
                        {f.settlementRef}
                      </button>
                    ) : "—"}
                  </td>
                  <td className="p-2">
                    {(f.status === "queued" || f.status === "error" || f.status === "skipped") && !busy && (
                      <button onClick={() => removeFile(f.id)} className="text-red-400 hover:text-red-300" title="إزالة">
                        <X size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {totals.done > 0 && (
              <tfoot>
                <tr className="border-t border-white/10 bg-white/5 font-semibold">
                  <td className="p-2" colSpan={2}>الإجمالي (المكتملة)</td>
                  <td className="p-2 tabular-nums">{totals.totalRows}</td>
                  <td className="p-2 tabular-nums">—</td>
                  <td className="p-2 tabular-nums">{totals.totalGross.toFixed(2)}</td>
                  <td className="p-2 tabular-nums">{totals.totalNet.toFixed(2)}</td>
                  <td className="p-2" colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {files.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-[12px] text-muted-foreground">
          لم تُضف ملفات بعد — اختر ملفات .xlsx / .xls / .csv من زر "إضافة ملفات" أعلاه.
        </div>
      )}
    </div>
  );
}
