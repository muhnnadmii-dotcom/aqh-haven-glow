import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Fish, Calendar, Inbox, Sparkles, ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/client-auth";

export const Route = createFileRoute("/_authenticated/account/")({
  component: AccountHome,
});

function AccountHome() {
  const [stats, setStats] = useState({ tanks: 0, appts: 0, requests: 0 });
  const [name, setName] = useState("");

  useEffect(() => {
    (async () => {
      const user = await getSessionUser();
      if (!user) return;
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      setName(prof?.full_name ?? "");
      const [t, a, sr, cr, cs] = await Promise.all([
        supabase.from("customer_tanks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("contact_requests").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("consultation_requests").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      setStats({
        tanks: t.count ?? 0,
        appts: a.count ?? 0,
        requests: (sr.count ?? 0) + (cr.count ?? 0) + (cs.count ?? 0),
      });
    })();
  }, []);

  const cards = [
    { label: "أحواضي", value: stats.tanks, icon: Fish, to: "/account/tanks" as const },
    { label: "المواعيد", value: stats.appts, icon: Calendar, to: "/account/appointments" as const },
    { label: "طلباتي", value: stats.requests, icon: Inbox, to: "/account/requests" as const },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs tracking-widest text-gradient-gold mb-2">حسابي</div>
        <h1 className="text-3xl font-bold">أهلاً {name || "بك"} <Sparkles className="inline text-gold" size={22} /></h1>
        <p className="text-sm text-muted-foreground mt-1">ملخص سريع لأحواضك وطلباتك.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="group glass rounded-2xl p-5 transition-all hover:glass-gold hover:-translate-y-1 active:translate-y-0 cursor-pointer block"
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
