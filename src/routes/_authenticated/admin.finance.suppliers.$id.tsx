import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  SAR,
  PURCHASE_STATUS_LABEL,
  PURCHASE_STATUS_CLASS,
} from "@/lib/finance/purchase-constants";

export const Route = createFileRoute("/_authenticated/admin/finance/suppliers/$id")({
  ssr: false,
  component: SupplierProfile,
});

function SupplierProfile() {
  const { id } = Route.useParams();

  const { data: supplier, isLoading: loadingSup } = useQuery({
    queryKey: ["finance_supplier", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_suppliers")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: invoices = [], isLoading: loadingInv } = useQuery({
    queryKey: ["supplier_purchase_invoices", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_invoices" as any)
        .select(
          "id, internal_reference, issue_date, total_amount, taxable_amount, vat_amount, deductible_vat_amount, non_deductible_vat_amount, vat_deductibility, status"
        )
        .eq("supplier_id", id)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const invoiceIds = invoices.map((i) => i.id);
  const { data: attachments = [] } = useQuery({
    queryKey: ["supplier_invoice_attachments", id, invoiceIds.length],
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
  const hasAttachment = (invId: number) =>
    attachments.some((a) => Number(a.related_bigint_id) === invId);

  const count = invoices.length;
  const totalPurchases = invoices.reduce((a, r) => a + Number(r.total_amount ?? 0), 0);
  const totalVat = invoices.reduce((a, r) => a + Number(r.vat_amount ?? 0), 0);
  const totalDeductible = invoices.reduce(
    (a, r) => a + Number(r.deductible_vat_amount ?? 0),
    0
  );
  const missingAttachCount = invoices.filter(
    (r) => Number(r.vat_amount ?? 0) > 0 && !hasAttachment(r.id)
  ).length;

  if (loadingSup) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }
  if (!supplier) {
    return <div className="text-center py-16 text-muted-foreground">المورد غير موجود</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          to="/admin/finance/suppliers"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} /> رجوع للموردين
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{supplier.name}</h1>
          {supplier.tax_number && (
            <span className="text-[12px] text-muted-foreground font-mono">
              ض: {supplier.tax_number}
            </span>
          )}
          <Badge
            className={
              supplier.is_active
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : "bg-white/10 text-muted-foreground border-white/20"
            }
          >
            {supplier.is_active ? "نشط" : "غير نشط"}
          </Badge>
          {supplier.is_vat_registered ? (
            <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/30">
              مسجل ضريبيًا
            </Badge>
          ) : (
            <Badge className="bg-white/10 text-muted-foreground border-white/20">
              غير مسجل ضريبيًا
            </Badge>
          )}
        </div>
        {(supplier.company_name || supplier.phone || supplier.email) && (
          <div className="text-[12px] text-muted-foreground mt-2">
            {supplier.company_name || "—"} · {supplier.phone || "—"} ·{" "}
            {supplier.email || "—"}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="عدد الفواتير" value={String(count)} />
        <Kpi label="إجمالي المشتريات" value={SAR(totalPurchases)} />
        <Kpi label="إجمالي الضريبة" value={SAR(totalVat)} />
        <Kpi label="ضريبة قابلة للخصم" value={SAR(totalDeductible)} />
        <Kpi label="فواتير بدون مرفق" value={String(missingAttachCount)} tone="warn" />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-white/5 text-muted-foreground">
            <tr>
              <th className="text-start px-3 py-2">المرجع</th>
              <th className="text-start px-3 py-2">التاريخ</th>
              <th className="text-start px-3 py-2">قبل الضريبة</th>
              <th className="text-start px-3 py-2">الضريبة</th>
              <th className="text-start px-3 py-2">القابل للخصم</th>
              <th className="text-start px-3 py-2">المرفق</th>
              <th className="text-start px-3 py-2">الحالة</th>
              <th className="text-start px-3 py-2">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {loadingInv ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">
                  ...جاري التحميل
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground">
                  لا توجد فواتير مشتريات لهذا المورد
                </td>
              </tr>
            ) : (
              invoices.map((r) => {
                const att = hasAttachment(r.id);
                return (
                  <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-3 py-2">
                      <Link
                        to="/admin/finance/purchase-invoices/$id"
                        params={{ id: String(r.id) }}
                        className="text-gold hover:underline font-mono"
                      >
                        {r.internal_reference ?? `#${r.id}`}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono">{r.issue_date ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">{SAR(r.taxable_amount ?? 0)}</td>
                    <td className="px-3 py-2 font-mono">{SAR(r.vat_amount ?? 0)}</td>
                    <td className="px-3 py-2 font-mono">
                      {SAR(r.deductible_vat_amount ?? 0)}
                    </td>
                    <td className="px-3 py-2">
                      {att ? (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                          مرفق
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">
                          غير مرفق
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        className={
                          PURCHASE_STATUS_CLASS[r.status] ??
                          "bg-white/10 text-muted-foreground border-white/20"
                        }
                      >
                        {PURCHASE_STATUS_LABEL[r.status] ?? r.status ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-mono">{SAR(r.total_amount ?? 0)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={`text-sm font-semibold mt-1 font-mono ${
          tone === "warn" ? "text-amber-300" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
