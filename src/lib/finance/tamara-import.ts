// Tamara Merchant Statement parser — used only when provider = "tamara".
// Does NOT touch Salla/Tabby logic and does NOT create sales invoices;
// it only produces parsed lines for the preview + commit path.

import * as XLSX from "xlsx";

const round2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: any) => (s == null ? "" : String(s)).trim().toLowerCase().replace(/\s+/g, " ");

export type TamaraFieldKey =
  | "event_date"
  | "original_order_date"
  | "provider_order_id"          // Tamara Order ID
  | "merchant_order_id"          // Merchant Order ID (fallback for order match)
  | "merchant_order_number"      // Merchant Order Number (primary match)
  | "provider_event_id"          // Event ID
  | "event_type_raw"             // Event
  | "event_amount"
  | "original_order_amount"      // Order Amount
  | "fixed_fee_amount"           // Tamara Fixed Fees
  | "variable_fee_rate"          // Tamara Variable Fees %
  | "variable_fee_amount"        // Tamara Variable Fees
  | "fees_before_vat"            // Total Fees
  | "fees_vat_amount"            // VAT Collected by Tamara
  | "net_amount"                 // Total Payable to Merchant
  | "provider_refund_id"         // Merchant Refund ID
  | "refund_reason"
  | "payment_type"
  | "provider_order_status"
  | "installments"
  | "country"
  | "currency";

export type TamaraFieldDef = {
  key: TamaraFieldKey;
  label: string;
  required: boolean;
  aliases: string[];
  section: "order" | "event" | "fees" | "net" | "refund" | "meta";
};

export const TAMARA_FIELDS: TamaraFieldDef[] = [
  // order
  { key: "merchant_order_number", label: "رقم طلب المتجر (Merchant Order Number)", required: true, section: "order",
    aliases: ["merchant order number", "merchant_order_number"] },
  { key: "merchant_order_id", label: "Merchant Order ID (احتياطي)", required: false, section: "order",
    aliases: ["merchant order id", "merchant_order_id"] },
  { key: "provider_order_id", label: "Tamara Order ID", required: false, section: "order",
    aliases: ["tamara order id", "tamara_order_id"] },
  { key: "original_order_date", label: "تاريخ الطلب (Transaction Date)", required: false, section: "order",
    aliases: ["transaction date dd/mm/yyyy", "transaction date", "transaction_date"] },
  { key: "original_order_amount", label: "Order Amount", required: false, section: "order",
    aliases: ["order amount", "order_amount"] },
  { key: "provider_order_status", label: "Order Status", required: false, section: "order",
    aliases: ["order status", "order_status"] },
  { key: "payment_type", label: "Payment Type", required: false, section: "order",
    aliases: ["payment type", "payment_type"] },
  { key: "installments", label: "Installments", required: false, section: "order",
    aliases: ["installments", "installment"] },
  { key: "country", label: "Country", required: false, section: "order",
    aliases: ["country"] },
  { key: "currency", label: "Currency", required: false, section: "meta",
    aliases: ["currency"] },
  // event
  { key: "event_type_raw", label: "نوع الحدث (Event)", required: true, section: "event",
    aliases: ["event"] },
  { key: "event_date", label: "تاريخ الحدث (Event Date)", required: false, section: "event",
    aliases: ["event date dd/mm/yyyy", "event date", "event_date"] },
  { key: "provider_event_id", label: "رقم الحدث (Event ID)", required: true, section: "event",
    aliases: ["event id", "event_id"] },
  { key: "event_amount", label: "مبلغ الحدث (Event Amount)", required: true, section: "event",
    aliases: ["event amount", "event_amount"] },
  // fees
  { key: "fixed_fee_amount", label: "Tamara Fixed Fees", required: false, section: "fees",
    aliases: ["tamara fixed fees", "tamara_fixed_fees", "fixed fees"] },
  { key: "variable_fee_rate", label: "Tamara Variable Fees %", required: false, section: "fees",
    aliases: ["tamara variable fees %", "tamara variable fees percent", "variable fees %"] },
  { key: "variable_fee_amount", label: "Tamara Variable Fees", required: false, section: "fees",
    aliases: ["tamara variable fees", "variable fees"] },
  { key: "fees_before_vat", label: "إجمالي الرسوم (Total Fees)", required: false, section: "fees",
    aliases: ["total fees", "total_fees"] },
  { key: "fees_vat_amount", label: "ضريبة الرسوم (VAT Collected by Tamara)", required: false, section: "fees",
    aliases: ["vat collected by tamara", "vat_collected_by_tamara", "tamara vat"] },
  // net
  { key: "net_amount", label: "الصافي (Total Payable to Merchant)", required: true, section: "net",
    aliases: ["total payable to merchant", "payable to merchant", "total_payable_to_merchant"] },
  // refund
  { key: "provider_refund_id", label: "Merchant Refund ID", required: false, section: "refund",
    aliases: ["merchant refund id", "refund id", "refund_id"] },
  { key: "refund_reason", label: "سبب الاسترجاع (Refund Reason)", required: false, section: "refund",
    aliases: ["refund reason", "refund_reason"] },
];

