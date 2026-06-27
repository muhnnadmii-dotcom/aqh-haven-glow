import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import { BarChart3, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/inventory/reports")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getSessionUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id)
      .in("role", ["admin", "staff"]).limit(1).maybeSingle();
    if (!data) throw redirect({ to: "/admin" });
    return { role: data.role as "admin" | "staff" };
  },
  component: ReportsPage,
});

const SAR = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(n) + " ر.س";

function ReportsPage() {
  const reqsQ = useQuery({
    queryKey: ["aqh_reports_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_restock_requests")
        .select("id,created_at,total,supplier_key,source,status,items_count");
      if (error) throw error;
      return data ?? [];
    },
  });

  const suppliersQ = useQuery({
    queryKey: ["finance_suppliers_map"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_suppliers").select("id,name");
      const m = new Map<string, string>();
      (data ?? []).forEach((s: any) => m.set(s.id, s.name));
      return m;
    },
  });

  const byMonth = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    (reqsQ.data ?? []).forEach((r: any) => {
      const k = (r.created_at as string).slice(0, 7);
      const cur = m.get(k) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(r.total) || 0;
      m.set(k, cur);
    });
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [reqsQ.data]);

  const bySupplier = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    (reqsQ.data ?? []).forEach((r: any) => {
      const k = r.supplier_key ?? "—";
      const cur = m.get(k) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(r.total) || 0;
      m.set(k, cur);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [reqsQ.data]);

  const productsQ = useQuery({
    queryKey: ["aqh_reports_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aqh_products")
        .select("id,name_ar,current_qty,cost,is_active,category")
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const lowStock = useMemo(() => {
    return (productsQ.data ?? [])
      .filter((p: any) => (p.current_qty ?? 0) <= 3)
      .sort((a: any, b: any) => (a.current_qty ?? 0) - (b.current_qty ?? 0))
      .slice(0, 20);
  }, [productsQ.data]);

  if (reqsQ.isLoading || productsQ.isLoading) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground" dir="rtl">
        <Loader2 className="inline-block animate-spin" size={16} /> جارٍ تحضير التقارير…
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 text-gold flex items-center justify-center">
          <BarChart3 size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold">تقارير المخزون</h1>
          <p className="text-xs text-muted-foreground">حركة الطلبات وأداء الموردين والمنتجات المنخفضة</p>
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <ReportCard title="الطلبات حسب الشهر">
          <Table head={["الشهر", "العدد", "الإجمالي"]}
            rows={byMonth.map(([k, v]) => [k, String(v.count), SAR(v.total)])} />
        </ReportCard>

        <ReportCard title="الطلبات حسب المورد">
          <Table head={["المورد", "العدد", "الإجمالي"]}
            rows={bySupplier.map(([k, v]) => [
              suppliersQ.data?.get(k) ?? k, String(v.count), SAR(v.total),
            ])} />
        </ReportCard>
      </div>

      <ReportCard title="منتجات منخفضة المخزون (أول 20)">
        <Table head={["المنتج", "التصنيف", "الكمية", "التكلفة"]}
          rows={lowStock.map((p: any) => [
            p.name_ar, p.category ?? "—",
            String(p.current_qty ?? 0),
            p.cost != null ? SAR(Number(p.cost)) : "—",
          ])} />
      </ReportCard>
    </div>
  );
}

function ReportCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  if (rows.length === 0) return <div className="text-xs text-muted-foreground py-4 text-center">لا توجد بيانات</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead className="text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="text-start px-2 py-1.5">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-white/5">
              {r.map((c, j) => <td key={j} className="px-2 py-1.5">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
