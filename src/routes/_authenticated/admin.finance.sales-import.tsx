import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Loader2, Save, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/sales-import")({
  ssr: false,
  component: SalesImportPage,
});

type ProviderKey =
  | "" | "salla_payments" | "tabby" | "tamara" | "bank_transfer"
  | "personal_account" | "business_account" | "cash" | "other";

const PROVIDERS: { value: ProviderKey; label: string }[] = [
  { value: "", label: "— غير محدد —" },
  { value: "salla_payments", label: "سلة للمدفوعات" },
  { value: "tabby", label: "تابي" },
  { value: "tamara", label: "تمارا" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "personal_account", label: "حساب شخصي" },
  { value: "business_account", label: "حساب تجاري" },
  { value: "cash", label: "نقدًا" },
  { value: "other", label: "أخرى" },
];

// Provider auto-detection from Salla payment method text
const PROVIDER_HINTS: [RegExp, ProviderKey][] = [
  [/tabby|تابي/i, "tabby"],
  [/tamara|تمارا/i, "tamara"],
  [/mada|apple ?pay|visa|master|credit|debit|stcpay|stc ?pay|checkout|payment|سلة|salla/i, "salla_payments"],
  [/bank|تحويل|iban|swift/i, "bank_transfer"],
  [/cash|نقد/i, "cash"],
];

function detectProvider(text: string | null): ProviderKey {
  if (!text) return "";
  for (const [rx, k] of PROVIDER_HINTS) if (rx.test(text)) return k;
  return "";
}

// Salla import fields
const FIELDS = [
  { key: "external_order_id", label: "رقم الطلب", required: true, aliases: ["order id", "order_id", "order number", "رقم الطلب", "رقم طلب", "الطلب"] },
  { key: "external_invoice_number", label: "رقم فاتورة سلة", required: false, aliases: ["invoice number", "invoice_no", "رقم الفاتورة", "فاتورة"] },
  { key: "order_date", label: "تاريخ الطلب", required: true, aliases: ["order date", "date", "التاريخ", "تاريخ الطلب", "تاريخ"] },
  { key: "customer_name", label: "اسم العميل", required: false, aliases: ["customer", "customer name", "اسم العميل", "العميل", "الاسم"] },
  { key: "payment_method", label: "طريقة الدفع", required: false, aliases: ["payment method", "payment", "طريقة الدفع", "الدفع"] },
  { key: "order_status", label: "حالة الطلب", required: false, aliases: ["status", "order status", "الحالة", "حالة الطلب"] },
  { key: "payment_status", label: "حالة الدفع", required: false, aliases: ["payment status", "حالة الدفع"] },
  { key: "original_gross_amount", label: "المبلغ الأصلي", required: true, aliases: ["total", "gross", "amount", "المبلغ الأصلي", "الإجمالي", "قيمة الطلب", "المبلغ"] },
  { key: "refund_amount", label: "المسترجع", required: false, aliases: ["refund", "refunded", "المرتجع", "المسترجع", "استرجاع"] },
  { key: "vat_amount", label: "ضريبة القيمة المضافة", required: false, aliases: ["vat", "tax", "ضريبة", "الضريبة"] },
  { key: "shipping_before_vat", label: "الشحن قبل الضريبة", required: false, aliases: ["shipping", "shipping cost", "شحن", "الشحن", "الشحن قبل الضريبة"] },
  { key: "shipping_vat", label: "ضريبة الشحن", required: false, aliases: ["shipping vat", "shipping tax", "ضريبة الشحن"] },
] as const;

type FieldKey = typeof FIELDS[number]["key"];

const normStr = (s: any) => (s == null ? "" : String(s)).trim().toLowerCase();

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
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  if (!s) return null;
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

function parseAmount(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && isFinite(v)) return Math.round(v * 100) / 100;
  const s = String(v).replace(/[^\d\.\-,]/g, "").replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return isFinite(n) ? Math.round(n * 100) / 100 : null;
}

