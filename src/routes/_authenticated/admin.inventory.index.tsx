import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import {
  Boxes, Truck, FolderTree, ClipboardList, BookOpen, BarChart3,
  AlertTriangle, Package, TrendingUp, ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/inventory/")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getSessionUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id)
      .in("role", ["admin", "staff"]).limit(1).maybeSingle();
    if (!data) throw redirect({ to: "/admin" });
    return { role: data.role as "admin" | "staff", userId: user.id };
  },
  component: InventoryDashboard,
});

const SAR = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(n) + " ر.س";

function InventoryDashboard() {
  const statsQ = useQuery({
    queryKey: ["aqh_inventory_dashboard"],
    queryFn: async () => {
      const [{ data: products }, { data: suppliers }, { data: cats }, { data: reqs }] =
        await Promise.all([
          supabase.from("aqh_products").select("id,current_qty,cost,is_active"),
          supabase.from("finance_suppliers").select("id,is_active"),
          supabase.from("aqh_product_categories").select("id,is_active"),
          supabase.from("aqh_restock_requests")
            .select("id,status,total,created_at,items_count,supplier_key,source,employee_name")
            .order("created_at", { ascending: false }).limit(5),
        ]);
      const ps = products ?? [];
      const active = ps.filter((p: any) => p.is_active);
      const low = active.filter((p: any) => (p.current_qty ?? 0) <= 3);
      const value = active.reduce(
        (s: number, p: any) => s + (Number(p.cost) || 0) * (Number(p.current_qty) || 0),
        0,
      );
      const openReqs = (reqs ?? []).filter(
        (r: any) => r.status === "new" || r.status === "ordered",
      ).length;
      return {
        productsTotal: ps.length,
        productsActive: active.length,
        low: low.length,
        value,
        suppliers: (suppliers ?? []).filter((s: any) => s.is_active).length,
        categories: (cats ?? []).filter((c: any) => c.is_active).length,
        openReqs,
        recent: reqs ?? [],
      };
    },
  });

  const s = statsQ.data;

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 text-gold flex items-center justify-center">
          <BarChart3 size={20} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">لوحة المخزون</h1>
          <p className="text-xs text-muted-foreground">نظرة سريعة على المنتجات والموردين والطلبات</p>
        </div>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Boxes size={18} />} label="إجمالي المنتجات" value={s ? `${s.productsActive} / ${s.productsTotal}` : "—"} hint="نشطة / كلية" />
        <StatCard icon={<AlertTriangle size={18} className="text-amber-300" />} label="منخفضة المخزون" value={s ? String(s.low) : "—"} hint="≤ 3 قطع" tone="warn" />
        <StatCard icon={<TrendingUp size={18} className="text-emerald-300" />} label="قيمة المخزون" value={s ? SAR(s.value) : "—"} hint="تكلفة × كمية" tone="ok" />
        <StatCard icon={<ClipboardList size={18} />} label="طلبات مفتوحة" value={s ? String(s.openReqs) : "—"} hint="جديد + تم الطلب" />
        <StatCard icon={<Truck size={18} />} label="الموردين" value={s ? String(s.suppliers) : "—"} hint="نشطون" />
        <StatCard icon={<FolderTree size={18} />} label="التصنيفات" value={s ? String(s.categories) : "—"} />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <QuickLink to="/admin/inventory/products" icon={<Boxes size={18} />} label="المنتجات" />
        <QuickLink to="/admin/inventory/categories" icon={<FolderTree size={18} />} label="التصنيفات" />
        <QuickLink to="/admin/finance/suppliers" icon={<Truck size={18} />} label="الموردين" />
        <QuickLink to="/admin/inventory/catalog" icon={<BookOpen size={18} />} label="الكاتلوج" />
        <QuickLink to="/admin/inventory/requests" icon={<ClipboardList size={18} />} label="الطلبات" />
        <QuickLink to="/admin/inventory/reports" icon={<BarChart3 size={18} />} label="التقارير" />
      </div>

      {/* Recent requests */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><ClipboardList size={14} /> آخر الطلبات</h2>
          <Link to="/admin/inventory/requests" className="text-[11px] text-muted-foreground hover:text-gold inline-flex items-center gap-1">
            عرض الكل <ArrowLeft size={11} />
          </Link>
        </div>
        {!s ? (
          <div className="text-xs text-muted-foreground">جارٍ التحميل…</div>
        ) : s.recent.length === 0 ? (
          <div className="text-xs text-muted-foreground py-3 text-center">لا توجد طلبات بعد</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {s.recent.map((r: any) => (
              <li key={r.id} className="py-2 flex items-center gap-3 text-[12px]">
                <span className="font-mono text-muted-foreground w-12">#{r.id}</span>
                <span className="flex-1 truncate">{r.employee_name ?? "—"} · {r.items_count} عنصر</span>
                <span className="text-muted-foreground">{r.source === "supplier_catalog" ? "كاتلوج" : "داخلي"}</span>
                <span className="text-gold font-mono">{r.total ? SAR(Number(r.total)) : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon, label, value, hint, tone,
}: { icon: React.ReactNode; label: string; value: string; hint?: string; tone?: "warn" | "ok" }) {
  const ring =
    tone === "warn" ? "border-amber-500/30 bg-amber-500/5" :
    tone === "ok" ? "border-emerald-500/30 bg-emerald-500/5" :
    "border-white/10 bg-white/[0.02]";
  return (
    <div className={`rounded-xl border ${ring} p-3`}>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="rounded-xl border border-white/10 bg-white/[0.02] hover:border-gold/40 hover:bg-gold/5 transition p-3 flex flex-col items-center gap-1.5 text-center">
      <span className="text-gold">{icon}</span>
      <span className="text-xs">{label}</span>
    </Link>
  );
}
