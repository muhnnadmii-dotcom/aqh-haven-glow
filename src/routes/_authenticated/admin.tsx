import { useEffect, useState } from "react";
import { createFileRoute, Outlet, redirect, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import {
  LayoutDashboard, Inbox, Fish, BookOpen, MessageSquareQuote, Users, UserCog,
  Wrench, FileText, Calendar, Palette, Menu, X, Tags, ExternalLink, LogOut, Settings as Cog, Images, Wallet,
  ChevronDown, TrendingUp, TrendingDown, Truck, Paperclip, History, Download, Upload, Archive, Shield, ShieldOff,
  Package, Boxes, FolderTree, ClipboardList, BarChart3,
} from "lucide-react";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { useAllowedPages } from "@/lib/use-allowed-pages";
import { ADMIN_PAGES } from "@/lib/admin-pages";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getSessionUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: r } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "staff", "finance_view", "finance_manage", "finance_accountant", "finance_export", "finance_settings"])
      .limit(1)
      .maybeSingle();
    if (!r) throw redirect({ to: "/account" });
  },
  component: AdminLayout,
});

type NavItem = { to: string; label: string; icon: any; exact?: boolean };
type NavGroup = { key: string; label: string; items: NavItem[]; collapsible?: boolean; financeOnly?: boolean };

const navGroups: NavGroup[] = [
  {
    key: "ops",
    label: "التشغيل",
    items: [
      { to: "/admin", label: "نظرة عامة", icon: LayoutDashboard, exact: true },
      { to: "/admin/requests", label: "الطلبات", icon: Inbox },
      { to: "/admin/appointments", label: "المواعيد", icon: Calendar },
      { to: "/admin/tanks", label: "أحواض العملاء", icon: Fish },
      { to: "/admin/users", label: "العملاء", icon: Users },
    ],
  },
  {
    key: "content",
    label: "محتوى الموقع",
    collapsible: true,
    items: [
      { to: "/admin/content", label: "كل صفحات الموقع", icon: FileText, exact: true },
      { to: "/admin/design", label: "الصفحة الرئيسية", icon: Palette, exact: true },
      { to: "/admin/design/about", label: "من نحن", icon: FileText },
      { to: "/admin/design/contact", label: "تواصل معنا", icon: FileText },
      { to: "/admin/services", label: "خدماتنا", icon: Wrench },
      { to: "/admin/projects", label: "أعمالنا / الأحواض", icon: Fish },
      { to: "/admin/gallery", label: "لقطات من أعمالنا", icon: Images },
      { to: "/admin/project-categories", label: "تصنيفات الأحواض", icon: Tags },
      { to: "/admin/articles", label: "المقالات", icon: BookOpen },
      { to: "/admin/testimonials", label: "التقييمات", icon: MessageSquareQuote },
    ],
  },

  {
    key: "finance",
    label: "المالية",
    collapsible: true,
    financeOnly: true,
    items: [
      { to: "/admin/finance", label: "لوحة المالية", icon: LayoutDashboard, exact: true },
      { to: "/admin/finance/incomes", label: "الدخل", icon: TrendingUp },
      { to: "/admin/finance/expenses", label: "المصروفات", icon: TrendingDown },
      { to: "/admin/finance/suppliers", label: "الموردين", icon: Truck },
      { to: "/admin/finance/categories", label: "التصنيفات", icon: Tags },
      { to: "/admin/finance/attachments", label: "المرفقات", icon: Paperclip },
      { to: "/admin/finance/export", label: "التصدير", icon: Download },
      { to: "/admin/finance/import", label: "استيراد Excel", icon: Upload },
      { to: "/admin/finance/import-batches", label: "دفعات الاستيراد", icon: Archive },
      { to: "/admin/finance/audit", label: "سجل التعديلات", icon: History },
      { to: "/admin/finance/settings", label: "الإعدادات", icon: Cog },
    ],
  },
  {
    key: "inventory",
    label: "المخزون",
    collapsible: true,
    items: [
      { to: "/admin/inventory", label: "لوحة المخزون", icon: LayoutDashboard, exact: true },
      { to: "/admin/inventory/products", label: "المنتجات", icon: Boxes },
      { to: "/admin/inventory/categories", label: "التصنيفات", icon: FolderTree },
      { to: "/admin/inventory/suppliers", label: "الموردين", icon: Truck },
      { to: "/admin/inventory/catalog", label: "كاتلوج دنيا الربيع", icon: BookOpen },
      { to: "/admin/inventory/requests", label: "طلبات التوريد", icon: ClipboardList },
      { to: "/admin/inventory/reports", label: "تقارير المخزون", icon: BarChart3 },
    ],
  },
  {
    key: "admin",
    label: "الإدارة",
    collapsible: true,
    items: [
      { to: "/admin/staff", label: "الموظفين", icon: UserCog },
      { to: "/admin/roles", label: "إدارة الصلاحيات", icon: Shield },
    ],
  },
];

