import { useState } from "react";
import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, Fish, Calendar, Inbox, User, LogOut, Sparkles, Wrench, Menu, X, Shield } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { RequestType } from "@/lib/service-requests";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountLayout,
});

const navItems = [
  { to: "/account", label: "نظرة عامة", icon: LayoutDashboard, exact: true },
  { to: "/account/tanks", label: "أحواضي", icon: Fish, exact: false },
  { to: "/account/appointments", label: "مواعيدي", icon: Calendar, exact: false },
  { to: "/account/requests", label: "طلباتي", icon: Inbox, exact: false },
  { to: "/account/profile", label: "ملفي الشخصي", icon: User, exact: false },
] as const;

const quickRequests: { kind: RequestType; label: string; icon: any }[] = [
  { kind: "consultation", label: "اطلب استشارة", icon: Sparkles },
  { kind: "visit", label: "اطلب معاينة", icon: Calendar },
  { kind: "design", label: "اطلب تصميم", icon: Fish },
  { kind: "maintenance", label: "اطلب صيانة", icon: Wrench },
];

function AccountLayout() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const close = () => setOpen(false);

  const currentLabel =
    [...navItems].reverse().find((n) => (n.exact ? pathname === n.to : pathname.startsWith(n.to)))?.label ?? "حسابي";

  const logout = async () => {
    close();
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const SidebarContent = (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 mb-2">حسابي</div>
        <nav className="flex flex-col gap-0.5">
          {navItems.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.exact }}
              onClick={close}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm hover:bg-white/5"
              activeProps={{ className: "flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm bg-white/10 font-semibold" }}
            >
              <n.icon size={16} /> {n.label}
            </Link>
          ))}
        </nav>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground px-2 mb-2 tracking-widest">طلبات سريعة</div>
        <div className="flex flex-col gap-1.5">
          {quickRequests.map((q) => (
            <Link
              key={q.kind}
              to="/account/requests/new"
              search={{ type: q.kind, tank: "" }}
              onClick={close}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-gold/10 text-gold hover:bg-gold/20"
            >
              <q.icon size={14} /> {q.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="pt-2 border-t border-white/5 space-y-1.5">
        {isAdmin && (
          <Link
            to="/admin"
            onClick={close}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground"
          >
            <Shield size={13} /> دخول لوحة الإدارة
          </Link>
        )}
        <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-300 hover:bg-red-500/10">
          <LogOut size={15} /> تسجيل الخروج
        </button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10 pb-24 lg:pb-10">
      {/* Mobile top bar */}
      <div className="lg:hidden mb-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">حسابي</div>
          <div className="truncate text-base font-semibold">{currentLabel}</div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl glass text-sm"
          aria-label="فتح قائمة الحساب"
        >
          <Menu size={16} /> القائمة
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[88vw] max-w-sm overflow-y-auto p-5">
          <SheetHeader className="mb-4 text-right">
            <SheetTitle className="text-base">حسابي</SheetTitle>
          </SheetHeader>
          {SidebarContent}
        </SheetContent>
      </Sheet>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block glass rounded-2xl p-4 h-fit lg:sticky lg:top-28">
          {SidebarContent}
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
