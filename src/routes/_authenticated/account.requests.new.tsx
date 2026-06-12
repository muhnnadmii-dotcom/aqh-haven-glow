import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MultiImageUploader } from "@/components/ImageUploader";
import {
  REQUEST_TYPE_LABEL, REQUIRES_TANK, SUCCESS_MESSAGE, type RequestType,
} from "@/lib/service-requests";
import { CheckCircle2, ArrowRight } from "lucide-react";

const search = z.object({
  type: fallback(z.enum(["design", "visit", "consultation", "maintenance"]), "design").default("design"),
  tank: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/account/requests/new")({
  validateSearch: zodValidator(search),
  component: NewRequestPage,
});

const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:border-gold/60";

type TankLite = { id: string; name: string; tank_type: string | null; volume_liters: number | null };

function NewRequestPage() {
  const search = Route.useSearch();
  const type = search.type as RequestType;
  const tankFromUrl = search.tank as string;
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ name: string; phone: string; city: string }>({ name: "", phone: "", city: "" });
  const [tanks, setTanks] = useState<TankLite[]>([]);
  const [tankId, setTankId] = useState<string>(tankFromUrl || "");
  const [details, setDetails] = useState<Record<string, string>>({});
  const [customerNotes, setCustomerNotes] = useState("");
  const [preferredTimes, setPreferredTimes] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const requiresTank = REQUIRES_TANK[type];

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase.from("profiles").select("full_name, phone").eq("id", u.user.id).maybeSingle();
      setProfile((prev) => ({ ...prev, name: p?.full_name ?? prev.name, phone: (p as any)?.phone ?? prev.phone }));
      if (requiresTank) {
        const { data: t } = await supabase.from("customer_tanks")
          .select("id, name, tank_type, volume_liters").eq("user_id", u.user.id)
          .order("created_at", { ascending: false });
        setTanks((t ?? []) as TankLite[]);
      }
    })();
  }, [requiresTank]);

  const setD = (k: string, v: string) => setDetails((d) => ({ ...d, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile.name.trim() || !profile.phone.trim()) {
      toast.error("الاسم ورقم الجوال مطلوبان"); return;
    }
    if (requiresTank && !tankId) {
      toast.error("اختر الحوض أو أضف حوضك أولًا"); return;
    }
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSubmitting(false); return; }
    const { error } = await supabase.from("service_requests").insert({
      user_id: u.user.id,
      type,
      tank_id: requiresTank ? tankId : null,
      name: profile.name.trim(),
      phone: profile.phone.trim(),
      city: profile.city.trim() || null,
      details,
      customer_notes: customerNotes.trim() || null,
      preferred_times: preferredTimes.trim() || null,
      attachments,
    } as any);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(SUCCESS_MESSAGE);
    setDone(true);
  };

  if (done) {
    return (
      <div className="glass-gold rounded-3xl p-8 text-center space-y-4 max-w-xl mx-auto">
        <CheckCircle2 className="mx-auto text-gold" size={56} />
        <h2 className="text-2xl font-bold">{SUCCESS_MESSAGE}</h2>
        <p className="text-sm text-muted-foreground">يمكنك متابعة حالة طلباتك من صفحة "طلباتي".</p>
        <div className="flex gap-2 justify-center">
          <Link to="/account/requests" className="btn-gold rounded-xl px-4 py-2 text-sm">طلباتي</Link>
          <Link to="/account" className="glass rounded-xl px-4 py-2 text-sm">العودة</Link>
        </div>
      </div>
    );
  }

  if (requiresTank && tanks.length === 0) {
    return (
      <div className="glass rounded-3xl p-8 text-center space-y-4 max-w-xl mx-auto">
        <h2 className="text-2xl font-bold">{REQUEST_TYPE_LABEL[type]}</h2>
        <p className="text-muted-foreground">يجب إضافة بيانات حوضك أولاً قبل إرسال هذا الطلب.</p>
        <Link to="/account/tanks" className="btn-gold rounded-xl px-4 py-2 text-sm inline-flex">أضف حوضي الآن</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">{REQUEST_TYPE_LABEL[type]}</h1>
        <Link to="/account/requests" className="text-sm text-muted-foreground hover:text-gold flex items-center gap-1">
          <ArrowRight size={14} /> طلباتي
        </Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-4 text-xs">
        {(["design", "visit", "consultation", "maintenance"] as RequestType[]).map((t) => (
          <button key={t} type="button"
            onClick={() => navigate({ to: "/account/requests/new", search: { type: t, tank: "" } })}
            className={`rounded-xl px-3 py-2 ${type === t ? "btn-gold" : "glass hover:bg-white/10"}`}>
            {REQUEST_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {/* contact info */}
      <div className="glass rounded-2xl p-5 grid gap-4 sm:grid-cols-3">
        <label><span className="text-xs text-muted-foreground block mb-1">الاسم *</span>
          <input required className={inp} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></label>
        <label><span className="text-xs text-muted-foreground block mb-1">رقم الجوال *</span>
          <input required dir="ltr" className={inp + " text-right"} value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="05xxxxxxxx" /></label>
        <label><span className="text-xs text-muted-foreground block mb-1">المدينة</span>
          <input className={inp} value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} placeholder="الرياض" /></label>
      </div>

      {requiresTank && (
        <div className="glass rounded-2xl p-5">
          <label className="block">
            <span className="text-xs text-muted-foreground block mb-1">الحوض المرتبط *</span>
            <select required className={inp} value={tankId} onChange={(e) => setTankId(e.target.value)}>
              <option value="" className="bg-background">— اختر حوضًا —</option>
              {tanks.map((t) => (
                <option key={t.id} value={t.id} className="bg-background">
                  {t.name} {t.volume_liters ? `(${t.volume_liters}L)` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* type-specific fields */}
      {type === "design" && (
        <div className="glass rounded-2xl p-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">نوع الحوض المطلوب</span>
            <input className={inp} value={details.tank_type ?? ""} onChange={(e) => setD("tank_type", e.target.value)} placeholder="نباتي / بحري / فايتر..." /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">المقاس المطلوب</span>
            <input className={inp} value={details.size ?? ""} onChange={(e) => setD("size", e.target.value)} placeholder="100×40×40 سم" /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">الميزانية التقريبية</span>
            <input className={inp} value={details.budget ?? ""} onChange={(e) => setD("budget", e.target.value)} placeholder="مثال: 5000 ر.س" /></label>
          <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">هل يوجد موقع جاهز للحوض؟</span>
            <select className={inp} value={details.has_location ?? ""} onChange={(e) => setD("has_location", e.target.value)}>
              <option value="" className="bg-background">—</option>
              <option value="yes" className="bg-background">نعم</option>
              <option value="no" className="bg-background">لا</option>
            </select></label>
        </div>
      )}

      {type === "visit" && (
        <div className="glass rounded-2xl p-5 grid gap-4 sm:grid-cols-2">
          <label><span className="text-xs text-muted-foreground block mb-1">الحي / الموقع</span>
            <input className={inp} value={details.area ?? ""} onChange={(e) => setD("area", e.target.value)} /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">نوع المعاينة</span>
            <select className={inp} value={details.visit_type ?? ""} onChange={(e) => setD("visit_type", e.target.value)}>
              <option value="" className="bg-background">—</option>
              <option value="install" className="bg-background">تركيب جديد</option>
              <option value="issue" className="bg-background">مشكلة في الحوض</option>
              <option value="upgrade" className="bg-background">تطوير</option>
              <option value="maintenance" className="bg-background">صيانة</option>
            </select></label>
          <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">وصف مختصر للحالة</span>
            <textarea rows={3} className={inp + " resize-none"} value={details.description ?? ""} onChange={(e) => setD("description", e.target.value)} /></label>
        </div>
      )}

      {type === "consultation" && (
        <div className="glass rounded-2xl p-5 grid gap-4">
          <label><span className="text-xs text-muted-foreground block mb-1">وصف المشكلة أو الاستفسار *</span>
            <textarea required rows={4} className={inp + " resize-none"} value={details.problem ?? ""} onChange={(e) => setD("problem", e.target.value)} /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">متى بدأت المشكلة؟</span>
            <input className={inp} value={details.started_at ?? ""} onChange={(e) => setD("started_at", e.target.value)} placeholder="منذ أسبوع، منذ يومين..." /></label>
        </div>
      )}

      {type === "maintenance" && (
        <div className="glass rounded-2xl p-5 grid gap-4 sm:grid-cols-2">
          <label><span className="text-xs text-muted-foreground block mb-1">نوع الصيانة المطلوبة *</span>
            <select required className={inp} value={details.maintenance_kind ?? ""} onChange={(e) => setD("maintenance_kind", e.target.value)}>
              <option value="" className="bg-background">—</option>
              <option value="routine" className="bg-background">صيانة دورية</option>
              <option value="emergency" className="bg-background">حالة طارئة</option>
              <option value="cleaning" className="bg-background">تنظيف شامل</option>
              <option value="water_change" className="bg-background">تغيير ماء</option>
              <option value="equipment" className="bg-background">صيانة معدات</option>
              <option value="other" className="bg-background">أخرى</option>
            </select></label>
          <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">وصف الحالة</span>
            <textarea rows={3} className={inp + " resize-none"} value={details.description ?? ""} onChange={(e) => setD("description", e.target.value)} /></label>
        </div>
      )}

      <div className="glass rounded-2xl p-5 grid gap-4">
        <label><span className="text-xs text-muted-foreground block mb-1">المواعيد المناسبة</span>
          <input className={inp} value={preferredTimes} onChange={(e) => setPreferredTimes(e.target.value)} placeholder="مثال: السبت والأحد بعد العصر" /></label>
        <label><span className="text-xs text-muted-foreground block mb-1">ملاحظات إضافية</span>
          <textarea rows={3} className={inp + " resize-none"} value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} /></label>
        <div>
          <span className="text-xs text-muted-foreground block mb-2">صور مرجعية (اختياري)</span>
          <MultiImageUploader values={attachments} cover={attachments[0] ?? null}
            onChange={(v) => setAttachments(v)} folder={`requests/${type}`} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Link to="/account/requests" className="glass rounded-xl px-4 py-2 text-sm">إلغاء</Link>
        <button type="submit" disabled={submitting} className="btn-gold rounded-xl px-6 py-2 text-sm disabled:opacity-50">
          {submitting ? "جاري الإرسال..." : "إرسال الطلب"}
        </button>
      </div>
    </form>
  );
}
