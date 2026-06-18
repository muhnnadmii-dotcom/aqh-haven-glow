import { useEffect, useState } from "react";
import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, Fish, Calendar, Inbox, User, LogOut, Sparkles, Wrench, Menu, Shield, FileText, Bell } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getSessionUser } from "@/lib/client-auth";
import type { RequestType } from "@/lib/service-requests";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountLayout,
});

const navItems = [
  { to: "/account", label: "نظرة عامة", icon: LayoutDashboard, exact: true },
  { to: "/account/tanks", label: "أحواضي", icon: Fish, exact: false },
  { to: "/account/appointments", label: "مواعيدي", icon: Calendar, exact: false },
  { to: "/account/requests", label: "طلباتي", icon: Inbox, exact: false },
  { to: "/account/reports", label: "تقاريري", icon: FileText, exact: false },
  { to: "/account/notifications", label: "الإشعارات", icon: Bell, exact: false },
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
  const { isAdmin, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [isStaff, setIsStaff] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const close = () => setOpen(false);

  useEffect(() => {
    let alive = true;
    const loadUnread = async () => {
      const u = await getSessionUser();
      if (!u) return;
      const { count } = await supabase
        .from("notifications" as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", u.id)
        .eq("is_read", false);
      if (alive) setUnread(count ?? 0);
    };
    loadUnread();
    const t = setInterval(loadUnread, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [pathname]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) { if (alive) setIsStaff(false); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "staff").maybeSingle();
      if (alive) setIsStaff(!!data);
    })();
    return () => { alive = false; };
  }, [user]);

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
          {navItems.map((n) => {
            const isBell = n.to === "/account/notifications";
            return (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.exact }}
                onClick={close}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm hover:bg-white/5"
                activeProps={{ className: "flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm bg-white/10 font-semibold" }}
              >
                <n.icon size={16} />
                <span className="flex-1">{n.label}</span>
                {isBell && unread > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold text-background font-bold">{unread > 99 ? "99+" : unread}</span>
                )}
              </Link>
            );
          })}
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
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/account/notifications"
            className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl glass"
            aria-label="الإشعارات"
          >
            <Bell size={16} />
            {unread > 0 && (
              <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-background text-[10px] font-bold grid place-items-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl glass text-sm"
            aria-label="فتح قائمة الحساب"
          >
            <Menu size={16} /> القائمة
          </button>
        </div>
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
