import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, Wrench, Plus, Fish, Calendar, Inbox, ArrowLeft } from "lucide-react";
import { AquariumAssistantShortcut } from "./aquarium/AquariumAssistantShortcut";

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

  if (loading) return null;
  if (!user) return <GuestCustomerBanner />;

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

          <AquariumAssistantShortcut />

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

function GuestCustomerBanner() {
  return (
    <section className="relative py-8 sm:py-10">
      <div className="mx-auto max-w-5xl px-5 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl glass-gold border border-[color:var(--gold)]/25 shadow-xl p-6 sm:p-8">
          {/* decorative glow */}
          <div aria-hidden className="pointer-events-none absolute -top-20 -left-20 h-56 w-56 rounded-full bg-[color:var(--gold)]/15 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[oklch(0.45_0.12_245)]/30 blur-3xl" />

          <div className="relative flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
            {/* Text side */}
            <div className="flex-1 min-w-0 text-center md:text-right">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--gold)]/15 border border-[color:var(--gold)]/30 px-3 py-1 text-[11px] text-[color:var(--gold)] mb-3">
                <span aria-hidden>📱</span> جديد · لوحة العميل
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-2">
                تابع حوضك من جوالك
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto md:mx-0">
                سجّل حالة حوضك، قراءات الماء، وصوره — واطلب دعم Aqua Haven بضغطة.
                كل شي عن حوضك في مكان واحد.
              </p>

              <div className="mt-5 flex flex-wrap gap-2.5 justify-center md:justify-start">
                <Link
                  to="/account"
                  className="btn-gold rounded-xl px-5 py-2.5 text-sm inline-flex items-center gap-2"
                >
                  <LayoutDashboard size={15} /> ادخل لوحتك
                  <ArrowLeft size={14} />
                </Link>
                <Link
                  to="/account/tanks"
                  className="rounded-xl px-5 py-2.5 text-sm inline-flex items-center gap-2 bg-white/5 border border-white/15 hover:bg-white/10"
                >
                  <Plus size={14} /> تحديث سريع للحوض
                </Link>
              </div>
            </div>

            {/* Visual side — mini tank status card */}
            <div className="w-full md:w-[300px] shrink-0">
              <div className="relative rounded-2xl bg-[oklch(0.12_0.06_245)]/70 border border-white/10 p-4 backdrop-blur-md">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="grid place-items-center h-9 w-9 rounded-xl bg-[color:var(--gold)]/15 text-[color:var(--gold)]">
                      <Fish size={16} />
                    </span>
                    <div className="text-xs">
                      <div className="text-muted-foreground">حوضي الرئيسي</div>
                      <div className="font-semibold">عرض مباشر</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                    ممتاز
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <MiniStat label="الحرارة" value="25°" />
                  <MiniStat label="pH" value="7.4" />
                  <MiniStat label="تغيير الماء" value="٣ أيام" />
                </div>

                <div className="mt-3 text-[11px] text-muted-foreground text-center">
                  اربط حوضك الرئيسي من الإعدادات لتظهر بياناتك هنا.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-2">
      <div className="text-sm font-bold text-gradient-gold">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
