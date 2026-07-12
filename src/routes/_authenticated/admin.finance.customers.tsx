import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, Users, Phone, Mail } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/finance/customers")({
  ssr: false,
  component: CustomersPage,
});

const SAR = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(n) || 0);

function CustomersPage() {
  const [q, setQ] = useState("");

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["finance_customers_full"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, phone, email, city").order("full_name", { ascending: true }).limit(5000)).data as any[],
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["finance_customers_invoices"],
    queryFn: async () => (await supabase.from("sales_invoices").select("customer_id, total_amount, paid_amount, remaining_amount, status").not("customer_id", "is", null)).data as any[],
  });

  const { data: incomes = [] } = useQuery({
    queryKey: ["finance_customers_incomes"],
    queryFn: async () => (await supabase.from("finance_incomes").select("customer_id, amount, sales_invoice_id").is("deleted_at", null).not("customer_id", "is", null)).data as any[],
  });

  const rows = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of customers) map.set(c.id, { ...c, total_invoiced: 0, total_paid: 0, remaining: 0, invoice_count: 0, advance_balance: 0 });
    for (const inv of invoices) {
      const m = map.get(inv.customer_id);
      if (!m) continue;
      if (inv.status !== "cancelled") {
        m.total_invoiced += Number(inv.total_amount || 0);
        m.total_paid += Number(inv.paid_amount || 0);
        m.remaining += Number(inv.remaining_amount || 0);
        m.invoice_count += 1;
      }
    }
    for (const i of incomes) {
      const m = map.get(i.customer_id);
      if (!m) continue;
      if (!i.sales_invoice_id) m.advance_balance += Number(i.amount || 0);
    }
    return Array.from(map.values()).filter((r) => r.invoice_count > 0 || r.advance_balance > 0 || (q && (r.full_name ?? "").toLowerCase().includes(q.toLowerCase())));
  }, [customers, invoices, incomes, q]);

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (r.full_name ?? "").toLowerCase().includes(s) || (r.email ?? "").toLowerCase().includes(s) || (r.phone ?? "").includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] tracking-[0.3em] text-gold/80 uppercase">Sales · Customers</div>
          <h2 className="text-lg font-semibold mt-1">العملاء</h2>
        </div>
      </div>

      <div className="rounded-xl bg-white/5 border border-white/10 p-2">
        <div className="relative">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو البريد أو الجوال..." className="pr-8 bg-transparent border-white/10" />
        </div>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-muted-foreground text-xs">
              <tr>
                <th className="text-right p-2">العميل</th>
                <th className="text-right p-2">التواصل</th>
                <th className="text-right p-2">عدد الفواتير</th>
                <th className="text-right p-2">إجمالي المبيعات</th>
                <th className="text-right p-2">المدفوع</th>
                <th className="text-right p-2">المتبقي عليه</th>
                <th className="text-right p-2">دفعات مقدمة</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">جاري التحميل...</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  لا يوجد عملاء بحركات مالية
                </td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="p-2">
                    <div className="font-semibold">{r.full_name ?? "—"}</div>
                    {r.city && <div className="text-xs text-muted-foreground">{r.city}</div>}
                  </td>
                  <td className="p-2 text-xs">
                    {r.phone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="w-3 h-3" />{r.phone}</div>}
                    {r.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="w-3 h-3" />{r.email}</div>}
                  </td>
                  <td className="p-2">{r.invoice_count}</td>
                  <td className="p-2 font-semibold">{SAR(r.total_invoiced)}</td>
                  <td className="p-2 text-emerald-300">{SAR(r.total_paid)}</td>
                  <td className="p-2 text-amber-300">{SAR(r.remaining)}</td>
                  <td className="p-2 text-blue-300">{SAR(r.advance_balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        * الدفعات المقدمة هي مقبوضات مرتبطة بالعميل بدون فاتورة، ويمكن تخصيصها لاحقًا من صفحة الفاتورة عبر "ربط تحصيل موجود".
      </div>
    </div>
  );
}
