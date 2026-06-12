import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, Fish, Calendar, Inbox, User, LogOut, Sparkles, Wrench } from "lucide-react";
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

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="glass rounded-2xl p-4 h-fit lg:sticky lg:top-28 space-y-5">
          <div>
            <div className="text-xs tracking-widest text-gradient-gold mb-3 px-2">حسابي</div>
            <nav className="flex flex-col gap-0.5">
              {navItems.map((n) => (
                <Link key={n.to} to={n.to} activeOptions={{ exact: n.exact }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-white/5"
                  activeProps={{ className: "flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-white/10 font-semibold" }}>
                  <n.icon size={15} /> {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground px-2 mb-2 tracking-widest">طلبات سريعة</div>
            <div className="flex flex-col gap-1.5">
              {quickRequests.map((q) => (
                <Link key={q.kind} to="/account/requests/new" search={{ type: q.kind, tank: "" }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-gold/10 text-gold hover:bg-gold/20">
                  <q.icon size={14} /> {q.label}
                </Link>
              ))}
            </div>
          </div>
          {isAdmin && (
            <Link to="/admin" className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10">
              <LayoutDashboard size={15} /> لوحة الإدارة
            </Link>
          )}
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-300 hover:bg-red-500/10">
            <LogOut size={15} /> تسجيل خروج
          </button>
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
