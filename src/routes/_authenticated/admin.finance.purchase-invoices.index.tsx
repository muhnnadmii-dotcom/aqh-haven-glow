import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, ShoppingCart, User } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import {
  PURCHASE_TYPE_LABEL,
  PURCHASE_STATUS_LABEL,
  PURCHASE_STATUS_CLASS,
  PURCHASE_PAY_LABEL,
  VAT_DEDUCTIBILITY_LABEL,
  ATTACHMENT_LABEL,
  SAR,
} from "@/lib/finance/purchase-constants";

export const Route = createFileRoute("/_authenticated/admin/finance/purchase-invoices/")({
  ssr: false,
  component: PurchaseInvoicesList,
});

function PurchaseInvoicesList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPay, setFPay] = useState("");
  const [fType, setFType] = useState("");
  const [fVat, setFVat] = useState("");
  const [fSupplier, setFSupplier] = useState("");
  const [fAttach, setFAttach] = useState("");
  const [fPersonal, setFPersonal] = useState("");
  const [fMonth, setFMonth] = useState("");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["purchase_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_invoices" as any)
        .select("*")
        .order("issue_date", { ascending: false })
        .order("id", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["finance_suppliers_min"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_suppliers").select("id, name").eq("is_active", true).order("name");
      return (data ?? []) as any[];
    },
  });
  const supName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "—";

  // attachment map
  const invoiceIds = invoices.map((i) => i.id);
  const { data: attachments = [] } = useQuery({
    queryKey: ["purchase_invoice_attachments", invoiceIds.length],
    queryFn: async () => {
      if (!invoiceIds.length) return [];
      const { data } = await supabase
        .from("finance_attachments")
        .select("related_bigint_id")
        .eq("related_type", "purchase_invoice" as any)
        .in("related_bigint_id", invoiceIds);
      return (data ?? []) as any[];
    },
    enabled: invoiceIds.length > 0,
  });
  const hasAttachment = (id: number) => attachments.some((a) => Number(a.related_bigint_id) === id);

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("purchase_invoices" as any)
        .insert({ created_by: u.user?.id ?? null } as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as number;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["purchase_invoices"] });
      navigate({ to: "/admin/finance/purchase-invoices/$id", params: { id: String(id) } });
    },
    onError: (e: any) => toast.error("تعذر إنشاء الفاتورة: " + e.message),
  });

  const filtered = useMemo(() => {
    return invoices.filter((r) => {
      if (fStatus && r.status !== fStatus) return false;
      if (fPay && r.payment_status !== fPay) return false;
      if (fType && r.purchase_type !== fType) return false;
      if (fVat && r.vat_deductibility !== fVat) return false;
      if (fSupplier && r.supplier_id !== fSupplier) return false;
      if (fPersonal === "yes" && !r.paid_from_personal_account) return false;
      if (fPersonal === "no" && r.paid_from_personal_account) return false;
      if (fMonth && !(r.issue_date ?? "").startsWith(fMonth)) return false;
      if (fAttach) {
        const status = !r.attachment_required
          ? "not_required"
          : r.attachment_exception_reason
          ? "not_required"
          : hasAttachment(r.id)
          ? "attached"
          : "not_attached";
        if (status !== fAttach) return false;
      }
      if (q) {
        const s = q.toLowerCase();
        const hay = `${r.internal_reference} ${r.supplier_invoice_number ?? ""} ${supName(r.supplier_id)} ${r.notes ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [invoices, fStatus, fPay, fType, fVat, fSupplier, fPersonal, fMonth, fAttach, q, attachments]);

  const kpis = useMemo(() => {
    const total = filtered.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const paid = filtered.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    const remaining = filtered.reduce((s, r) => s + Number(r.remaining_amount || 0), 0);
    const deductible = filtered.reduce((s, r) => s + Number(r.deductible_vat_amount || 0), 0);
    const nondec = filtered.reduce((s, r) => s + Number(r.non_deductible_vat_amount || 0), 0);
    return { total, paid, remaining, deductible, nondec };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.3em] text-gold/80 uppercase">Purchase Invoices</div>
          <h2 className="text-lg font-semibold mt-1">فواتير المشتريات</h2>
        </div>
        <Button onClick={() => create.mutate()} disabled={create.isPending} className="bg-gold text-black hover:bg-gold/90">
          {create.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Plus className="w-4 h-4 ml-1" />}
          فاتورة جديدة
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="عدد الفواتير" value={String(filtered.length)} />
        <KPI label="إجمالي" value={SAR(kpis.total)} />
        <KPI label="المدفوع" value={SAR(kpis.paid)} tone="emerald" />
        <KPI label="المتبقي" value={SAR(kpis.remaining)} tone="amber" />
        <KPI label="ضريبة قابلة للخصم" value={SAR(kpis.deductible)} tone="blue" />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 rounded-xl bg-white/5 border border-white/10 p-3">
        <Input placeholder="بحث..." value={q} onChange={(e) => setQ(e.target.value)} className="bg-black/40 border-white/10 text-sm" />
        <Sel value={fStatus} onChange={setFStatus} placeholder="حالة الفاتورة">
          {Object.entries(PURCHASE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Sel>
        <Sel value={fPay} onChange={setFPay} placeholder="حالة السداد">
          {Object.entries(PURCHASE_PAY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Sel>
        <Sel value={fType} onChange={setFType} placeholder="نوع المشتريات">
          {Object.entries(PURCHASE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Sel>
        <Sel value={fVat} onChange={setFVat} placeholder="قابلية الخصم">
          {Object.entries(VAT_DEDUCTIBILITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Sel>
        <Sel value={fSupplier} onChange={setFSupplier} placeholder="المورد">
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Sel>
        <Sel value={fAttach} onChange={setFAttach} placeholder="المرفق">
          <option value="attached">مرفق</option>
          <option value="not_attached">غير مرفق</option>
          <option value="not_required">مستثنى</option>
        </Sel>
        <Sel value={fPersonal} onChange={setFPersonal} placeholder="من حساب شخصي">
          <option value="yes">نعم</option>
          <option value="no">لا</option>
        </Sel>
        <Input type="month" value={fMonth} onChange={(e) => setFMonth(e.target.value)} className="bg-black/40 border-white/10 text-sm" />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline ml-2" />جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <ShoppingCart className="w-8 h-8 mx-auto opacity-40 mb-2" />
            لا توجد فواتير
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="text-right p-2">المرجع الداخلي</th>
                <th className="text-right p-2">رقم فاتورة المورد</th>
                <th className="text-right p-2">المورد</th>
                <th className="text-right p-2">التاريخ</th>
                <th className="text-right p-2">النوع</th>
                <th className="text-right p-2">قبل الضريبة</th>
                <th className="text-right p-2">الضريبة</th>
                <th className="text-right p-2">القابل للخصم</th>
                <th className="text-right p-2">غير القابل</th>
                <th className="text-right p-2">الإجمالي</th>
                <th className="text-right p-2">المدفوع</th>
                <th className="text-right p-2">المتبقي</th>
                <th className="text-right p-2">المرفق</th>
                <th className="text-right p-2">الحالة</th>
                <th className="text-right p-2">السداد</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const attStatus = !r.attachment_required
                  ? "not_required"
                  : r.attachment_exception_reason
                  ? "not_required"
                  : hasAttachment(r.id)
                  ? "attached"
                  : "not_attached";
                return (
                  <tr key={r.id} className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => navigate({ to: "/admin/finance/purchase-invoices/$id", params: { id: String(r.id) } })}>
                    <td className="p-2 font-mono text-xs">{r.internal_reference}</td>
                    <td className="p-2">{r.supplier_invoice_number ?? "—"}</td>
                    <td className="p-2">
                      {supName(r.supplier_id)}
                      {r.paid_from_personal_account && <User className="inline w-3 h-3 mr-1 text-amber-300" />}
                    </td>
                    <td className="p-2 whitespace-nowrap">{r.issue_date}</td>
                    <td className="p-2 text-xs">{PURCHASE_TYPE_LABEL[r.purchase_type] ?? r.purchase_type}</td>
                    <td className="p-2">{SAR(r.taxable_amount)}</td>
                    <td className="p-2">{SAR(r.vat_amount)}</td>
                    <td className="p-2 text-blue-300">{SAR(r.deductible_vat_amount)}</td>
                    <td className="p-2 text-muted-foreground">{SAR(r.non_deductible_vat_amount)}</td>
                    <td className="p-2 font-semibold">{SAR(r.total_amount)}</td>
                    <td className="p-2 text-emerald-300">{SAR(r.paid_amount)}</td>
                    <td className="p-2 text-amber-300">{SAR(r.remaining_amount)}</td>
                    <td className="p-2 text-xs">{ATTACHMENT_LABEL[attStatus]}</td>
                    <td className="p-2"><Badge variant="outline" className={PURCHASE_STATUS_CLASS[r.status] ?? ""}>{PURCHASE_STATUS_LABEL[r.status] ?? r.status}</Badge></td>
                    <td className="p-2 text-xs">{PURCHASE_PAY_LABEL[r.payment_status] ?? r.payment_status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" | "blue" }) {
  const t = tone === "emerald" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : tone === "blue" ? "text-blue-300" : "";
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${t}`}>{value}</div>
    </div>
  );
}

function Sel({ value, onChange, placeholder, children }: { value: string; onChange: (v: string) => void; placeholder: string; children: any }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-sm">
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}
