import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePaginatedQuery, type PageSize } from "@/lib/finance/use-paginated-query";
import { PaginationBar } from "@/components/finance/PaginationBar";

export const Route = createFileRoute("/_authenticated/admin/finance/sales-invoices/")({
  ssr: false,
  component: SalesInvoicesList,
});

const SAR = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(n) || 0);

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

const LIST_COLS = "id,invoice_number,issue_date,customer_id,customer_name_snapshot,order_id,taxable_amount,vat_amount,total_amount,paid_amount,remaining_amount,status,payment_status";

function monthOptions(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function SalesInvoicesList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPay, setFPay] = useState("");
  const [fMonth, setFMonth] = useState("");
  const [fLinked, setFLinked] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const fetcher = useCallback(async ({ page, pageSize }: { page: number; pageSize: PageSize }) => {
    let query = supabase.from("sales_invoices").select(LIST_COLS, { count: "exact" })
      .order("issue_date", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false });
    if (fStatus) query = query.eq("status", fStatus as any);
    if (fPay) query = query.eq("payment_status", fPay as any);
    if (fMonth) {
      const [y, m] = fMonth.split("-").map(Number);
      const from = `${y}-${String(m).padStart(2, "0")}-01`;
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      const to = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
      query = query.gte("issue_date", from).lt("issue_date", to);
    }
    if (fLinked === "linked") query = query.not("order_id", "is", null);
    if (fLinked === "unlinked") query = query.is("order_id", null);
    if (debouncedQ) {
      const like = `%${debouncedQ.replace(/[%_]/g, (m) => "\\" + m)}%`;
      query = query.or(`invoice_number.ilike.${like},customer_name_snapshot.ilike.${like},notes.ilike.${like}`);
    }
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await query.range(from, to);
    if (error) throw new Error(error.message);
    return { rows: (data as any[]) ?? [], total: count ?? 0 };
  }, [debouncedQ, fStatus, fPay, fMonth, fLinked]);

  const pg = usePaginatedQuery(fetcher, [debouncedQ, fStatus, fPay, fMonth, fLinked]);
  useEffect(() => { if (pg.error) toast.error(pg.error); }, [pg.error]);

  const customerIds = useMemo(() => Array.from(new Set(pg.rows.map((r) => r.customer_id).filter(Boolean))), [pg.rows]);
  const { data: customers = [] } = useQuery({
    queryKey: ["profiles_by_ids", customerIds.join(",")],
    enabled: customerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", customerIds as string[]);
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
      const { data, error } = await supabase.from("sales_invoices").insert({ created_by: u.user?.id ?? null } as any).select("id").single();
      if (error) throw error;
      return data.id as number;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["sales_invoices"] });
      pg.reload();
      navigate({ to: "/admin/finance/sales-invoices/$id", params: { id: String(id) } });
    },
    onError: (e: any) => toast.error("تعذر إنشاء الفاتورة: " + e.message),
  });

  const months = useMemo(() => monthOptions(), []);
  const pageTotals = pg.rows.reduce((a, r) => ({
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
        <StatCard label="عدد الفواتير (المطابقة للفلاتر)" value={String(pg.total)} />
        <StatCard label="إجمالي الصفحة" value={SAR(pageTotals.total)} />
        <StatCard label="مدفوع (الصفحة)" value={SAR(pageTotals.paid)} tone="emerald" />
        <StatCard label="متبقي (الصفحة)" value={SAR(pageTotals.remaining)} tone="amber" />
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

      <div className={`rounded-xl border border-white/10 overflow-hidden bg-white/[0.02] ${pg.loading ? "opacity-70" : ""}`}>
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
              {pg.loading && pg.rows.length === 0 && (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground"><Loader2 className="inline w-4 h-4 animate-spin ml-2" />جاري التحميل...</td></tr>
              )}
              {!pg.loading && pg.rows.length === 0 && (
                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  لا توجد فواتير مطابقة
                </td></tr>
              )}
              {pg.rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="p-2">
                    <Link to="/admin/finance/sales-invoices/$id" params={{ id: String(r.id) }} className="text-gold hover:underline font-mono">
                      {r.invoice_number}
                    </Link>
                  </td>
                  <td className="p-2 whitespace-nowrap">{r.issue_date}</td>
                  <td className="p-2">{custName(r)}</td>
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
        <PaginationBar page={pg.page} pageCount={pg.pageCount} pageSize={pg.pageSize} total={pg.total} loading={pg.loading} onPage={pg.setPage} onPageSize={pg.setPageSize} />
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
