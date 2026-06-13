import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Inbox, Fish, BookOpen, MessageSquareQuote, Users, UserCog, Wrench, FileText, Calendar, Palette } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).in("role", ["admin", "staff"]).maybeSingle();
    if (!r) throw redirect({ to: "/account" });
  },
  component: AdminLayout,
});

const navGroups = [
  {
    label: "عام",
    items: [
      { to: "/admin", label: "نظرة عامة", icon: LayoutDashboard, exact: true },
      { to: "/admin/requests", label: "الطلبات", icon: Inbox, exact: false },
      { to: "/admin/appointments", label: "المواعيد", icon: Calendar, exact: false },
    ],
  },
  {
    label: "تصميم المتجر",
    items: [
      { to: "/admin/design", label: "الصفحة الرئيسية", icon: Palette, exact: true },
      { to: "/admin/design/about", label: "من نحن", icon: FileText, exact: false },
      { to: "/admin/design/contact", label: "تواصل معنا", icon: FileText, exact: false },
    ],
  },
  {
    label: "محتوى الصفحات",
    items: [
      { to: "/admin/projects", label: "اعمالنا (الأحواض)", icon: Fish, exact: false },
      { to: "/admin/services", label: "خدماتنا", icon: Wrench, exact: false },
      { to: "/admin/articles", label: "المقالات", icon: BookOpen, exact: false },
      { to: "/admin/testimonials", label: "التقييمات", icon: MessageSquareQuote, exact: false },
    ],
  },
  {
    label: "الإدارة",
    items: [
      { to: "/admin/users", label: "العملاء", icon: Users, exact: false },
      { to: "/admin/staff", label: "الموظفين", icon: UserCog, exact: false },
    ],
  },
] as const;

function AdminLayout() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="glass rounded-2xl p-4 h-fit lg:sticky lg:top-28">
          <div className="text-xs tracking-widest text-gradient-gold mb-4 px-2">ADMIN</div>
          <nav className="flex flex-col gap-4">
            {navGroups.map((g) => (
              <div key={g.label}>
                <div className="text-[10px] uppercase text-muted-foreground px-2 mb-1.5 tracking-widest">{g.label}</div>
                <div className="flex flex-col gap-0.5">
                  {g.items.map((n) => (
                    <Link key={n.to} to={n.to}
                      activeOptions={{ exact: n.exact }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-white/5 whitespace-nowrap"
                      activeProps={{ className: "flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-white/10 text-foreground font-semibold whitespace-nowrap" }}>
                      <n.icon size={15} /> {n.label}
                    </Link>
                  ))}
                </div>
              </div>
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
