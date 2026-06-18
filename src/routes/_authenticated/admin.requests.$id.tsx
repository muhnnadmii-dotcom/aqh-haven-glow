import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRight, Copy, MessageCircle, Phone, Calendar, Plus, Save, X, Image as ImageIcon,
} from "lucide-react";
import { publicUrl, onImageError, IMAGE_PLACEHOLDER } from "@/lib/storage";
import {
  REQUEST_TYPE_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_COLOR,
  ALL_STATUSES, DETAILS_LABELS, type RequestType, type RequestStatus,
} from "@/lib/service-requests";
import {
  display, NA, waLink, waGreeting, buildRequestSummary, orderedDetails,
} from "@/lib/admin-ops";

export const Route = createFileRoute("/_authenticated/admin/requests/$id")({
  component: RequestDetail,
});

type Req = {
  id: string; type: RequestType; status: RequestStatus;
  name: string; phone: string | null; city: string | null;
  user_id: string | null; tank_id: string | null;
  details: Record<string, any> | null;
  customer_notes: string | null; admin_notes: string | null;
  preferred_times: string | null; attachments: string[];
  created_at: string; updated_at: string;
};
type Note = { id: string; body: string; created_at: string; author_id: string | null };
type History = { id: string; from_status: string | null; to_status: string; note: string | null; created_at: string };
type Appt = { id: string; kind: string; status: string; preferred_date: string | null; notes: string | null };

function RequestDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [req, setReq] = useState<Req | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [showAppt, setShowAppt] = useState(false);

  const load = async () => {
    setLoading(true);
    const [r, n, h, a] = await Promise.all([
      supabase.from("service_requests").select("*").eq("id", id).maybeSingle(),
      supabase.from("request_notes").select("*").eq("request_id", id).order("created_at", { ascending: false }),
      supabase.from("request_status_history").select("*").eq("request_id", id).order("created_at", { ascending: false }),
      supabase.from("appointments").select("id,kind,status,preferred_date,notes").eq("service_request_id", id).order("preferred_date", { ascending: true }),
    ]);
    if (r.data) setReq(r.data as unknown as Req);
    setNotes((n.data ?? []) as any);
    setHistory((h.data ?? []) as any);
    setAppointments((a.data ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  if (loading) return <p className="text-sm text-muted-foreground">جاري التحميل...</p>;
  if (!req) return (
    <div className="space-y-3">
      <Link to="/admin/requests" className="text-sm text-gold inline-flex items-center gap-1"><ArrowRight size={14} /> رجوع للطلبات</Link>
      <p>الطلب غير موجود.</p>
    </div>
  );

  const d = req.details ?? {};
  const wa = waLink(req.phone, waGreeting(req.name, req.type));
  const allImages: string[] = [
    ...(req.attachments ?? []),
    ...((d.place_images as string[]) ?? []),
    ...((d.existing_tank_images as string[]) ?? []),
  ].filter(Boolean);

  const ordered = orderedDetails(d);

  const changeStatus = async (newStatus: RequestStatus, noteText?: string) => {
    if (savingStatus || newStatus === req.status) return;
    setSavingStatus(true);
    const from = req.status;
    const { error } = await supabase.from("service_requests").update({ status: newStatus }).eq("id", req.id);
    if (error) { toast.error(error.message); setSavingStatus(false); return; }
    await supabase.from("request_status_history").insert({
      request_id: req.id, from_status: from, to_status: newStatus, note: noteText ?? null,
    });
    toast.success("تم تحديث الحالة");
    setSavingStatus(false);
    load();
  };

  const addNote = async () => {
    const body = newNote.trim();
    if (!body || savingNote) return;
    setSavingNote(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("request_notes").insert({
      request_id: req.id, body, author_id: user?.id ?? null,
    });
    if (error) toast.error(error.message);
    else { toast.success("تم حفظ الملاحظة"); setNewNote(""); load(); }
    setSavingNote(false);
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link to="/admin/requests" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowRight size={14} /> الطلبات
        </Link>
        <span className={`text-xs px-2 py-1 rounded-md ${REQUEST_STATUS_COLOR[req.status]}`}>{REQUEST_STATUS_LABEL[req.status]}</span>
      </div>

      {/* Header / quick actions */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[11px] text-gold mb-1">{REQUEST_TYPE_LABEL[req.type]}</div>
            <h1 className="text-xl sm:text-2xl font-bold truncate">{display(req.name)}</h1>
            <div className="text-xs text-muted-foreground mt-1" dir="ltr">{req.phone || NA} · {display(req.city)}</div>
          </div>
          <div className="text-[11px] text-muted-foreground text-end">
            <div>أرسل: {new Date(req.created_at).toLocaleString("ar-SA")}</div>
            <div>آخر تحديث: {new Date(req.updated_at).toLocaleString("ar-SA")}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {wa ? (
            <a href={wa} target="_blank" rel="noreferrer"
              className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 inline-flex items-center gap-1">
              <MessageCircle size={13} /> فتح واتساب
            </a>
          ) : (
            <button disabled title="رقم الجوال غير متوفر"
              className="text-xs px-2.5 py-1.5 rounded-md bg-white/5 text-muted-foreground inline-flex items-center gap-1 cursor-not-allowed">
              <MessageCircle size={13} /> واتساب (لا يوجد رقم)
            </button>
          )}
          {req.phone && (
            <>
              <a href={`tel:${req.phone}`}
                className="text-xs px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 inline-flex items-center gap-1">
                <Phone size={13} /> اتصال
              </a>
              <button onClick={() => copy(req.phone!, "تم نسخ الرقم")}
                className="text-xs px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 inline-flex items-center gap-1">
                <Copy size={13} /> نسخ الرقم
              </button>
            </>
          )}
          <button onClick={() => copy(buildRequestSummary(req), "تم نسخ ملخص الطلب")}
            className="text-xs px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 inline-flex items-center gap-1">
            <Copy size={13} /> نسخ الملخص
          </button>
          <button onClick={() => setShowAppt(true)}
            className="text-xs px-2.5 py-1.5 rounded-md bg-gold/15 text-gold hover:bg-gold/25 inline-flex items-center gap-1">
            <Calendar size={13} /> تحديد موعد
          </button>
          <select
            value={req.status}
            onChange={(e) => changeStatus(e.target.value as RequestStatus)}
            disabled={savingStatus}
            className="text-xs px-2 py-1.5 rounded-md bg-white/5 border border-white/10"
          >
            {ALL_STATUSES.map((s) => <option key={s} value={s} className="bg-background">{REQUEST_STATUS_LABEL[s]}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Customer info */}
        <Section title="معلومات العميل">
          <KV k="الاسم" v={display(req.name)} />
          <KV k="رقم الجوال" v={display(req.phone)} ltr />
          <KV k="المدينة" v={display(req.city)} />
          <KV k="الحي" v={display(d.neighborhood)} />
          <KV k="طريقة التواصل المفضلة" v={display(d.preferred_contact)} />
        </Section>

        {/* Request details */}
        <Section title="تفاصيل الطلب">
          <KV k="نوع الطلب" v={REQUEST_TYPE_LABEL[req.type]} />
          {ordered.map((row) => <KV key={row.key} k={row.label} v={row.value} />)}
          {req.preferred_times && <KV k="مواعيد التواصل" v={req.preferred_times} />}
          {req.customer_notes && (
            <div className="text-sm whitespace-pre-wrap bg-white/5 rounded-lg p-2.5 mt-1">
              <div className="text-[11px] text-muted-foreground mb-1">ملاحظات العميل:</div>
              {req.customer_notes}
            </div>
          )}
        </Section>
      </div>

      {/* Images */}
      {allImages.length > 0 && (
        <Section title={`الصور والمرفقات (${allImages.length})`} icon={<ImageIcon size={14} />}>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {allImages.map((p, i) => (
              <button key={i} onClick={() => setLightbox(publicUrl(p))}
                className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-gold/40">
                <img src={publicUrl(p)} onError={onImageError} alt="" loading="lazy"
                  className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </Section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Internal notes */}
        <Section title="ملاحظات داخلية">
          <div className="space-y-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
              placeholder="اكتب ملاحظة داخلية..."
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold/60"
            />
            <button onClick={addNote} disabled={savingNote || !newNote.trim()}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-gold/20 text-gold hover:bg-gold/30 disabled:opacity-50">
              <Save size={13} /> حفظ الملاحظة
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {notes.length === 0 && <p className="text-xs text-muted-foreground">لا توجد ملاحظات بعد.</p>}
            {notes.map((n) => (
              <div key={n.id} className="text-sm bg-white/5 rounded-lg p-2.5">
                <div className="whitespace-pre-wrap">{n.body}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("ar-SA")}</div>
              </div>
            ))}
          </div>
          {req.admin_notes && (
            <div className="mt-3 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
              <div className="text-amber-300 mb-1">ملاحظة قديمة:</div>
              <div className="whitespace-pre-wrap">{req.admin_notes}</div>
            </div>
          )}
        </Section>

        {/* History + appointments */}
        <Section title="سجل التحديثات">
          {history.length === 0 && <p className="text-xs text-muted-foreground">لا يوجد سجل تحديثات بعد.</p>}
          <div className="space-y-1.5">
            {history.map((h) => (
              <div key={h.id} className="text-xs flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-1.5">
                <span className="text-muted-foreground">{h.from_status ? REQUEST_STATUS_LABEL[h.from_status as RequestStatus] || h.from_status : "بدء"}</span>
                <span>←</span>
                <span className="text-gold">{REQUEST_STATUS_LABEL[h.to_status as RequestStatus] || h.to_status}</span>
                <span className="text-muted-foreground ms-auto">{new Date(h.created_at).toLocaleDateString("ar-SA")}</span>
              </div>
            ))}
          </div>

          {appointments.length > 0 && (
            <>
              <div className="mt-4 mb-1.5 text-[11px] text-muted-foreground">المواعيد المرتبطة:</div>
              <div className="space-y-1.5">
                {appointments.map((a) => (
                  <div key={a.id} className="text-xs flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-1.5">
                    <Calendar size={12} className="text-gold" />
                    <span>{a.kind}</span>
                    <span className="text-muted-foreground">{a.preferred_date ? new Date(a.preferred_date).toLocaleString("ar-SA") : NA}</span>
                    <span className="ms-auto text-[10px] px-1.5 py-0.5 rounded bg-white/10">{a.status}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 left-4 p-2 rounded-full bg-white/10" onClick={() => setLightbox(null)}><X size={20} /></button>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-xl"
            onError={(e) => { e.currentTarget.src = IMAGE_PLACEHOLDER; }} />
        </div>
      )}

      {/* Appointment modal */}
      {showAppt && (
        <AppointmentModal
          requestId={req.id}
          userId={req.user_id}
          onClose={() => setShowAppt(false)}
          onSaved={() => { setShowAppt(false); load(); }}
        />
      )}
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

function AppointmentModal({ requestId, userId, onClose, onSaved }: {
  requestId: string; userId: string | null; onClose: () => void; onSaved: () => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [kind, setKind] = useState("معاينة");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!date) { toast.error("اختر تاريخ الموعد"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const owner = userId || user?.id;
    if (!owner) { toast.error("لا يمكن تحديد المستخدم"); setSaving(false); return; }
    const preferred_date = new Date(`${date}T${time || "10:00"}:00`).toISOString();
    const { error } = await supabase.from("appointments").insert({
      user_id: owner,
      kind,
      status: "scheduled",
      preferred_date,
      notes: notes || null,
      service_request_id: requestId,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("تم تحديد الموعد"); onSaved(); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass rounded-2xl p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">تحديد موعد</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
            className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm" />
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value)}
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm">
          <option className="bg-background">معاينة</option>
          <option className="bg-background">صيانة</option>
          <option className="bg-background">تركيب</option>
          <option className="bg-background">اتصال</option>
        </select>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="ملاحظات (اختياري)"
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm resize-none" />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-md bg-white/5">إلغاء</button>
          <button onClick={save} disabled={saving}
            className="text-xs px-3 py-1.5 rounded-md bg-gold/20 text-gold inline-flex items-center gap-1 disabled:opacity-50">
            <Plus size={12} /> حفظ الموعد
          </button>
        </div>
      </div>
    </div>
  );
}
