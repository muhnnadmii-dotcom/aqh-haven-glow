import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Fish, Calendar, Inbox, Sparkles, Wrench, Plus, ChevronLeft } from "lucide-react";
import { getSessionUser } from "@/lib/client-auth";
import { publicUrl } from "@/lib/storage";
import {
  REQUEST_TYPE_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_COLOR,
  type RequestType, type RequestStatus,
} from "@/lib/service-requests";

export const Route = createFileRoute("/_authenticated/account/")({
  component: AccountHome,
});

type TankRow = {
  id: string; name: string; tank_type: string | null;
  volume_liters: number | null; primary_image: string | null; image_paths: string[] | null;
};
type ReqRow = { id: string; type: RequestType; status: RequestStatus; created_at: string };
type ApptRow = { id: string; kind: string; status: string; preferred_date: string | null };

function AccountHome() {
  const [stats, setStats] = useState({ tanks: 0, appts: 0, requests: 0 });
  const [name, setName] = useState("");
  const [tanks, setTanks] = useState<TankRow[]>([]);
  const [requests, setRequests] = useState<ReqRow[]>([]);
  const [nextAppt, setNextAppt] = useState<ApptRow | null>(null);

  useEffect(() => {
    (async () => {
      const user = await getSessionUser();
      if (!user) return;
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      setName(prof?.full_name ?? "");

      const [t, a, sr, cr, cs, recentTanks, recentReqs, upcoming] = await Promise.all([
        supabase.from("customer_tanks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("contact_requests").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("consultation_requests").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("customer_tanks")
          .select("id,name,tank_type,volume_liters,primary_image,image_paths")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
        supabase.from("service_requests")
          .select("id,type,status,created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(3),
        supabase.from("appointments")
          .select("id,kind,status,preferred_date")
          .eq("user_id", user.id)
          .not("preferred_date", "is", null)
          .gte("preferred_date", new Date().toISOString())
          .order("preferred_date", { ascending: true }).limit(1),
      ]);

      setStats({
        tanks: t.count ?? 0,
        appts: a.count ?? 0,
        requests: (sr.count ?? 0) + (cr.count ?? 0) + (cs.count ?? 0),
      });
      setTanks((recentTanks.data ?? []) as TankRow[]);
      setRequests((recentReqs.data ?? []) as ReqRow[]);
      setNextAppt(((upcoming.data ?? [])[0] as ApptRow) ?? null);
    })();
  }, []);

  const cards = [
    { label: "أحواضي", value: stats.tanks, icon: Fish, to: "/account/tanks" as const },
    { label: "المواعيد", value: stats.appts, icon: Calendar, to: "/account/appointments" as const },
    { label: "طلباتي", value: stats.requests, icon: Inbox, to: "/account/requests" as const },
  ];

  const quick = [
    { label: "اطلب صيانة", icon: Wrench, to: "/account/requests/new" as const, search: { type: "maintenance" as RequestType, tank: "" } },
    { label: "اطلب استشارة", icon: Sparkles, to: "/account/requests/new" as const, search: { type: "consultation" as RequestType, tank: "" } },
    { label: "اطلب تصميم", icon: Fish, to: "/account/requests/new" as const, search: { type: "design" as RequestType, tank: "" } },
    { label: "أضف حوض", icon: Plus, to: "/account/tanks" as const, search: undefined },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">
          أهلًا {name || "بك"} <Sparkles className="inline text-gold" size={20} />
        </h1>
        <p className="text-sm text-muted-foreground mt-1">ملخص سريع لأحواضك وطلباتك.</p>
      </div>

      {/* Compact stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="glass rounded-xl p-3 sm:p-4 hover:bg-white/5 transition relative"
          >
            <c.icon className="absolute top-2 end-2 text-gold/70" size={14} />
            <div className="text-2xl sm:text-3xl font-bold leading-none">{c.value}</div>
            <div className="text-[11px] sm:text-xs text-muted-foreground mt-1.5">{c.label}</div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="text-sm font-semibold mb-2.5">طلبات سريعة</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {quick.map((q) => (
            <Link
              key={q.label}
              to={q.to}
              {...(q.search ? { search: q.search } : {})}
              className="glass-gold rounded-xl px-3 py-2.5 text-xs sm:text-sm flex items-center justify-center gap-1.5 text-gold hover:bg-gold/10 transition text-center"
            >
              <q.icon size={14} /> {q.label}
            </Link>
          ))}
        </div>
      </section>

      {/* My tanks */}
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold">أحواضي</h2>
          {tanks.length > 0 && (
            <Link to="/account/tanks" className="text-xs text-gold hover:underline inline-flex items-center gap-1">
              عرض الكل <ChevronLeft size={12} />
            </Link>
          )}
        </div>
        {tanks.length === 0 ? (
          <div className="glass rounded-xl p-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">لم تتم إضافة أحواض بعد</p>
            <Link to="/account/tanks" className="text-xs px-3 py-1.5 rounded-lg bg-gold/15 text-gold hover:bg-gold/25">
              أضف حوضك الأول
            </Link>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tanks.map((tk) => {
              const img = tk.primary_image || tk.image_paths?.[0];
              return (
                <Link
                  key={tk.id}
                  to="/account/tanks/$id"
                  params={{ id: tk.id }}
                  className="glass rounded-xl p-2.5 flex gap-3 items-center hover:bg-white/5 transition"
                >
                  <div className="h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-white/5 grid place-items-center">
                    {img ? (
                      <img src={publicUrl(img)} alt={tk.name} className="h-full w-full object-cover" />
                    ) : (
                      <Fish size={20} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{tk.name || "حوض"}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {[tk.tank_type, tk.volume_liters ? `${tk.volume_liters} لتر` : null].filter(Boolean).join(" • ") || "—"}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent requests */}
      <section>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold">آخر الطلبات</h2>
          {requests.length > 0 && (
            <Link to="/account/requests" className="text-xs text-gold hover:underline inline-flex items-center gap-1">
              عرض الكل <ChevronLeft size={12} />
            </Link>
          )}
        </div>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد طلبات بعد.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="glass rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{REQUEST_TYPE_LABEL[r.type]}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("ar-SA")}
                  </div>
                </div>
                <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-md ${REQUEST_STATUS_COLOR[r.status]}`}>
                  {REQUEST_STATUS_LABEL[r.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Upcoming appointment */}
      <section>
        <h2 className="text-sm font-semibold mb-2.5">المواعيد القادمة</h2>
        {!nextAppt ? (
          <p className="text-sm text-muted-foreground">لا توجد مواعيد قادمة.</p>
        ) : (
          <Link
            to="/account/appointments"
            className="glass rounded-xl p-3 flex items-center gap-3 hover:bg-white/5 transition"
          >
            <div className="h-10 w-10 shrink-0 rounded-lg bg-gold/15 text-gold grid place-items-center">
              <Calendar size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{labelKind(nextAppt.kind)}</div>
              <div className="text-[11px] text-muted-foreground">
                {nextAppt.preferred_date && new Date(nextAppt.preferred_date).toLocaleString("ar-SA")}
              </div>
            </div>
            <ChevronLeft size={14} className="text-muted-foreground" />
          </Link>
        )}
      </section>
    </div>
  );
}

function labelKind(k: string) {
  return ({ consultation: "استشارة", visit: "معاينة", design: "تصميم", maintenance: "صيانة" } as Record<string, string>)[k] ?? k;
}
