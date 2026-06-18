import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, MessageCircle, Phone, Copy, Save, Eye, Plus, Fish, Calendar } from "lucide-react";
import { display, NA, waLink } from "@/lib/admin-ops";
import { REQUEST_TYPE_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_COLOR, type RequestType, type RequestStatus } from "@/lib/service-requests";

export const Route = createFileRoute("/_authenticated/admin/users/$id")({
  component: CustomerDetail,
});

type Profile = { id: string; full_name: string | null; phone: string | null; created_at: string };
type Tank = { id: string; name: string; tank_type: string | null; volume_liters: number | null };
type Req = { id: string; type: RequestType; status: RequestStatus; city: string | null; created_at: string };
type Appt = { id: string; kind: string; status: string; preferred_date: string | null; service_request_id: string | null };
type Note = { id: string; body: string; created_at: string };

function CustomerDetail() {
  const { id } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [requests, setRequests] = useState<Req[]>([]);
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [lastCity, setLastCity] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [p, t, r, a, n] = await Promise.all([
      supabase.from("profiles").select("id,full_name,phone,created_at").eq("id", id).maybeSingle(),
      supabase.from("customer_tanks").select("id,name,tank_type,volume_liters").eq("user_id", id),
      supabase.from("service_requests").select("id,type,status,city,created_at").eq("user_id", id).order("created_at", { ascending: false }),
      supabase.from("appointments").select("id,kind,status,preferred_date,service_request_id").eq("user_id", id).order("preferred_date", { ascending: true }),
      supabase.from("customer_notes").select("id,body,created_at").eq("profile_id", id).order("created_at", { ascending: false }),
    ]);
    setProfile((p.data as any) ?? null);
    setTanks((t.data ?? []) as any);
    const reqs = (r.data ?? []) as Req[];
    setRequests(reqs);
    setLastCity(reqs.find((x) => x.city)?.city ?? null);
    setAppointments((a.data ?? []) as any);
    setNotes((n.data ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  if (loading) return <p className="text-sm text-muted-foreground">جاري التحميل...</p>;
  if (!profile) return (
    <div className="space-y-3">
      <Link to="/admin/users" className="text-sm text-gold inline-flex items-center gap-1"><ArrowRight size={14} /> العملاء</Link>
      <p>العميل غير موجود.</p>
    </div>
  );

  const wa = waLink(profile.phone);
  const now = Date.now();
  const upcoming = appointments.filter((a) => !a.preferred_date || new Date(a.preferred_date).getTime() >= now);
  const past = appointments.filter((a) => a.preferred_date && new Date(a.preferred_date).getTime() < now);

  const addNote = async () => {
    const body = newNote.trim();
    if (!body || savingNote) return;
    setSavingNote(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("customer_notes").insert({
      profile_id: profile.id, body, author_id: user?.id ?? null,
    });
    if (error) toast.error(error.message);
    else { toast.success("تم حفظ الملاحظة"); setNewNote(""); load(); }
    setSavingNote(false);
  };

  return (
    <div className="space-y-4">
      <Link to="/admin/users" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowRight size={14} /> العملاء
      </Link>

      {/* Header */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{display(profile.full_name)}</h1>
          <div className="text-xs text-muted-foreground mt-1" dir="ltr">{profile.phone || NA}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {wa ? (
            <a href={wa} target="_blank" rel="noreferrer"
              className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-500/15 text-emerald-300 inline-flex items-center gap-1">
              <MessageCircle size={13} /> واتساب
            </a>
          ) : (
            <button disabled className="text-xs px-2.5 py-1.5 rounded-md bg-white/5 text-muted-foreground inline-flex items-center gap-1 cursor-not-allowed">
              <MessageCircle size={13} /> لا يوجد رقم
            </button>
          )}
          {profile.phone && (
            <>
              <a href={`tel:${profile.phone}`} className="text-xs px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 inline-flex items-center gap-1">
                <Phone size={13} /> اتصال
              </a>
              <button onClick={() => { navigator.clipboard.writeText(profile.phone!); toast.success("تم نسخ الرقم"); }}
                className="text-xs px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 inline-flex items-center gap-1">
                <Copy size={13} /> نسخ
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="بيانات العميل">
          <KV k="الاسم" v={display(profile.full_name)} />
          <KV k="الجوال" v={display(profile.phone)} ltr />
          <KV k="المدينة (من آخر طلب)" v={display(lastCity)} />
          <KV k="تاريخ الإنشاء" v={new Date(profile.created_at).toLocaleDateString("ar-SA")} />
        </Section>

        <Section title={`أحواض العميل (${tanks.length})`} icon={<Fish size={14} />}>
          {tanks.length === 0 && <p className="text-xs text-muted-foreground">لا توجد أحواض.</p>}
          <div className="space-y-1.5">
            {tanks.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 bg-white/5 rounded-lg px-2.5 py-1.5 text-xs">
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-[10px] text-muted-foreground">{display(t.tank_type)} {t.volume_liters ? `· ${t.volume_liters}L` : ""}</div>
                </div>
                <Link to="/admin/tanks" className="text-gold hover:underline">عرض</Link>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title={`طلبات العميل (${requests.length})`}>
        {requests.length === 0 && <p className="text-xs text-muted-foreground">لا توجد طلبات.</p>}
        <div className="space-y-1.5">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 bg-white/5 rounded-lg px-2.5 py-1.5 text-xs flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-gold">{REQUEST_TYPE_LABEL[r.type]}</span>
                <span className="text-muted-foreground">{display(r.city)}</span>
                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar-SA")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${REQUEST_STATUS_COLOR[r.status]}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
                <Link to="/admin/requests/$id" params={{ id: r.id }} className="text-gold inline-flex items-center gap-1">
                  <Eye size={11} /> عرض
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={`المواعيد القادمة (${upcoming.length})`} icon={<Calendar size={14} />}>
          {upcoming.length === 0 && <p className="text-xs text-muted-foreground">لا توجد مواعيد قادمة.</p>}
          {upcoming.map((a) => <ApptLine key={a.id} a={a} />)}
        </Section>
        <Section title={`المواعيد السابقة (${past.length})`} icon={<Calendar size={14} />}>
          {past.length === 0 && <p className="text-xs text-muted-foreground">لا توجد مواعيد سابقة.</p>}
          {past.map((a) => <ApptLine key={a.id} a={a} />)}
        </Section>
      </div>

      <Section title="ملاحظات داخلية">
        <div className="space-y-2">
          <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={2}
            placeholder="ملاحظة عن العميل..."
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold/60" />
          <button onClick={addNote} disabled={savingNote || !newNote.trim()}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-gold/20 text-gold disabled:opacity-50">
            <Save size={13} /> حفظ
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {notes.length === 0 && <p className="text-xs text-muted-foreground">لا توجد ملاحظات.</p>}
          {notes.map((n) => (
            <div key={n.id} className="text-sm bg-white/5 rounded-lg p-2.5">
              <div className="whitespace-pre-wrap">{n.body}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("ar-SA")}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-sm font-bold text-gold mb-3 flex items-center gap-1.5">{icon}{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function KV({ k, v, ltr }: { k: string; v: string; ltr?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 border-b border-white/5 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{k}</span>
      <span className={`text-sm text-end ${ltr ? "font-mono" : ""}`} dir={ltr ? "ltr" : undefined}>{v}</span>
    </div>
  );
}

function ApptLine({ a }: { a: Appt }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-white/5 rounded-lg px-2.5 py-1.5 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-gold">{a.kind}</span>
        <span className="text-muted-foreground">{a.preferred_date ? new Date(a.preferred_date).toLocaleString("ar-SA") : NA}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10">{a.status}</span>
        {a.service_request_id && (
          <Link to="/admin/requests/$id" params={{ id: a.service_request_id }} className="text-gold inline-flex items-center gap-1">
            <Eye size={11} /> الطلب
          </Link>
        )}
      </div>
    </div>
  );
}
