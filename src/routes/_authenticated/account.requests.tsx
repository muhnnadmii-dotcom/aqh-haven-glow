import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/account/requests")({
  component: RequestsPage,
});

type ContactReq = { id: string; type: string; message: string; status: string; created_at: string };
type ConsultReq = { id: string; goal: string | null; tank_type: string | null; size: string | null; details: string; status: string; created_at: string };

function RequestsPage() {
  const [contacts, setContacts] = useState<ContactReq[]>([]);
  const [consults, setConsults] = useState<ConsultReq[]>([]);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
      const [c, cs] = await Promise.all([
        supabase.from("contact_requests").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false }),
        supabase.from("consultation_requests").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false }),
      ]);
      setContacts((c.data ?? []) as ContactReq[]);
      setConsults((cs.data ?? []) as ConsultReq[]);
    })();
  }, []);

  const badge = (s: string) => {
    const map: Record<string, string> = { new: "bg-blue-500/20 text-blue-300", in_progress: "bg-yellow-500/20 text-yellow-300", closed: "bg-green-500/20 text-green-300" };
    const label: Record<string, string> = { new: "جديد", in_progress: "قيد المتابعة", closed: "مغلق" };
    return <span className={`px-2 py-0.5 rounded-md text-xs ${map[s] ?? ""}`}>{label[s] ?? s}</span>;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">طلباتي</h1>

      <section className="glass rounded-2xl p-5">
        <h2 className="font-bold mb-3">طلبات التواصل ({contacts.length})</h2>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد طلبات. <Link to="/contact" className="text-gold hover:underline">أرسل طلب</Link></p>
        ) : (
          <ul className="space-y-2">
            {contacts.map((c) => (
              <li key={c.id} className="glass rounded-xl p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="font-semibold text-sm">{c.type}</div>
                  {badge(c.status)}
                </div>
                <p className="text-sm text-muted-foreground">{c.message}</p>
                <div className="text-xs text-muted-foreground mt-1">{new Date(c.created_at).toLocaleString("ar-SA")}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="font-bold mb-3">طلبات الاستشارة ({consults.length})</h2>
        {consults.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد استشارات. <Link to="/consultation" className="text-gold hover:underline">احجز استشارة</Link></p>
        ) : (
          <ul className="space-y-2">
            {consults.map((c) => (
              <li key={c.id} className="glass rounded-xl p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="font-semibold text-sm">{c.goal ?? "استشارة"}</div>
                  {badge(c.status)}
                </div>
                <div className="text-xs text-muted-foreground mb-1">نوع: {c.tank_type ?? "—"} · {c.size ?? "—"}</div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.details}</p>
                <div className="text-xs text-muted-foreground mt-1">{new Date(c.created_at).toLocaleString("ar-SA")}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
