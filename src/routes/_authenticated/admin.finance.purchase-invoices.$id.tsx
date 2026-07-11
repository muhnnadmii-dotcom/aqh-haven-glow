import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, Loader2, Plus, Trash2, XCircle, Link2, AlertTriangle, User } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { AttachmentsPanel } from "@/components/finance/AttachmentsPanel";
import { CreditDebitNotesPanel } from "@/components/finance/CreditDebitNotesPanel";
import {
  PURCHASE_TYPE_LABEL,
  PURCHASE_STATUS_LABEL,
  PURCHASE_STATUS_CLASS,
  PURCHASE_PAY_LABEL,
  VAT_DEDUCTIBILITY_LABEL,
  NON_DEDUCTIBLE_REASON_LABEL,
  PAYMENT_TYPE_LABEL,
  SAR,
} from "@/lib/finance/purchase-constants";

export const Route = createFileRoute("/_authenticated/admin/finance/purchase-invoices/$id")({
  ssr: false,
  component: PurchaseInvoiceEditor,
});

const TAX_LABEL: Record<string, string> = {
  standard_15: "قياسية 15%", zero_rated: "معدل صفري", exempt: "معفاة", out_of_scope: "خارج النطاق",
};

type Item = {
  id?: number;
  purchase_invoice_id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  expense_category_id?: string | null;
  product_id?: number | null;
  tax_code: string;
  tax_rate?: number;
  line_subtotal?: number;
  line_tax_amount?: number;
  line_total?: number;
  sort_order: number;
};

