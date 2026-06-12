import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Inbox, Fish, BookOpen, MessageSquareQuote } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const [stats, setStats] = useState({ newReq: 0, projects: 0, articles: 0, testimonials: 0 });

  useEffect(() => {
    (async () => {
      const [c1, c2, p, a, t] = await Promise.all([
        supabase.from("contact_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("consultation_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("articles").select("id", { count: "exact", head: true }),
        supabase.from("testimonials").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        newReq: (c1.count ?? 0) + (c2.count ?? 0),
        projects: p.count ?? 0,
        articles: a.count ?? 0,
        testimonials: t.count ?? 0,
      });
    })();
  }, []);

  const cards = [
    { label: "طلبات جديدة", value: stats.newReq, icon: Inbox, color: "from-blue-500/30 to-blue-700/10" },
    { label: "الأحواض", value: stats.projects, icon: Fish, color: "from-emerald-500/30 to-emerald-700/10" },
    { label: "المقالات", value: stats.articles, icon: BookOpen, color: "from-amber-500/30 to-amber-700/10" },
    { label: "الشهادات", value: stats.testimonials, icon: MessageSquareQuote, color: "from-purple-500/30 to-purple-700/10" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">لوحة التحكم</h1>
        <p className="text-sm text-muted-foreground mt-1">أهلاً بك في لوحة إدارة أكوا هيفن</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`glass rounded-2xl p-5 bg-gradient-to-br ${c.color}`}>
            <c.icon className="text-gold mb-3" size={20} />
            <div className="text-3xl font-bold">{c.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
