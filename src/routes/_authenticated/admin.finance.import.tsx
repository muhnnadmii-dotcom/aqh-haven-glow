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

type RawRow = Record<string, any>;

type ParsedRow = {
  rowNo: number;
  raw: RawRow;
  // normalized
  date: string | null;
  amount: number | null;
  month: string | null;
  account_type: "business" | "personal" | null;
  internal_review_status: "reviewed" | "unreviewed";
  note: string | null;
  // income
  source_name?: string | null;
  source_id?: string | null;
  // expense
  item_name?: string | null;
  supplier_name?: string | null;
  supplier_id?: string | null;
  main_category_name?: string | null;
  sub_category_name?: string | null;
  main_category_id?: string | null;
  sub_category_id?: string | null;
  attachment_status?: "attached" | "not_attached" | "not_required";
  // flags
  errors: string[];
  warnings: string[];
  duplicate: boolean;
  newSource?: boolean;
  newSupplier?: boolean;
  newMain?: boolean;
  newSub?: boolean;
};

const INCOME_COL_MAP: Record<string, string[]> = {
  date: ["date", "التاريخ", "تاريخ"],
  amount: ["amount", "المبلغ", "مبلغ", "value"],
  source: ["source", "المصدر", "مصدر"],
  month: ["month", "الشهر"],
  account_type: ["account type", "account_type", "نوع الحساب", "الحساب"],
  confirmed: ["confirmed", "مؤكد", "status"],
  note: ["note", "ملاحظة", "ملاحظات", "notes"],
};

const EXPENSE_COL_MAP: Record<string, string[]> = {
  date: ["date", "التاريخ", "تاريخ"],
  amount: ["amount", "المبلغ", "مبلغ"],
  item: ["item", "name", "البيان", "الشيء", "الصنف", "description", "وصف"],
  vendor: ["vendor", "supplier", "المورد", "البائع"],
  category: ["category", "التصنيف", "main category", "التصنيف الرئيسي"],
  sub: ["sub-category", "sub_category", "subcategory", "التصنيف الفرعي", "فرعي"],
  month: ["month", "الشهر"],
  invoice: ["invoice", "فاتورة", "حالة الفاتورة"],
  reason: ["reason", "note", "السبب", "ملاحظة", "ملاحظات"],
  account_type: ["account type", "account_type", "نوع الحساب", "الحساب"],
  confirmed: ["confirmed", "مؤكد"],
  uploaded: ["uploaded", "مرفوع", "attached"],
};

function findCol(headers: string[], aliases: string[]): string | null {
  const norm = (s: string) => s.toString().trim().toLowerCase();
  for (const a of aliases) {
    const m = headers.find((h) => norm(h) === norm(a));
    if (m) return m;
  }
  for (const a of aliases) {
    const m = headers.find((h) => norm(h).includes(norm(a)));
    if (m) return m;
  }
  return null;
}

function parseDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // Excel serial
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const mm = String(d.m).padStart(2, "0");
    const dd = String(d.d).padStart(2, "0");
    return `${d.y}-${mm}-${dd}`;
  }
  const s = String(v).trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dmy = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/.exec(s);
  if (dmy) {
    let y = dmy[3];
    if (y.length === 2) y = "20" + y;
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
  const [skipErrors, setSkipErrors] = useState(true);

  // logs
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

  const onFile = async (f: File) => {
    setFile(f);
    setParsed([]);
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

  const norm = (s?: string | null) => (s ?? "").toString().trim().toLowerCase();

  const parsePreview = () => {
    if (!wb || !sheetName) return;
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null, raw: true });
    if (!rows.length) {
      setParsed([]);
      toast.warning("الشيت فارغ");
      return;
    }
    const headers = Object.keys(rows[0]);
    const out: ParsedRow[] = [];

    if (importType === "incomes") {
      const c = {
        date: findCol(headers, INCOME_COL_MAP.date),
        amount: findCol(headers, INCOME_COL_MAP.amount),
        source: findCol(headers, INCOME_COL_MAP.source),
        month: findCol(headers, INCOME_COL_MAP.month),
        account_type: findCol(headers, INCOME_COL_MAP.account_type),
        confirmed: findCol(headers, INCOME_COL_MAP.confirmed),
        note: findCol(headers, INCOME_COL_MAP.note),
      };
      rows.forEach((r, i) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        const date = c.date ? parseDate(r[c.date]) : null;
        if (!date) errors.push("تاريخ غير صالح");
        const amount = c.amount ? parseAmount(r[c.amount]) : null;
        if (amount == null || amount < 0) errors.push("مبلغ غير صالح");
        const acct = c.account_type ? parseAccountType(r[c.account_type]) : "business";
        if (!acct) errors.push("نوع حساب غير معروف");
        const month = (c.month && r[c.month]) ? String(r[c.month]).slice(0, 7) : date ? date.slice(0, 7) : null;
        const srcName = c.source ? (r[c.source] == null ? null : String(r[c.source]).trim()) : null;
        let source_id: string | null = null;
        let newSource = false;
        if (srcName) {
          const m = sources.find((s) => norm(s.name) === norm(srcName));
          if (m) source_id = m.id;
          else {
            newSource = true;
            warnings.push(`مصدر دخل جديد: ${srcName}`);
          }
        } else {
          errors.push("مصدر الدخل مفقود");
        }
        const note = c.note ? (r[c.note] == null ? null : String(r[c.note])) : null;
        const confirmed = c.confirmed ? parseBool(r[c.confirmed]) : false;
        const row: ParsedRow = {
          rowNo: i + 2,
          raw: r,
          date,
          amount,
          month,
          account_type: acct,
          internal_review_status: confirmed ? "reviewed" : "unreviewed",
          note,
          source_name: srcName,
          source_id,
          newSource,
          errors,
          warnings,
          duplicate: false,
        };
        // duplicate detection
        if (date && amount != null) {
          row.duplicate = existingIncomes.some(
            (e) =>
              e.income_date === date &&
              Number(e.amount) === amount &&
              (source_id ? e.income_source_id === source_id : true) &&
              e.account_type === acct &&
              norm(e.note) === norm(note),
          );
          if (row.duplicate) warnings.push("مكرر محتمل");
        }
        out.push(row);
      });
    } else {
      const c = {
        date: findCol(headers, EXPENSE_COL_MAP.date),
        amount: findCol(headers, EXPENSE_COL_MAP.amount),
        item: findCol(headers, EXPENSE_COL_MAP.item),
        vendor: findCol(headers, EXPENSE_COL_MAP.vendor),
        category: findCol(headers, EXPENSE_COL_MAP.category),
        sub: findCol(headers, EXPENSE_COL_MAP.sub),
        month: findCol(headers, EXPENSE_COL_MAP.month),
        invoice: findCol(headers, EXPENSE_COL_MAP.invoice),
        reason: findCol(headers, EXPENSE_COL_MAP.reason),
        account_type: findCol(headers, EXPENSE_COL_MAP.account_type),
        confirmed: findCol(headers, EXPENSE_COL_MAP.confirmed),
        uploaded: findCol(headers, EXPENSE_COL_MAP.uploaded),
      };
      rows.forEach((r, i) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        const date = c.date ? parseDate(r[c.date]) : null;
        if (!date) errors.push("تاريخ غير صالح");
        const amount = c.amount ? parseAmount(r[c.amount]) : null;
        if (amount == null || amount < 0) errors.push("مبلغ غير صالح");
        const acct = c.account_type ? parseAccountType(r[c.account_type]) : "business";
        if (!acct) errors.push("نوع حساب غير معروف");
        const month = (c.month && r[c.month]) ? String(r[c.month]).slice(0, 7) : date ? date.slice(0, 7) : null;
        const item = c.item ? (r[c.item] == null ? null : String(r[c.item]).trim()) : null;
        if (!item) errors.push("اسم الصنف/البيان مفقود");
        const vendor = c.vendor ? (r[c.vendor] == null ? null : String(r[c.vendor]).trim()) : null;
        let supplier_id: string | null = null;
        let newSupplier = false;
        if (vendor) {
          const m = suppliers.find((s) => norm(s.name) === norm(vendor));
          if (m) supplier_id = m.id;
          else {
            newSupplier = true;
            warnings.push(`مورد جديد: ${vendor}`);
          }
        }
        const catName = c.category ? (r[c.category] == null ? null : String(r[c.category]).trim()) : null;
        let main_category_id: string | null = null;
        let newMain = false;
        if (catName) {
          const m = mainCats.find((x) => norm(x.name) === norm(catName));
          if (m) main_category_id = m.id;
          else {
            if (createCats) {
              newMain = true;
              warnings.push(`تصنيف رئيسي جديد: ${catName}`);
            } else {
              errors.push(`تصنيف رئيسي غير معروف: ${catName}`);
            }
          }
        }
        const subName = c.sub ? (r[c.sub] == null ? null : String(r[c.sub]).trim()) : null;
        let sub_category_id: string | null = null;
        let newSub = false;
        if (subName) {
          const m = subCats.find((x) => norm(x.name) === norm(subName) && (!main_category_id || x.parent_id === main_category_id));
          if (m) sub_category_id = m.id;
          else if (createCats) {
            newSub = true;
            warnings.push(`تصنيف فرعي جديد: ${subName}`);
          } else {
            warnings.push(`تصنيف فرعي غير معروف: ${subName}`);
          }
        }
        const reason = c.reason ? (r[c.reason] == null ? null : String(r[c.reason])) : null;
        const confirmed = c.confirmed ? parseBool(r[c.confirmed]) : false;
        const uploaded = c.uploaded ? parseBool(r[c.uploaded]) : false;
        const invoiceVal = c.invoice ? String(r[c.invoice] ?? "").toLowerCase().trim() : "";
        const notRequired = /not required|no invoice|بدون فاتورة|لا يحتاج/.test(invoiceVal);
        let attachment_status: "attached" | "not_attached" | "not_required" = "not_attached";
        if (notRequired) attachment_status = "not_required";
        if (uploaded && !notRequired) warnings.push("الملف القديم كان مرفوع، لكن لا يوجد مرفق فعلي في النظام");
        const row: ParsedRow = {
          rowNo: i + 2,
          raw: r,
          date,
          amount,
          month,
          account_type: acct,
          internal_review_status: confirmed ? "reviewed" : "unreviewed",
          note: reason,
          item_name: item,
          supplier_name: vendor,
          supplier_id,
          main_category_name: catName,
          sub_category_name: subName,
          main_category_id,
          sub_category_id,
          attachment_status,
          newSupplier,
          newMain,
          newSub,
          errors,
          warnings,
          duplicate: false,
        };
        if (date && amount != null && item) {
          row.duplicate = existingExpenses.some(
            (e) =>
              e.expense_date === date &&
              Number(e.amount) === amount &&
              norm(e.item_name) === norm(item) &&
              e.account_type === acct &&
              (supplier_id ? e.supplier_id === supplier_id : norm(e.supplier_name) === norm(vendor)) &&
              (main_category_id ? e.main_category_id === main_category_id : true),
          );
          if (row.duplicate) warnings.push("مكرر محتمل");
        }
        out.push(row);
      });
    }
    setParsed(out);
    toast.success(`تم قراءة ${out.length} صف`);
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

    // working copies (so multiple rows referencing same new name reuse the created row)
    const srcMap = new Map(sources.map((s) => [norm(s.name), s.id]));
    const supMap = new Map(suppliers.map((s) => [norm(s.name), s.id]));
    const mainMap = new Map(mainCats.map((s) => [norm(s.name), s.id]));
    const subMap = new Map(subCats.map((s) => [`${s.parent_id}|${norm(s.name)}`, s.id]));

    for (const r of parsed) {
      if (r.errors.length) { skipped++; continue; }
      if (skipDuplicates && r.duplicate) { skipped++; continue; }
      try {
        if (importType === "incomes") {
          let source_id = r.source_id;
          if (!source_id && r.source_name) {
            const key = norm(r.source_name);
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
            income_date: r.date!,
            amount: r.amount!,
            income_source_id: source_id,
            month: r.month!,
            account_type: r.account_type!,
            internal_review_status: r.internal_review_status,
            accountant_status: "not_reviewed",
            attachment_status: "not_attached",
            note: r.note,
            created_by: uid,
            import_batch_id: batchId,
          });
          if (error) throw error;
        } else {
          let supplier_id = r.supplier_id;
          if (!supplier_id && r.supplier_name && createSuppliers) {
            const key = norm(r.supplier_name);
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
            const key = norm(r.main_category_name);
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
            const key = `${main_id}|${norm(r.sub_category_name)}`;
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
            expense_date: r.date!,
            amount: r.amount!,
            item_name: r.item_name!,
            supplier_id,
            supplier_name: supplier_id ? null : r.supplier_name,
            main_category_id: main_id,
            sub_category_id: sub_id,
            month: r.month!,
            account_type: r.account_type!,
            internal_review_status: r.internal_review_status,
            accountant_status: "not_reviewed",
            attachment_status: r.attachment_status ?? "not_attached",
            note: r.note,
            created_by: uid,
            import_batch_id: batchId,
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
      summary_json: { batch_id: batchId, created, errors: errorsList.slice(0, 50) } as any,
    });

    setImporting(false);
    toast.success(`تم استيراد ${imported} صف · تم تخطي ${skipped}`);
    setParsed([]);
    setFile(null);
    setWb(null);
    reloadLogs();
  };

  if (roles.loading) return <div className="text-sm text-muted-foreground">…</div>;
  if (!canImport) return <div className="text-sm text-muted-foreground">لا تملك صلاحية الاستيراد. يتطلب admin أو finance_manage.</div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">استيراد البيانات</h2>
        <p className="text-xs text-muted-foreground">رفع ملف Excel قديم لاستيراد الدخل أو المصروفات. لن يتم الحفظ قبل المعاينة والتأكيد.</p>
      </div>

      {/* Step 1: file */}
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

      {/* Step 2+3 */}
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
            <div className="flex items-end">
              <button onClick={parsePreview} disabled={loading} className="w-full px-3 py-1.5 rounded bg-gold/15 border border-gold/30 text-gold text-xs hover:bg-gold/25">
                قراءة ومعاينة
              </button>
            </div>
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
            <label className="flex items-center gap-2"><input type="checkbox" checked={skipErrors} onChange={(e) => setSkipErrors(e.target.checked)} /> تخطي الصفوف فيها أخطاء</label>
          </div>
          <button onClick={() => parsePreview()} className="text-[11px] text-gold hover:underline">إعادة التحقق</button>
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