function PurchaseInvoiceEditor() {
  const { id } = Route.useParams();
  const invoiceId = Number(id);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["purchase_invoice", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_invoices" as any).select("*").eq("id", invoiceId).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ["purchase_invoice_items", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_invoice_items" as any).select("*")
        .eq("purchase_invoice_id", invoiceId).order("sort_order").order("id");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: linkedPayments = [], refetch: refetchLinked } = useQuery({
    queryKey: ["purchase_invoice_payments", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_expenses")
        .select("id, expense_date, amount, account_type, note, payment_type, business_relation, account_id, deleted_at")
        .eq("purchase_invoice_id", invoiceId)
        .is("deleted_at", null)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["finance_suppliers_min"],
    queryFn: async () => (await supabase.from("finance_suppliers").select("id, name").eq("is_active", true).order("name")).data as any[],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["finance_categories_min"],
    queryFn: async () => (await supabase.from("finance_categories").select("id, name, kind, parent_id").eq("is_active", true).order("display_order")).data as any[],
  });

  const [header, setHeader] = useState<any>(null);
  useEffect(() => { if (invoice) setHeader({ ...invoice }); }, [invoice]);

  const [rows, setRows] = useState<Item[]>([]);
  useEffect(() => { setRows(items as any[]); }, [items]);

  const isDraft = header?.status === "draft";
  const canEdit = header?.status === "draft" || header?.status === "under_review" || header?.status === "rejected";
  const isRejected = header?.status === "rejected";

  const saveHeader = useMutation({
    mutationFn: async () => {
      const payload: any = {
        supplier_id: header.supplier_id || null,
        supplier_invoice_number: header.supplier_invoice_number || null,
        issue_date: header.issue_date,
        supply_date: header.supply_date || null,
        due_date: header.due_date || null,
        purchase_type: header.purchase_type,
        vat_deductibility: header.vat_deductibility,
        deductible_percentage: header.vat_deductibility === "partially_deductible" ? Number(header.deductible_percentage || 0) : 100,
        non_deductible_reason: header.vat_deductibility === "non_deductible" ? header.non_deductible_reason : null,
        reviewer_note: header.reviewer_note || null,
        attachment_required: !!header.attachment_required,
        attachment_exception_reason: header.attachment_exception_reason || null,
        paid_from_personal_account: !!header.paid_from_personal_account,
        duplicate_override_reason: header.duplicate_override_reason || null,
        notes: header.notes || null,
        internal_notes: header.internal_notes || null,
      };
      const { error } = await supabase.from("purchase_invoices" as any).update(payload).eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حفظ بيانات الفاتورة"); qc.invalidateQueries({ queryKey: ["purchase_invoice", invoiceId] }); qc.invalidateQueries({ queryKey: ["purchase_invoices"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveItems = useMutation({
    mutationFn: async () => {
      for (const r of rows) {
        const payload: any = {
          purchase_invoice_id: invoiceId,
          description: r.description || "بند",
          quantity: Number(r.quantity || 0),
          unit_price: Number(r.unit_price || 0),
          discount_amount: Number(r.discount_amount || 0),
          expense_category_id: r.expense_category_id ?? null,
          tax_code: r.tax_code,
          sort_order: r.sort_order ?? 0,
        };
        if (r.id) {
          const { error } = await supabase.from("purchase_invoice_items" as any).update(payload).eq("id", r.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("purchase_invoice_items" as any).insert(payload);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => { toast.success("تم حفظ البنود"); refetchItems(); qc.invalidateQueries({ queryKey: ["purchase_invoice", invoiceId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeItem = async (row: Item, idx: number) => {
    if (!row.id) { setRows((rs) => rs.filter((_, i) => i !== idx)); return; }
    if (!confirm("حذف هذا البند؟")) return;
    const { error } = await supabase.from("purchase_invoice_items" as any).delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    refetchItems();
    qc.invalidateQueries({ queryKey: ["purchase_invoice", invoiceId] });
  };

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      // Save header + items first
      await saveHeader.mutateAsync();
      if (rows.some(r => !r.id)) await saveItems.mutateAsync();
      const { error } = await supabase.from("purchase_invoices" as any).update({ status } as any).eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم تحديث الحالة"); qc.invalidateQueries({ queryKey: ["purchase_invoice", invoiceId] }); qc.invalidateQueries({ queryKey: ["purchase_invoices"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: async () => {
      await saveHeader.mutateAsync();
      if (rows.some(r => !r.id)) await saveItems.mutateAsync();
      const { data, error } = await supabase.rpc("approve_purchase_invoice" as any, { p_invoice_id: invoiceId } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("تم اعتماد الفاتورة"); qc.invalidateQueries({ queryKey: ["purchase_invoice", invoiceId] }); qc.invalidateQueries({ queryKey: ["purchase_invoices"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDraft = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("purchase_invoices" as any).delete().eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حذف الفاتورة"); navigate({ to: "/admin/finance/purchase-invoices" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  if (isLoading || !header) {
    return <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline ml-2" />جاري التحميل...</div>;
  }

  const canApprove = header.status === "draft" || header.status === "under_review" || header.status === "rejected";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/admin/finance/purchase-invoices" className="text-muted-foreground hover:text-foreground"><ArrowRight className="w-5 h-5" /></Link>
          <div>
            <div className="text-[11px] tracking-[0.3em] text-gold/80 uppercase">Purchase Invoice</div>
            <h2 className="text-lg font-semibold mt-1 font-mono">{header.internal_reference}</h2>
          </div>
          <Badge variant="outline" className={PURCHASE_STATUS_CLASS[header.status] ?? ""}>{PURCHASE_STATUS_LABEL[header.status] ?? header.status}</Badge>
          {header.paid_from_personal_account && (
            <Badge variant="outline" className="bg-amber-500/15 text-amber-300 border-amber-500/30"><User className="w-3 h-3 ml-1" />من حساب شخصي</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => saveHeader.mutate()} disabled={saveHeader.isPending}>حفظ البيانات</Button>
              <Button variant="outline" onClick={() => saveItems.mutate()} disabled={saveItems.isPending}>حفظ البنود</Button>
              {isDraft && (
                <Button variant="outline" onClick={() => setStatus.mutate("under_review")} disabled={setStatus.isPending} className="text-amber-300 border-amber-500/30">
                  إرسال للمراجعة
                </Button>
              )}
              <Button onClick={() => approve.mutate()} disabled={approve.isPending || rows.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {approve.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle2 className="w-4 h-4 ml-1" />}
                اعتماد
              </Button>
              {!isRejected && (
                <Button variant="outline" onClick={() => { if (confirm("رفض الفاتورة؟")) setStatus.mutate("rejected"); }} className="text-red-300 border-red-500/30">
                  <XCircle className="w-4 h-4 ml-1" />رفض
                </Button>
              )}
              {(isDraft || isRejected) && (
                <Button variant="outline" onClick={() => { if (confirm("حذف الفاتورة نهائيًا؟")) deleteDraft.mutate(); }} className="text-red-300 border-red-500/30">
                  <Trash2 className="w-4 h-4 ml-1" />حذف
                </Button>
              )}
            </>
          )}
          {!canEdit && (
            <>
              <Button variant="outline" onClick={() => setShowPayModal(true)}><Plus className="w-4 h-4 ml-1" />تسجيل دفعة</Button>
              <Button variant="outline" onClick={() => setShowLinkModal(true)}><Link2 className="w-4 h-4 ml-1" />ربط دفعة موجودة</Button>
            </>
          )}
        </div>
      </div>

      {/* Header form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl bg-white/5 border border-white/10 p-4">
        <Field label="المورد">
          <select value={header.supplier_id ?? ""} onChange={(e) => setHeader({ ...header, supplier_id: e.target.value || null })} disabled={!canEdit} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
            <option value="">— بدون مورد —</option>
            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="رقم فاتورة المورد">
          <Input value={header.supplier_invoice_number ?? ""} disabled={!canEdit} onChange={(e) => setHeader({ ...header, supplier_invoice_number: e.target.value })} className="bg-black/40 border-white/10" />
        </Field>
        <Field label="نوع المشتريات">
          <select value={header.purchase_type} onChange={(e) => setHeader({ ...header, purchase_type: e.target.value })} disabled={!canEdit} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
            {Object.entries(PURCHASE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="تاريخ الإصدار">
          <Input type="date" value={header.issue_date ?? ""} disabled={!canEdit} onChange={(e) => setHeader({ ...header, issue_date: e.target.value })} className="bg-black/40 border-white/10" />
        </Field>
        <Field label="تاريخ التوريد">
          <Input type="date" value={header.supply_date ?? ""} disabled={!canEdit} onChange={(e) => setHeader({ ...header, supply_date: e.target.value })} className="bg-black/40 border-white/10" />
        </Field>
        <Field label="تاريخ الاستحقاق">
          <Input type="date" value={header.due_date ?? ""} onChange={(e) => setHeader({ ...header, due_date: e.target.value })} className="bg-black/40 border-white/10" />
        </Field>

        <Field label="قابلية خصم الضريبة">
          <select value={header.vat_deductibility} onChange={(e) => setHeader({ ...header, vat_deductibility: e.target.value })} disabled={!canEdit} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
            {Object.entries(VAT_DEDUCTIBILITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        {header.vat_deductibility === "partially_deductible" && (
          <Field label="نسبة الخصم %">
            <Input type="number" min={0} max={100} step="0.01" value={header.deductible_percentage ?? 0} disabled={!canEdit} onChange={(e) => setHeader({ ...header, deductible_percentage: Number(e.target.value) })} className="bg-black/40 border-white/10" />
          </Field>
        )}
        {header.vat_deductibility === "non_deductible" && (
          <Field label="سبب عدم الخصم">
            <select value={header.non_deductible_reason ?? ""} onChange={(e) => setHeader({ ...header, non_deductible_reason: e.target.value || null })} disabled={!canEdit} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
              <option value="">— اختر —</option>
              {Object.entries(NON_DEDUCTIBLE_REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        )}

        <Field label="مدفوعة من حساب شخصي">
          <label className="inline-flex items-center gap-2 text-sm bg-black/40 border border-white/10 rounded-md px-2 py-1.5 cursor-pointer">
            <input type="checkbox" checked={!!header.paid_from_personal_account} disabled={!canEdit} onChange={(e) => setHeader({ ...header, paid_from_personal_account: e.target.checked })} />
            نعم — مدفوعة من حساب المالك الشخصي للنشاط
          </label>
        </Field>
        <Field label="مرفق مطلوب">
          <label className="inline-flex items-center gap-2 text-sm bg-black/40 border border-white/10 rounded-md px-2 py-1.5 cursor-pointer">
            <input type="checkbox" checked={!!header.attachment_required} disabled={!canEdit} onChange={(e) => setHeader({ ...header, attachment_required: e.target.checked })} />
            المرفق إلزامي
          </label>
        </Field>
        {header.attachment_required && (
          <Field label="سبب استثناء المرفق (إن وجد)">
            <Input value={header.attachment_exception_reason ?? ""} disabled={!canEdit} onChange={(e) => setHeader({ ...header, attachment_exception_reason: e.target.value })} className="bg-black/40 border-white/10" />
          </Field>
        )}

        <Field label="سبب تجاوز تكرار الرقم (للمدير)">
          <Input value={header.duplicate_override_reason ?? ""} disabled={!canEdit} onChange={(e) => setHeader({ ...header, duplicate_override_reason: e.target.value })} className="bg-black/40 border-white/10" placeholder="اختياري — يستخدم عند تكرار رقم فاتورة المورد" />
        </Field>

        <Field label="ملاحظات المراجع">
          <Input value={header.reviewer_note ?? ""} disabled={!canEdit} onChange={(e) => setHeader({ ...header, reviewer_note: e.target.value })} className="bg-black/40 border-white/10" />
        </Field>
        <Field label="ملاحظات">
          <Input value={header.notes ?? ""} onChange={(e) => setHeader({ ...header, notes: e.target.value })} className="bg-black/40 border-white/10" />
        </Field>
        <Field label="ملاحظات داخلية">
          <Input value={header.internal_notes ?? ""} onChange={(e) => setHeader({ ...header, internal_notes: e.target.value })} className="bg-black/40 border-white/10" />
        </Field>
      </div>

      {/* Items */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">البنود</h3>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setRows((rs) => [...rs, { description: "", quantity: 1, unit_price: 0, discount_amount: 0, tax_code: "standard_15", sort_order: rs.length }])}>
              <Plus className="w-4 h-4 ml-1" />إضافة بند
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="text-right p-1 w-8">#</th>
                <th className="text-right p-1">الوصف</th>
                <th className="text-right p-1 w-32">تصنيف المصروف</th>
                <th className="text-right p-1 w-20">الكمية</th>
                <th className="text-right p-1 w-24">السعر</th>
                <th className="text-right p-1 w-24">الخصم</th>
                <th className="text-right p-1 w-32">الضريبة</th>
                <th className="text-right p-1 w-24">قبل الضريبة</th>
                <th className="text-right p-1 w-24">الإجمالي</th>
                {canEdit && <th className="w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">لا توجد بنود</td></tr>}
              {rows.map((r, i) => {
                const base = Number(r.quantity || 0) * Number(r.unit_price || 0);
                const sub = Math.max(base - Number(r.discount_amount || 0), 0);
                const rate = r.tax_code === "standard_15" ? 15 : 0;
                const tax = Math.round(sub * rate) / 100;
                return (
                  <tr key={r.id ?? `n${i}`} className="border-t border-white/5">
                    <td className="p-1 text-muted-foreground">{i + 1}</td>
                    <td className="p-1"><Input value={r.description} disabled={!canEdit} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} className="bg-black/40 border-white/10 h-8" /></td>
                    <td className="p-1">
                      <select value={r.expense_category_id ?? ""} disabled={!canEdit} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, expense_category_id: e.target.value || null } : x))} className="w-full bg-black/40 border border-white/10 rounded-md px-1 py-1 text-xs h-8">
                        <option value="">—</option>
                        {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className="p-1"><Input type="number" step="0.001" value={r.quantity} disabled={!canEdit} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} className="bg-black/40 border-white/10 h-8" /></td>
                    <td className="p-1"><Input type="number" step="0.01" value={r.unit_price} disabled={!canEdit} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, unit_price: Number(e.target.value) } : x))} className="bg-black/40 border-white/10 h-8" /></td>
                    <td className="p-1"><Input type="number" step="0.01" value={r.discount_amount} disabled={!canEdit} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, discount_amount: Number(e.target.value) } : x))} className="bg-black/40 border-white/10 h-8" /></td>
                    <td className="p-1">
                      <select value={r.tax_code} disabled={!canEdit} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, tax_code: e.target.value } : x))} className="w-full bg-black/40 border border-white/10 rounded-md px-1 py-1 text-xs h-8">
                        {Object.entries(TAX_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td className="p-1 text-muted-foreground">{SAR(sub)}</td>
                    <td className="p-1 font-semibold">{SAR(sub + tax)}</td>
                    {canEdit && <td className="p-1"><button onClick={() => removeItem(r, i)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
          <TotalCell label="قبل الخصم" value={SAR(header.subtotal)} />
          <TotalCell label="الخصم" value={SAR(header.discount_amount)} />
          <TotalCell label="القاعدة الضريبية" value={SAR(header.taxable_amount)} />
          <TotalCell label="الضريبة" value={SAR(header.vat_amount)} />
          <TotalCell label="القابل للخصم" value={SAR(header.deductible_vat_amount)} tone="blue" />
          <TotalCell label="الإجمالي" value={SAR(header.total_amount)} highlight />
        </div>
        {Number(header.non_deductible_vat_amount || 0) > 0 && (
          <div className="mt-2 text-xs text-amber-300 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            ضريبة غير قابلة للخصم: {SAR(header.non_deductible_vat_amount)}
          </div>
        )}
      </div>

      {/* Payment status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="إجمالي الفاتورة" value={SAR(header.total_amount)} />
        <StatCard label="المدفوع" value={SAR(header.paid_amount)} tone="emerald" />
        <StatCard label="المتبقي" value={SAR(header.remaining_amount)} tone="amber" />
      </div>

      {/* Linked payments */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <h3 className="font-semibold mb-3">الدفعات المرتبطة</h3>
        {linkedPayments.length === 0 ? (
          <div className="text-muted-foreground text-sm">لا توجد دفعات مرتبطة بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-right p-1">التاريخ</th>
                  <th className="text-right p-1">النوع</th>
                  <th className="text-right p-1">الحساب</th>
                  <th className="text-right p-1">المبلغ</th>
                  <th className="text-right p-1">ملاحظات</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {linkedPayments.map((c: any) => (
                  <tr key={c.id} className="border-t border-white/5">
                    <td className="p-1 whitespace-nowrap">{c.expense_date}</td>
                    <td className="p-1 text-xs">{PAYMENT_TYPE_LABEL[c.payment_type] ?? c.payment_type ?? "—"}</td>
                    <td className="p-1">{c.account_type}</td>
                    <td className="p-1 font-semibold text-red-300">{SAR(c.amount)}</td>
                    <td className="p-1 text-muted-foreground">{c.note ?? ""}</td>
                    <td className="p-1">
                      <button className="text-red-400 hover:text-red-300" onClick={async () => {
                        if (!confirm("فك ربط هذه الدفعة عن الفاتورة؟")) return;
                        const { error } = await supabase.from("finance_expenses").update({ purchase_invoice_id: null, payment_type: "direct_expense" as any } as any).eq("id", c.id);
                        if (error) return toast.error(error.message);
                        refetchLinked(); qc.invalidateQueries({ queryKey: ["purchase_invoice", invoiceId] });
                      }}><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attachments */}
      <AttachmentsPanel relatedType="purchase_invoice" relatedId={String(invoiceId)} canManage={canEdit} />

      {/* Credit & Debit Notes */}
      {!canEdit && header.status !== "cancelled" && (
        <CreditDebitNotesPanel
          invoiceId={invoiceId}
          invoiceKind="purchase"
          partyId={header.supplier_id ?? null}
          invoiceTotal={Number(header.total_amount ?? 0)}
        />
      )}

      {showLinkModal && (
        <LinkPaymentModal invoiceId={invoiceId} supplierId={header.supplier_id} onClose={() => setShowLinkModal(false)} onDone={() => { setShowLinkModal(false); refetchLinked(); qc.invalidateQueries({ queryKey: ["purchase_invoice", invoiceId] }); }} />
      )}
      {showPayModal && (
        <RecordPaymentModal invoice={header} onClose={() => setShowPayModal(false)} onDone={() => { setShowPayModal(false); refetchLinked(); qc.invalidateQueries({ queryKey: ["purchase_invoice", invoiceId] }); }} />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
function TotalCell({ label, value, highlight, tone }: { label: string; value: string; highlight?: boolean; tone?: "blue" }) {
  const t = tone === "blue" ? "text-blue-300" : "";
  return (
    <div className={`rounded-lg border p-2 ${highlight ? "border-gold/40 bg-gold/10 text-gold" : "border-white/10 bg-black/30"}`}>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`font-semibold ${highlight ? "text-gold" : t}`}>{value}</div>
    </div>
  );
}
function StatCard({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
  const t = tone === "emerald" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : "";
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${t}`}>{value}</div>
    </div>
  );
}

function LinkPaymentModal({ invoiceId, supplierId, onClose, onDone }: { invoiceId: number; supplierId: string | null; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState("");
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["purchase_link_candidates", supplierId],
    queryFn: async () => {
      let query = supabase
        .from("finance_expenses")
        .select("id, expense_date, amount, account_type, note, supplier_id, purchase_invoice_id")
        .is("deleted_at", null)
        .is("purchase_invoice_id", null)
        .order("expense_date", { ascending: false })
        .limit(300);
      if (supplierId) query = query.eq("supplier_id", supplierId);
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });
  const link = async (row: any) => {
    const { error } = await supabase.from("finance_expenses").update({
      purchase_invoice_id: invoiceId,
      payment_type: "supplier_invoice_payment" as any,
      transaction_type: "supplier_invoice_payment" as any,
      business_relation: "business" as any,
    } as any).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("تم ربط الدفعة");
    onDone();
  };
  const filtered = candidates.filter((r) => !q || (r.note ?? "").toLowerCase().includes(q.toLowerCase()) || String(r.amount).includes(q));
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background border border-white/10 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold">ربط دفعة موجودة بالفاتورة</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="p-3 border-b border-white/10">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث..." className="bg-black/40 border-white/10" />
          {supplierId ? <div className="text-xs text-muted-foreground mt-2">تعرض المدفوعات غير المرتبطة لهذا المورد فقط.</div>
            : <div className="text-xs text-amber-300 mt-2">لم يتم تحديد مورد — يتم عرض جميع المدفوعات غير المرتبطة.</div>}
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {isLoading && <div className="p-4 text-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline ml-2" />جاري التحميل...</div>}
          {!isLoading && filtered.length === 0 && <div className="p-6 text-center text-muted-foreground">لا توجد مدفوعات مؤهلة</div>}
          {filtered.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded">
              <div>
                <div className="font-semibold text-red-300">{SAR(r.amount)}</div>
                <div className="text-xs text-muted-foreground">{r.expense_date} · {r.account_type} · {r.note ?? ""}</div>
              </div>
              <Button size="sm" onClick={() => link(r)}>ربط</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecordPaymentModal({ invoice, onClose, onDone }: { invoice: any; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState<number>(Number(invoice.remaining_amount || 0));
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [account, setAccount] = useState<string>(invoice.paid_from_personal_account ? "personal" : "business");
  const [note, setNote] = useState<string>("");
  const [pending, setPending] = useState(false);

  const save = async () => {
    if (!amount || amount <= 0) return toast.error("أدخل مبلغًا صحيحًا");
    setPending(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        expense_date: date,
        amount,
        item_name: `دفعة فاتورة ${invoice.internal_reference}`,
        supplier_id: invoice.supplier_id,
        purchase_invoice_id: invoice.id,
        account_type: account,
        note: note || null,
        created_by: u.user?.id ?? null,
        payment_type: "supplier_invoice_payment",
        transaction_type: "supplier_invoice_payment",
        business_relation: "business",
        accounting_status: "operational",
      };
      const { error } = await supabase.from("finance_expenses").insert(payload);
      if (error) throw error;
      toast.success("تم تسجيل الدفعة");
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background border border-white/10 rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold">تسجيل دفعة</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="التاريخ"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-black/40 border-white/10" /></Field>
          <Field label="المبلغ"><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="bg-black/40 border-white/10" /></Field>
          <Field label="الحساب">
            <select value={account} onChange={(e) => setAccount(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
              <option value="business">حساب النشاط</option>
              <option value="personal">حساب شخصي</option>
            </select>
          </Field>
          <Field label="ملاحظة"><Input value={note} onChange={(e) => setNote(e.target.value)} className="bg-black/40 border-white/10" /></Field>
          {account === "personal" && (
            <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded p-2">
              الدفعة من حساب شخصي — ستُسجل كمستحق للمالك على المنشأة.
            </div>
          )}
        </div>
        <div className="p-3 border-t border-white/10 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={pending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {pending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle2 className="w-4 h-4 ml-1" />}
            حفظ الدفعة
          </Button>
        </div>
      </div>
    </div>
  );
}
