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

const CANCELLED_RX = /cancel|ملغى|ملغي|ملغاة|إلغاء|الغاء/i;
const isCancelled = (s: string | null) => !!s && CANCELLED_RX.test(s);

type Classification =
  | "ready_to_import"
  | "importable_missing_tax_document"
  | "skipped_duplicate"
  | "cancelled_order"
  | "blocking_review";

const CLASSIFICATION_LABEL: Record<Classification, string> = {
  ready_to_import: "جاهز للاستيراد",
  importable_missing_tax_document: "مسودة — مستند ضريبي ناقص",
  skipped_duplicate: "مكرر — سيتم تجاوزه",
  cancelled_order: "طلب ملغي (سجل فقط)",
  blocking_review: "خطأ يمنع الاستيراد",
};

const CLASSIFICATION_CLASS: Record<Classification, string> = {
  ready_to_import: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  importable_missing_tax_document: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  skipped_duplicate: "bg-white/10 text-muted-foreground border-white/20",
  cancelled_order: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  blocking_review: "bg-red-500/15 text-red-300 border-red-500/30",
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

type PaymentStatus = "paid" | "unpaid" | "unknown";

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
  payment_status_source: "inferred" | "unknown";
  original_gross_amount: number | null;
  total_vat_amount: number;
  shipping_before_vat: number;
  shipping_vat: number;
  product_vat: number;
  total_before_vat: number;
  product_before_vat: number;
  total_discount: number;
  cancelled: boolean;
  duplicate: boolean;
  issues: DataIssue[];
  classification: Classification;
  tax_document_status: "present" | "missing";
  vat_return_eligible: boolean;
};

