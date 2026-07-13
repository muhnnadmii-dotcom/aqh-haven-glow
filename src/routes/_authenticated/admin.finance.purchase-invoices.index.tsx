import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, ShoppingCart, User, X } from "lucide-react";
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);


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

  const attStatusOf = (r: any) => (hasAttachment(r.id) ? "attached" : "not_attached");

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
      if (fAttach && attStatusOf(r) !== fAttach) return false;
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
        </Sel>

        <Sel value={fPersonal} onChange={setFPersonal} placeholder="من حساب شخصي">
          <option value="yes">نعم</option>
          <option value="no">لا</option>
        </Sel>
        <Input type="month" value={fMonth} onChange={(e) => setFMonth(e.target.value)} className="bg-black/40 border-white/10 text-sm" />
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="font-semibold text-gold">تم تحديد {selected.size} فاتورة</span>
          <span className="mx-1 text-muted-foreground">—</span>
          <BulkSel
            placeholder="تغيير الحالة"
            disabled={bulkBusy}
            onPick={async (v) => {
              if (!v) return;
              setBulkBusy(true);
              const ids = Array.from(selected);
              const { error } = await supabase.from("purchase_invoices" as any).update({ status: v } as any).in("id", ids);
              setBulkBusy(false);
              if (error) return toast.error(error.message);
              toast.success(`تم تحديث ${ids.length} فاتورة`);
              setSelected(new Set());
              qc.invalidateQueries({ queryKey: ["purchase_invoices"] });
            }}
          >
            {Object.entries(PURCHASE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </BulkSel>
          <BulkSel
            placeholder="تغيير قابلية الخصم"
            disabled={bulkBusy}
            onPick={async (v) => {
              if (!v) return;
              setBulkBusy(true);
              const ids = Array.from(selected);
              const { error } = await supabase.from("purchase_invoices" as any).update({ vat_deductibility: v } as any).in("id", ids);
              setBulkBusy(false);
              if (error) return toast.error(error.message);
              toast.success("تم التحديث");
              setSelected(new Set());
              qc.invalidateQueries({ queryKey: ["purchase_invoices"] });
            }}
          >
            {Object.entries(VAT_DEDUCTIBILITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </BulkSel>
          <BulkSel
            placeholder="تغيير المورد"
            disabled={bulkBusy}
            onPick={async (v) => {
              if (!v) return;
              setBulkBusy(true);
              const ids = Array.from(selected);
              const { error } = await supabase.from("purchase_invoices" as any).update({ supplier_id: v } as any).in("id", ids);
              setBulkBusy(false);
              if (error) return toast.error(error.message);
              toast.success("تم التحديث");
              setSelected(new Set());
              qc.invalidateQueries({ queryKey: ["purchase_invoices"] });
            }}
          >
            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </BulkSel>
          <button
            disabled={bulkBusy}
            onClick={async () => {
              const ids = Array.from(selected);
              const targets = invoices.filter((r) => ids.includes(r.id) && (r.status === "draft" || r.status === "rejected"));
              if (targets.length === 0) return toast.error("لا يمكن الحذف إلا للمسودات والمرفوضة");
              if (!confirm(`حذف ${targets.length} فاتورة نهائيًا؟`)) return;
              setBulkBusy(true);
              const { error } = await supabase.from("purchase_invoices" as any).delete().in("id", targets.map((t) => t.id));
              setBulkBusy(false);
              if (error) return toast.error(error.message);
              toast.success("تم الحذف");
              setSelected(new Set());
              qc.invalidateQueries({ queryKey: ["purchase_invoices"] });
            }}
            className="px-3 py-1.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 text-[12px]"
          >حذف المحدد (مسودة/مرفوضة)</button>
          <button onClick={() => setSelected(new Set())} className="ms-auto p-1.5 rounded hover:bg-white/10" title="إلغاء التحديد"><X size={14} /></button>
        </div>
      )}

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
                <th className="p-2 w-8">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) filtered.forEach((r) => next.add(r.id));
                      else filtered.forEach((r) => next.delete(r.id));
                      setSelected(next);
                    }}
                  />
                </th>
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
                const attStatus = attStatusOf(r);
                const isSel = selected.has(r.id);
                return (
                  <tr key={r.id} className={`border-t border-white/5 hover:bg-white/5 cursor-pointer ${isSel ? "bg-gold/5" : ""}`} onClick={() => navigate({ to: "/admin/finance/purchase-invoices/$id", params: { id: String(r.id) } })}>
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(r.id); else next.delete(r.id);
                          setSelected(next);
                        }}
                      />
                    </td>
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
                    <td className={`p-2 text-xs ${attStatus === "attached" ? "text-emerald-300" : "text-amber-300"}`}>{ATTACHMENT_LABEL[attStatus]}</td>
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

function BulkSel({ placeholder, onPick, disabled, children }: { placeholder: string; onPick: (v: string) => void; disabled?: boolean; children: any }) {
  return (
    <select
      disabled={disabled}
      defaultValue=""
      onChange={(e) => { const v = e.target.value; e.target.value = ""; if (v) onPick(v); }}
      className="bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-[12px] disabled:opacity-50"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