export type TamaraMapping = Partial<Record<TamaraFieldKey, number>>;

export function autoMapTamara(headers: any[]): TamaraMapping {
  const hs = headers.map(norm);
  const m: TamaraMapping = {};
  for (const f of TAMARA_FIELDS) {
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

// Locate the transactions header row by looking for the required Tamara columns.
export function detectTamaraHeaderRow(aoa: any[][]): number {
  const need = ["event", "event amount", "total payable to merchant", "event id"];
  const max = Math.min(aoa.length, 200);
  let best = 0, bestScore = 0;
  for (let i = 0; i < max; i++) {
    const row = (aoa[i] ?? []).map(norm);
    let s = 0;
    for (const n of need) if (row.some((c) => c === n || c.includes(n))) s++;
    if (s > bestScore) { bestScore = s; best = i; }
  }
  return bestScore >= 2 ? best : 0;
}

// ---- header / period extraction ----
function parseDateCell(v: any): string | null {
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
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dmy = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/.exec(s);
  if (dmy) {
    let y = dmy[3];
    if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
    // Tamara uses DD/MM/YYYY
    return `${y}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return null;
}

export type TamaraHeaderInfo = {
  merchant: string | null;
  storeName: string | null;
  statementId: string | null;
  statementDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  tamaraMerchantId: string | null;
  currency: string | null;
};

// Search the top rows for label→value pairs (label in one cell, value in the next non-empty cell).
export function extractTamaraHeader(aoa: any[][]): TamaraHeaderInfo {
  const info: TamaraHeaderInfo = {
    merchant: null, storeName: null, statementId: null, statementDate: null,
    periodStart: null, periodEnd: null, tamaraMerchantId: null, currency: null,
  };
  const max = Math.min(aoa.length, 40);

  const valueRight = (r: number, c: number): any => {
    const row = aoa[r] ?? [];
    for (let j = c + 1; j < row.length; j++) {
      const v = row[j];
      if (v != null && String(v).trim() !== "") return v;
    }
    // sometimes value is on the row below
    const below = aoa[r + 1] ?? [];
    const v2 = below[c];
    if (v2 != null && String(v2).trim() !== "") return v2;
    return null;
  };

  for (let i = 0; i < max; i++) {
    const row = aoa[i] ?? [];
    for (let j = 0; j < row.length; j++) {
      const label = norm(row[j]);
      if (!label) continue;
      if (info.merchant == null && (label === "merchant" || label.startsWith("merchant "))) {
        if (label === "merchant") info.merchant = String(valueRight(i, j) ?? "").trim() || null;
      }
      if (info.storeName == null && label === "store name") info.storeName = String(valueRight(i, j) ?? "").trim() || null;
      if (info.statementId == null && label === "statement id") info.statementId = String(valueRight(i, j) ?? "").trim() || null;
      if (info.statementDate == null && label === "statement date") info.statementDate = parseDateCell(valueRight(i, j));
      if (info.tamaraMerchantId == null && (label === "tamara merchant id" || label === "merchant id")) {
        info.tamaraMerchantId = String(valueRight(i, j) ?? "").trim() || null;
      }
      if ((info.periodStart == null || info.periodEnd == null) && label === "statement period") {
        const v = String(valueRight(i, j) ?? "").trim();
        // formats: "27/12/2025 - 02/01/2026" or "27/12/2025 to 02/01/2026"
        const parts = v.split(/\s*(?:-|–|—|to)\s*/i).filter(Boolean);
        if (parts.length >= 2) {
          info.periodStart = parseDateCell(parts[0]);
          info.periodEnd = parseDateCell(parts[1]);
        }
      }
      if (info.currency == null && label === "currency") info.currency = String(valueRight(i, j) ?? "").trim() || null;
    }
  }
  return info;
}

export type TamaraSummary = {
  transactionCount: number | null;
  capturedAmount: number | null;
  refundAmount: number | null;      // stored as signed (negative for refunds)
  canceledAmount: number | null;
  feesBeforeVat: number | null;
  feesVat: number | null;
  payableToMerchant: number | null; // official expected net
};

// Parse the summary block (columns: Type, Count, Canceled, Captured, Refund, Fees, VAT, Payable).
export function extractTamaraSummary(aoa: any[][]): TamaraSummary {
  const out: TamaraSummary = {
    transactionCount: null, capturedAmount: null, refundAmount: null, canceledAmount: null,
    feesBeforeVat: null, feesVat: null, payableToMerchant: null,
  };
  // Find summary header row
  let hdr = -1;
  for (let i = 0; i < Math.min(aoa.length, 80); i++) {
    const row = (aoa[i] ?? []).map(norm);
    if (row.some((c) => c === "type") && row.some((c) => c === "captured amount") && row.some((c) => c === "payable to merchant")) {
      hdr = i; break;
    }
  }
  if (hdr < 0) return out;
  const cols = (aoa[hdr] ?? []).map(norm);
  const idxOf = (n: string) => cols.findIndex((c) => c === n);
  const idxCount = idxOf("count");
  const idxCanceled = idxOf("canceled amount");
  const idxCaptured = idxOf("captured amount");
  const idxRefund = idxOf("refund amount");
  const idxFees = idxOf("tamara fees");
  const idxVat = idxOf("tamara vat");
  const idxPay = idxOf("payable to merchant");

  const numAt = (row: any[], i: number): number | null => {
    if (i < 0) return null;
    const v = row[i];
    if (v == null || v === "") return null;
    if (typeof v === "number") return round2(v);
    const s = String(v).replace(/[^\d.\-]/g, "");
    if (!s) return null;
    const n = Number(s);
    return isFinite(n) ? round2(n) : null;
  };

  // Look for a totals row within the next ~20 rows (label often "Credit Total" / "Total" / "Grand Total")
  const totalsRe = /^(credit\s+total|grand\s+total|totals?|total)$/i;
  let totalRow: any[] | null = null;
  let accum = { count: 0, canceled: 0, captured: 0, refund: 0, fees: 0, vat: 0, payable: 0, has: false };
  for (let i = hdr + 1; i < Math.min(aoa.length, hdr + 40); i++) {
    const row = aoa[i] ?? [];
    const first = norm(row[cols.findIndex((c) => c === "type")] ?? row[0]);
    // If we hit an empty row, stop.
    if (!row.some((c) => c != null && String(c).trim() !== "")) break;
    if (totalsRe.test(first)) { totalRow = row; break; }
    // otherwise accumulate the section rows (never accumulate a totals-like row)
    const cCount = numAt(row, idxCount);
    if (cCount != null) accum.count += cCount;
    const cCan = numAt(row, idxCanceled); if (cCan != null) accum.canceled += cCan;
    const cCap = numAt(row, idxCaptured); if (cCap != null) accum.captured += cCap;
    const cRef = numAt(row, idxRefund); if (cRef != null) accum.refund += cRef;
    const cFee = numAt(row, idxFees); if (cFee != null) accum.fees += cFee;
    const cVat = numAt(row, idxVat); if (cVat != null) accum.vat += cVat;
    const cPay = numAt(row, idxPay); if (cPay != null) accum.payable += cPay;
    accum.has = true;
  }
  if (totalRow) {
    out.transactionCount = numAt(totalRow, idxCount);
    out.canceledAmount = numAt(totalRow, idxCanceled);
    out.capturedAmount = numAt(totalRow, idxCaptured);
    out.refundAmount = numAt(totalRow, idxRefund);
    out.feesBeforeVat = numAt(totalRow, idxFees);
    out.feesVat = numAt(totalRow, idxVat);
    out.payableToMerchant = numAt(totalRow, idxPay);
  } else if (accum.has) {
    out.transactionCount = accum.count || null;
    out.canceledAmount = round2(accum.canceled);
    out.capturedAmount = round2(accum.captured);
    out.refundAmount = round2(accum.refund);
    out.feesBeforeVat = round2(accum.fees);
    out.feesVat = round2(accum.vat);
    out.payableToMerchant = round2(accum.payable);
  }
  return out;
}

// ---- rows ----
export type TamaraEventType = "sale" | "refund" | "needs_review_event";

export type TamaraParsedLine = {
  rowNo: number;
  external_order_id: string | null;    // Merchant Order Number || Merchant Order ID
  external_order_id_source: "merchant_order_number" | "merchant_order_id" | null;
  provider_order_id: string | null;
  provider_event_id: string | null;
  provider_refund_id: string | null;
  event_type_raw: string | null;
  event_type: TamaraEventType;
  line_type: "sale" | "refund" | "manual_adjustment";
  event_date: string | null;
  original_order_date: string | null;
  event_amount: number;
  original_order_amount: number | null;
  fixed_fee_amount: number;
  variable_fee_amount: number;
  variable_fee_rate: number | null;
  fees_before_vat: number;
  fees_vat_amount: number;
  net_amount: number | null;
  provider_order_status: string | null;
  payment_type: string | null;
  refund_reason: string | null;
  currency: string | null;
  reasons: string[];
  needs_review: boolean;
  raw: Record<string, any>;
};

function parseNum(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && isFinite(v)) return round2(v);
  const s = String(v).replace(/[^\d.\-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return isFinite(n) ? round2(n) : null;
}
function normalizeOrderId(v: any): string | null {
  if (v == null) return null;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/\s+/g, "");
  // strip trailing .0 from Excel numeric coercion
  s = s.replace(/\.0+$/, "");
  // scientific notation guard
  if (/e\+?\d+$/i.test(s)) {
    const n = Number(s);
    if (isFinite(n)) s = Math.round(n).toString();
  }
  return s || null;
}

export function buildTamaraRows(aoa: any[][], headerRow: number, mapping: TamaraMapping): TamaraParsedLine[] {
  const headers = aoa[headerRow] ?? [];
  const body = aoa.slice(headerRow + 1).filter((r) => r.some((c) => c != null && String(c).trim() !== ""));
  const get = (raw: any[], k: TamaraFieldKey) => (mapping[k] != null ? raw[mapping[k]!] : null);

  return body.map((raw, idx) => {
    const eventRaw = String(get(raw, "event_type_raw") ?? "").trim();
    const evNorm = eventRaw.toLowerCase();
    const merchantNumber = normalizeOrderId(get(raw, "merchant_order_number"));
    const merchantId = normalizeOrderId(get(raw, "merchant_order_id"));
    const external_order_id = merchantNumber ?? merchantId ?? null;
    const external_order_id_source = merchantNumber
      ? "merchant_order_number"
      : merchantId
        ? "merchant_order_id"
        : null;

    const eventAmount = parseNum(get(raw, "event_amount")) ?? 0;
    const fixedFee = parseNum(get(raw, "fixed_fee_amount")) ?? 0;
    const varFee = parseNum(get(raw, "variable_fee_amount")) ?? 0;
    const varRate = parseNum(get(raw, "variable_fee_rate"));
    const totalFees = parseNum(get(raw, "fees_before_vat"));
    const vatFees = parseNum(get(raw, "fees_vat_amount")) ?? 0;
    const netAmount = parseNum(get(raw, "net_amount"));
    const orderAmount = parseNum(get(raw, "original_order_amount"));

    const reasons: string[] = [];
    let event_type: TamaraEventType;
    let line_type: TamaraParsedLine["line_type"];
    if (evNorm === "captured") { event_type = "sale"; line_type = "sale"; }
    else if (evNorm === "refunded") {
      event_type = "refund";
      line_type = "refund";
      // ensure negative retained
    } else {
      event_type = "needs_review_event";
      line_type = "manual_adjustment";
      if (eventRaw) reasons.push(`unhandled_event:${eventRaw}`);
      else reasons.push("missing_event");
    }

    // Total fees consistency check (only for events with fees)
    let feesFinal: number;
    if (totalFees != null) {
      feesFinal = totalFees;
      const sum = round2(fixedFee + varFee);
      if (Math.abs(sum - totalFees) > 0.02 && (fixedFee !== 0 || varFee !== 0)) {
        reasons.push("fees_breakdown_mismatch");
      }
    } else {
      feesFinal = round2(fixedFee + varFee);
    }

    // Net check: for sale, Event - Total Fees - VAT ≈ net
    if (netAmount != null && event_type !== "needs_review_event") {
      const calc = event_type === "sale"
        ? round2(eventAmount - feesFinal - vatFees)
        : round2(eventAmount); // refund: net ≈ event (usually 0 fees)
      if (Math.abs(calc - netAmount) > 0.02) reasons.push("net_amount_mismatch");
    }

    const rawObj: Record<string, any> = {};
    headers.forEach((h: any, i: number) => { rawObj[String(h ?? `col_${i}`)] = raw[i] ?? null; });

    return {
      rowNo: idx + 1,
      external_order_id,
      external_order_id_source,
      provider_order_id: (String(get(raw, "provider_order_id") ?? "").trim() || null),
      provider_event_id: (String(get(raw, "provider_event_id") ?? "").trim() || null),
      provider_refund_id: (String(get(raw, "provider_refund_id") ?? "").trim() || null),
      event_type_raw: eventRaw || null,
      event_type,
      line_type,
      event_date: parseDateCell(get(raw, "event_date")),
      original_order_date: parseDateCell(get(raw, "original_order_date")),
      event_amount: eventAmount,
      original_order_amount: orderAmount,
      fixed_fee_amount: fixedFee,
      variable_fee_amount: varFee,
      variable_fee_rate: varRate,
      fees_before_vat: feesFinal,
      fees_vat_amount: vatFees,
      net_amount: netAmount,
      provider_order_status: (String(get(raw, "provider_order_status") ?? "").trim() || null),
      payment_type: (String(get(raw, "payment_type") ?? "").trim() || null),
      refund_reason: (String(get(raw, "refund_reason") ?? "").trim() || null),
      currency: (String(get(raw, "currency") ?? "").trim() || null),
      reasons,
      needs_review: reasons.length > 0 || event_type === "needs_review_event",
      raw: rawObj,
    };
  });
}
