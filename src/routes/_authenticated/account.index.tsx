import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Fish, Calendar, Inbox, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account/")({
  component: AccountHome,
});

function AccountHome() {
  const [stats, setStats] = useState({ tanks: 0, appts: 0, requests: 0, lastReport: "" });
  const [name, setName] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle();
      setName(prof?.full_name ?? "");
      const [t, a, c, cs] = await Promise.all([
        supabase.from("customer_tanks").select("id", { count: "exact", head: true }).eq("user_id", u.user.id),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("user_id", u.user.id),
        supabase.from("contact_requests").select("id", { count: "exact", head: true }).eq("user_id", u.user.id),
        supabase.from("consultation_requests").select("id", { count: "exact", head: true }).eq("user_id", u.user.id),
      ]);
      setStats({
        tanks: t.count ?? 0,
        appts: a.count ?? 0,
        requests: (c.count ?? 0) + (cs.count ?? 0),
        lastReport: "",
      });
    })();
  }, []);

  const cards = [
    { label: "أحواضي", value: stats.tanks, icon: Fish },
    { label: "المواعيد", value: stats.appts, icon: Calendar },
    { label: "طلباتي", value: stats.requests, icon: Inbox },
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
          <div key={c.label} className="glass rounded-2xl p-5">
            <c.icon className="text-gold mb-3" size={20} />
            <div className="text-3xl font-bold">{c.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
