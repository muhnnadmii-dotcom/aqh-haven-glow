import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Copy as CopyIcon, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/import")({
  ssr: false,
  component: ImportPage,
});

type ImportType = "incomes" | "expenses";

type ParsedRow = {
  rowNo: number;
  raw: any[];
  date: string | null;
  amount: number | null;
  month: string | null;
  account_type: "business" | "personal" | null;
  internal_review_status: "reviewed" | "unreviewed";
  note: string | null;
  source_name?: string | null;
  source_id?: string | null;
  item_name?: string | null;
  supplier_name?: string | null;
  supplier_id?: string | null;
  main_category_name?: string | null;
  sub_category_name?: string | null;
  main_category_id?: string | null;
  sub_category_id?: string | null;
  attachment_status?: "attached" | "not_attached" | "not_required";
  errors: string[];
  warnings: string[];
  duplicate: boolean;
  newSource?: boolean;
  newSupplier?: boolean;
  newMain?: boolean;
  newSub?: boolean;
};

const INCOME_FIELDS = [
  { key: "date", label: "التاريخ", aliases: ["date", "التاريخ", "تاريخ"], required: true },
  { key: "amount", label: "المبلغ", aliases: ["amount", "المبلغ", "مبلغ", "value", "القيمة"], required: true },
  { key: "source", label: "المصدر", aliases: ["source", "المصدر", "مصدر", "income source", "مصدر الدخل"], required: true },
  { key: "month", label: "الشهر", aliases: ["month", "الشهر"], required: false },
  { key: "account_type", label: "نوع الحساب", aliases: ["account type", "account_type", "نوع الحساب", "الحساب"], required: false },
  { key: "confirmed", label: "مؤكد", aliases: ["confirmed", "مؤكد", "status", "الحالة"], required: false },
  { key: "note", label: "ملاحظة", aliases: ["note", "ملاحظة", "ملاحظات", "notes"], required: false },
] as const;

const EXPENSE_FIELDS = [
  { key: "date", label: "التاريخ", aliases: ["date", "التاريخ", "تاريخ"], required: true },
  { key: "amount", label: "المبلغ", aliases: ["amount", "المبلغ", "مبلغ"], required: true },
  { key: "item", label: "البيان", aliases: ["item", "name", "البيان", "الصنف", "description", "وصف"], required: false },
  { key: "vendor", label: "المورد", aliases: ["vendor", "supplier", "المورد", "البائع"], required: false },
  { key: "category", label: "التصنيف الرئيسي", aliases: ["category", "التصنيف", "main category", "التصنيف الرئيسي"], required: false },
  { key: "sub", label: "التصنيف الفرعي", aliases: ["sub-category", "sub_category", "subcategory", "التصنيف الفرعي", "فرعي"], required: false },
  { key: "month", label: "الشهر", aliases: ["month", "الشهر"], required: false },
  { key: "invoice", label: "حالة الفاتورة", aliases: ["invoice", "فاتورة", "حالة الفاتورة"], required: false },
  { key: "reason", label: "السبب/ملاحظة", aliases: ["reason", "note", "السبب", "ملاحظة", "ملاحظات"], required: false },
  { key: "account_type", label: "نوع الحساب", aliases: ["account type", "account_type", "نوع الحساب", "الحساب"], required: false },
  { key: "confirmed", label: "مؤكد", aliases: ["confirmed", "مؤكد"], required: false },
  { key: "uploaded", label: "مرفوع", aliases: ["uploaded", "مرفوع", "attached"], required: false },
] as const;

const normStr = (s: any) => (s == null ? "" : String(s)).trim().toLowerCase();

