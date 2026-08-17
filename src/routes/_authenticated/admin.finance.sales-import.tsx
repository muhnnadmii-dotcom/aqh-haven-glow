import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, Save, RotateCcw, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/sales-import")({
  ssr: false,
  component: SalesImportPage,
});

type ProviderKey =
  | "" | "salla_payments" | "tabby" | "tamara" | "bank_transfer"
  | "personal_account" | "business_account" | "cash" | "unknown" | "other";

const PROVIDERS: { value: ProviderKey; label: string }[] = [
  { value: "", label: "— غير محدد —" },
  { value: "salla_payments", label: "سلة للمدفوعات" },
  { value: "tabby", label: "تابي" },
  { value: "tamara", label: "تمارا" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "unknown", label: "غير معروف" },
];

// طرق الدفع من ملف سلة → وسيط الدفع
const PROVIDER_HINTS: [RegExp, ProviderKey][] = [
  [/tamara|تمارا/i, "tamara"],
  [/tabby|تابي/i, "tabby"],
  [/bank|حوالة|iban|swift|تحويل/i, "bank_transfer"],
  [/mada|مدى|apple ?pay|visa|master|credit|debit|stcpay|stc ?pay|checkout|بطاقة|سلة|salla/i, "salla_payments"],
];

function detectProvider(text: string | null | undefined): ProviderKey {
  const s = (text ?? "").toString().trim();
  if (!s || s === "\\N" || s.toUpperCase() === "N/A") return "unknown";
  for (const [rx, k] of PROVIDER_HINTS) if (rx.test(s)) return k;
  return "unknown";
}

// حقول الاستيراد (ترجم إلى الأعمدة الافتراضية في تصدير سلة)
const FIELDS = [
  { key: "external_order_id", label: "رقم الطلب", required: true, aliases: ["رقم الطلب", "order id", "order_id", "order number", "رقم طلب", "الطلب"] },
  { key: "customer_name", label: "اسم العميل", required: false, aliases: ["اسم العميل", "customer", "customer name", "العميل", "الاسم"] },
  { key: "external_invoice_number", label: "رقم الفاتورة", required: false, aliases: ["رقم الفاتورة", "invoice number", "invoice_no", "فاتورة"] },
  { key: "order_date", label: "تاريخ الطلب", required: true, aliases: ["تاريخ الطلب", "order date", "date", "التاريخ", "تاريخ"] },
  { key: "order_status", label: "حالة الطلب", required: false, aliases: ["حالة الطلب", "status", "order status", "الحالة"] },
  { key: "payment_method", label: "طريقة الدفع", required: false, aliases: ["طريقة الدفع", "payment method", "payment", "الدفع"] },
  { key: "original_gross_amount", label: "إجمالي الطلب (شامل الضريبة)", required: true, aliases: ["إجمالي الطلب", "المبلغ الأصلي", "total", "gross", "amount", "الإجمالي", "قيمة الطلب", "المبلغ"] },
  { key: "total_vat_amount", label: "الضريبة (إجمالي)", required: false, aliases: ["الضريبة", "إجمالي الضريبة", "vat", "tax", "ضريبة"] },
  { key: "shipping_before_vat", label: "تكلفة الشحن (قبل الضريبة)", required: false, aliases: ["تكلفة الشحن", "الشحن", "shipping", "shipping cost", "شحن", "الشحن قبل الضريبة"] },
  { key: "discount_coupon", label: "خصم الكوبون", required: false, aliases: ["قيمة خصم الكوبون", "خصم الكوبون", "coupon", "كوبون"] },
  { key: "discount_offers", label: "خصم العروض الخاصة", required: false, aliases: ["قيمة خصم العروض الخاصة", "خصم العروض", "offers discount"] },
  { key: "discount_abandoned", label: "خصم السلة المتروكة", required: false, aliases: ["قيمة عرض السلة المتروكة", "السلة المتروكة", "abandoned cart"] },
  // حقول مصدر معلوماتية فقط — لا تؤثر على المبالغ أو الضريبة أو حالة الدفع
  { key: "discount_code", label: "رمز الكوبون", required: false, aliases: ["رمز الكوبون", "كود الخصم", "رمز الخصم", "coupon code", "discount code"] },
  { key: "payment_references", label: "رقم مرجع عملية الدفع", required: false, aliases: ["رقم مرجع عملية الدفع", "مرجع عملية الدفع", "مرجع الدفع", "payment reference", "transaction reference"] },
  { key: "source_updated_at", label: "تاريخ آخر تحديث للطلب", required: false, aliases: ["تاريخ آخر تحديث للطلب", "تاريخ التحديث", "آخر تحديث", "updated at", "last updated"] },
  { key: "external_order_reference", label: "رقم مرجع الطلب", required: false, aliases: ["رقم مرجع الطلب", "مرجع الطلب", "order reference", "reference id"] },
  { key: "source_products_raw", label: "أسماء المنتجات مع SKU", required: false, aliases: ["اسماء المنتجات مع SKU", "أسماء المنتجات مع SKU", "المنتجات", "products", "product names"] },
  { key: "customer_phone_snapshot", label: "رقم الجوال", required: false, aliases: ["رقم الجوال", "الجوال", "جوال العميل", "phone", "mobile"] },
] as const;


