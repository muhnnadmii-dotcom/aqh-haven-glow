import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Inbox, Fish, BookOpen, MessageSquareQuote } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!r) throw redirect({ to: "/account" });
  },
  component: AdminLayout,
});

const navItems = [
  { to: "/admin", label: "نظرة عامة", icon: LayoutDashboard, exact: true },
  { to: "/admin/requests", label: "الطلبات", icon: Inbox, exact: false },
  { to: "/admin/projects", label: "الأحواض", icon: Fish, exact: false },
  { to: "/admin/articles", label: "المقالات", icon: BookOpen, exact: false },
  { to: "/admin/testimonials", label: "الشهادات", icon: MessageSquareQuote, exact: false },
] as const;

function AdminLayout() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="glass rounded-2xl p-4 h-fit lg:sticky lg:top-28">
          <div className="text-xs tracking-widest text-gradient-gold mb-4 px-2">ADMIN</div>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
            {navItems.map((n) => (
              <Link key={n.to} to={n.to}
                activeOptions={{ exact: n.exact }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm hover:bg-white/5 whitespace-nowrap"
                activeProps={{ className: "flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm bg-white/10 text-foreground font-semibold whitespace-nowrap" }}>
                <n.icon size={16} /> {n.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
