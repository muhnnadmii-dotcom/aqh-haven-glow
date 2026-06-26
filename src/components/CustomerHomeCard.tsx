import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Snapshot = {
  name: string;
  tanks: number;
  lastUpdate: string | null;
  orderVerified: boolean;
  hasPendingOrder: boolean;
  freeConsultsLeft: number;
};

function timeAgoAr(iso: string | null): string {
  if (!iso) return "لا يوجد تحديث بعد";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return "الآن";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "قبل لحظات";
  if (mins < 60) return `قبل ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `قبل ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `قبل ${days} ${days === 1 ? "يوم" : days === 2 ? "يومين" : "أيام"}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `قبل ${months} شهر`;
  const years = Math.floor(months / 12);
  return `قبل ${years} سنة`;
}

export function CustomerHomeCard() {
  const { user, loading } = useAuth();
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!user) { setSnap(null); return; }
    let active = true;
    (async () => {
      const [prof, tanks] = await Promise.all([
        supabase.from("profiles").select("full_name, salla_order_no, order_verified, free_consults_total, free_consults_used" as any).eq("id", user.id).maybeSingle(),
        supabase.from("customer_tanks").select("id, updated_at").eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
      ]);
      if (!active) return;
      const rows = (tanks.data ?? []) as Array<{ id: string; updated_at: string | null }>;
      const p = (prof.data ?? {}) as any;
      const total = Number(p.free_consults_total ?? 0);
      const used = Number(p.free_consults_used ?? 0);
      setSnap({
        name: (p.full_name as string) || (user.email?.split("@")[0] ?? "صديقنا"),
        tanks: rows.length,
        lastUpdate: rows[0]?.updated_at ?? null,
        orderVerified: !!p.order_verified,
        hasPendingOrder: !!p.salla_order_no && !p.order_verified,
        freeConsultsLeft: Math.max(0, total - used),
      });
    })();
    return () => { active = false; };
  }, [user]);

  if (loading) return null;

  const isMember = !!user && !!snap && snap.tanks > 0;

  if (!isMember) {
    return <GuestBlock consultBadge={snap ? <ConsultBadge snap={snap} /> : null} />;
  }
  return <MemberBlock snap={snap!} />;
}

function ConsultBadge({ snap }: { snap: Snapshot }) {
  if (snap.orderVerified && snap.freeConsultsLeft > 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs bg-[color:var(--gold)]/15 border border-[color:var(--gold)]/30 text-[color:var(--gold)]">
        ✦ لديك {snap.freeConsultsLeft} استشارات مجانية
      </div>
    );
  }
  if (snap.hasPendingOrder) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs bg-white/5 border border-white/10 text-muted-foreground">
        ⏳ طلبك قيد التحقق — بنفعّل استشاراتك المجانية قريبًا
      </div>
    );
  }
  return null;
}

function GuestBlock({ consultBadge }: { consultBadge?: React.ReactNode }) {
  return (
    <section className="relative py-8 sm:py-10 aqh-guest">
      <div className="mx-auto max-w-5xl px-5 sm:px-6">
        <div className="glass-gold rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-[color:var(--gold)]/20 shadow-lg">
          <div className="text-[11px] tracking-widest text-gradient-gold mb-2">✦ لوحة العميل</div>
          <h2 className="aqh-g-title text-2xl sm:text-3xl font-bold mb-2">
            سجّل حوضك وتابعه من جوالك
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-6 max-w-2xl">
            أنشئ حسابك، أضف حوضك، وخلّ Aqua Haven معك خطوة بخطوة — متابعة، تذكيرات، وطلب خدمة بضغطة.
          </p>

          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3 mb-6">
            <FeatureRow icon="✔" title="تابع حالة حوضك" desc="قراءات وحالة لحظية" />
            <FeatureRow icon="🔔" title="تذكيرات الصيانة" desc="ما تنسى تغيير الماء" />
            <FeatureRow icon="🎧" title="طلب دعم بضغطة" desc="فريقنا معك وقت المشكلة" />
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <Link
              to="/auth"
              search={{ redirect: "/account/tanks" } as any}
              className="btn-gold rounded-xl px-5 py-2.5 text-sm inline-flex items-center justify-center gap-2"
            >
              سجّل حوضك الآن ←
            </Link>
            <Link
              to="/auth"
              search={{ redirect: "/account" } as any}
              className="text-sm text-[color:var(--gold)] hover:underline"
            >
              عندي حساب · دخول
            </Link>
          </div>
          {consultBadge && <div className="mt-5">{consultBadge}</div>}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
      <span className="grid place-items-center h-9 w-9 rounded-lg bg-[color:var(--gold)]/15 text-[color:var(--gold)] shrink-0 text-lg">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}

function MemberBlock({ snap }: { snap: Snapshot }) {
  const { name, tanks, lastUpdate } = snap;
  const tanksLabel = tanks === 1 ? "حوض مسجّل واحد" : tanks === 2 ? "حوضان مسجّلان" : `${tanks} أحواض مسجّلة`;
  return (
    <section className="relative py-8 sm:py-10 aqh-member">
      <div className="mx-auto max-w-5xl px-5 sm:px-6">
        <div className="glass-gold rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-[color:var(--gold)]/20 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] tracking-widest text-gradient-gold mb-1.5">YOUR ACCOUNT</div>
              <h2 className="aqh-m-title text-xl sm:text-2xl font-bold mb-1.5 truncate">
                مرحبًا {name} <span aria-hidden>👋</span>
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                تابع طلباتك، أحواضك، ومواعيدك من مكان واحد.
              </p>
              <div className="mt-2"><ConsultBadge snap={snap} /></div>
            </div>
            <Link
              to="/account"
              className="btn-gold rounded-xl px-5 py-2.5 text-sm inline-flex items-center justify-center gap-2 shrink-0"
            >
              ⬚ لوحة العميل ←
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-semibold">🐟 أحواضك</div>
                <span className="text-[11px] text-[color:var(--gold)]">● ممتاز</span>
              </div>
              <div className="text-xs text-muted-foreground mb-2">
                {tanksLabel} · آخر تحديث {timeAgoAr(lastUpdate)}
              </div>
              <Link to="/account/tanks" className="text-xs text-[color:var(--gold)] hover:underline">
                عرض أحواضي ←
              </Link>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="text-sm font-semibold mb-1">✦ مساعد الحوض</div>
              <div className="text-xs text-muted-foreground mb-2">
                سجّل حالة حوضك، القراءات، أو ارفع صورة خلال ثوانٍ.
              </div>
              <Link
                to="/account/tanks"
                className="text-xs inline-flex items-center gap-1 text-[color:var(--gold)] hover:underline"
              >
                ⚡ تحديث سريع للحوض
              </Link>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/account/tanks"
              className="rounded-xl px-4 py-2 text-xs inline-flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10"
            >
              + إضافة حوض
            </Link>
            <Link
              to="/account/requests/new"
              search={{ type: "maintenance", tank: "" } as any}
              className="rounded-xl px-4 py-2 text-xs inline-flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10"
            >
              🔧 طلب صيانة
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