const TITLES: Record<string, string> = {
  "/admin": "نظرة عامة",
  "/admin/requests": "الطلبات",
  "/admin/appointments": "المواعيد",
  "/admin/tanks": "أحواض العملاء",
  "/admin/users": "العملاء",
  "/admin/design": "تصميم الصفحة الرئيسية",
  "/admin/projects": "أعمالنا / الأحواض",
  "/admin/gallery": "لقطات من أعمالنا",
  "/admin/project-categories": "تصنيفات الأحواض",
  "/admin/services": "خدماتنا",
  "/admin/articles": "المقالات",
  "/admin/testimonials": "التقييمات",
  "/admin/content": "محتوى صفحات الموقع",
  "/admin/design/about": "من نحن",
  "/admin/design/contact": "تواصل معنا",
  "/admin/staff": "الموظفين",
  "/admin/inventory": "لوحة المخزون",
  "/admin/inventory/products": "إدارة المنتجات",
  "/admin/inventory/categories": "التصنيفات",
  "/admin/inventory/suppliers": "الموردين",
  "/admin/inventory/catalog": "كاتلوج دنيا الربيع",
  "/admin/inventory/requests": "طلبات التوريد",
  "/admin/inventory/reports": "تقارير المخزون",
};

function AdminLayout() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Lock body scroll when drawer open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // Auto-close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  let title = TITLES[pathname] || "لوحة الإدارة";
  if (pathname.startsWith("/admin/requests/")) title = "تفاصيل الطلب";
  else if (pathname.startsWith("/admin/users/")) title = "تفاصيل العميل";

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile topbar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-2 px-3 h-14 border-b border-white/10 bg-background/95 backdrop-blur">
        <button
          onClick={() => setOpen(true)}
          aria-label="فتح القائمة"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 text-sm shrink-0"
        >
          <Menu size={18} /> القائمة
        </button>
        <div className="text-sm font-semibold truncate flex-1 text-center px-1">{title}</div>
        <Link
          to="/account"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-xs shrink-0"
          aria-label="خروج من الإدارة"
          title="العودة للوحة العميل"
        >
          <LogOut size={13} /> خروج
        </Link>
      </header>

      <div className="lg:flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col fixed inset-y-0 right-0 w-64 border-l border-white/10 bg-background/95 z-20">
          <SidebarContent onNavigate={() => setOpen(false)} onSignOut={handleSignOut} />
        </aside>

        {/* Mobile drawer */}
        {open && (
          <>
            <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <aside className="lg:hidden fixed inset-y-0 right-0 z-50 w-[82%] max-w-[320px] bg-background border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between h-14 px-4 border-b border-white/10 shrink-0">
                <div className="text-xs tracking-widest text-gradient-gold">AQH ADMIN</div>
                <button onClick={() => setOpen(false)} aria-label="إغلاق" className="p-2 rounded-lg hover:bg-white/5">
                  <X size={18} />
                </button>
              </div>
              <SidebarContent onNavigate={() => setOpen(false)} onSignOut={handleSignOut} />
            </aside>
          </>
        )}

        {/* Main content */}
        <main className="flex-1 lg:mr-64 min-w-0">
          <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-8 max-w-6xl mx-auto">
            <RouteAccessGate pathname={pathname}>
              <Outlet />
            </RouteAccessGate>
          </div>
        </main>
      </div>
    </div>
  );
}

