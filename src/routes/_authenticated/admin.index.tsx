import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl } from "@/lib/storage";
import {
  Inbox, Fish, BookOpen, MessageSquareQuote, Calendar, Wrench,
  ExternalLink, Plus, ArrowLeft, Loader2, Phone,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

type Stats = {
  reqNew: number; reqFollow: number; apptUpcoming: number; tanks: number;
  projects: number; articles: number; services: number; testimonials: number;
};

type ReqRow = {
  id: string; name: string; phone: string | null; city: string | null;
  type: string; status: string; created_at: string;
};

type ProjRow = { id: string; title: string; category_label: string | null; cover_path: string | null; cover: string | null };
type ArtRow = { id: string; title: string; published: boolean };

const STATUS_LABEL: Record<string, string> = {
  new: "جديد", in_review: "قيد المراجعة", contacted: "تم التواصل",
  scheduled: "مجدول", in_progress: "قيد التنفيذ", proposal_sent: "أُرسل عرض",
  approved: "موافق", done: "منجز", cancelled: "ملغي",
};
const STATUS_COLOR: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-300",
  in_review: "bg-amber-500/15 text-amber-300",
  contacted: "bg-purple-500/15 text-purple-300",
  scheduled: "bg-cyan-500/15 text-cyan-300",
  in_progress: "bg-orange-500/15 text-orange-300",
  proposal_sent: "bg-pink-500/15 text-pink-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  done: "bg-emerald-500/15 text-emerald-300",
  cancelled: "bg-red-500/15 text-red-300",
};
const TYPE_LABEL: Record<string, string> = {
  consultation: "استشارة", visit: "معاينة", design: "تصميم",
  maintenance: "صيانة", custom_aquarium_design: "حوض مخصص", other: "أخرى",
};