function autoMatchColumn(headers: any[], aliases: readonly string[]): number {
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

function detectHeaderRow(aoa: any[][], aliasesPool: string[]): number {
  const maxScan = Math.min(aoa.length, 30);
  let best = 0;
  let bestScore = 0;
  for (let i = 0; i < maxScan; i++) {
    const row = aoa[i] ?? [];
    let score = 0;
    for (const a of aliasesPool) {
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
  if (!isNaN(t.getTime())) return t.toISOString().slice(0, 10);
  return null;
}

function parseAmount(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v).replace(/[, ٬]/g, "").replace(/[^\d\.\-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

function parseAccountType(v: any): "business" | "personal" | null {
  if (v == null) return "business";
  const s = String(v).toLowerCase().trim();
  if (!s) return "business";
  if (s.includes("personal") || s.includes("شخصي")) return "personal";
  if (s.includes("business") || s.includes("تجاري") || s.includes("شركة") || s.includes("الشركة")) return "business";
  return null;
}

function parseBool(v: any): boolean {
  if (v == null) return false;
  const s = String(v).toLowerCase().trim();
  return ["yes", "y", "true", "1", "مؤكد", "نعم", "✓", "✔"].includes(s);
}

function ImportPage() {
  const roles = useFinanceRoles();
  const canImport = roles.isAdmin || roles.canManage;

  const [file, setFile] = useState<File | null>(null);
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null);
  const [sheetName, setSheetName] = useState<string>("");
  const [importType, setImportType] = useState<ImportType>("incomes");
  const [aoa, setAoa] = useState<any[][]>([]);
  const [headerRow, setHeaderRow] = useState<number>(1); // 1-based for UI
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // lookups
  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [mainCats, setMainCats] = useState<{ id: string; name: string }[]>([]);
  const [subCats, setSubCats] = useState<{ id: string; name: string; parent_id: string | null }[]>([]);
  const [existingIncomes, setExistingIncomes] = useState<any[]>([]);
  const [existingExpenses, setExistingExpenses] = useState<any[]>([]);

  // options
  const [createSources, setCreateSources] = useState(true);
  const [createSuppliers, setCreateSuppliers] = useState(true);
  const [createCats, setCreateCats] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [s, sup, cats, inc, exp, lg] = await Promise.all([
        supabase.from("finance_income_sources").select("id,name"),
        supabase.from("finance_suppliers").select("id,name"),
        supabase.from("finance_categories").select("id,name,kind,parent_id"),
        supabase.from("finance_incomes").select("id,income_date,amount,income_source_id,account_type,note").is("deleted_at", null).limit(5000),
        supabase.from("finance_expenses").select("id,expense_date,amount,supplier_id,supplier_name,item_name,main_category_id,account_type").is("deleted_at", null).limit(5000),
        supabase.from("finance_import_logs").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      setSources(s.data ?? []);
      setSuppliers(sup.data ?? []);
      const all = cats.data ?? [];
      setMainCats(all.filter((c: any) => c.kind === "main"));
      setSubCats(all.filter((c: any) => c.kind === "sub"));
      setExistingIncomes(inc.data ?? []);
      setExistingExpenses(exp.data ?? []);
      setLogs(lg.data ?? []);
    })();
  }, []);

  const reloadLogs = async () => {
    const { data } = await supabase.from("finance_import_logs").select("*").order("created_at", { ascending: false }).limit(20);
    setLogs(data ?? []);
  };

  const fieldDefs = importType === "incomes" ? INCOME_FIELDS : EXPENSE_FIELDS;

  // Load AoA whenever workbook/sheet changes
  useEffect(() => {
    if (!wb || !sheetName) { setAoa([]); return; }
    const ws = wb.Sheets[sheetName];
    if (!ws) { setAoa([]); return; }
    const arr = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null, raw: true, blankrows: false });
    setAoa(arr);
    // auto-detect header row
    const pool = fieldDefs.flatMap((f) => [...f.aliases]);
    const hr = detectHeaderRow(arr, pool);
    setHeaderRow(hr + 1);
    setParsed([]);
  }, [wb, sheetName, importType]);

  // Auto-remap whenever headerRow or importType changes
  useEffect(() => {
    if (!aoa.length) return;
    const headers = aoa[headerRow - 1] ?? [];
    const m: Record<string, number> = {};
    for (const f of fieldDefs) m[f.key] = autoMatchColumn(headers, f.aliases);
    setMapping(m);
  }, [aoa, headerRow, importType]);

  const headers: any[] = aoa[headerRow - 1] ?? [];
  const numCols = useMemo(() => Math.max(0, ...aoa.slice(0, 30).map((r) => (r ?? []).length)), [aoa]);

  const missingRequired = useMemo(
    () => fieldDefs.filter((f) => f.required && (mapping[f.key] == null || mapping[f.key] < 0)).map((f) => f.label),
    [fieldDefs, mapping],
  );

  const isRowEmpty = (cells: any[]) => {
    const di = mapping.date ?? -1;
    const ai = mapping.amount ?? -1;
    const si = (mapping.source ?? mapping.vendor ?? mapping.item ?? -1);
    const hasDate = di >= 0 && cells[di] != null && String(cells[di]).trim() !== "";
    const hasAmt = ai >= 0 && cells[ai] != null && String(cells[ai]).trim() !== "";
    const hasSrc = si >= 0 && cells[si] != null && String(cells[si]).trim() !== "";
    return !hasDate && !hasAmt && !hasSrc;
  };

  const parsePreview = () => {
    if (!aoa.length) return;
    if (missingRequired.length) {
      toast.error("لم يتم التعرف على أعمدة التاريخ أو المبلغ أو المصدر. تأكد من اختيار صف العناوين الصحيح.");
      setParsed([]);
      return;
    }

    const dataRows = aoa.slice(headerRow); // everything after header row
    const out: ParsedRow[] = [];
    let skippedEmpty = 0;

    dataRows.forEach((cells, idx) => {
      const realRow = headerRow + idx + 1; // 1-based Excel row
      if (!cells || isRowEmpty(cells)) { skippedEmpty++; return; }

      const errors: string[] = [];
      const warnings: string[] = [];
      const get = (k: string) => {
        const i = mapping[k];
        return i != null && i >= 0 ? cells[i] : null;
      };

      const date = parseDate(get("date"));
      if (!date) errors.push("تاريخ غير صالح");
      const amount = parseAmount(get("amount"));
      if (amount == null || amount < 0) errors.push("مبلغ غير صالح");
      const acct = parseAccountType(get("account_type"));
      if (!acct) errors.push("نوع حساب غير معروف");
      const monthRaw = get("month");
      const month = monthRaw ? String(monthRaw).slice(0, 7) : date ? date.slice(0, 7) : null;
      const confirmed = parseBool(get("confirmed"));

      if (importType === "incomes") {
        const srcRaw = get("source");
        const srcName = srcRaw == null ? null : String(srcRaw).trim() || null;
        let source_id: string | null = null;
        let newSource = false;
        if (srcName) {
          const m = sources.find((s) => normStr(s.name) === normStr(srcName));
          if (m) source_id = m.id;
          else { newSource = true; warnings.push(`مصدر دخل جديد: ${srcName}`); }
        } else {
          errors.push("مصدر الدخل مفقود");
        }
        const noteRaw = get("note");
        const note = noteRaw == null ? null : String(noteRaw);
        const row: ParsedRow = {
          rowNo: realRow, raw: cells, date, amount, month,
          account_type: acct, internal_review_status: confirmed ? "reviewed" : "unreviewed",
          note, source_name: srcName, source_id, newSource,
          errors, warnings, duplicate: false,
        };
        if (date && amount != null) {
          row.duplicate = existingIncomes.some(
            (e) =>
              e.income_date === date &&
              Number(e.amount) === amount &&
              (source_id ? e.income_source_id === source_id : true) &&
              e.account_type === acct &&
              normStr(e.note) === normStr(note),
          );
          if (row.duplicate) warnings.push("مكرر محتمل");
        }
        out.push(row);
      } else {
        const itemRaw = get("item");
        const item = itemRaw == null ? null : String(itemRaw).trim() || null;
        if (!item) errors.push("اسم الصنف/البيان مفقود");
        const vendorRaw = get("vendor");
        const vendor = vendorRaw == null ? null : String(vendorRaw).trim() || null;
        let supplier_id: string | null = null;
        let newSupplier = false;
        if (vendor) {
          const m = suppliers.find((s) => normStr(s.name) === normStr(vendor));
          if (m) supplier_id = m.id;
          else { newSupplier = true; warnings.push(`مورد جديد: ${vendor}`); }
        }
        const catRaw = get("category");
        const catName = catRaw == null ? null : String(catRaw).trim() || null;
        let main_category_id: string | null = null;
        let newMain = false;
        if (catName) {
          const m = mainCats.find((x) => normStr(x.name) === normStr(catName));
          if (m) main_category_id = m.id;
          else if (createCats) { newMain = true; warnings.push(`تصنيف رئيسي جديد: ${catName}`); }
          else errors.push(`تصنيف رئيسي غير معروف: ${catName}`);
        }
        const subRaw = get("sub");
        const subName = subRaw == null ? null : String(subRaw).trim() || null;
        let sub_category_id: string | null = null;
        let newSub = false;
        if (subName) {
          const m = subCats.find((x) => normStr(x.name) === normStr(subName) && (!main_category_id || x.parent_id === main_category_id));
          if (m) sub_category_id = m.id;
          else if (createCats) { newSub = true; warnings.push(`تصنيف فرعي جديد: ${subName}`); }
          else warnings.push(`تصنيف فرعي غير معروف: ${subName}`);
        }
        const reasonRaw = get("reason");
        const reason = reasonRaw == null ? null : String(reasonRaw);
        const uploaded = parseBool(get("uploaded"));
        const invVal = get("invoice");
        const invoiceVal = invVal == null ? "" : String(invVal).toLowerCase().trim();
        const notRequired = /not required|no invoice|بدون فاتورة|لا يحتاج/.test(invoiceVal);
        let attachment_status: "attached" | "not_attached" | "not_required" = "not_attached";
        if (notRequired) attachment_status = "not_required";
        if (uploaded && !notRequired) warnings.push("الملف القديم كان مرفوع، لكن لا يوجد مرفق فعلي");
        const row: ParsedRow = {
          rowNo: realRow, raw: cells, date, amount, month,
          account_type: acct, internal_review_status: confirmed ? "reviewed" : "unreviewed",
          note: reason, item_name: item, supplier_name: vendor, supplier_id,
          main_category_name: catName, sub_category_name: subName,
          main_category_id, sub_category_id, attachment_status,
          newSupplier, newMain, newSub,
          errors, warnings, duplicate: false,
        };
        if (date && amount != null && item) {
          row.duplicate = existingExpenses.some(
            (e) =>
              e.expense_date === date &&
              Number(e.amount) === amount &&
              normStr(e.item_name) === normStr(item) &&
              e.account_type === acct &&
              (supplier_id ? e.supplier_id === supplier_id : normStr(e.supplier_name) === normStr(vendor)) &&
              (main_category_id ? e.main_category_id === main_category_id : true),
          );
          if (row.duplicate) warnings.push("مكرر محتمل");
        }
        out.push(row);
      }
    });

    setParsed(out);
    toast.success(`تم قراءة ${out.length} صف${skippedEmpty ? ` · تم تجاهل ${skippedEmpty} صف فارغ` : ""}`);
  };

  const onFile = async (f: File) => {
    setFile(f);
    setParsed([]);
    setAoa([]);
    setLoading(true);
    try {
      const buf = await f.arrayBuffer();
      const wbk = XLSX.read(buf, { type: "array", cellDates: false });
      setWb(wbk);
      const first = wbk.SheetNames.find((n) => /income|دخل|تحصيل/i.test(n)) ?? wbk.SheetNames[0];
      setSheetName(first ?? "");
    } catch (e: any) {
      toast.error("تعذر قراءة الملف: " + e.message);
    }
    setLoading(false);
  };

  const stats = useMemo(() => {
    const errors = parsed.filter((r) => r.errors.length).length;
    const dupes = parsed.filter((r) => r.duplicate).length;
    const ready = parsed.filter((r) => !r.errors.length && (!skipDuplicates || !r.duplicate)).length;
    return { errors, dupes, ready, total: parsed.length };
  }, [parsed, skipDuplicates]);

  const runImport = async () => {
    if (!canImport) return;
    setImporting(true);
    const batchId = (crypto as any).randomUUID();
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;

    let created = { sources: 0, suppliers: 0, mains: 0, subs: 0 };
    let imported = 0;
    let skipped = 0;
    const errorsList: string[] = [];

    const srcMap = new Map(sources.map((s) => [normStr(s.name), s.id]));
    const supMap = new Map(suppliers.map((s) => [normStr(s.name), s.id]));
    const mainMap = new Map(mainCats.map((s) => [normStr(s.name), s.id]));
    const subMap = new Map(subCats.map((s) => [`${s.parent_id}|${normStr(s.name)}`, s.id]));

    for (const r of parsed) {
      if (r.errors.length) { skipped++; continue; }
      if (skipDuplicates && r.duplicate) { skipped++; continue; }
      try {
        if (importType === "incomes") {
          let source_id = r.source_id;
          if (!source_id && r.source_name) {
            const key = normStr(r.source_name);
            source_id = srcMap.get(key) ?? null;
            if (!source_id && createSources) {
              const { data, error } = await supabase.from("finance_income_sources").insert({ name: r.source_name }).select("id").single();
              if (error) throw error;
              source_id = data.id;
              srcMap.set(key, source_id);
              created.sources++;
            }
          }
          if (!source_id) { skipped++; continue; }
          const { error } = await supabase.from("finance_incomes").insert({
            income_date: r.date!, amount: r.amount!, income_source_id: source_id,
            month: r.month!, account_type: r.account_type!,
            internal_review_status: r.internal_review_status,
            accountant_status: "not_reviewed", attachment_status: "not_attached",
            note: r.note, created_by: uid, import_batch_id: batchId,
          });
          if (error) throw error;
        } else {
          let supplier_id = r.supplier_id;
          if (!supplier_id && r.supplier_name && createSuppliers) {
            const key = normStr(r.supplier_name);
            supplier_id = supMap.get(key) ?? null;
            if (!supplier_id) {
              const { data, error } = await supabase.from("finance_suppliers").insert({ name: r.supplier_name }).select("id").single();
              if (error) throw error;
              supplier_id = data.id;
              supMap.set(key, supplier_id);
              created.suppliers++;
            }
          }
          let main_id = r.main_category_id;
          if (!main_id && r.main_category_name && createCats) {
            const key = normStr(r.main_category_name);
            main_id = mainMap.get(key) ?? null;
            if (!main_id) {
              const { data, error } = await supabase.from("finance_categories").insert({ name: r.main_category_name, kind: "main" }).select("id").single();
              if (error) throw error;
              main_id = data.id;
              mainMap.set(key, main_id);
              created.mains++;
            }
          }
          let sub_id = r.sub_category_id;
          if (!sub_id && r.sub_category_name && createCats && main_id) {
            const key = `${main_id}|${normStr(r.sub_category_name)}`;
            sub_id = subMap.get(key) ?? null;
            if (!sub_id) {
              const { data, error } = await supabase.from("finance_categories").insert({ name: r.sub_category_name, kind: "sub", parent_id: main_id }).select("id").single();
              if (error) throw error;
              sub_id = data.id;
              subMap.set(key, sub_id);
              created.subs++;
            }
          }
          const { error } = await supabase.from("finance_expenses").insert({
            expense_date: r.date!, amount: r.amount!, item_name: r.item_name!,
            supplier_id, supplier_name: supplier_id ? null : r.supplier_name,
            main_category_id: main_id, sub_category_id: sub_id,
            month: r.month!, account_type: r.account_type!,
            internal_review_status: r.internal_review_status,
            accountant_status: "not_reviewed",
            attachment_status: r.attachment_status ?? "not_attached",
            note: r.note, created_by: uid, import_batch_id: batchId,
          });
          if (error) throw error;
        }
        imported++;
      } catch (e: any) {
        errorsList.push(`صف ${r.rowNo}: ${e.message}`);
        skipped++;
      }
    }

    await supabase.from("finance_import_logs").insert({
      import_type: importType,
      file_name: file?.name ?? "unknown",
      sheet_name: sheetName,
      total_rows: parsed.length,
      imported_rows: imported,
      skipped_rows: skipped,
      error_rows: parsed.filter((r) => r.errors.length).length,
      duplicate_rows: parsed.filter((r) => r.duplicate).length,
      imported_by: uid,
      summary_json: { batch_id: batchId, created, errors: errorsList.slice(0, 50), header_row: headerRow } as any,
    });

    setImporting(false);
    toast.success(`تم استيراد ${imported} صف · تم تخطي ${skipped}`);
    setParsed([]);
    setFile(null);
    setWb(null);
    setAoa([]);
    reloadLogs();
  };

  if (roles.loading) return <div className="text-sm text-muted-foreground">…</div>;
  if (!canImport) return <div className="text-sm text-muted-foreground">لا تملك صلاحية الاستيراد. يتطلب admin أو finance_manage.</div>;

  const colLabel = (i: number) => {
    // Excel-style A, B, .., Z, AA
    let s = "";
    let n = i;
    while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
    return s;
  };

  const previewRows = aoa.slice(0, 15);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">استيراد البيانات</h2>
        <p className="text-xs text-muted-foreground">رفع ملف Excel قديم لاستيراد الدخل أو المصروفات. لن يتم الحفظ قبل المعاينة والتأكيد.</p>
      </div>

      {/* Step 1 */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium"><Upload size={14} /> 1) رفع الملف</div>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          className="block text-xs"
        />
        {file && <div className="text-xs text-muted-foreground">{file.name}</div>}
      </div>

      {/* Step 2 */}
      {wb && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium"><FileSpreadsheet size={14} /> 2) نوع الاستيراد والشيت</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs space-y-1">
              <div>نوع الاستيراد</div>
              <select value={importType} onChange={(e) => setImportType(e.target.value as ImportType)} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs">
                <option value="incomes">دخل / تحصيلات</option>
                <option value="expenses">مصروفات</option>
              </select>
            </label>
            <label className="text-xs space-y-1">
              <div>الشيت</div>
              <select value={sheetName} onChange={(e) => setSheetName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs">
                {wb.SheetNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="text-xs space-y-1">
              <div>صف العناوين (Header Row)</div>
              <input
                type="number"
                min={1}
                max={Math.max(1, aoa.length)}
                value={headerRow}
                onChange={(e) => setHeaderRow(Math.max(1, Number(e.target.value) || 1))}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs"
              />
            </label>
          </div>
        </div>
      )}

      {/* Step 3: Raw preview */}
      {aoa.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="text-sm font-medium">3) معاينة خام (أول 15 صف)</div>
          <p className="text-[11px] text-muted-foreground">الصف المحدد باللون الذهبي هو صف العناوين الحالي. غيّر الرقم في الأعلى إذا كانت العناوين في صف مختلف.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-white/5">
                  <th className="p-1.5 text-right border border-white/10 sticky right-0 bg-white/5">#</th>
                  {Array.from({ length: numCols }).map((_, i) => (
                    <th key={i} className="p-1.5 border border-white/10 text-center text-muted-foreground">{colLabel(i)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => {
                  const realRow = i + 1;
                  const isHeader = realRow === headerRow;
                  return (
                    <tr key={i} className={isHeader ? "bg-gold/15" : ""}>
                      <td className="p-1.5 border border-white/10 sticky right-0 bg-inherit text-muted-foreground">
                        <button onClick={() => setHeaderRow(realRow)} className="hover:text-gold">{realRow}</button>
                      </td>
                      {Array.from({ length: numCols }).map((_, c) => (
                        <td key={c} className="p-1.5 border border-white/10 whitespace-nowrap max-w-[180px] truncate">
                          {row?.[c] == null ? "" : String(row[c])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 4: Mapping */}
      {aoa.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="text-sm font-medium">4) مطابقة الأعمدة</div>
          <p className="text-[11px] text-muted-foreground">تم اقتراح المطابقة تلقائيًا من صف العناوين. عدّلها إذا لزم.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {fieldDefs.map((f) => (
              <label key={f.key} className="text-xs space-y-1">
                <div className="flex items-center gap-1">
                  <span>{f.label}</span>
                  {f.required && <span className="text-red-300">*</span>}
                </div>
                <select
                  value={mapping[f.key] ?? -1}
                  onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs"
                >
                  <option value={-1}>— غير مطابق —</option>
                  {Array.from({ length: numCols }).map((_, i) => (
                    <option key={i} value={i}>
                      {colLabel(i)} — {headers[i] == null || String(headers[i]).trim() === "" ? "(فارغ)" : String(headers[i])}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {missingRequired.length > 0 && (
            <div className="text-[11px] text-red-300 flex items-center gap-1">
              <AlertTriangle size={12} /> الأعمدة المطلوبة غير محددة: {missingRequired.join(" · ")}
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-center pt-1">
            <button
              onClick={parsePreview}
              disabled={loading || missingRequired.length > 0}
              className="px-3 py-1.5 rounded bg-gold/15 border border-gold/30 text-gold text-xs hover:bg-gold/25 disabled:opacity-40"
            >
              معاينة البيانات
            </button>
            <span className="text-[11px] text-muted-foreground">سيتم تجاهل الصفوف الفارغة تلقائيًا.</span>
          </div>
        </div>
      )}

      {/* Options */}
      {parsed.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="text-sm font-medium">خيارات الاستيراد</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <label className="flex items-center gap-2"><input type="checkbox" checked={createSources} onChange={(e) => setCreateSources(e.target.checked)} /> إنشاء مصادر دخل جديدة</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={createSuppliers} onChange={(e) => setCreateSuppliers(e.target.checked)} /> إنشاء موردين جدد</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={createCats} onChange={(e) => setCreateCats(e.target.checked)} /> إنشاء تصنيفات جديدة</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} /> تخطي المكررات</label>
          </div>
        </div>
      )}

      {/* Preview */}
      {parsed.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm font-medium">معاينة ({parsed.length} صف)</div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">جاهز {stats.ready}</span>
              <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30">خطأ {stats.errors}</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">مكرر {stats.dupes}</span>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/5 sticky top-0">
                <tr className="text-right">
                  <th className="p-2">#</th>
                  <th className="p-2">الحالة</th>
                  <th className="p-2">التاريخ</th>
                  <th className="p-2">المبلغ</th>
                  {importType === "incomes" ? (
                    <th className="p-2">المصدر</th>
                  ) : (
                    <>
                      <th className="p-2">البيان</th>
                      <th className="p-2">المورد</th>
                      <th className="p-2">التصنيف</th>
                    </>
                  )}
                  <th className="p-2">نوع الحساب</th>
                  <th className="p-2">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 500).map((r, i) => (
                  <tr key={i} className="border-t border-white/5 align-top">
                    <td className="p-2 text-muted-foreground">{r.rowNo}</td>
                    <td className="p-2">
                      {r.errors.length ? (
                        <span className="inline-flex items-center gap-1 text-red-300"><XCircle size={12} /> خطأ</span>
                      ) : r.duplicate ? (
                        <span className="inline-flex items-center gap-1 text-amber-300"><CopyIcon size={12} /> مكرر</span>
                      ) : r.warnings.length ? (
                        <span className="inline-flex items-center gap-1 text-amber-300"><AlertTriangle size={12} /> تحذير</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 size={12} /> جاهز</span>
                      )}
                    </td>
                    <td className="p-2">{r.date ?? "—"}</td>
                    <td className="p-2">{r.amount ?? "—"}</td>
                    {importType === "incomes" ? (
                      <td className="p-2">{r.source_name ?? "—"} {r.newSource && <span className="text-[10px] text-amber-300">(جديد)</span>}</td>
                    ) : (
                      <>
                        <td className="p-2">{r.item_name ?? "—"}</td>
                        <td className="p-2">{r.supplier_name ?? "—"} {r.newSupplier && <span className="text-[10px] text-amber-300">(جديد)</span>}</td>
                        <td className="p-2">{r.main_category_name ?? "—"}{r.sub_category_name ? ` / ${r.sub_category_name}` : ""}</td>
                      </>
                    )}
                    <td className="p-2">{r.account_type ?? "—"}</td>
                    <td className="p-2 text-[10px] text-muted-foreground">{[...r.errors, ...r.warnings].join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.length > 500 && <div className="text-[10px] text-muted-foreground p-2">عرض أول 500 صف فقط في المعاينة. سيتم استيراد الكل.</div>}
          </div>
          <div className="flex justify-end">
            <button
              disabled={importing || stats.ready === 0}
              onClick={runImport}
              className="px-4 py-2 rounded bg-gold/20 border border-gold/40 text-gold text-xs hover:bg-gold/30 disabled:opacity-40"
            >
              {importing ? <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> جاري الاستيراد…</span> : `تأكيد الاستيراد (${stats.ready})`}
            </button>
          </div>
        </div>
      )}

      {/* Logs */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="text-sm font-medium">سجل الاستيراد</div>
        {logs.length === 0 ? (
          <div className="text-xs text-muted-foreground">لا يوجد سجل بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/5">
                <tr className="text-right">
                  <th className="p-2">التاريخ</th>
                  <th className="p-2">النوع</th>
                  <th className="p-2">الملف</th>
                  <th className="p-2">الشيت</th>
                  <th className="p-2">الكل</th>
                  <th className="p-2">مستورد</th>
                  <th className="p-2">متخطى</th>
                  <th className="p-2">أخطاء</th>
                  <th className="p-2">مكررات</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-white/5">
                    <td className="p-2">{new Date(l.created_at).toLocaleString("ar-SA")}</td>
                    <td className="p-2">{l.import_type === "incomes" ? "دخل" : "مصروفات"}</td>
                    <td className="p-2">{l.file_name}</td>
                    <td className="p-2">{l.sheet_name ?? "—"}</td>
                    <td className="p-2">{l.total_rows}</td>
                    <td className="p-2 text-emerald-300">{l.imported_rows}</td>
                    <td className="p-2 text-amber-300">{l.skipped_rows}</td>
                    <td className="p-2 text-red-300">{l.error_rows}</td>
                    <td className="p-2">{l.duplicate_rows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
