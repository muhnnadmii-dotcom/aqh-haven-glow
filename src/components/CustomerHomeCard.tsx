import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, Wrench, Plus, Fish, Calendar, Inbox, ArrowLeft } from "lucide-react";

type Snapshot = {
  name: string;
  openRequests: number;
  tanks: number;
  nextAppointment: string | null;
};

const CLOSED_STATUSES = ["completed", "cancelled", "closed", "done", "rejected"];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

export function CustomerHomeCard() {
  const { user, loading } = useAuth();
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!user) { setSnap(null); return; }
    let active = true;
    (async () => {
      const [prof, openReq, tanks, appt] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("service_requests").select("id", { count: "exact", head: true })
          .eq("user_id", user.id).not("status", "in", `(${CLOSED_STATUSES.join(",")})`),
        supabase.from("customer_tanks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("appointments").select("id,preferred_date").eq("user_id", user.id)
          .not("preferred_date", "is", null)
          .gte("preferred_date", new Date().toISOString())
          .order("preferred_date", { ascending: true }).limit(1).maybeSingle(),
      ]);
      if (!active) return;
      setSnap({
        name: (prof.data?.full_name as string) || (user.email?.split("@")[0] ?? "صديقنا"),
        openRequests: openReq.count ?? 0,
        tanks: tanks.count ?? 0,
        nextAppointment: (appt.data as any)?.preferred_date ?? null,
      });
    })();
    return () => { active = false; };
  }, [user]);

  if (loading || !user) return null;

  const name = snap?.name ?? "";
  const hasAnyData = !!snap && (snap.openRequests > 0 || snap.tanks > 0 || !!snap.nextAppointment);

  return (
    <section className="relative py-8 sm:py-10">
      <div className="mx-auto max-w-5xl px-5 sm:px-6">
        <div className="glass-gold rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-[color:var(--gold)]/20 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] tracking-widest text-gradient-gold mb-1.5">YOUR ACCOUNT</div>
              <h2 className="text-xl sm:text-2xl font-bold mb-1.5 truncate">
                مرحبًا {name} <span aria-hidden>👋</span>
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                تابع طلباتك، أحواضك، مواعيدك، وتقاريرك من لوحة العميل.
              </p>
            </div>
            <Link
              to="/account"
              className="btn-gold rounded-xl px-5 py-2.5 text-sm inline-flex items-center justify-center gap-2 shrink-0"
            >
              <LayoutDashboard size={15} /> الدخول إلى لوحة العميل
              <ArrowLeft size={14} />
            </Link>
          </div>

          {/* Smart stats */}
          {snap && (
            <div className="mt-5 grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-3">
              {snap.openRequests > 0 && (
                <StatRow
                  icon={Inbox}
                  text={`لديك ${snap.openRequests} ${snap.openRequests === 1 ? "طلب" : snap.openRequests === 2 ? "طلبين" : "طلبات"} قيد المتابعة`}
                  cta="عرض طلباتي"
                  to="/account/requests"
                />
              )}
              {snap.tanks > 0 && (
                <StatRow
                  icon={Fish}
                  text={`أحواضك المسجلة: ${snap.tanks}`}
                  cta="عرض أحواضي"
                  to="/account/tanks"
                />
              )}
              {snap.nextAppointment && (
                <StatRow
                  icon={Calendar}
                  text={`موعدك القادم: ${formatDate(snap.nextAppointment)}`}
                  cta="عرض المواعيد"
                  to="/account/appointments"
                />
              )}
              {!hasAnyData && (
                <div className="sm:col-span-3 text-sm text-muted-foreground bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  ابدأ بإضافة حوضك الأول أو إرسال طلب جديد.
                </div>
              )}
            </div>
          )}

          {/* Quick actions */}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/account/requests/new"
              search={{ type: "maintenance", tank: "" } as any}
              className="rounded-xl px-4 py-2 text-xs inline-flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10"
            >
              <Wrench size={13} /> طلب صيانة
            </Link>
            <Link
              to="/account/tanks"
              className="rounded-xl px-4 py-2 text-xs inline-flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10"
            >
              <Plus size={13} /> إضافة حوض
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatRow({ icon: Icon, text, cta, to }: { icon: any; text: string; cta: string; to: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5">
      <div className="flex items-center gap-2 min-w-0 text-sm">
        <span className="grid place-items-center h-7 w-7 rounded-lg bg-[color:var(--gold)]/15 text-[color:var(--gold)] shrink-0">
          <Icon size={14} />
        </span>
        <span className="truncate">{text}</span>
      </div>
      <Link to={to as any} className="text-xs text-[color:var(--gold)] hover:underline shrink-0 inline-flex items-center gap-1">
        {cta} <ArrowLeft size={12} />
      </Link>
    </div>
  );
}
