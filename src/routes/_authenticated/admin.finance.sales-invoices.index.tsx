import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/finance/sales-invoices/")({
  ssr: false,
  component: SalesInvoicesList,
});

const SAR = (n: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(Number(n) || 0);

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة", approved: "معتمدة", partially_paid: "مدفوعة جزئيًا", paid: "مدفوعة", cancelled: "ملغاة",
};
const STATUS_CLASS: Record<string, string> = {
  draft: "bg-white/10 text-muted-foreground border-white/20",
  approved: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  partially_paid: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
};
const PAY_LABEL: Record<string, string> = {
  unpaid: "غير مدفوعة", partially_paid: "جزئي", paid: "مدفوعة", overpaid: "زائد",
};

function SalesInvoicesList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPay, setFPay] = useState("");
  const [fMonth, setFMonth] = useState("");
  const [fLinked, setFLinked] = useState("");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["sales_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_invoices")
        .select("*")
        .order("issue_date", { ascending: false })
        .order("id", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["profiles_customers_min"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").limit(2000);
      return (data ?? []) as any[];
    },
  });
  const custName = (r: any) => {
    if (r.customer_id) {
      const found = customers.find((c) => c.id === r.customer_id)?.full_name;
      if (found) return found;
    }
    return r.customer_name_snapshot || "—";
  };

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("sales_invoices")
        .insert({ created_by: u.user?.id ?? null } as any)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as number;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["sales_invoices"] });
      navigate({ to: "/admin/finance/sales-invoices/$id", params: { id: String(id) } });
    },
    onError: (e: any) => toast.error("تعذر إنشاء الفاتورة: " + e.message),
  });

  const filtered = useMemo(() => invoices.filter((r) => {
    if (q) {
      const s = q.toLowerCase();
      const hay = `${r.invoice_number ?? ""} ${custName(r.customer_id)} ${r.notes ?? ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    if (fStatus && r.status !== fStatus) return false;
    if (fPay && r.payment_status !== fPay) return false;
    if (fMonth && (r.issue_date ?? "").slice(0, 7) !== fMonth) return false;
    if (fLinked === "linked" && !r.order_id) return false;
    if (fLinked === "unlinked" && r.order_id) return false;
    return true;
  }), [invoices, q, fStatus, fPay, fMonth, fLinked, customers]);

  const months = useMemo(() => Array.from(new Set(invoices.map((r) => (r.issue_date ?? "").slice(0, 7)).filter(Boolean))).sort().reverse(), [invoices]);

  const totals = filtered.reduce((a, r) => ({
    total: a.total + Number(r.total_amount ?? 0),
    paid: a.paid + Number(r.paid_amount ?? 0),
    remaining: a.remaining + Number(r.remaining_amount ?? 0),
  }), { total: 0, paid: 0, remaining: 0 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.3em] text-gold/80 uppercase">Sales · Invoices</div>
          <h2 className="text-lg font-semibold mt-1">فواتير المبيعات</h2>
        </div>
        <Button onClick={() => create.mutate()} disabled={create.isPending} className="bg-gold text-black hover:bg-gold/90">
          {create.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Plus className="w-4 h-4 ml-1" />}
          فاتورة جديدة
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="عدد الفواتير" value={filtered.length.toString()} />
        <StatCard label="إجمالي" value={SAR(totals.total)} />
        <StatCard label="مدفوع" value={SAR(totals.paid)} tone="emerald" />
        <StatCard label="متبقي" value={SAR(totals.remaining)} tone="amber" />
      </div>

      <div className="flex flex-wrap gap-2 items-center rounded-xl bg-white/5 border border-white/10 p-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث برقم الفاتورة أو العميل..." className="pr-8 bg-transparent border-white/10" />
        </div>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="text-sm bg-black/40 border border-white/10 rounded-md px-2 py-1.5">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={fPay} onChange={(e) => setFPay(e.target.value)} className="text-sm bg-black/40 border border-white/10 rounded-md px-2 py-1.5">
          <option value="">كل حالات السداد</option>
          {Object.entries(PAY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={fMonth} onChange={(e) => setFMonth(e.target.value)} className="text-sm bg-black/40 border border-white/10 rounded-md px-2 py-1.5">
          <option value="">كل الأشهر</option>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={fLinked} onChange={(e) => setFLinked(e.target.value)} className="text-sm bg-black/40 border border-white/10 rounded-md px-2 py-1.5">
          <option value="">مرتبطة/غير مرتبطة</option>
          <option value="linked">مرتبطة بطلب</option>
          <option value="unlinked">بدون طلب</option>
        </select>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-muted-foreground text-xs">
              <tr>
                <th className="text-right p-2">الرقم</th>
                <th className="text-right p-2">التاريخ</th>
                <th className="text-right p-2">العميل</th>
                <th className="text-right p-2">قبل الضريبة</th>
                <th className="text-right p-2">الضريبة</th>
                <th className="text-right p-2">الإجمالي</th>
                <th className="text-right p-2">مدفوع</th>
                <th className="text-right p-2">متبقي</th>
                <th className="text-right p-2">الحالة</th>
                <th className="text-right p-2">السداد</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground"><Loader2 className="inline w-4 h-4 animate-spin ml-2" />جاري التحميل...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  لا توجد فواتير مطابقة
                </td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="p-2">
                    <Link to="/admin/finance/sales-invoices/$id" params={{ id: String(r.id) }} className="text-gold hover:underline font-mono">
                      {r.invoice_number}
                    </Link>
                  </td>
                  <td className="p-2 whitespace-nowrap">{r.issue_date}</td>
                  <td className="p-2">{custName(r.customer_id)}</td>
                  <td className="p-2">{SAR(r.taxable_amount)}</td>
                  <td className="p-2">{SAR(r.vat_amount)}</td>
                  <td className="p-2 font-semibold">{SAR(r.total_amount)}</td>
                  <td className="p-2 text-emerald-300">{SAR(r.paid_amount)}</td>
                  <td className="p-2 text-amber-300">{SAR(r.remaining_amount)}</td>
                  <td className="p-2"><Badge variant="outline" className={STATUS_CLASS[r.status] ?? ""}>{STATUS_LABEL[r.status] ?? r.status}</Badge></td>
                  <td className="p-2 text-xs">{PAY_LABEL[r.payment_status] ?? r.payment_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
  const toneCls = tone === "emerald" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : "text-foreground";
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}