type FieldKey = typeof FIELDS[number]["key"];

const normStr = (s: any) => (s == null ? "" : String(s)).trim().toLowerCase();
const isBlank = (v: any) => {
  if (v == null) return true;
  const s = String(v).trim();
  return s === "" || s === "\\N" || s.toUpperCase() === "N/A";
};

function autoMatch(headers: any[], aliases: readonly string[]): number {
  const hs = headers.map(normStr);
  for (const a of aliases) {
    const i = hs.findIndex((h) => h === normStr(a));
    if (i >= 0) return i;
  }
  for (const a of aliases) {
    const i = hs.findIndex((h) => h && h.includes(normStr(a)));
    if (i >= 0) return i;
  }
  return -1;
}

function detectHeaderRow(aoa: any[][]): number {
  const pool = FIELDS.flatMap((f) => f.aliases);
  const maxScan = Math.min(aoa.length, 30);
  let best = 0, bestScore = 0;
  for (let i = 0; i < maxScan; i++) {
    const row = aoa[i] ?? [];
    let score = 0;
    for (const a of pool) {
      const na = normStr(a);
      if (row.some((c) => normStr(c) === na || (normStr(c) && normStr(c).includes(na)))) score++;
    }
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return bestScore >= 2 ? best : 0;
}

function parseDate(v: any): string | null {
  if (isBlank(v)) return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
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
  return isNaN(t.getTime()) ? null : `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

// timestamptz معلوماتي (تاريخ آخر تحديث للطلب) — يُخزَّن كنص ISO أو null
function parseTimestamp(v: any): string | null {
  if (isBlank(v)) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const t = Date.UTC(d.y, (d.m || 1) - 1, d.d || 1, d.H || 0, d.M || 0, Math.floor(d.S || 0));
    return new Date(t).toISOString();
  }
  const s = String(v).trim();
  const t = new Date(s.replace(" ", "T"));
  if (!isNaN(t.getTime())) return t.toISOString();
  const d = parseDate(s);
  return d ? new Date(`${d}T00:00:00Z`).toISOString() : null;
}

// مراجع الدفع: تُحفظ كما هي (كائنات {provider,reference,amount}) — معلوماتية فقط
type PaymentRef = Record<string, any>;
function toRefObject(x: any): PaymentRef | null {
  if (x == null) return null;
  if (typeof x === "object") return x as PaymentRef;
  const s = String(x).trim();
  if (!s) return null;
  if (s.startsWith("{")) {
    try {
      const j = JSON.parse(s);
      if (j && typeof j === "object" && !Array.isArray(j)) return j as PaymentRef;
    } catch { /* fall through */ }
  }
  return { reference: s };
}

function parsePaymentRefs(v: any): PaymentRef[] {
  if (isBlank(v)) return [];
  if (Array.isArray(v)) return v.map(toRefObject).filter(Boolean) as PaymentRef[];
  const s = String(v).trim();
  if (s.startsWith("[") || s.startsWith("{")) {
    try {
      const j = JSON.parse(s);
      if (Array.isArray(j)) return j.map(toRefObject).filter(Boolean) as PaymentRef[];
      if (j && typeof j === "object") return [j as PaymentRef];
    } catch { /* fall through to plain split */ }
  }
  return s.split(/[,،;|\n]+/).map((x) => toRefObject(x)).filter(Boolean) as PaymentRef[];
}



// دقيق مالي (خانتان عشريتان)
const round2 = (n: number) => Math.round(n * 100) / 100;

function parseAmount(v: any): number | null {
  if (isBlank(v)) return null;
  if (typeof v === "number" && isFinite(v)) return round2(v);
  const s = String(v).replace(/[^\d\.\-,]/g, "").replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return isFinite(n) ? round2(n) : null;
}
const amount0 = (v: any) => parseAmount(v) ?? 0;

// Includes deleted/removed variants so Salla "محذوف" orders are treated as cancelled.
const CANCELLED_RX = /cancel|ملغى|ملغي|ملغاة|إلغاء|الغاء|deleted|removed|محذوف|حذف/i;
const isCancelled = (s: string | null) => !!s && CANCELLED_RX.test(s);

// Server-side actions returned by salla_classify_row / salla_import_preview
type Classification =
  | "new"
  | "new_missing_invoice_number"
  | "update_existing_draft"
  | "metadata_only_update"
  | "unchanged"
  | "conflict_existing_final"
  | "cancelled_new"
  | "cancel_draft"
  | "needs_credit_note"
  | "blocked";

const ALL_CLASSIFICATIONS: Classification[] = [
  "new", "new_missing_invoice_number", "update_existing_draft", "metadata_only_update", "unchanged",
  "conflict_existing_final", "cancelled_new", "cancel_draft", "needs_credit_note", "blocked",
];

const CLASSIFICATION_LABEL: Record<Classification, string> = {
  new: "جديد — مكتمل",
  new_missing_invoice_number: "جديد — بلا رقم فاتورة (مسودة)",
  update_existing_draft: "تحديث مسودة موجودة",
  metadata_only_update: "تحديث بيانات مصدر فقط",
  unchanged: "لا تغيير",
  conflict_existing_final: "تعارض مع فاتورة نهائية",
  cancelled_new: "طلب ملغي (سجل فقط)",
  cancel_draft: "إلغاء مسودة",
  needs_credit_note: "ملغي بعد الاعتماد — إشعار دائن",
  blocked: "خطأ يمنع الاستيراد",
};

const CLASSIFICATION_CLASS: Record<Classification, string> = {
  new: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  new_missing_invoice_number: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  update_existing_draft: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  metadata_only_update: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  unchanged: "bg-white/10 text-muted-foreground border-white/20",
  conflict_existing_final: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  cancelled_new: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  cancel_draft: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  needs_credit_note: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  blocked: "bg-red-500/15 text-red-300 border-red-500/30",
};


type DataIssue =
  | "missing_invoice_number"
  | "missing_payment_method"
  | "cancelled_order"
  | "duplicate_order"
  | "zero_total"
  | "invalid_amount"
  | "missing_order_id"
  | "invalid_date"
  | "conflicting_existing_order";

const ISSUE_LABEL: Record<DataIssue, string> = {
  missing_invoice_number: "رقم الفاتورة مفقود",
  missing_payment_method: "طريقة الدفع مفقودة",
  cancelled_order: "طلب ملغي",
  duplicate_order: "مكرر",
  zero_total: "إجمالي = 0",
  invalid_amount: "قيمة غير صالحة",
  missing_order_id: "رقم الطلب مفقود",
  invalid_date: "تاريخ غير صالح",
  conflicting_existing_order: "تعارض مع طلب موجود",
};

type PaymentStatus = "unpaid" | "unknown";

type Mapping = Partial<Record<FieldKey, number>>;
type ParsedRow = {
  rowNo: number;
  external_order_id: string | null;
  external_invoice_number: string | null;
  order_date: string | null;
  customer_name: string | null;
  payment_method_raw: string | null;
  payment_provider: ProviderKey;
  order_status: string | null;
  payment_status: PaymentStatus;
  payment_status_source: "evidence_required";
  original_gross_amount: number | null;
  total_vat_amount: number;
  shipping_before_vat: number;
  shipping_vat: number;
  product_vat: number;
  total_before_vat: number;
  product_before_vat: number;
  total_discount: number;
  // حقول مصدر معلوماتية فقط
  discount_code: string | null;
  payment_references: PaymentRef[];
  source_updated_at: string | null;
  external_order_reference: string | null;
  source_products_raw: string | null;
  customer_phone_snapshot: string | null;
  cancelled: boolean;
  duplicate: boolean;
  issues: DataIssue[];
  classification: Classification;
  action_reason: string | null;
  existing_status: string | null;
  tax_document_status: "present" | "missing";
  vat_return_eligible: boolean;
};

const SELECTABLE_ACTIONS: Classification[] = [
  "new", "new_missing_invoice_number", "update_existing_draft", "metadata_only_update",
  "cancelled_new", "cancel_draft", "needs_credit_note", "conflict_existing_final",
];

// حجم الدفعة الواحدة لكل استدعاء/transaction — يمنع statement timeout على الملفات الكبيرة
const CHUNK_SIZE = 200;

type ChunkState = {
  index: number;
  rowNos: number[];
  status: "pending" | "running" | "done" | "failed";
  error?: string;
  result?: Record<string, number>;
};

function countBuckets(rows: ParsedRow[]) {
  const acc = Object.fromEntries(ALL_CLASSIFICATIONS.map((k) => [k, 0])) as Record<Classification, number>;
  rows.forEach((r) => { acc[r.classification]++; });
  return acc;
}




function SalesImportPage() {
  const { canManage, canAccountant } = useFinanceRoles();
  const canWrite = canManage || canAccountant;

  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheet, setSheet] = useState<string>("");
  const [aoa, setAoa] = useState<any[][]>([]);
  const [headerRow, setHeaderRow] = useState<number>(0);
  const [headers, setHeaders] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showOnlyReview, setShowOnlyReview] = useState(false);
  const [savedMappings, setSavedMappings] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [committing, setCommitting] = useState(false);
  const [chunks, setChunks] = useState<ChunkState[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("sales_import_mappings")
        .select("*")
        .eq("sales_channel", "salla")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      setSavedMappings(data || []);
    })();
  }, []);

  async function onFile(f: File) {
    setFile(f);
    const buf = await f.arrayBuffer();
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
    const hr = detectHeaderRow(arr);
    setHeaderRow(hr);
    const hs = arr[hr] ?? [];
    setHeaders(hs);
    const m: Mapping = {};
    for (const f of FIELDS) {
      const idx = autoMatch(hs, f.aliases);
      if (idx >= 0) m[f.key] = idx;
    }
    setMapping(m);
    setRows([]);
    setSelected(new Set());
  }

  async function reparseSheet() {
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    loadSheet(wb, sheet);
  }
  useEffect(() => { if (file && sheet) reparseSheet(); /* eslint-disable-line */ }, [sheet]);

  useEffect(() => {
    if (!aoa.length) return;
    const hs = aoa[headerRow] ?? [];
    setHeaders(hs);
  }, [headerRow, aoa]);

  async function buildPreview() {
    if (!aoa.length) { toast.error("لم يتم تحميل ملف"); return; }
    const required = FIELDS.filter((f) => f.required);
    const missing = required.filter((f) => mapping[f.key] == null || mapping[f.key] === -1);
    if (missing.length) { toast.error(`أعمدة مطلوبة غير مرتبطة: ${missing.map((m) => m.label).join("، ")}`); return; }

    const body = aoa.slice(headerRow + 1).filter((r) => r.some((c) => c != null && c !== ""));
    const parsed: ParsedRow[] = body.map((raw, idx) => {
      const get = (k: FieldKey) => (mapping[k] != null ? raw[mapping[k]!] : null);
      const orderId = String(get("external_order_id") ?? "").trim() || null;
      const dateStr = parseDate(get("order_date"));
      const invoiceRaw = get("external_invoice_number");
      const invoiceNumber = isBlank(invoiceRaw) ? null : String(invoiceRaw).trim();
      const orderStatus = isBlank(get("order_status")) ? null : String(get("order_status")).trim();
      const paymentMethodRaw = isBlank(get("payment_method")) ? null : String(get("payment_method")).trim();

      const gross = parseAmount(get("original_gross_amount"));
      const totalVat = amount0(get("total_vat_amount"));
      const shipBefore = amount0(get("shipping_before_vat"));

      // ضريبة الشحن محسوبة، ولا تتجاوز إجمالي ضريبة الطلب
      const shippingVatRaw = round2(shipBefore * 0.15);
      const shippingVat = round2(Math.min(totalVat, shippingVatRaw));
      const productVat = round2(Math.max(totalVat - shippingVat, 0));
      const totalBeforeVat = gross != null ? round2(gross - totalVat) : 0;
      const productBeforeVat = gross != null ? round2(Math.max(totalBeforeVat - shipBefore, 0)) : 0;

      const totalDiscount = round2(
        amount0(get("discount_coupon")) +
        amount0(get("discount_offers")) +
        amount0(get("discount_abandoned"))
      );

      const cancelled = isCancelled(orderStatus);
      const provider = detectProvider(paymentMethodRaw);

      // تجميع القضايا (issues) بدون تصنيف نهائي حتى نطبق المكررات
      const issues: DataIssue[] = [];
      if (!orderId) issues.push("missing_order_id");
      if (!dateStr) issues.push("invalid_date");
      if (gross == null) issues.push("invalid_amount");
      if (gross != null && gross < 0 && !cancelled) issues.push("invalid_amount");
      if (cancelled) issues.push("cancelled_order");
      if (gross != null && gross === 0) issues.push("zero_total");
      if (!paymentMethodRaw) issues.push("missing_payment_method");
      if (!invoiceNumber) issues.push("missing_invoice_number");

      // حالة الدفع لا تُستنتج من طريقة الدفع — تُحدَّد لاحقًا من دليل السداد الفعلي
      const paymentStatus: PaymentStatus = "unknown";

      return {
        rowNo: headerRow + 2 + idx,
        external_order_id: orderId,
        external_invoice_number: invoiceNumber,
        order_date: dateStr,
        customer_name: isBlank(get("customer_name")) ? null : String(get("customer_name")).trim(),
        payment_method_raw: paymentMethodRaw,
        payment_provider: provider,
        order_status: orderStatus,
        payment_status: paymentStatus,
        payment_status_source: "evidence_required" as const,
        original_gross_amount: gross,
        total_vat_amount: totalVat,
        shipping_before_vat: shipBefore,
        shipping_vat: shippingVat,
        product_vat: productVat,
        total_before_vat: totalBeforeVat,
        product_before_vat: productBeforeVat,
        total_discount: totalDiscount,
        // حقول مصدر معلوماتية فقط — لا تغيّر المبالغ أو الضريبة أو حالة الدفع
        discount_code: isBlank(get("discount_code")) ? null : String(get("discount_code")).trim(),
        payment_references: parsePaymentRefs(get("payment_references")),
        source_updated_at: parseTimestamp(get("source_updated_at")),
        external_order_reference: isBlank(get("external_order_reference")) ? null : String(get("external_order_reference")).trim(),
        source_products_raw: isBlank(get("source_products_raw")) ? null : String(get("source_products_raw")).trim(),
        customer_phone_snapshot: isBlank(get("customer_phone_snapshot")) ? null : String(get("customer_phone_snapshot")).trim(),
        cancelled,
        duplicate: false,
        issues,
        classification: "new" as Classification, // مبدئي — يُحدَّد من الخادم أدناه
        action_reason: null as string | null,
        existing_status: null as string | null,
        tax_document_status: invoiceNumber ? "present" : "missing" as const,
        vat_return_eligible: !!invoiceNumber && !cancelled,
      };
    });

    // تكرار داخل الملف (آخر صف يفوز، والصفوف السابقة تُستبعد من التحديد)
    const seen = new Map<string, number>();
    parsed.forEach((r) => {
      if (!r.external_order_id) return;
      const prev = seen.get(r.external_order_id);
      if (prev != null) {
        r.duplicate = true;
        if (!r.issues.includes("duplicate_order")) r.issues.push("duplicate_order");
      } else {
        seen.set(r.external_order_id, r.rowNo);
      }
    });

    // التصنيف مصدره الخادم (نفس منطق الـ commit)
    const { data: preview, error: pErr } = await (supabase as any).rpc("salla_import_preview", {
      p_rows: parsed as any,
    });
    if (pErr) { toast.error(`تعذّر تحضير المعاينة: ${pErr.message}`); return; }
    // The RPC returns one merged object per row: { rowNo, external_order_id, action, reason, ... }.
    // Only accept entries that actually carry an action; anything else is a protocol problem
    // and must be surfaced instead of silently marking every row as "blocked".
    const byRow = new Map<number, any>();
    (Array.isArray(preview) ? preview : []).forEach((p: any) => {
      if (p && p.action != null && p.rowNo != null) byRow.set(Number(p.rowNo), p);
    });
    if (parsed.length && byRow.size === 0) {
      toast.error("تعذّر قراءة نتيجة التصنيف من الخادم — لم يتم تصنيف أي صف. لم تُحفظ أي بيانات.");
      return;
    }
    parsed.forEach((r) => {
      const p = byRow.get(r.rowNo);
      if (!p) {
        r.classification = "blocked";
        r.action_reason = "لم يصل تصنيف من الخادم لهذا الصف";
        return;
      }
      r.classification = p.action as Classification;
      r.action_reason = p.reason ?? null;
      r.existing_status = p.existing_status ?? null;
      if (r.classification === "conflict_existing_final" && !r.issues.includes("conflicting_existing_order")) {
        r.issues.push("conflicting_existing_order");
      }
    });

    setRows(parsed);
    const auto = new Set<number>();
    parsed.forEach((r) => {
      if (SELECTABLE_ACTIONS.includes(r.classification)) auto.add(r.rowNo);
    });
    setSelected(auto);

    const b = countBuckets(parsed);
    toast.success(
      `تم تحضير ${parsed.length} صف — جديد: ${b.new + b.new_missing_invoice_number}، تحديث مسودات: ${b.update_existing_draft}، لا تغيير: ${b.unchanged}، تعارض: ${b.conflict_existing_final}، ملغي: ${b.cancelled_new + b.cancel_draft + b.needs_credit_note}، أخطاء: ${b.blocked}`
    );
  }



  const buckets = useMemo(() => countBuckets(rows), [rows]);
  const issueCounts = useMemo(() => {
    const acc: Record<DataIssue, number> = {
      missing_invoice_number: 0, missing_payment_method: 0, cancelled_order: 0,
      duplicate_order: 0, zero_total: 0, invalid_amount: 0,
      missing_order_id: 0, invalid_date: 0, conflicting_existing_order: 0,
    };
    rows.forEach((r) => r.issues.forEach((k) => { acc[k] = (acc[k] ?? 0) + 1; }));
    return acc;
  }, [rows]);

  const canImportRow = (r: ParsedRow) => SELECTABLE_ACTIONS.includes(r.classification);

  const stats = useMemo(() => {
    const total = rows.length;
    const importable = rows.filter(canImportRow).length;
    const selectedImportable = rows.filter((r) => selected.has(r.rowNo) && canImportRow(r)).length;
    return { total, importable, selectedImportable };
  }, [rows, selected]);

  function toggleRow(rowNo: number, canSelect: boolean) {
    if (!canSelect) return;
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(rowNo)) n.delete(rowNo); else n.add(rowNo);
      return n;
    });
  }
  function selectAllImportable() {
    const n = new Set<number>();
    rows.forEach((r) => { if (canImportRow(r)) n.add(r.rowNo); });
    setSelected(n);
  }
  function clearSelection() { setSelected(new Set()); }

  // تنفيذ دفعة واحدة (≤ CHUNK_SIZE صف) داخل transaction واحدة على الخادم
  async function runChunk(chunkRows: ParsedRow[], batchId: string | null) {
    const payload = chunkRows.map((r) => ({ ...r, selected: true }));
    const { data, error } = await (supabase as any).rpc("salla_import_commit", {
      p_batch: {
        file_name: file?.name ?? "salla-import",
        sheet_name: sheet || null,
        mapping,
        header_row: headerRow,
        batch_id: batchId,
      },
      p_rows: payload as any,
    });
    if (error) throw error;
    return (data ?? {}) as Record<string, any>;
  }

  async function runChunks(list: ChunkState[], startBatchId: string | null) {
    let batchId = startBatchId;
    setCommitting(true);
    try {
      for (const ch of list) {
        setChunks((prev) => prev.map((c) => (c.index === ch.index ? { ...c, status: "running", error: undefined } : c)));
        const chunkRows = rows.filter((r) => ch.rowNos.includes(r.rowNo));
        try {
          const res = await runChunk(chunkRows, batchId);
          if (!batchId && res.batch_id) { batchId = String(res.batch_id); setBatchId(batchId); }
          setChunks((prev) => prev.map((c) => (c.index === ch.index ? { ...c, status: "done", result: res as any } : c)));
        } catch (e: any) {
          setChunks((prev) => prev.map((c) => (c.index === ch.index ? { ...c, status: "failed", error: e?.message ?? String(e) } : c)));
        }
      }
    } finally {
      setCommitting(false);
    }
  }

  async function commit() {
    if (!rows.length) return;
    if (!canWrite) { toast.error("لا تملك صلاحية الاستيراد"); return; }
    // لا تُرسل الصفوف غير القابلة للإجراء (no_change / blocked)
    const importable = rows.filter((r) => selected.has(r.rowNo) && canImportRow(r));
    if (!importable.length) { toast.error("لا توجد صفوف قابلة للتنفيذ ضمن التحديد"); return; }

    const b = countBuckets(importable);
    const nChunks = Math.ceil(importable.length / CHUNK_SIZE);
    const ok = window.confirm(
      `سيتم اعتماد ${importable.length} صف على ${nChunks} دفعة (حد أقصى ${CHUNK_SIZE} صف لكل دفعة):\n` +
      `• فواتير جديدة مكتملة (ستُعتمد): ${b.new}\n` +
      `• جديدة بلا رقم فاتورة (تبقى مسودة): ${b.new_missing_invoice_number}\n` +
      `• تحديث مسودات موجودة: ${b.update_existing_draft}\n` +
      `• تحديث بيانات مصدر فقط (فواتير نهائية): ${b.metadata_only_update}\n` +
      `• تعارض مع فواتير نهائية (مراجعة + بيانات مصدر فقط): ${b.conflict_existing_final}\n` +
      `• ملغي: ${b.cancelled_new + b.cancel_draft}، إشعار دائن مطلوب: ${b.needs_credit_note}\n\n` +
      `تحديث بيانات المصدر لا يمس المبالغ أو الضريبة أو أرقام الفواتير أو حالة الدفع أو القيود.\n\nمتابعة؟`
    );
    if (!ok) return;

    const list: ChunkState[] = [];
    for (let i = 0; i < importable.length; i += CHUNK_SIZE) {
      list.push({
        index: list.length,
        rowNos: importable.slice(i, i + CHUNK_SIZE).map((r) => r.rowNo),
        status: "pending",
      });
    }
    setChunks(list);
    setBatchId(null);
    await runChunks(list, null);
  }

  async function retryFailedChunks() {
    const failed = chunks.filter((c) => c.status === "failed");
    if (!failed.length) return;
    await runChunks(failed, batchId);
  }

  const chunkTotals = useMemo(() => {
    const acc = {
      metadata_updated: 0, updated_drafts: 0, new: 0, cancelled: 0,
      needs_credit_note: 0, conflicts: 0, needs_review: 0,
      unchanged: 0, blocked: 0, failed: 0, approved: 0,
    };
    chunks.forEach((c) => {
      if (c.status === "failed") { acc.failed += c.rowNos.length; return; }
      const r = c.result as any;
      if (!r) return;
      acc.metadata_updated += Number(r.metadata_updated ?? 0);
      acc.updated_drafts += Number(r.updated_drafts ?? 0);
      acc.new += Number(r.new ?? 0);
      acc.cancelled += Number(r.cancelled ?? 0);
      acc.needs_credit_note += Number(r.needs_credit_note ?? 0);
      acc.conflicts += Number(r.conflicts ?? 0);
      acc.needs_review += Number(r.needs_review ?? 0);
      acc.unchanged += Number(r.unchanged ?? 0);
      acc.blocked += Number(r.blocked ?? 0);
      acc.approved += Number(r.approved ?? 0);
    });
    return acc;
  }, [chunks]);





  async function saveTemplate() {
    const name = templateName.trim();
    if (!name) { toast.error("أدخل اسم القالب"); return; }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("sales_import_mappings").upsert({
      name,
      sales_channel: "salla",
      mapping,
      created_by: u.user?.id ?? null,
    }, { onConflict: "sales_channel,name" });
    if (error) return toast.error(error.message);
    toast.success("تم حفظ قالب الربط");
    setTemplateName("");
    const { data } = await (supabase as any).from("sales_import_mappings")
      .select("*").eq("sales_channel", "salla").order("created_at", { ascending: false });
    setSavedMappings(data || []);
  }
  function applyTemplate(id: string) {
    const t = savedMappings.find((x) => x.id === id);
    if (!t) return;
    setMapping(t.mapping || {});
    toast.success(`تم تطبيق قالب: ${t.name}`);
  }

  const [reviewFilter, setReviewFilter] = useState<Classification | "all">("all");
  const visibleRows = useMemo(
    () => reviewFilter === "all" ? rows : rows.filter((r) => r.classification === reviewFilter),
    [rows, reviewFilter]
  );


  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileSpreadsheet className="text-gold" size={18} />
          <h2 className="text-sm font-semibold">استيراد مبيعات سلة (Excel / CSV)</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[12px] cursor-pointer hover:bg-gold/25">
            <Upload size={14} />
            <span>اختر ملف</span>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files && e.target.files[0] && onFile(e.target.files[0])}
            />
          </label>
          {file && <span className="text-[12px] text-muted-foreground">{file.name}</span>}
          {sheets.length > 1 && (
            <select className="inp text-[12px]" value={sheet} onChange={(e) => setSheet(e.target.value)}>
              {sheets.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {aoa.length > 0 && (
            <label className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
              <span>صف العناوين:</span>
              <input type="number" min={0} max={Math.max(0, aoa.length - 1)} value={headerRow}
                onChange={(e) => setHeaderRow(Math.max(0, Math.min(aoa.length - 1, Number(e.target.value) || 0)))}
                className="inp w-16" />
            </label>
          )}
          {aoa.length > 0 && (
            <button onClick={buildPreview} className="ml-auto px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[12px] hover:bg-white/15">
              معاينة الصفوف
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          قناة البيع = سلة. حالة الدفع تُستنتج من بيانات الطلب ولا تُشتق من حالة الطلب. ضريبة الشحن تُحسب من الشحن قبل الضريبة ولا تُضاف على إجمالي الضريبة.
        </p>
      </div>

      {aoa.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-semibold mb-3">ربط أعمدة الملف بالحقول</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-2 text-[12px]">
                <div className="w-56 shrink-0">
                  <span>{f.label}</span>
                  {f.required && <span className="text-red-400 mr-1">*</span>}
                </div>
                <select
                  className="inp flex-1"
                  value={mapping[f.key] ?? -1}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setMapping({ ...mapping, [f.key]: v === -1 ? undefined : v } as Mapping);
                  }}
                >
                  <option value={-1}>— بدون —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{String(h ?? `عمود ${i + 1}`)}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input className="inp text-[12px] w-56" placeholder="اسم القالب لحفظه"
              value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            <button onClick={saveTemplate} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[12px] hover:bg-white/15 inline-flex items-center gap-1.5">
              <Save size={14} /> حفظ القالب
            </button>
            {savedMappings.length > 0 && (
              <select className="inp text-[12px]" defaultValue="" onChange={(e) => e.target.value && applyTemplate(e.target.value)}>
                <option value="">— تطبيق قالب محفوظ —</option>
                {savedMappings.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h3 className="text-sm font-semibold">معاينة ({rows.length} صف)</h3>
            <div className="flex items-center gap-1 text-[11px] flex-wrap">
              {ALL_CLASSIFICATIONS.map((k) => (
                <BucketChip key={k} active={reviewFilter} k={k} n={buckets[k]} onClick={setReviewFilter} />
              ))}

              {reviewFilter !== "all" && (
                <button onClick={() => setReviewFilter("all")} className="px-2 py-0.5 rounded border border-white/15 text-muted-foreground">عرض الكل</button>
              )}
              <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300">محدد: {stats.selectedImportable}</span>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button onClick={selectAllImportable} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[12px]">
                تحديد كل الصالح للاستيراد
              </button>
              <button onClick={clearSelection} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[12px]">
                مسح التحديد
              </button>
              <button
                onClick={commit}
                disabled={committing || !canWrite || stats.selectedImportable === 0}
                className="px-4 py-2 rounded-lg bg-gold text-black text-[12px] font-semibold hover:bg-gold/90 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {committing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                اعتماد المحدد ({stats.selectedImportable})
              </button>
              <button onClick={() => { setRows([]); setSelected(new Set()); setChunks([]); setBatchId(null); }} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[12px] inline-flex items-center gap-1.5">
                <RotateCcw size={14} /> إلغاء
              </button>
            </div>
          </div>

          {chunks.length > 0 && (
            <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-[11px] space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[12px]">
                  تقدّم الاعتماد: {chunks.filter((c) => c.status === "done").length} / {chunks.length} دفعة
                </span>
                {chunks.some((c) => c.status === "failed") && (
                  <button
                    onClick={retryFailedChunks}
                    disabled={committing}
                    className="px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    <RotateCcw size={12} /> إعادة محاولة الدفعات الفاشلة ({chunks.filter((c) => c.status === "failed").length})
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {chunks.map((c) => (
                  <span
                    key={c.index}
                    title={c.error ?? ""}
                    className={
                      "px-2 py-0.5 rounded border " +
                      (c.status === "done" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : c.status === "failed" ? "bg-red-500/15 text-red-300 border-red-500/30"
                        : c.status === "running" ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                        : "bg-white/5 text-muted-foreground border-white/15")
                    }
                  >
                    دفعة {c.index + 1} ({c.rowNos.length})
                    {c.status === "failed" ? " — فشلت" : c.status === "running" ? " — جارٍ" : c.status === "done" ? " — تمت" : ""}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-1 border-t border-white/10">
                <span className="text-muted-foreground">الإجمالي:</span>
                <span>تحديث بيانات مصدر: <b>{chunkTotals.metadata_updated}</b></span>
                <span>تحديث مسودات: <b>{chunkTotals.updated_drafts}</b></span>
                <span>جديد: <b>{chunkTotals.new}</b></span>
                <span>ملغي: <b>{chunkTotals.cancelled}</b></span>
                <span>متجاوَز: <b>{chunkTotals.skipped}</b></span>
                <span className={chunkTotals.failed ? "text-red-300" : ""}>فاشل: <b>{chunkTotals.failed}</b></span>
                <span className="text-muted-foreground">معتمد: {chunkTotals.approved}</span>
              </div>

              {chunks.filter((c) => c.status === "failed").map((c) => (
                <div key={`e-${c.index}`} className="text-red-300">دفعة {c.index + 1}: {c.error}</div>
              ))}
            </div>
          )}

          {/* بطاقة تفصيل أسباب المراجعة */}
          <div className="mb-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-2 text-[11px]">
            {(Object.keys(ISSUE_LABEL) as DataIssue[]).map((k) => (
              <div key={k} className="flex items-center justify-between px-2 py-1 rounded bg-white/5">
                <span className="text-muted-foreground">{ISSUE_LABEL[k]}</span>
                <span className={issueCounts[k] > 0 ? "text-amber-300 font-semibold" : "text-muted-foreground"}>{issueCounts[k]}</span>
              </div>
            ))}
          </div>

          {buckets.blocked > 0 && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-200">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div>{buckets.blocked} صف يحتوي خطأ يمنع الاستيراد. راجعها ثم أعد الاستيراد.</div>

            </div>
          )}


          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="text-muted-foreground">
                <tr className="border-b border-white/10">
                  <th className="p-1.5 w-8"></th>
                  <th className="p-1.5 text-right">#</th>
                  <th className="p-1.5 text-right">الحالة</th>
                  <th className="p-1.5 text-right">رقم الطلب</th>
                  <th className="p-1.5 text-right">العميل</th>
                  <th className="p-1.5 text-right">حالة الطلب</th>
                  <th className="p-1.5 text-right">حالة الدفع</th>
                  <th className="p-1.5 text-right">طريقة الدفع</th>
                  <th className="p-1.5 text-right">وسيط الدفع</th>
                  <th className="p-1.5 text-right">إجمالي (شامل)</th>
                  <th className="p-1.5 text-right">قبل الضريبة</th>
                  <th className="p-1.5 text-right">إجمالي الضريبة</th>
                  <th className="p-1.5 text-right">الشحن (قبل)</th>
                  <th className="p-1.5 text-right">ضريبة الشحن</th>
                  <th className="p-1.5 text-right">الخصومات</th>
                  <th className="p-1.5 text-right">سبب المراجعة</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => {
                  const rowStatus = CLASSIFICATION_LABEL[r.classification];
                  const badge = CLASSIFICATION_CLASS[r.classification];
                  const canSelect = canImportRow(r);
                  const isSel = selected.has(r.rowNo);
                  const payStatusBadge = "text-amber-300";

                  return (
                    <tr key={r.rowNo} className="border-b border-white/5">
                      <td className="p-1.5">
                        <input
                          type="checkbox"
                          disabled={!canSelect}
                          checked={isSel}
                          onChange={() => toggleRow(r.rowNo, canSelect)}
                        />
                      </td>
                      <td className="p-1.5 text-muted-foreground">{r.rowNo}</td>
                      <td className="p-1.5"><span className={`px-1.5 py-0.5 rounded border text-[10px] ${badge}`}>{rowStatus}</span></td>
                      <td className="p-1.5 font-mono">{r.external_order_id ?? "—"}</td>
                      <td className="p-1.5">{r.customer_name ?? "—"}</td>
                      <td className="p-1.5">{r.order_status ?? "—"}</td>
                      <td className={`p-1.5 ${payStatusBadge}`}>
                        يُحدَّد من دليل السداد

                      </td>
                      <td className="p-1.5">{r.payment_method_raw ?? "—"}</td>
                      <td className="p-1.5">{PROVIDERS.find((p) => p.value === r.payment_provider)?.label ?? r.payment_provider}</td>
                      <td className="p-1.5">{r.original_gross_amount ?? "—"}</td>
                      <td className="p-1.5">{r.total_before_vat || "—"}</td>
                      <td className="p-1.5">{r.total_vat_amount || "—"}</td>
                      <td className="p-1.5">{r.shipping_before_vat || "—"}</td>
                      <td className="p-1.5">{r.shipping_vat || "—"}</td>
                      <td className="p-1.5">{r.total_discount || "—"}</td>
                      <td className="p-1.5 text-[10px] text-amber-200">
                        {r.action_reason && (
                          <div className={r.classification === "blocked" ? "text-red-300 font-semibold" : "text-sky-200"}>
                            {r.action_reason}
                            {r.classification === "blocked" && (
                              <span className="text-red-200/80">
                                {" "}({!r.external_order_id ? "رقم الطلب" : !r.order_date ? "تاريخ الطلب" : "إجمالي الطلب"})
                              </span>
                            )}
                          </div>
                        )}
                        {r.issues.length
                          ? r.issues.map((x) => <div key={x}>• {ISSUE_LABEL[x]}</div>)
                          : (!r.action_reason ? "—" : null)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function BucketChip({ active, k, n, onClick }: { active: Classification | "all"; k: Classification; n: number; onClick: (k: Classification | "all") => void }) {
  const cls = CLASSIFICATION_CLASS[k];
  const isActive = active === k;
  return (
    <button
      onClick={() => onClick(isActive ? "all" : k)}
      className={`px-2 py-0.5 rounded border text-[11px] ${cls} ${isActive ? "ring-1 ring-white/40" : ""}`}
    >
      {CLASSIFICATION_LABEL[k]}: {n}
    </button>
  );
}

