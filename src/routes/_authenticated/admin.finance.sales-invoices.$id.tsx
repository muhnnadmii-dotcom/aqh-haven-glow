import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, Loader2, Plus, Printer, Trash2, XCircle, Link2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { AttachmentsPanel } from "@/components/finance/AttachmentsPanel";

export const Route = createFileRoute("/_authenticated/admin/finance/sales-invoices/$id")({
  ssr: false,
  component: SalesInvoiceEditor,
});

const SAR = (n: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(Number(n) || 0);

const TAX_LABEL: Record<string, string> = {
  standard_15: "قياسية 15%", zero_rated: "معدل صفري", exempt: "معفاة", out_of_scope: "خارج النطاق",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة", approved: "معتمدة", partially_paid: "مدفوعة جزئيًا", paid: "مدفوعة", cancelled: "ملغاة",
};

type Item = {
  id?: number;
  invoice_id?: number;
  product_id?: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_code: string;
  tax_rate?: number;
  line_subtotal?: number;
  line_tax_amount?: number;
  line_total?: number;
  sort_order: number;
  _dirty?: boolean;
  _new?: boolean;
};

function SalesInvoiceEditor() {
  const { id } = Route.useParams();
  const invoiceId = Number(id);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["sales_invoice", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_invoices").select("*").eq("id", invoiceId).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ["sales_invoice_items", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_invoice_items").select("*")
        .eq("invoice_id", invoiceId).order("sort_order").order("id");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: linkedCollections = [], refetch: refetchLinked } = useQuery({
    queryKey: ["sales_invoice_collections", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_incomes")
        .select("id, income_date, amount, account_type, note, collection_type, deleted_at, account_id")
        .eq("sales_invoice_id", invoiceId)
        .is("deleted_at", null)
        .order("income_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["profiles_customers_min"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, phone, email").limit(2000)).data as any[],
  });

  const [header, setHeader] = useState<any>(null);
  useEffect(() => { if (invoice) setHeader({ ...invoice }); }, [invoice]);

  const [rows, setRows] = useState<Item[]>([]);
  useEffect(() => { setRows(items as any[]); }, [items]);

  const isDraft = header?.status === "draft";
  const isCancelled = header?.status === "cancelled";

  const totals = useMemo(() => {
    let subtotal = 0, discount = 0, taxable = 0, vat = 0, total = 0;
    rows.forEach((r) => {
      const base = Number(r.quantity || 0) * Number(r.unit_price || 0);
      const sub = Math.max(base - Number(r.discount_amount || 0), 0);
      const rate = r.tax_code === "standard_15" ? 15 : 0;
      const tax = Math.round(sub * rate) / 100;
      subtotal += base;
      discount += Number(r.discount_amount || 0);
      taxable += sub;
      vat += tax;
      total += sub + tax;
    });
    return { subtotal, discount, taxable, vat, total };
  }, [rows]);

  const saveHeader = useMutation({
    mutationFn: async () => {
      const payload = {
        customer_id: header.customer_id || null,
        order_id: header.order_id || null,
        issue_date: header.issue_date,
        supply_date: header.supply_date || null,
        due_date: header.due_date || null,
        notes: header.notes || null,
        internal_notes: header.internal_notes || null,
      };
      const { error } = await supabase.from("sales_invoices").update(payload).eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حفظ بيانات الفاتورة"); qc.invalidateQueries({ queryKey: ["sales_invoice", invoiceId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveItems = useMutation({
    mutationFn: async () => {
      // Persist current rows: existing → update, new → insert
      for (const r of rows) {
        const payload: any = {
          invoice_id: invoiceId,
          product_id: r.product_id ?? null,
          description: r.description || "بند",
          quantity: Number(r.quantity || 0),
          unit_price: Number(r.unit_price || 0),
          discount_amount: Number(r.discount_amount || 0),
          tax_code: r.tax_code,
          sort_order: r.sort_order ?? 0,
        };
        if (r.id) {
          const { error } = await supabase.from("sales_invoice_items").update(payload).eq("id", r.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("sales_invoice_items").insert(payload);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => { toast.success("تم حفظ البنود"); refetchItems(); qc.invalidateQueries({ queryKey: ["sales_invoice", invoiceId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeItem = async (row: Item, idx: number) => {
    if (!row.id) { setRows((rs) => rs.filter((_, i) => i !== idx)); return; }
    if (!confirm("حذف هذا البند؟")) return;
    const { error } = await supabase.from("sales_invoice_items").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    refetchItems();
    qc.invalidateQueries({ queryKey: ["sales_invoice", invoiceId] });
  };

  const approve = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("approve_sales_invoice", { p_invoice_id: invoiceId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("تم اعتماد الفاتورة"); qc.invalidateQueries({ queryKey: ["sales_invoice", invoiceId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelInvoice = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sales_invoices").update({ status: "cancelled" }).eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم إلغاء الفاتورة"); qc.invalidateQueries({ queryKey: ["sales_invoice", invoiceId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDraft = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sales_invoices").delete().eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حذف المسودة"); navigate({ to: "/admin/finance/sales-invoices" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const [showLinkModal, setShowLinkModal] = useState(false);

  if (isLoading || !header) {
    return <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline ml-2" />جاري التحميل...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/admin/finance/sales-invoices" className="text-muted-foreground hover:text-foreground"><ArrowRight className="w-5 h-5" /></Link>
          <div>
            <div className="text-[11px] tracking-[0.3em] text-gold/80 uppercase">Sales Invoice</div>
            <h2 className="text-lg font-semibold mt-1 font-mono">{header.invoice_number}</h2>
          </div>
          <Badge variant="outline" className="mr-2">{STATUS_LABEL[header.status] ?? header.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <>
              <Button variant="outline" onClick={() => saveHeader.mutate()} disabled={saveHeader.isPending}>حفظ البيانات</Button>
              <Button variant="outline" onClick={() => saveItems.mutate()} disabled={saveItems.isPending}>حفظ البنود</Button>
              <Button onClick={() => approve.mutate()} disabled={approve.isPending || rows.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {approve.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle2 className="w-4 h-4 ml-1" />}
                اعتماد
              </Button>
              <Button variant="outline" onClick={() => { if (confirm("حذف المسودة؟")) deleteDraft.mutate(); }} className="text-red-300 border-red-500/30">
                <Trash2 className="w-4 h-4 ml-1" />حذف
              </Button>
            </>
          )}
          {!isDraft && !isCancelled && (
            <>
              <Button variant="outline" onClick={() => setShowLinkModal(true)}><Link2 className="w-4 h-4 ml-1" />ربط تحصيل موجود</Button>
              <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 ml-1" />طباعة</Button>
              <Button variant="outline" onClick={() => { if (confirm("إلغاء الفاتورة؟ يمكن تصحيحها لاحقًا بإشعار.")) cancelInvoice.mutate(); }} className="text-red-300 border-red-500/30">
                <XCircle className="w-4 h-4 ml-1" />إلغاء
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Header form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl bg-white/5 border border-white/10 p-4">
        <Field label="العميل">
          <select
            value={header.customer_id ?? ""}
            onChange={(e) => setHeader({ ...header, customer_id: e.target.value || null })}
            disabled={!isDraft}
            className="w-full bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm"
          >
            <option value="">— بدون عميل —</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.full_name || c.email || c.phone || c.id.slice(0, 8)}</option>)}
          </select>
        </Field>
        <Field label="تاريخ الإصدار">
          <Input type="date" value={header.issue_date ?? ""} disabled={!isDraft} onChange={(e) => setHeader({ ...header, issue_date: e.target.value })} className="bg-black/40 border-white/10" />
        </Field>
        <Field label="تاريخ التوريد">
          <Input type="date" value={header.supply_date ?? ""} disabled={!isDraft} onChange={(e) => setHeader({ ...header, supply_date: e.target.value })} className="bg-black/40 border-white/10" />
        </Field>
        <Field label="تاريخ الاستحقاق">
          <Input type="date" value={header.due_date ?? ""} onChange={(e) => setHeader({ ...header, due_date: e.target.value })} className="bg-black/40 border-white/10" />
        </Field>
        <Field label="ملاحظات (تظهر للعميل)">
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
          {isDraft && (
            <Button size="sm" variant="outline" onClick={() => setRows((rs) => [...rs, { description: "", quantity: 1, unit_price: 0, discount_amount: 0, tax_code: "standard_15", sort_order: rs.length, _new: true }])}>
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
                <th className="text-right p-1 w-20">الكمية</th>
                <th className="text-right p-1 w-24">السعر</th>
                <th className="text-right p-1 w-24">الخصم</th>
                <th className="text-right p-1 w-32">الضريبة</th>
                <th className="text-right p-1 w-24">قبل الضريبة</th>
                <th className="text-right p-1 w-24">الإجمالي</th>
                {isDraft && <th className="w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">لا توجد بنود</td></tr>}
              {rows.map((r, i) => {
                const base = Number(r.quantity || 0) * Number(r.unit_price || 0);
                const sub = Math.max(base - Number(r.discount_amount || 0), 0);
                const rate = r.tax_code === "standard_15" ? 15 : 0;
                const tax = Math.round(sub * rate) / 100;
                return (
                  <tr key={r.id ?? `n${i}`} className="border-t border-white/5">
                    <td className="p-1 text-muted-foreground">{i + 1}</td>
                    <td className="p-1">
                      <Input value={r.description} disabled={!isDraft} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} className="bg-black/40 border-white/10 h-8" />
                    </td>
                    <td className="p-1"><Input type="number" step="0.001" value={r.quantity} disabled={!isDraft} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} className="bg-black/40 border-white/10 h-8" /></td>
                    <td className="p-1"><Input type="number" step="0.01" value={r.unit_price} disabled={!isDraft} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, unit_price: Number(e.target.value) } : x))} className="bg-black/40 border-white/10 h-8" /></td>
                    <td className="p-1"><Input type="number" step="0.01" value={r.discount_amount} disabled={!isDraft} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, discount_amount: Number(e.target.value) } : x))} className="bg-black/40 border-white/10 h-8" /></td>
                    <td className="p-1">
                      <select value={r.tax_code} disabled={!isDraft} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, tax_code: e.target.value } : x))} className="w-full bg-black/40 border border-white/10 rounded-md px-1 py-1 text-xs h-8">
                        {Object.entries(TAX_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td className="p-1 text-muted-foreground">{SAR(sub)}</td>
                    <td className="p-1 font-semibold">{SAR(sub + tax)}</td>
                    {isDraft && <td className="p-1"><button onClick={() => removeItem(r, i)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
          <TotalCell label="قبل الخصم" value={SAR(totals.subtotal)} />
          <TotalCell label="الخصم" value={SAR(totals.discount)} />
          <TotalCell label="القاعدة الضريبية" value={SAR(totals.taxable)} />
          <TotalCell label="الضريبة" value={SAR(totals.vat)} />
          <TotalCell label="الإجمالي" value={SAR(totals.total)} highlight />
        </div>
      </div>

      {/* Payment status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="إجمالي الفاتورة" value={SAR(header.total_amount)} />
        <StatCard label="المدفوع" value={SAR(header.paid_amount)} tone="emerald" />
        <StatCard label="المتبقي" value={SAR(header.remaining_amount)} tone="amber" />
      </div>

      {/* Collections list */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <h3 className="font-semibold mb-3">التحصيلات المرتبطة</h3>
        {linkedCollections.length === 0 ? (
          <div className="text-muted-foreground text-sm">لا توجد تحصيلات مرتبطة بعد.</div>
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
                {linkedCollections.map((c: any) => (
                  <tr key={c.id} className="border-t border-white/5">
                    <td className="p-1 whitespace-nowrap">{c.income_date}</td>
                    <td className="p-1">{c.collection_type ?? "—"}</td>
                    <td className="p-1">{c.account_type}</td>
                    <td className="p-1 font-semibold text-emerald-300">{SAR(c.amount)}</td>
                    <td className="p-1 text-muted-foreground">{c.note ?? ""}</td>
                    <td className="p-1">
                      {!isDraft && !isCancelled && (
                        <button
                          className="text-red-400 hover:text-red-300"
                          onClick={async () => {
                            if (!confirm("فك ربط هذا التحصيل عن الفاتورة؟")) return;
                            const { error } = await supabase.from("finance_incomes").update({ sales_invoice_id: null, collection_type: "other" }).eq("id", c.id);
                            if (error) return toast.error(error.message);
                            refetchLinked(); qc.invalidateQueries({ queryKey: ["sales_invoice", invoiceId] });
                          }}
                        ><Trash2 className="w-4 h-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attachments */}
      <AttachmentsPanel relatedType="quote" relatedId={String(invoiceId)} />

      {showLinkModal && (
        <LinkCollectionModal
          invoiceId={invoiceId}
          customerId={header.customer_id}
          onClose={() => setShowLinkModal(false)}
          onDone={() => { setShowLinkModal(false); refetchLinked(); qc.invalidateQueries({ queryKey: ["sales_invoice", invoiceId] }); }}
        />
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
function TotalCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 ${highlight ? "border-gold/40 bg-gold/10 text-gold" : "border-white/10 bg-black/30"}`}>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`font-semibold ${highlight ? "text-gold" : ""}`}>{value}</div>
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

function LinkCollectionModal({ invoiceId, customerId, onClose, onDone }: { invoiceId: number; customerId: string | null; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState("");
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["link_candidates", customerId],
    queryFn: async () => {
      let query = supabase
        .from("finance_incomes")
        .select("id, income_date, amount, account_type, note, customer_id, sales_invoice_id")
        .is("deleted_at", null)
        .is("sales_invoice_id", null)
        .order("income_date", { ascending: false })
        .limit(200);
      if (customerId) query = query.eq("customer_id", customerId);
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });
  const link = async (row: any) => {
    const { error } = await supabase.from("finance_incomes").update({ sales_invoice_id: invoiceId, collection_type: "invoice_collection", transaction_type: "customer_invoice_collection", business_relation: "business" }).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("تم ربط التحصيل");
    onDone();
  };
  const filtered = candidates.filter((r) => !q || (r.note ?? "").toLowerCase().includes(q.toLowerCase()) || String(r.amount).includes(q));
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background border border-white/10 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold">ربط تحصيل موجود بالفاتورة</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="p-3 border-b border-white/10">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث..." className="bg-black/40 border-white/10" />
          {customerId && <div className="text-xs text-muted-foreground mt-2">تعرض المقبوضات غير المرتبطة لهذا العميل فقط.</div>}
          {!customerId && <div className="text-xs text-amber-300 mt-2">لم يتم تحديد عميل — يتم عرض جميع المقبوضات غير المرتبطة.</div>}
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {isLoading && <div className="p-4 text-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline ml-2" />جاري التحميل...</div>}
          {!isLoading && filtered.length === 0 && <div className="p-6 text-center text-muted-foreground"><Receipt className="w-8 h-8 mx-auto opacity-40 mb-2" />لا توجد مقبوضات مؤهلة</div>}
          {filtered.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded">
              <div>
                <div className="font-semibold text-emerald-300">{SAR(r.amount)}</div>
                <div className="text-xs text-muted-foreground">{r.income_date} · {r.account_type} · {r.note ?? ""}</div>
              </div>
              <Button size="sm" onClick={() => link(r)}>ربط</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