function AdminHome() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    reqNew: 0, reqFollow: 0, apptUpcoming: 0, tanks: 0,
    projects: 0, articles: 0, services: 0, testimonials: 0,
  });
  const [followUp, setFollowUp] = useState<ReqRow[]>([]);
  const [latestReq, setLatestReq] = useState<ReqRow[]>([]);
  const [latestProj, setLatestProj] = useState<ProjRow[]>([]);
  const [latestArt, setLatestArt] = useState<ArtRow[]>([]);

  useEffect(() => {
    (async () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();
      const nowIso = new Date().toISOString();
      const [
        sNew, sFollow, sAppt, sTanks, sProj, sArt, sSvc, sTest,
        followRes, latestReqRes, projRes, artRes,
      ] = await Promise.all([
        supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("service_requests").select("id", { count: "exact", head: true })
          .in("status", ["in_review", "contacted", "scheduled", "proposal_sent"]),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .in("status", ["new", "confirmed"]).gte("preferred_date", nowIso),
        supabase.from("customer_tanks").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("published", true),
        supabase.from("articles").select("id", { count: "exact", head: true }).eq("published", true),
        supabase.from("services").select("id", { count: "exact", head: true }).eq("published", true),
        supabase.from("testimonials").select("id", { count: "exact", head: true }),
        supabase.from("service_requests")
          .select("id,name,phone,city,type,status,created_at")
          .or(`status.eq.new,status.eq.in_review,and(status.in.(contacted,scheduled,in_progress),updated_at.lt.${tenDaysAgo})`)
          .order("created_at", { ascending: false }).limit(6),
        supabase.from("service_requests")
          .select("id,name,phone,city,type,status,created_at")
          .order("created_at", { ascending: false }).limit(5),
        supabase.from("projects")
          .select("id,title,category_label,cover_path,cover")
          .order("created_at", { ascending: false }).limit(3),
        supabase.from("articles")
          .select("id,title,published")
          .order("created_at", { ascending: false }).limit(3),
      ]);

      setStats({
        reqNew: sNew.count ?? 0,
        reqFollow: sFollow.count ?? 0,
        apptUpcoming: sAppt.count ?? 0,
        tanks: sTanks.count ?? 0,
        projects: sProj.count ?? 0,
        articles: sArt.count ?? 0,
        services: sSvc.count ?? 0,
        testimonials: sTest.count ?? 0,
      });
      setFollowUp((followRes.data ?? []) as ReqRow[]);
      setLatestReq((latestReqRes.data ?? []) as ReqRow[]);
      setLatestProj((projRes.data ?? []) as ProjRow[]);
      setLatestArt((artRes.data ?? []) as ArtRow[]);
      setLoading(false);
    })();
  }, []);

  const today = new Date().toLocaleDateString("ar-SA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const statCards: { label: string; value: number; icon: any; to: string; color: string }[] = [
    { label: "طلبات جديدة", value: stats.reqNew, icon: Inbox, to: "/admin/requests", color: "text-blue-300" },
    { label: "قيد المتابعة", value: stats.reqFollow, icon: Inbox, to: "/admin/requests", color: "text-amber-300" },
    { label: "مواعيد قادمة", value: stats.apptUpcoming, icon: Calendar, to: "/admin/appointments", color: "text-cyan-300" },
    { label: "أحواض العملاء", value: stats.tanks, icon: Fish, to: "/admin/tanks", color: "text-emerald-300" },
    { label: "مشاريع منشورة", value: stats.projects, icon: Fish, to: "/admin/projects", color: "text-emerald-300" },
    { label: "مقالات منشورة", value: stats.articles, icon: BookOpen, to: "/admin/articles", color: "text-amber-300" },
    { label: "خدمات منشورة", value: stats.services, icon: Wrench, to: "/admin/services", color: "text-purple-300" },
    { label: "تقييمات", value: stats.testimonials, icon: MessageSquareQuote, to: "/admin/testimonials", color: "text-pink-300" },
  ];

  const quick: { label: string; to: string; icon: any }[] = [
    { label: "إضافة حوض", to: "/admin/projects", icon: Plus },
    { label: "إضافة مقال", to: "/admin/articles", icon: Plus },
    { label: "إضافة خدمة", to: "/admin/services", icon: Plus },
    { label: "إضافة تقييم", to: "/admin/testimonials", icon: Plus },
    { label: "عرض الطلبات", to: "/admin/requests", icon: Inbox },
    { label: "عرض الموقع", to: "/", icon: ExternalLink },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">لوحة التحكم</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">ملخص سريع لأهم نشاطات Aqua Haven.</p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">{today}</p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs"
        >
          <ExternalLink size={14} /> عرض الموقع
        </Link>
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">إجراءات سريعة</h2>
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <Link key={q.label} to={q.to}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-gold/10 hover:text-gold text-xs sm:text-sm border border-white/5 transition">
              <q.icon size={14} /> {q.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">إحصائيات</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {statCards.map((c) => (
            <Link key={c.label} to={c.to}
              className="glass rounded-xl p-3 sm:p-3.5 hover:bg-white/10 transition group">
              <div className="flex items-center justify-between mb-1.5">
                <c.icon size={16} className={c.color} />
                <ArrowLeft size={12} className="text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition" />
              </div>
              <div className="text-xl sm:text-2xl font-bold leading-tight">
                {loading ? <Loader2 size={18} className="animate-spin text-muted-foreground" /> : c.value}
              </div>
              <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">{c.label}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Follow-up requests */}
      <section className="glass rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm sm:text-base font-bold">طلبات تحتاج متابعة</h2>
          <Link to="/admin/requests" className="text-xs text-gold hover:underline">الكل</Link>
        </div>
        {loading ? (
          <div className="text-xs text-muted-foreground py-4">جارٍ التحميل...</div>
        ) : followUp.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4">لا توجد طلبات تحتاج متابعة حاليًا.</div>
        ) : (
          <div className="space-y-2">{followUp.map((r) => <RequestLine key={r.id} r={r} />)}</div>
        )}
      </section>

      {/* Latest requests */}
      <section className="glass rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm sm:text-base font-bold">آخر الطلبات</h2>
          <Link to="/admin/requests" className="text-xs text-gold hover:underline">الكل</Link>
        </div>
        {loading ? (
          <div className="text-xs text-muted-foreground py-4">جارٍ التحميل...</div>
        ) : latestReq.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4">لا توجد طلبات بعد.</div>
        ) : (
          <div className="space-y-2">{latestReq.map((r) => <RequestLine key={r.id} r={r} />)}</div>
        )}
      </section>

      {/* Latest projects + articles */}
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="glass rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm sm:text-base font-bold">آخر الأحواض</h2>
            <Link to="/admin/projects" className="text-xs text-gold hover:underline">الكل</Link>
          </div>
          {latestProj.length === 0 ? (
            <div className="text-xs text-muted-foreground py-3">لا توجد أحواض بعد.</div>
          ) : (
            <div className="space-y-2">
              {latestProj.map((p) => {
                const img = publicUrl(p.cover_path) || p.cover || "";
                return (
                  <Link key={p.id} to="/admin/projects" className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                    {img ? (
                      <img src={img} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-white/5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{p.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{p.category_label ?? "—"}</div>
                    </div>
                    <span className="text-xs text-gold">تعديل</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm sm:text-base font-bold">آخر المقالات</h2>
            <Link to="/admin/articles" className="text-xs text-gold hover:underline">الكل</Link>
          </div>
          {latestArt.length === 0 ? (
            <div className="text-xs text-muted-foreground py-3">لا توجد مقالات بعد.</div>
          ) : (
            <div className="space-y-2">
              {latestArt.map((a) => (
                <Link key={a.id} to="/admin/articles" className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{a.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.published ? "منشور" : "مسودة"}
                    </div>
                  </div>
                  <span className="text-xs text-gold">تعديل</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RequestLine({ r }: { r: ReqRow }) {
  const wa = r.phone ? `https://wa.me/${r.phone.replace(/\D/g, "")}` : null;
  return (
    <div className="flex items-center gap-2 sm:gap-3 p-2 rounded-lg hover:bg-white/5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{r.name || "—"}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COLOR[r.status] || "bg-white/10 text-muted-foreground"}`}>
            {STATUS_LABEL[r.status] || r.status}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {TYPE_LABEL[r.type] || r.type}
          {r.city ? ` · ${r.city}` : ""}
          {" · "}{new Date(r.created_at).toLocaleDateString("ar-SA")}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer"
            className="p-1.5 rounded-md bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" aria-label="واتساب">
            <Phone size={13} />
          </a>
        )}
        <Link to="/admin/requests" className="text-xs text-gold hover:underline px-2">عرض</Link>
      </div>
    </div>
  );
}
