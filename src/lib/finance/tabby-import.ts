// Tabby "Bulk Settlement Report" parser.
// Used only when provider = "tabby". Never applied to Salla or Tamara files.
//
// Contract:
//  - Never creates sales invoices, incomes, credit notes, or output VAT.
//  - Never mutates existing settlements; the caller decides whether to commit.
//  - Preserves original signed values row-by-row (refunds stay negative).
//  - Splits the report into one settlement per (Transfer Date, Currency, Merchant Code).
//  - Uses row_fingerprint (11 fields) + file_hash to guard against duplicates.

import * as XLSX from "xlsx";

const round2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: any) => (s == null ? "" : String(s)).trim().toLowerCase().replace(/\s+/g, " ");
const FEE_TOL = 0.02;

// ---------- number / date helpers ----------
function parseNum(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && isFinite(v)) return round2(v);
  // Accept Arabic digits, minus, parentheses for negatives.
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const paren = /^\((.+)\)$/.exec(s);
  const sign = paren ? -1 : 1;
  if (paren) s = paren[1];
  s = s.replace(/[^\d.\-]/g, "");
  if (!s || s === "-" || s === ".") return null;
  const n = Number(s) * sign;
  return isFinite(n) ? round2(n) : null;
}

// Dates in the Tabby report are MM/DD/YYYY. Return ISO DATE (no timezone conversion).
function parseTabbyDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  // ISO passthrough
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  // Tabby uses MM/DD/YYYY
  const mdy = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/.exec(s);
  if (mdy) {
    let y = mdy[3];
    if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
    return `${y}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }
  return null;
}

function normalizeOrderId(v: any): string | null {
  if (v == null) return null;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  s = s.replace(/\s+/g, "");
  s = s.replace(/\.0+$/, "");
  if (/e\+?\d+$/i.test(s)) {
    const n = Number(s);
    if (isFinite(n)) s = Math.round(n).toString();
  }
  return s || null;
}

// ---------- Tabby field schema ----------
export type TabbyFieldKey =
  | "external_order_id"       // Order Number
  | "event_date"              // Sale/Refund Date
  | "merchant_name_snapshot"  // Merchant Name
  | "merchant_code"           // Merchant Code
  | "product_type"            // Product Type
  | "event_type_raw"          // Type
  | "currency"                // Currency
  | "gross_amount"            // Order Amount
  | "refundable_commission"   // Refundable Commission
  | "non_refundable_commission" // Non Refundable Commission
  | "fixed_fee"               // Fixed Fee
  | "fees_before_vat"         // Total Fee
  | "fees_vat_amount"         // VAT Amount
  | "fee_vat_rate"            // Vat Rate
  | "total_deduction"         // Total Deduction
  | "net_amount"              // Transferred amount
  | "payout_date";            // Transfer Date

export type TabbyFieldDef = {
  key: TabbyFieldKey;
  label: string;
  header: string;      // canonical CSV header name
  required: boolean;
  aliases: string[];
};

export const TABBY_FIELDS: TabbyFieldDef[] = [
  { key: "external_order_id",        label: "Order Number",              header: "order number",              required: true,  aliases: ["order number", "order_no"] },
  { key: "event_date",               label: "Sale/Refund Date",          header: "sale/refund date",          required: true,  aliases: ["sale/refund date", "sale refund date"] },
  { key: "merchant_name_snapshot",   label: "Merchant Name",             header: "merchant name",             required: false, aliases: ["merchant name"] },
  { key: "merchant_code",            label: "Merchant Code",             header: "merchant code",             required: false, aliases: ["merchant code"] },
  { key: "product_type",             label: "Product Type",              header: "product type",              required: false, aliases: ["product type"] },
  { key: "event_type_raw",           label: "Type",                      header: "type",                      required: true,  aliases: ["type"] },
  { key: "currency",                 label: "Currency",                  header: "currency",                  required: false, aliases: ["currency"] },
  { key: "gross_amount",             label: "Order Amount",              header: "order amount",              required: true,  aliases: ["order amount"] },
  { key: "refundable_commission",    label: "Refundable Commission",     header: "refundable commission",     required: false, aliases: ["refundable commission"] },
  { key: "non_refundable_commission",label: "Non Refundable Commission", header: "non refundable commission", required: false, aliases: ["non refundable commission", "non-refundable commission"] },
  { key: "fixed_fee",                label: "Fixed Fee",                 header: "fixed fee",                 required: false, aliases: ["fixed fee"] },
  { key: "fees_before_vat",          label: "Total Fee",                 header: "total fee",                 required: true,  aliases: ["total fee"] },
  { key: "fees_vat_amount",          label: "VAT Amount",                header: "vat amount",                required: false, aliases: ["vat amount"] },
  { key: "fee_vat_rate",             label: "Vat Rate",                  header: "vat rate",                  required: false, aliases: ["vat rate"] },
  { key: "total_deduction",          label: "Total Deduction",           header: "total deduction",           required: false, aliases: ["total deduction"] },
  { key: "net_amount",               label: "Transferred amount",        header: "transferred amount",        required: true,  aliases: ["transferred amount"] },
  { key: "payout_date",              label: "Transfer Date",             header: "transfer date",             required: true,  aliases: ["transfer date"] },
];

// Columns that uniquely identify a Tabby-shaped file (guard against wrong provider).
export const TABBY_SIGNATURE_HEADERS = [
  "refundable commission",
  "non refundable commission",
  "fixed fee",
  "transferred amount",
  "transfer date",
];

export type TabbyMapping = Partial<Record<TabbyFieldKey, number>>;

export function autoMapTabby(headers: any[]): TabbyMapping {
  const hs = headers.map(norm);
  const m: TabbyMapping = {};
  for (const f of TABBY_FIELDS) {
    for (const a of f.aliases) {
      const na = norm(a);
      const i = hs.findIndex((h) => h === na);
      if (i >= 0) { m[f.key] = i; break; }
    }
    if (m[f.key] == null) {
      for (const a of f.aliases) {
        const na = norm(a);
        const i = hs.findIndex((h) => h && h.includes(na));
        if (i >= 0) { m[f.key] = i; break; }
      }
    }
  }
  return m;
}

// Locate the transactions header row by looking for "order number" + "transfer date".
export function detectTabbyHeaderRow(aoa: any[][]): number {
  const need = ["order number", "transfer date", "type", "order amount"];
  const max = Math.min(aoa.length, 40);
  let best = 0, bestScore = 0;
  for (let i = 0; i < max; i++) {
    const row = (aoa[i] ?? []).map(norm);
    let s = 0;
    for (const n of need) if (row.some((c) => c === n)) s++;
    if (s > bestScore) { bestScore = s; best = i; }
  }
  return bestScore >= 3 ? best : 0;
}

export type TabbyHeaderInfo = {
  reportTitle: string | null;
  dateRangeStart: string | null;   // ISO
  dateRangeEnd: string | null;     // ISO
};

// Extract the report title + "Date range" line above the transactions table.
export function extractTabbyHeader(aoa: any[][]): TabbyHeaderInfo {
  const out: TabbyHeaderInfo = { reportTitle: null, dateRangeStart: null, dateRangeEnd: null };
  const max = Math.min(aoa.length, 20);
  for (let i = 0; i < max; i++) {
    const row = aoa[i] ?? [];
    for (let j = 0; j < row.length; j++) {
      const label = norm(row[j]);
      if (!label) continue;
      if (!out.reportTitle && label === "settlement report") out.reportTitle = "Settlement Report";
      if (label === "date range") {
        // value is in the next non-empty cell to the right
        for (let k = j + 1; k < row.length; k++) {
          const v = row[k];
          if (v != null && String(v).trim() !== "") {
            const s = String(v).trim();
            // formats: "01/01/2026 - 30/06/2026" — Tabby range uses DD/MM/YYYY here.
            const parts = s.split(/\s*(?:-|–|—|to)\s*/i).filter(Boolean);
            if (parts.length >= 2) {
              // Try DD/MM/YYYY first for range labels.
              const parseRange = (raw: string) => {
                const m = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/.exec(raw);
                if (!m) return null;
                let y = m[3];
                if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
                return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
              };
              out.dateRangeStart = parseRange(parts[0]);
              out.dateRangeEnd = parseRange(parts[1]);
            }
            break;
          }
        }
      }
    }
  }
  return out;
}

// ---------- Row model ----------
export type TabbyEventType = "sale" | "refund" | "partial_refund" | "adjustment";

export type TabbyParsedLine = {
  rowNo: number;
  provider_id: "tabby";
  external_order_id: string | null;
  event_date: string | null;         // Sale/Refund Date
  payout_date: string | null;        // Transfer Date — settlement key
  merchant_name_snapshot: string | null;
  merchant_code: string | null;
  product_type: string | null;
  event_type_raw: string | null;
  event_type: TabbyEventType;
  line_type: "sale" | "refund" | "partial_refund" | "adjustment";
  currency: string | null;

  gross_amount: number;              // Order Amount (signed)
  refundable_commission: number;
  non_refundable_commission: number;
  fixed_fee: number;
  fees_before_vat: number;           // Total Fee (signed)
  fees_vat_amount: number;           // VAT Amount (signed)
  fee_vat_rate: number | null;
  total_deduction: number;           // signed
  net_amount: number;                // Transferred amount (signed)

  row_fingerprint: string;
  reasons: string[];
  needs_review: boolean;
  raw: Record<string, any>;
};

function classifyEvent(raw: string | null): { event_type: TabbyEventType; line_type: TabbyParsedLine["line_type"]; reason?: string } {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "sale") return { event_type: "sale", line_type: "sale" };
  if (t === "refund") return { event_type: "refund", line_type: "refund" };
  if (t === "partial refund" || t === "partial_refund") return { event_type: "partial_refund", line_type: "partial_refund" };
  return { event_type: "adjustment", line_type: "adjustment", reason: `unknown_tabby_event_type:${raw ?? ""}` };
}

async function sha256Hex(s: string): Promise<string> {
  const enc = new TextEncoder().encode(s);
  const h = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Build parsed lines from a Tabby report AOA. Truncates at the trailing note.
export async function buildTabbyRows(aoa: any[][], headerRow: number, mapping: TabbyMapping): Promise<TabbyParsedLine[]> {
  const headers = aoa[headerRow] ?? [];
  const orderIdx = mapping["external_order_id"];
  const typeIdx = mapping["event_type_raw"];
  const grossIdx = mapping["gross_amount"];
  const transferIdx = mapping["payout_date"];

  const get = (raw: any[], k: TabbyFieldKey) => (mapping[k] != null ? raw[mapping[k]!] : null);

  const body: any[][] = [];
  for (let i = headerRow + 1; i < aoa.length; i++) {
    const raw = aoa[i] ?? [];
    // Skip fully empty rows
    if (!raw.some((c) => c != null && String(c).trim() !== "")) continue;

    // Trailing note guard: stop when we hit a row that doesn't have a numeric-looking order number
    // OR whose content is clearly a note (contains letters in the order-number cell).
    const rawOrder = orderIdx != null ? raw[orderIdx] : null;
    const rawType = typeIdx != null ? raw[typeIdx] : null;
    const rawGross = grossIdx != null ? raw[grossIdx] : null;
    const rawTransfer = transferIdx != null ? raw[transferIdx] : null;

    const orderStr = normalizeOrderId(rawOrder);
    if (!orderStr) continue;                          // skip rows without an order number
    if (!/^\d+$/.test(orderStr)) continue;            // reject "Note:" rows and similar
    if (parseNum(rawGross) == null) continue;         // reject non-numeric amount rows
    if (!String(rawType ?? "").trim()) continue;      // reject rows without a Type
    if (!parseTabbyDate(rawTransfer)) continue;       // reject rows without a Transfer Date

    body.push(raw);
  }

  const out: TabbyParsedLine[] = [];
  for (let idx = 0; idx < body.length; idx++) {
    const raw = body[idx];
    const rowNo = idx + 1;
    const rawObj: Record<string, any> = {};
    headers.forEach((h: any, i: number) => { rawObj[String(h ?? `col_${i}`)] = raw[i] ?? null; });

    const orderId = normalizeOrderId(get(raw, "external_order_id"));
    const eventDate = parseTabbyDate(get(raw, "event_date"));
    const payoutDate = parseTabbyDate(get(raw, "payout_date"));
    const merchantName = (String(get(raw, "merchant_name_snapshot") ?? "").trim() || null);
    const merchantCode = (String(get(raw, "merchant_code") ?? "").trim() || null);
    const productType = (String(get(raw, "product_type") ?? "").trim() || null);
    const eventRaw = (String(get(raw, "event_type_raw") ?? "").trim() || null);
    const currency = (String(get(raw, "currency") ?? "").trim() || null);

    const gross = parseNum(get(raw, "gross_amount")) ?? 0;
    const refundableCommission = parseNum(get(raw, "refundable_commission")) ?? 0;
    const nonRefundableCommission = parseNum(get(raw, "non_refundable_commission")) ?? 0;
    const fixedFee = parseNum(get(raw, "fixed_fee")) ?? 0;
    const totalFee = parseNum(get(raw, "fees_before_vat")) ?? 0;
    const vatAmt = parseNum(get(raw, "fees_vat_amount")) ?? 0;
    const vatRate = parseNum(get(raw, "fee_vat_rate"));
    const totalDeduction = parseNum(get(raw, "total_deduction")) ?? 0;
    const transferred = parseNum(get(raw, "net_amount")) ?? 0;

    const { event_type, line_type, reason } = classifyEvent(eventRaw);
    const reasons: string[] = [];
    if (reason) reasons.push(reason);

    // Fee arithmetic checks (0.02 tolerance).
    const feeSum = round2(refundableCommission + nonRefundableCommission + fixedFee);
    if (Math.abs(feeSum - totalFee) > FEE_TOL) reasons.push("fee_components_mismatch");
    const deductionCheck = round2(totalFee + vatAmt);
    if (Math.abs(deductionCheck - totalDeduction) > FEE_TOL) reasons.push("total_deduction_mismatch");
    const transferCheck = round2(gross - totalDeduction);
    if (Math.abs(transferCheck - transferred) > FEE_TOL) reasons.push("transferred_amount_mismatch");

    // row_fingerprint: normalized values.
    const fpSource = [
      "tabby",
      orderId ?? "",
      (eventRaw ?? "").toLowerCase(),
      eventDate ?? "",
      payoutDate ?? "",
      (currency ?? "").toUpperCase(),
      gross.toFixed(2),
      refundableCommission.toFixed(2),
      nonRefundableCommission.toFixed(2),
      fixedFee.toFixed(2),
      totalFee.toFixed(2),
      vatAmt.toFixed(2),
      totalDeduction.toFixed(2),
      transferred.toFixed(2),
    ].join("|");
    const row_fingerprint = await sha256Hex(fpSource);

    out.push({
      rowNo,
      provider_id: "tabby",
      external_order_id: orderId,
      event_date: eventDate,
      payout_date: payoutDate,
      merchant_name_snapshot: merchantName,
      merchant_code: merchantCode,
      product_type: productType,
      event_type_raw: eventRaw,
      event_type,
      line_type,
      currency,
      gross_amount: gross,
      refundable_commission: refundableCommission,
      non_refundable_commission: nonRefundableCommission,
      fixed_fee: fixedFee,
      fees_before_vat: totalFee,
      fees_vat_amount: vatAmt,
      fee_vat_rate: vatRate,
      total_deduction: totalDeduction,
      net_amount: transferred,
      row_fingerprint,
      reasons,
      needs_review: reasons.length > 0,
      raw: rawObj,
    });
  }

  return out;
}

// ---------- Grouping into settlements ----------
export type TabbyGroupKey = { payout_date: string; currency: string; merchant_code: string };

export type TabbyGroupTotals = {
  key: TabbyGroupKey;
  internal_reference: string;              // TABBY-YYYYMMDD-CUR-MERCHANT
  display_name: string;                    // "تابي — دفعة DD/MM/YYYY"
  period_start: string | null;
  period_end: string | null;
  transactions_count: number;
  sale_count: number;
  refund_count: number;
  partial_refund_count: number;
  gross_sales_amount: number;              // sum(Order Amount) for sale only
  refunds_amount: number;                  // sum(Order Amount) for refund + partial_refund (signed, negative)
  net_order_amount: number;                // gross_sales_amount + refunds_amount
  refundable_commission: number;
  non_refundable_commission: number;
  fixed_fee: number;
  fees_before_vat: number;                 // signed
  fees_vat_amount: number;                 // signed
  total_deduction: number;                 // signed
  expected_net_amount: number;             // sum(Transferred amount)
  arithmetic_mismatch: boolean;            // net_order_amount - total_deduction vs expected_net
  lines: TabbyParsedLine[];
};

function displayDateDMY(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function groupTabbyLines(lines: TabbyParsedLine[]): TabbyGroupTotals[] {
  const groups = new Map<string, TabbyParsedLine[]>();
  for (const l of lines) {
    if (!l.payout_date) continue;
    const currency = (l.currency ?? "SAR").toUpperCase();
    const merchantCode = l.merchant_code ?? "default";
    const key = `${l.payout_date}|${currency}|${merchantCode}`;
    const arr = groups.get(key) ?? [];
    arr.push(l);
    groups.set(key, arr);
  }

  const out: TabbyGroupTotals[] = [];
  for (const [key, arr] of groups) {
    const [payout_date, currency, merchant_code] = key.split("|");
    const dates = arr.map((l) => l.event_date).filter(Boolean).sort() as string[];
    const period_start = dates[0] ?? null;
    const period_end = dates[dates.length - 1] ?? null;

    let sale_count = 0, refund_count = 0, partial_refund_count = 0;
    let gross_sales_amount = 0, refunds_amount = 0;
    let refundable_commission = 0, non_refundable_commission = 0, fixed_fee = 0;
    let fees_before_vat = 0, fees_vat_amount = 0, total_deduction = 0, expected_net_amount = 0;

    for (const l of arr) {
      if (l.line_type === "sale") { sale_count++; gross_sales_amount = round2(gross_sales_amount + l.gross_amount); }
      else if (l.line_type === "refund") { refund_count++; refunds_amount = round2(refunds_amount + l.gross_amount); }
      else if (l.line_type === "partial_refund") { partial_refund_count++; refunds_amount = round2(refunds_amount + l.gross_amount); }
      refundable_commission = round2(refundable_commission + l.refundable_commission);
      non_refundable_commission = round2(non_refundable_commission + l.non_refundable_commission);
      fixed_fee = round2(fixed_fee + l.fixed_fee);
      fees_before_vat = round2(fees_before_vat + l.fees_before_vat);
      fees_vat_amount = round2(fees_vat_amount + l.fees_vat_amount);
      total_deduction = round2(total_deduction + l.total_deduction);
      expected_net_amount = round2(expected_net_amount + l.net_amount);
    }
    const net_order_amount = round2(gross_sales_amount + refunds_amount);
    const check = round2(net_order_amount - total_deduction);
    const arithmetic_mismatch = Math.abs(check - expected_net_amount) > 0.05;

    const cur = (currency ?? "SAR").toUpperCase();
    const mc = merchant_code ?? "default";
    const compact = payout_date.replace(/-/g, "");
    out.push({
      key: { payout_date, currency: cur, merchant_code: mc },
      internal_reference: `TABBY-${compact}-${cur}-${mc}`,
      display_name: `تابي — دفعة ${displayDateDMY(payout_date)}`,
      period_start,
      period_end,
      transactions_count: arr.length,
      sale_count, refund_count, partial_refund_count,
      gross_sales_amount, refunds_amount, net_order_amount,
      refundable_commission, non_refundable_commission, fixed_fee,
      fees_before_vat, fees_vat_amount, total_deduction, expected_net_amount,
      arithmetic_mismatch,
      lines: arr,
    });
  }
  out.sort((a, b) => a.key.payout_date.localeCompare(b.key.payout_date));
  return out;
}

// ---------- File-level totals ----------
export type TabbyFileTotals = {
  transactions_count: number;
  unique_orders: number;
  sale_count: number;
  refund_count: number;
  partial_refund_count: number;
  transfer_dates: number;
  gross_sales_amount: number;
  refunds_amount: number;
  net_order_amount: number;
  refundable_commission: number;
  non_refundable_commission: number;
  fixed_fee: number;
  fees_before_vat: number;
  fees_vat_amount: number;
  total_deduction: number;
  expected_net_amount: number;
  duplicate_fingerprints: number;
  needs_review_count: number;
};

export function computeTabbyFileTotals(lines: TabbyParsedLine[], groups: TabbyGroupTotals[]): TabbyFileTotals {
  const orders = new Set<string>();
  const fps = new Map<string, number>();
  let sale = 0, refund = 0, partial = 0;
  let gross = 0, refunds = 0, refCom = 0, nonRefCom = 0, fixed = 0;
  let feeBv = 0, vat = 0, dedu = 0, net = 0, review = 0;
  for (const l of lines) {
    if (l.external_order_id) orders.add(l.external_order_id);
    fps.set(l.row_fingerprint, (fps.get(l.row_fingerprint) ?? 0) + 1);
    if (l.line_type === "sale") { sale++; gross = round2(gross + l.gross_amount); }
    else if (l.line_type === "refund") { refund++; refunds = round2(refunds + l.gross_amount); }
    else if (l.line_type === "partial_refund") { partial++; refunds = round2(refunds + l.gross_amount); }
    refCom = round2(refCom + l.refundable_commission);
    nonRefCom = round2(nonRefCom + l.non_refundable_commission);
    fixed = round2(fixed + l.fixed_fee);
    feeBv = round2(feeBv + l.fees_before_vat);
    vat = round2(vat + l.fees_vat_amount);
    dedu = round2(dedu + l.total_deduction);
    net = round2(net + l.net_amount);
    if (l.needs_review) review++;
  }
  let dupes = 0;
  fps.forEach((c) => { if (c > 1) dupes += c - 1; });
  return {
    transactions_count: lines.length,
    unique_orders: orders.size,
    sale_count: sale, refund_count: refund, partial_refund_count: partial,
    transfer_dates: groups.length,
    gross_sales_amount: gross,
    refunds_amount: refunds,
    net_order_amount: round2(gross + refunds),
    refundable_commission: refCom,
    non_refundable_commission: nonRefCom,
    fixed_fee: fixed,
    fees_before_vat: feeBv,
    fees_vat_amount: vat,
    total_deduction: dedu,
    expected_net_amount: net,
    duplicate_fingerprints: dupes,
    needs_review_count: review,
  };
}

// ---------- File structure guard ----------
export type TabbyStructureCheck = {
  isTabbyShape: boolean;
  matchedSignatures: string[];
  missingSignatures: string[];
};

export function checkTabbyStructure(headers: any[]): TabbyStructureCheck {
  const hs = headers.map(norm);
  const matched: string[] = [], missing: string[] = [];
  for (const sig of TABBY_SIGNATURE_HEADERS) {
    if (hs.some((h) => h === sig || h.includes(sig))) matched.push(sig);
    else missing.push(sig);
  }
  return { isTabbyShape: matched.length >= 4, matchedSignatures: matched, missingSignatures: missing };
}