function matchPageKey(pathname: string): string | null {
  let best: string | null = null;
  for (const p of ADMIN_PAGES) {
    if (pathname === p.key || pathname.startsWith(p.key + "/")) {
      if (!best || p.key.length > best.length) best = p.key;
    }
  }
  return best;
}

function RouteAccessGate({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { loading, canSee } = useAllowedPages();
  const pageKey = matchPageKey(pathname);
  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">جارٍ التحقق…</div>;
  // Unknown admin path => allow (e.g. dynamic detail pages already inherit parent prefix)
  if (!pageKey) return <>{children}</>;
  if (!canSee(pageKey)) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-500/10 text-red-300 flex items-center justify-center">
          <ShieldOff size={26} />
        </div>
        <h2 className="text-lg font-semibold">لا تملك صلاحية الدخول لهذه الصفحة</h2>
        <p className="text-sm text-muted-foreground">تواصل مع مدير النظام لإضافة هذه الصفحة إلى دورك الوظيفي.</p>
        <Link to="/admin" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/15 border border-gold/30 text-gold text-sm">
          العودة للوحة الإدارة
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

function isItemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(item.to + "/");
}

function SidebarContent({ onNavigate, onSignOut }: { onNavigate: () => void; onSignOut: () => void }) {
  const { canView: canViewFinance } = useFinanceRoles();
  const { canSee } = useAllowedPages();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const visibleGroups = navGroups
    .filter((g) => !g.financeOnly || canViewFinance)
    .map((g) => ({ ...g, items: g.items.filter((i) => canSee(i.to)) }))
    .filter((g) => g.items.length > 0);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of visibleGroups) {
      if (!g.collapsible) { init[g.key] = true; continue; }
      init[g.key] = g.items.some((i) => isItemActive(pathname, i));
    }
    return init;
  });

  // Keep group containing active route open
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const g of visibleGroups) {
        if (!g.collapsible) continue;
        if (g.items.some((i) => isItemActive(pathname, i)) && !next[g.key]) {
          next[g.key] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pathname, canViewFinance]);

  const toggle = (key: string) => setOpenGroups((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="hidden lg:flex items-center justify-between h-16 px-5 border-b border-white/10 shrink-0">
        <div className="text-xs tracking-[0.3em] text-gradient-gold">AQH ADMIN</div>
        <Link
          to="/account"
          onClick={onNavigate}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[11px] hover:bg-gold/25"
          title="العودة للوحة العميل"
        >
          <LogOut size={12} /> خروج
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {visibleGroups.map((g) => {
          const isOpen = openGroups[g.key] ?? true;
          const hasActive = g.items.some((i) => isItemActive(pathname, i));
          return (
            <div key={g.key}>
              {g.collapsible ? (
                <button
                  type="button"
                  onClick={() => toggle(g.key)}
                  className={`w-full flex items-center justify-between px-3 mb-1 text-[10px] uppercase tracking-[0.2em] transition ${
                    hasActive ? "text-gold/80" : "text-muted-foreground/60 hover:text-muted-foreground"
                  }`}
                  aria-expanded={isOpen}
                >
                  <span>{g.label}</span>
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
              ) : (
                <div className="px-3 mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
                  {g.label}
                </div>
              )}
              {isOpen && (
                <div className="flex flex-col gap-0.5">
                  {g.items.map((n) => (
                    <Link
                      key={n.to}
                      to={n.to}
                      onClick={onNavigate}
                      activeOptions={{ exact: n.exact }}
                      className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
                      activeProps={{ className: "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] bg-gold/10 text-gold font-semibold border-r-2 border-gold" }}
                    >
                      <n.icon size={14} className="shrink-0 opacity-80" />
                      <span className="truncate">{n.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3 space-y-1 shrink-0">
        <Link
          to="/account"
          onClick={onNavigate}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] bg-gold/10 text-gold hover:bg-gold/20"
        >
          <LayoutDashboard size={15} /> لوحة العميل
        </Link>
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-white/5"
        >
          <ExternalLink size={15} /> عرض الموقع
        </Link>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-red-300 hover:bg-red-500/10"
        >
          <LogOut size={15} /> تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
