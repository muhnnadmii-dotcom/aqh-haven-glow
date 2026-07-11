import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { PURCHASE_STATUS_CLASS, PURCHASE_STATUS_LABEL, VAT_DEDUCTIBILITY_LABEL, SAR } from "@/lib/finance/purchase-constants";

export const Route = createFileRoute("/_authenticated/admin/finance/purchase-invoices-review")({
  ssr: false,
  component: PurchaseReview,
});

function PurchaseReview() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({
    queryKey: ["purchase_invoices_review"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_invoices" as any)
        .select("*")
        .in("status", ["draft", "under_review", "rejected"] as any)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["finance_suppliers_min"],
    queryFn: async () => (await supabase.from("finance_suppliers").select("id, name")).data as any[],
  });
  const supName = (id: string | null) => suppliers.find((s: any) => s.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] tracking-[0.3em] text-gold/80 uppercase">Awaiting Review</div>
        <h2 className="text-lg font-semibold mt-1">فواتير مشتريات تنتظر المراجعة</h2>
        <p className="text-xs text-muted-foreground mt-1">مسودات، قيد المراجعة، ومرفوضة — تحتاج مراجعة قابلية الخصم واكتمال البيانات قبل الاعتماد.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline ml-2" />جاري التحميل...</div>
        ) : data.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <ClipboardCheck className="w-8 h-8 mx-auto opacity-40 mb-2" />
            لا توجد فواتير تنتظر مراجعة
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="text-right p-2">المرجع</th>
                <th className="text-right p-2">المورد</th>
                <th className="text-right p-2">التاريخ</th>
                <th className="text-right p-2">الإجمالي</th>
                <th className="text-right p-2">قابلية الخصم</th>
                <th className="text-right p-2">مرفق مطلوب</th>
                <th className="text-right p-2">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r: any) => (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => navigate({ to: "/admin/finance/purchase-invoices/$id", params: { id: String(r.id) } })}>
                  <td className="p-2 font-mono text-xs">{r.internal_reference}</td>
                  <td className="p-2">{supName(r.supplier_id)}</td>
                  <td className="p-2 whitespace-nowrap">{r.issue_date}</td>
                  <td className="p-2 font-semibold">{SAR(r.total_amount)}</td>
                  <td className="p-2 text-xs">{VAT_DEDUCTIBILITY_LABEL[r.vat_deductibility] ?? r.vat_deductibility}</td>
                  <td className="p-2 text-xs">{r.attachment_required ? "نعم" : "لا"}</td>
                  <td className="p-2"><Badge variant="outline" className={PURCHASE_STATUS_CLASS[r.status] ?? ""}>{PURCHASE_STATUS_LABEL[r.status] ?? r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
