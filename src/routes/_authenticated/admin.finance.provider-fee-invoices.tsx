import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/finance/provider-fee-invoices")({
  ssr: false,
  component: ProviderFeeInvoicesPage,
});

function ProviderFeeInvoicesPage() {
  const [providers, setProviders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [filterProvider, setFilterProvider] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: p } = await supabase.from("payment_providers" as any).select("*");
    setProviders(p ?? []);
    const supplierIds = (p ?? []).map((x: any) => x.supplier_id).filter(Boolean);
    if (supplierIds.length === 0) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    const { data: inv, error } = await supabase
      .from("purchase_invoices")
      .select("*")
      .in("supplier_id", supplierIds)
      .order("issue_date", { ascending: false });
    if (error) toast.error(error.message);
    else setInvoices(inv ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const providerBySupplier = (sid: string) => providers.find((p) => p.supplier_id === sid);
  const filtered = invoices.filter((inv) => {
    if (!filterProvider) return true;
    const prov = providerBySupplier(inv.supplier_id);
    return prov?.id === filterProvider;
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">فواتير رسوم الوسطاء</h2>
        <p className="text-[11px] text-muted-foreground mt-1">فواتير المشتريات المسجلة تحت موردي بوابات الدفع (سلة، تابي، تمارا) — تشمل الرسوم وضريبتها.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px]">
          <option value="">كل البوابات</option>
          {providers.filter((p) => p.supplier_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground text-[12px] py-6">جارٍ التحميل…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-[12px] text-muted-foreground">
          لا توجد فواتير رسوم بعد. اربط كل بوابة بمورد في صفحة "بوابات الدفع" ثم أنشئ فواتير المشتريات تحت هذا المورد.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
          <table className="w-full text-[12px]">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="text-start px-3 py-2">التاريخ</th>
                <th className="text-start px-3 py-2">رقم الفاتورة</th>
                <th className="text-start px-3 py-2">البوابة</th>
                <th className="text-start px-3 py-2">الإجمالي</th>
                <th className="text-start px-3 py-2">الضريبة</th>
                <th className="text-start px-3 py-2">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const prov = providerBySupplier(r.supplier_id);
                return (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-3 py-2">{r.issue_date}</td>
                    <td className="px-3 py-2">{r.invoice_number}</td>
                    <td className="px-3 py-2">{prov?.name ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{Number(r.total_amount ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-2 tabular-nums">{Number(r.vat_amount ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-2">{r.status ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
