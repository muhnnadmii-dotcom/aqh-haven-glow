import { Link, Outlet, useRouterState, createFileRoute, redirect } from "@tanstack/react-router";
import { ChevronDown, LayoutDashboard, ShoppingCart, ShoppingBag, Wallet, BookOpen, Percent, BarChart3, MoreHorizontal, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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

type MenuItem = { to?: string; label: string; soon?: boolean };
type MenuSection = { key: string; label: string; icon: any; items: MenuItem[] };

const sections: MenuSection[] = [
  {
    key: "dashboard",
    label: "اللوحة",
    icon: LayoutDashboard,
    items: [
      { to: "/admin/finance", label: "لوحة المالية" },
      { to: "/admin/finance/review", label: "مركز مراجعة الحركات" },
      { to: "/admin/finance/compare", label: "مقارنة الأشهر" },
    ],
  },
  {
    key: "sales",
    label: "المبيعات",
    icon: ShoppingBag,
    items: [
      { to: "/admin/finance/quotes", label: "عروض الأسعار" },
      { to: "/admin/finance/sales-invoices", label: "فواتير المبيعات" },
      { to: "/admin/finance/customers", label: "العملاء" },
      { to: "/admin/finance/sales-import", label: "استيراد مبيعات سلة" },
      { to: "/admin/finance/sales-import-batches", label: "سجل عمليات الاستيراد" },
      { to: "/admin/finance/sales-review", label: "عناصر تحتاج مراجعة" },
      { label: "مرتجعات المبيعات", soon: true },
      { label: "إشعارات المبيعات", soon: true },
    ],
  },
  {
    key: "purchases",
    label: "المشتريات",
    icon: ShoppingCart,
    items: [
      { to: "/admin/finance/purchase-invoices", label: "فواتير المشتريات" },
      { to: "/admin/finance/purchase-invoices-review", label: "فواتير تحتاج مراجعة" },
      { to: "/admin/finance/suppliers", label: "الموردون" },
      { label: "إشعارات الموردين", soon: true },
    ],
  },
  {
    key: "cash",
    label: "النقد والتسويات",
    icon: Wallet,
    items: [
      { to: "/admin/finance/incomes", label: "المقبوضات" },
      { to: "/admin/finance/expenses", label: "المدفوعات" },
      { to: "/admin/finance/accounts", label: "الحسابات المالية" },
      { to: "/admin/finance/owner-account", label: "جاري المالك" },
      { to: "/admin/finance/payment-providers", label: "بوابات الدفع" },
      { to: "/admin/finance/settlements", label: "التسويات" },
      { to: "/admin/finance/settlement-lines", label: "حركات التسويات" },
      { to: "/admin/finance/provider-balances", label: "أرصدة معلقة" },
      { to: "/admin/finance/settlements-review", label: "تسويات تحتاج مراجعة" },
      { to: "/admin/finance/provider-fee-invoices", label: "فواتير رسوم الوسطاء" },
    ],
  },
  {
    key: "accounting",
    label: "المحاسبة",
    icon: BookOpen,
    items: [
      { to: "/admin/finance/chart-of-accounts", label: "دليل الحسابات" },
      { to: "/admin/finance/journal-entries", label: "القيود اليومية" },
      { to: "/admin/finance/general-ledger", label: "دفتر الأستاذ" },
      { to: "/admin/finance/trial-balance", label: "ميزان المراجعة" },
      { to: "/admin/finance/periods", label: "الفترات المحاسبية" },
    ],
  },
  {
    key: "tax",
    label: "الضريبة",
    icon: Percent,
    items: [
      { to: "/admin/finance/vat", label: "لوحة ضريبة القيمة المضافة" },
      { to: "/admin/finance/vat/sales", label: "ضريبة المبيعات" },
      { to: "/admin/finance/vat/purchases", label: "ضريبة المشتريات" },
      { to: "/admin/finance/vat/draft", label: "مسودة الإقرار" },
      { to: "/admin/finance/vat/periods", label: "الفترات الضريبية" },
      { to: "/admin/finance/credit-debit-notes", label: "الإشعارات الدائنة والمدينة" },
    ],
  },
  {
    key: "reports",
    label: "التقارير",
    icon: BarChart3,
    items: [
      { to: "/admin/finance/reports", label: "التقارير المالية" },
      { label: "قائمة الدخل", soon: true },
      { label: "التدفق النقدي", soon: true },
      { to: "/admin/finance/compare", label: "مقارنة الأشهر" },
      { label: "تقارير العملاء والموردين", soon: true },
    ],
  },
  {
    key: "more",
    label: "المزيد",
    icon: MoreHorizontal,
    items: [
      { to: "/admin/finance/categories", label: "التصنيفات" },
      { to: "/admin/finance/attachments", label: "المرفقات" },
      { to: "/admin/finance/import", label: "مركز الاستيراد" },
      { to: "/admin/finance/import-batches", label: "دفعات الاستيراد" },
      { to: "/admin/finance/export", label: "التصدير" },
      { to: "/admin/finance/audit", label: "سجل التعديلات" },
      { to: "/admin/finance/settings", label: "الإعدادات" },
    ],
  },
];

function findActive(pathname: string): { section?: MenuSection; item?: MenuItem } {
  let bestSection: MenuSection | undefined;
  let bestItem: MenuItem | undefined;
  let bestLen = -1;
  for (const s of sections) {
    for (const it of s.items) {
      if (!it.to) continue;
      const match = pathname === it.to || pathname.startsWith(it.to + "/");
      if (match && it.to.length > bestLen) {
        bestLen = it.to.length;
        bestSection = s;
        bestItem = it;
      }
    }
  }
  return { section: bestSection, item: bestItem };
}

function FinanceLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { section: activeSection, item: activeItem } = findActive(pathname);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] tracking-[0.3em] text-gold/80 uppercase">Aqua Haven · Finance</div>
          <h1 className="text-xl font-semibold mt-1 truncate">البوابة المالية</h1>
        </div>
      </div>

      {/* Top banner: 8 dropdown sections, no horizontal scroll */}
      <nav
        dir="rtl"
        className="flex flex-wrap gap-1.5 p-1.5 rounded-xl bg-white/5 border border-white/10"
      >
        {sections.map((s) => {
          const isActive = activeSection?.key === s.key;
          return (
            <DropdownMenu key={s.key}>
              <DropdownMenuTrigger
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] whitespace-nowrap transition outline-none ${
                  isActive
                    ? "bg-gold/15 text-gold border border-gold/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
                }`}
              >
                <s.icon size={13} />
                <span>{s.label}</span>
                <ChevronDown size={12} className="opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[220px]">
                <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                  {s.label}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {s.items.map((it, idx) => {
                  if (it.soon || !it.to) {
                    return (
                      <DropdownMenuItem
                        key={`${s.key}-${idx}`}
                        disabled
                        className="justify-between text-[12px] opacity-60"
                      >
                        <span>{it.label}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                          قريبًا
                        </span>
                      </DropdownMenuItem>
                    );
                  }
                  const itemActive = activeItem?.to === it.to;
                  return (
                    <DropdownMenuItem
                      key={`${s.key}-${idx}`}
                      asChild
                      className={`text-[12px] ${itemActive ? "bg-gold/10 text-gold" : ""}`}
                    >
                      <Link to={it.to}>{it.label}</Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </nav>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Link to="/admin/finance" className="hover:text-foreground">المالية</Link>
        {activeSection && (
          <>
            <ChevronLeft size={12} className="opacity-60" />
            <span>{activeSection.label}</span>
          </>
        )}
        {activeItem && (
          <>
            <ChevronLeft size={12} className="opacity-60" />
            <span className="text-gold">{activeItem.label}</span>
          </>
        )}
      </div>

      <div className="pt-1">
        <Outlet />
      </div>
    </div>
  );
}