function countBuckets(rows: ParsedRow[]) {
  const acc: Record<Classification, number> = {
    ready_to_import: 0, importable_missing_tax_document: 0,
    skipped_duplicate: 0, cancelled_order: 0, blocking_review: 0,
  };
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

      // حالة الدفع المستنتجة (لا تعتمد على وجود رقم فاتورة)
      let paymentStatus: PaymentStatus = "unknown";
      let statusSource: "inferred" | "unknown" = "unknown";
      if (!cancelled && gross != null && gross > 0 && paymentMethodRaw) {
        paymentStatus = "paid";
        statusSource = "inferred";
      }

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
        payment_status_source: statusSource,
        original_gross_amount: gross,
        total_vat_amount: totalVat,
        shipping_before_vat: shipBefore,
        shipping_vat: shippingVat,
        product_vat: productVat,
        total_before_vat: totalBeforeVat,
        product_before_vat: productBeforeVat,
        total_discount: totalDiscount,
        cancelled,
        duplicate: false,
        issues,
        classification: "ready_to_import", // مبدئي — سيُعاد تصنيفه أدناه
        tax_document_status: invoiceNumber ? "present" : "missing",
        vat_return_eligible: !!invoiceNumber && !cancelled,
      };
    });

    // تكرار داخل الملف
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

    // تكرار من قاعدة البيانات
    const ids = parsed.map((r) => r.external_order_id).filter((x): x is string => !!x);
    if (ids.length) {
      const { data: existing } = await (supabase as any)
        .from("sales_invoices")
        .select("external_order_id")
        .eq("sales_channel", "salla")
        .in("external_order_id", ids);
      const existSet = new Set((existing || []).map((x: any) => x.external_order_id));
      parsed.forEach((r) => {
        if (r.external_order_id && existSet.has(r.external_order_id)) {
          r.duplicate = true;
          if (!r.issues.includes("duplicate_order")) r.issues.push("duplicate_order");
        }
      });
    }

    // تصنيف نهائي بالأولوية: blocking > duplicate > cancelled > missing_tax_doc > ready
    parsed.forEach((r) => {
      const hardBlocking =
        !r.external_order_id ||
        !r.order_date ||
        r.original_gross_amount == null ||
        (r.original_gross_amount != null && r.original_gross_amount < 0 && !r.cancelled);
      if (hardBlocking) r.classification = "blocking_review";
      else if (r.duplicate) r.classification = "skipped_duplicate";
      else if (r.cancelled) r.classification = "cancelled_order";
      else if (!r.external_invoice_number) r.classification = "importable_missing_tax_document";
      else r.classification = "ready_to_import";
    });

    setRows(parsed);
    // اختيار افتراضي: جاهز + مسودة مستند ناقص
    const auto = new Set<number>();
    parsed.forEach((r) => {
      if (r.classification === "ready_to_import" || r.classification === "importable_missing_tax_document") auto.add(r.rowNo);
    });
    setSelected(auto);

    const buckets = countBuckets(parsed);
    toast.success(
      `تم تحضير ${parsed.length} صف — جاهز: ${buckets.ready_to_import}، مسودة ناقصة: ${buckets.importable_missing_tax_document}، ملغي: ${buckets.cancelled_order}، مكرر: ${buckets.skipped_duplicate}، أخطاء: ${buckets.blocking_review}`
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

  const canImportRow = (r: ParsedRow) =>
    r.classification === "ready_to_import" || r.classification === "importable_missing_tax_document";

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

  async function commit() {
    if (!rows.length) return;
    if (!canWrite) { toast.error("لا تملك صلاحية الاستيراد"); return; }
    const importable = rows.filter((r) => selected.has(r.rowNo) && canImportRow(r));
    if (!importable.length) { toast.error("لا توجد صفوف قابلة للاستيراد ضمن التحديد"); return; }

    const readyCount = importable.filter((r) => r.classification === "ready_to_import").length;
    const missingDocCount = importable.filter((r) => r.classification === "importable_missing_tax_document").length;
    const cancelledCount = buckets.cancelled_order;
    const dupCount = buckets.skipped_duplicate;
    const blockCount = buckets.blocking_review;

    const ok = window.confirm(
      `سيتم استيراد ${importable.length} طلب كمسودة فاتورة:\n` +
      `• جاهز للاستيراد: ${readyCount}\n` +
      `• مسودات بمستند ضريبي ناقص: ${missingDocCount}\n\n` +
      `سيتم حفظ ${cancelledCount} طلب ملغي كسجل طلب فقط (بدون فاتورة نشطة).\n` +
      `سيتم تجاوز ${dupCount} مكرر و ${blockCount} خطأ.\n\nمتابعة؟`
    );
    if (!ok) return;

    setCommitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;

      const { data: batchRow, error: bErr } = await (supabase as any)
        .from("sales_import_batches")
        .insert({
          sales_channel: "salla",
          file_name: file?.name ?? "salla-import",
          sheet_name: sheet || null,
          mapping_snapshot: mapping,
          total_rows: rows.length,
          summary_json: { headerRow, headers },
          created_by: uid,
          status: "committed",
        })
        .select("id")
        .single();
      if (bErr) throw bErr;
      const batchId = batchRow.id as string;

      let inserted = 0;
      let insertedDraftMissingDoc = 0;
      const failed: { rowNo: number; error: string }[] = [];

      for (const r of importable) {
        // رقم عرض داخلي — لا نضع external_invoice_number إن كان ناقصاً
        const invoiceNumber = r.external_invoice_number
          ? `SALLA-${r.external_order_id}`
          : `SALLA-${r.external_order_id}`;
        const missingDoc = r.classification === "importable_missing_tax_document";
        const settlementStatus =
          r.payment_provider === "tabby" || r.payment_provider === "tamara" || r.payment_provider === "salla_payments"
            ? "pending"
            : r.payment_provider === "bank_transfer"
              ? "not_applicable"
              : "manual_review";
        const noteParts: string[] = [];
        if (missingDoc) noteParts.push("مسودة — رقم الفاتورة الضريبية مفقود، لا تدخل الإقرار الضريبي حتى الاستكمال");
        if (!r.payment_method_raw) noteParts.push("طريقة الدفع غير معروفة");
        const row: any = {
          invoice_number: invoiceNumber,
          issue_date: r.order_date,
          supply_date: r.order_date,
          order_date: r.order_date,
          status: "draft",
          payment_status: r.payment_status === "paid" ? "paid" : "unpaid",
          sales_channel: "salla",
          payment_provider: r.payment_provider && r.payment_provider !== "unknown" ? r.payment_provider : null,
          settlement_status: settlementStatus,
          original_payment_method: r.payment_method_raw ?? null,
          external_order_id: r.external_order_id,
          external_invoice_number: r.external_invoice_number, // يبقى null إن كان مفقوداً
          customer_name_snapshot: r.customer_name,
          order_status: r.order_status,
          original_gross_amount: r.original_gross_amount,
          refund_amount: 0,
          net_amount: r.original_gross_amount,
          shipping_before_vat: r.shipping_before_vat,
          shipping_vat: r.shipping_vat,
          subtotal: r.total_before_vat,
          discount_amount: r.total_discount,
          taxable_amount: r.total_before_vat,
          vat_amount: r.total_vat_amount,
          total_amount: r.original_gross_amount ?? 0,
          paid_amount: r.payment_status === "paid" ? (r.original_gross_amount ?? 0) : 0,
          remaining_amount: r.payment_status === "paid" ? 0 : (r.original_gross_amount ?? 0),
          data_completeness_status: missingDoc ? "missing_original_invoice" : "complete",
          import_batch_id: batchId,
          import_row_snapshot: r as any,
          notes: noteParts.length ? noteParts.join(" · ") : null,
        };

        const { error: iErr } = await (supabase as any)
          .from("sales_invoices")
          .insert(row)
          .select("id")
          .single();
        if (iErr) { failed.push({ rowNo: r.rowNo, error: iErr.message }); continue; }
        inserted++;
        if (missingDoc) insertedDraftMissingDoc++;
      }

      const errorRows = failed.length;

      // Upsert ALL parsed rows into salla_orders (يشمل الملغية والمكررة) لأغراض مطابقة التسويات
      const orderPayloads = rows
        .filter((r) => r.external_order_id)
        .map((r) => ({
          external_order_id: String(r.external_order_id),
          order_status: r.order_status,
          payment_status: r.payment_status,
          original_total: r.original_gross_amount,
          refund_total: 0,
          payment_method: r.payment_method_raw,
          invoice_number: r.external_invoice_number,
          cancellation_date: r.cancelled ? r.order_date : null,
          order_date: r.order_date,
          customer_name: r.customer_name,
          batch_id: batchId,
          raw_snapshot: r as any,
        }));
      const oChunk = 500;
      for (let i = 0; i < orderPayloads.length; i += oChunk) {
        await (supabase as any).from("salla_orders").upsert(orderPayloads.slice(i, i + oChunk), { onConflict: "external_order_id" });
      }

      await (supabase as any).from("sales_import_batches").update({
        imported_rows: inserted,
        duplicate_rows: buckets.skipped_duplicate,
        needs_review_rows: buckets.blocking_review,
        error_rows: errorRows,
        summary_json: {
          headerRow, headers, failed,
          salla_orders_upserted: orderPayloads.length,
          buckets, issue_counts: issueCounts,
          drafts_missing_tax_document: insertedDraftMissingDoc,
          cancelled_saved_as_orders: buckets.cancelled_order,
        },
      }).eq("id", batchId);

      await (supabase as any).from("finance_audit_logs").insert({
        related_type: "sales_import_batches",
        related_id: batchId,
        action: "commit_sales_import",
        note: `salla · file=${file?.name} inserted=${inserted} draft_missing_doc=${insertedDraftMissingDoc} cancelled=${buckets.cancelled_order} dupes=${buckets.skipped_duplicate} blocking=${buckets.blocking_review} errors=${errorRows}`,
        changed_by: uid,
      });

      toast.success(
        `تم استيراد ${inserted} طلب (${insertedDraftMissingDoc} بمستند ناقص). ملغي محفوظ كسجل: ${buckets.cancelled_order}، مكرر متجاوز: ${buckets.skipped_duplicate}، خطأ: ${buckets.blocking_review + errorRows}.`
      );
      setRows([]); setSelected(new Set()); setFile(null); setSheets([]); setSheet(""); setAoa([]); setMapping({});
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      toast.error(`فشل الاستيراد: ${e.message ?? e}`);
    } finally {
      setCommitting(false);
    }
  }


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
            <div className="flex items-center gap-2 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">صالح: {stats.valid}</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">يحتاج مراجعة: {stats.review}</span>
              <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300">محدد: {stats.selectedValid}</span>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowOnlyReview((v) => !v)}
                className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[12px] inline-flex items-center gap-1.5"
              >
                <Eye size={14} /> {showOnlyReview ? "عرض الكل" : `مراجعة الصفوف المستبعدة (${stats.review})`}
              </button>
              <button onClick={selectAllValid} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[12px]">
                تحديد كل الصالح
              </button>
              <button onClick={clearSelection} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[12px]">
                مسح التحديد
              </button>
              <button
                onClick={commit}
                disabled={committing || !canWrite || stats.selectedValid === 0}
                className="px-4 py-2 rounded-lg bg-gold text-black text-[12px] font-semibold hover:bg-gold/90 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {committing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                اعتماد الصفوف الصالحة ({stats.selectedValid})
              </button>
              <button onClick={() => { setRows([]); setSelected(new Set()); }} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[12px] inline-flex items-center gap-1.5">
                <RotateCcw size={14} /> إلغاء
              </button>
            </div>
          </div>

          {stats.review >= 14 && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div>
                يوجد {stats.review} صف يحتاج مراجعة. تم استبعادها من التحديد الافتراضي. راجعها قبل أي اعتماد يدوي.
              </div>
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
                  const rowStatus = r.hard_error ? "خطأ"
                    : r.needs_review ? "مراجعة"
                    : "صالح";
                  const badge = r.hard_error ? "bg-red-500/15 text-red-300 border-red-500/30"
                    : r.needs_review ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
                  const canSelect = !r.needs_review && !r.hard_error;
                  const isSel = selected.has(r.rowNo);
                  const payStatusBadge = r.payment_status === "paid"
                    ? "text-emerald-300"
                    : r.payment_status === "unknown" ? "text-amber-300" : "text-muted-foreground";
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
                        {r.payment_status === "paid" ? "مدفوع (مستنتج)" : r.payment_status === "unknown" ? "غير معروف" : "غير مدفوع"}
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
                        {r.review_reasons.length
                          ? r.review_reasons.map((x) => <div key={x}>• {REVIEW_LABEL[x]}</div>)
                          : "—"}
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
