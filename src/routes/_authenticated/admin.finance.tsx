import { Link, Outlet, useRouterState, createFileRoute, redirect } from "@tanstack/react-router";
import { LayoutDashboard, TrendingUp, TrendingDown, Truck, Tags, Paperclip, History, Download, Settings as Cog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";

export const Route = createFileRoute("/_authenticated/admin/finance")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getSessionUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "finance_view", "finance_manage", "finance_accountant", "finance_export", "finance_settings"])
      .limit(1)
      .maybeSingle();
    if (!data) throw redirect({ to: "/admin" });
  },
  component: FinanceLayout,
});

const tabs = [
  { to: "/admin/finance", label: "لوحة المالية", icon: LayoutDashboard, exact: true },
  { to: "/admin/finance/incomes", label: "الدخل", icon: TrendingUp },
  { to: "/admin/finance/expenses", label: "المصروفات", icon: TrendingDown },
  { to: "/admin/finance/suppliers", label: "الموردين", icon: Truck },
  { to: "/admin/finance/categories", label: "التصنيفات", icon: Tags },
  { to: "/admin/finance/attachments", label: "المرفقات", icon: Paperclip },
  { to: "/admin/finance/audit", label: "سجل التعديلات", icon: History },
  { to: "/admin/finance/export", label: "التصدير", icon: Download },
  { to: "/admin/finance/settings", label: "الإعدادات", icon: Cog },
];

function FinanceLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.3em] text-gold/80 uppercase">Aqua Haven · Finance</div>
          <h1 className="text-xl font-semibold mt-1">البوابة المالية</h1>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div className="inline-flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 min-w-max">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to) && (t.to !== "/admin/finance" || pathname === "/admin/finance");
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] whitespace-nowrap transition ${
                  active ? "bg-gold/15 text-gold border border-gold/30" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <t.icon size={13} />
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="pt-2">
        <Outlet />
      </div>
    </div>
  );
}
