import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Inbox, Fish, BookOpen, MessageSquareQuote, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const [stats, setStats] = useState({ newReq: 0, tanks: 0, articles: 0, testimonials: 0 });

  useEffect(() => {
    (async () => {
      const [sr, cr, cs, ct, a, t] = await Promise.all([
        supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("contact_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("consultation_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("customer_tanks").select("id", { count: "exact", head: true }),
        supabase.from("articles").select("id", { count: "exact", head: true }),
        supabase.from("testimonials").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        newReq: (sr.count ?? 0) + (cr.count ?? 0) + (cs.count ?? 0),
        tanks: ct.count ?? 0,
        articles: a.count ?? 0,
        testimonials: t.count ?? 0,
      });
    })();
  }, []);

  const cards = [
    { label: "طلبات جديدة", value: stats.newReq, icon: Inbox, color: "from-blue-500/30 to-blue-700/10", to: "/admin/requests" as const },
    { label: "أحواض العملاء", value: stats.tanks, icon: Fish, color: "from-emerald-500/30 to-emerald-700/10", to: "/admin/tanks" as const },
    { label: "المقالات", value: stats.articles, icon: BookOpen, color: "from-amber-500/30 to-amber-700/10", to: "/admin/articles" as const },
    { label: "الشهادات", value: stats.testimonials, icon: MessageSquareQuote, color: "from-purple-500/30 to-purple-700/10", to: "/admin/testimonials" as const },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">لوحة التحكم</h1>
        <p className="text-sm text-muted-foreground mt-1">أهلاً بك في لوحة إدارة أكوا هيفن</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className={`group glass rounded-2xl p-5 bg-gradient-to-br ${c.color} transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer block`}
          >
            <div className="flex items-center justify-between mb-3">
              <c.icon className="text-gold" size={20} />
              <ArrowLeft size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
            </div>
            <div className="text-3xl font-bold">{c.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