type Mapping = Partial<Record<FieldKey, number>>;
type ParsedRow = {
  rowNo: number;
  external_order_id: string | null;
  external_invoice_number: string | null;
  order_date: string | null;
  customer_name: string | null;
  payment_method: string | null;
  payment_provider: ProviderKey;
  order_status: string | null;
  payment_status: string | null;
  original_gross_amount: number | null;
  refund_amount: number;
  vat_amount: number;
  shipping_before_vat: number;
  shipping_vat: number;
  net_amount: number | null;
  errors: string[];
  warnings: string[];
  duplicate: boolean;
  completeness: "complete" | "missing_original_invoice" | "missing_tax_details" | "needs_review" | "needs_credit_note";
};

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
      const gross = parseAmount(get("original_gross_amount"));
      const refund = parseAmount(get("refund_amount")) ?? 0;
      const vat = parseAmount(get("vat_amount")) ?? 0;
      const shipBefore = parseAmount(get("shipping_before_vat")) ?? 0;
      const shipVat = parseAmount(get("shipping_vat")) ?? 0;
      const paymentMethod = get("payment_method") == null ? null : String(get("payment_method"));
      const provider = detectProvider(paymentMethod);
      const errors: string[] = [];
      const warnings: string[] = [];
      if (!orderId) errors.push("رقم الطلب مفقود");
      if (!dateStr) errors.push("تاريخ الطلب غير صالح");
      if (gross == null) errors.push("المبلغ الأصلي مفقود");
      if (refund < 0) errors.push("قيمة المرتجع سالبة");
      if (gross != null && refund > gross) warnings.push("قيمة المرتجع تتجاوز الأصل");
      if (vat === 0 && gross && gross > 0) warnings.push("لا توجد ضريبة");

      const net = gross != null ? Math.round((gross - refund) * 100) / 100 : null;

      let completeness: ParsedRow["completeness"] = "complete";
      if (!get("external_invoice_number")) completeness = "missing_original_invoice";
      if (vat === 0 && gross && gross > 0) completeness = "missing_tax_details";
      if (refund > 0) completeness = "needs_credit_note";
      if (warnings.length && completeness === "complete") completeness = "needs_review";

      return {
        rowNo: headerRow + 2 + idx,
        external_order_id: orderId,
        external_invoice_number: get("external_invoice_number") ? String(get("external_invoice_number")).trim() : null,
        order_date: dateStr,
        customer_name: get("customer_name") ? String(get("customer_name")).trim() : null,
        payment_method: paymentMethod,
        payment_provider: provider,
        order_status: get("order_status") ? String(get("order_status")).trim() : null,
        payment_status: get("payment_status") ? String(get("payment_status")).trim() : null,
        original_gross_amount: gross,
        refund_amount: refund,
        vat_amount: vat,
        shipping_before_vat: shipBefore,
        shipping_vat: shipVat,
        net_amount: net,
        errors,
        warnings,
        duplicate: false,
        completeness,
      };
    });

    // Dedupe within file
    const seen = new Map<string, number>();
    parsed.forEach((r) => {
      if (!r.external_order_id) return;
      const prev = seen.get(r.external_order_id);
      if (prev != null) r.duplicate = true;
      else seen.set(r.external_order_id, r.rowNo);
    });

    // Check DB for existing external_order_id
    const ids = parsed.map((r) => r.external_order_id).filter((x): x is string => !!x);
    if (ids.length) {
      const { data: existing } = await (supabase as any)
        .from("sales_invoices")
        .select("external_order_id")
        .eq("sales_channel", "salla")
        .in("external_order_id", ids);
      const existSet = new Set((existing || []).map((x: any) => x.external_order_id));
      parsed.forEach((r) => {
        if (r.external_order_id && existSet.has(r.external_order_id)) r.duplicate = true;
      });
    }

    setRows(parsed);
    toast.success(`تم تحضير ${parsed.length} صف. راجع ثم اضغط اعتماد.`);
  }

  const stats = useMemo(() => {
    const total = rows.length;
    const dupes = rows.filter((r) => r.duplicate).length;
    const errs = rows.filter((r) => r.errors.length).length;
    const review = rows.filter((r) => !r.duplicate && !r.errors.length && r.completeness !== "complete").length;
    const ok = rows.filter((r) => !r.duplicate && !r.errors.length && r.completeness === "complete").length;
    return { total, dupes, errs, review, ok, importable: ok + review };
  }, [rows]);

  async function commit() {
    if (!rows.length) return;
    if (!canWrite) { toast.error("لا تملك صلاحية الاستيراد"); return; }
    setCommitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;

      // Insert batch first
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

      const importable = rows.filter((r) => !r.duplicate && !r.errors.length);
      let inserted = 0;
      const failed: { rowNo: number; error: string }[] = [];

      for (const r of importable) {
        const invoiceNumber = `SALLA-${r.external_order_id}`;
        const taxable = Math.max((r.original_gross_amount ?? 0) - r.vat_amount, 0);
        const row: any = {
          invoice_number: invoiceNumber,
          issue_date: r.order_date,
          supply_date: r.order_date,
          order_date: r.order_date,
          status: "draft",
          payment_status: "unpaid",
          sales_channel: "salla",
          payment_provider: r.payment_provider || null,
          external_order_id: r.external_order_id,
          external_invoice_number: r.external_invoice_number,
          customer_name_snapshot: r.customer_name,
          order_status: r.order_status,
          original_gross_amount: r.original_gross_amount,
          refund_amount: 0, // will be set by trigger when we insert sales_refunds
          net_amount: r.net_amount,
          shipping_before_vat: r.shipping_before_vat,
          shipping_vat: r.shipping_vat,
          subtotal: taxable,
          discount_amount: 0,
          taxable_amount: taxable,
          vat_amount: r.vat_amount,
          total_amount: r.original_gross_amount ?? 0,
          paid_amount: 0,
          remaining_amount: r.original_gross_amount ?? 0,
          data_completeness_status: r.completeness,
          import_batch_id: batchId,
          import_row_snapshot: r as any,
          notes: r.payment_method ? `طريقة الدفع: ${r.payment_method}` : null,
        };

        const { data: invRow, error: iErr } = await (supabase as any)
          .from("sales_invoices")
          .insert(row)
          .select("id")
          .single();
        if (iErr) { failed.push({ rowNo: r.rowNo, error: iErr.message }); continue; }

        if (r.refund_amount > 0) {
          const { error: rErr } = await (supabase as any).from("sales_refunds").insert({
            invoice_id: invRow.id,
            refund_date: r.order_date,
            amount: r.refund_amount,
            reason: "مرتجع من الاستيراد",
            external_reference: r.external_order_id,
            sales_channel: "salla",
            has_credit_note: false,
            import_batch_id: batchId,
            created_by: uid,
          });
          if (rErr) failed.push({ rowNo: r.rowNo, error: `refund: ${rErr.message}` });
        }
        inserted++;
      }

      const duplicates = rows.filter((r) => r.duplicate).length;
      const errorRows = rows.filter((r) => r.errors.length).length + failed.length;
      const reviewRows = importable.filter((r) => r.completeness !== "complete").length;

      await (supabase as any).from("sales_import_batches").update({
        imported_rows: inserted,
        duplicate_rows: duplicates,
        needs_review_rows: reviewRows,
        error_rows: errorRows,
        summary_json: { headerRow, headers, failed },
      }).eq("id", batchId);

      // Audit
      await (supabase as any).from("finance_audit_logs").insert({
        related_type: "sales_import_batches",
        related_id: batchId,
        action: "commit_sales_import",
        note: `salla · file=${file?.name} inserted=${inserted} dupes=${duplicates} review=${reviewRows} errors=${errorRows}`,
        changed_by: uid,
      });

      toast.success(`تم استيراد ${inserted} فاتورة. مكررة: ${duplicates}، مراجعة: ${reviewRows}، أخطاء: ${errorRows}.`);
      setRows([]); setFile(null); setSheets([]); setSheet(""); setAoa([]); setMapping({});
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
          قناة البيع تُثبَّت على "سلة" ووسيط الدفع يُكتشف تلقائيًا من طريقة الدفع في الملف. لن يتم إنشاء فاتورة جديدة إذا كان رقم الطلب موجود مسبقًا.
        </p>
      </div>

      {aoa.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-semibold mb-3">ربط أعمدة الملف بالحقول</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-2 text-[12px]">
                <div className="w-40 shrink-0">
                  <span>{f.label}</span>
                  {f.required && <span className="text-red-400 mr-1">*</span>}
                </div>
                <select
                  className="inp flex-1"
                  value={mapping[f.key] ?? -1}
                  onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}
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
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">صالح: {stats.ok}</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">مراجعة: {stats.review}</span>
              <span className="px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/30 text-orange-300">مكرر: {stats.dupes}</span>
              <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-300">أخطاء: {stats.errs}</span>
            </div>
            <button
              onClick={commit}
              disabled={committing || !canWrite || stats.importable === 0}
              className="ml-auto px-4 py-2 rounded-lg bg-gold text-black text-[12px] font-semibold hover:bg-gold/90 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {committing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              اعتماد الاستيراد ({stats.importable})
            </button>
            <button onClick={() => setRows([])} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[12px] inline-flex items-center gap-1.5">
              <RotateCcw size={14} /> إلغاء
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="text-muted-foreground">
                <tr className="border-b border-white/10">
                  <th className="p-1.5 text-right">#</th>
                  <th className="p-1.5 text-right">الحالة</th>
                  <th className="p-1.5 text-right">رقم الطلب</th>
                  <th className="p-1.5 text-right">تاريخ</th>
                  <th className="p-1.5 text-right">العميل</th>
                  <th className="p-1.5 text-right">وسيط الدفع</th>
                  <th className="p-1.5 text-right">الأصلي</th>
                  <th className="p-1.5 text-right">المرتجع</th>
                  <th className="p-1.5 text-right">الصافي</th>
                  <th className="p-1.5 text-right">الضريبة</th>
                  <th className="p-1.5 text-right">اكتمال</th>
                  <th className="p-1.5 text-right">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const badge = r.errors.length ? "bg-red-500/15 text-red-300 border-red-500/30"
                    : r.duplicate ? "bg-orange-500/15 text-orange-300 border-orange-500/30"
                    : r.completeness !== "complete" ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
                  const label = r.errors.length ? "خطأ" : r.duplicate ? "مكرر" : r.completeness !== "complete" ? "مراجعة" : "صالح";
                  return (
                    <tr key={r.rowNo} className="border-b border-white/5">
                      <td className="p-1.5 text-muted-foreground">{r.rowNo}</td>
                      <td className="p-1.5"><span className={`px-1.5 py-0.5 rounded border text-[10px] ${badge}`}>{label}</span></td>
                      <td className="p-1.5 font-mono">{r.external_order_id ?? "—"}</td>
                      <td className="p-1.5">{r.order_date ?? "—"}</td>
                      <td className="p-1.5">{r.customer_name ?? "—"}</td>
                      <td className="p-1.5">{PROVIDERS.find((p) => p.value === r.payment_provider)?.label ?? "—"}</td>
                      <td className="p-1.5">{r.original_gross_amount ?? "—"}</td>
                      <td className="p-1.5">{r.refund_amount || "—"}</td>
                      <td className="p-1.5">{r.net_amount ?? "—"}</td>
                      <td className="p-1.5">{r.vat_amount || "—"}</td>
                      <td className="p-1.5 text-[10px]">{r.completeness}</td>
                      <td className="p-1.5 text-[10px] text-muted-foreground">
                        {r.errors.map((x, i) => <div key={i} className="text-red-300">• {x}</div>)}
                        {r.warnings.map((x, i) => <div key={`w${i}`} className="text-amber-300">• {x}</div>)}
                        {r.duplicate && <div className="text-orange-300">• رقم الطلب موجود مسبقًا</div>}
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
