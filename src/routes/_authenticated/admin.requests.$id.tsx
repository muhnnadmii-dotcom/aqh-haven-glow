import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRight, Copy, MessageCircle, Phone, Calendar, Plus, Save, X, Image as ImageIcon,
  FileText, Paperclip, MessageSquare, ListTodo, History as HistoryIcon, Lock, Upload, Trash2,
  UserPlus, UserCheck, UserMinus, ArrowLeftRight, CheckCircle2,
} from "lucide-react";
import { publicUrl, onImageError, IMAGE_PLACEHOLDER } from "@/lib/storage";
import {
  REQUEST_TYPE_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_COLOR,
  ALL_STATUSES, type RequestType, type RequestStatus,
} from "@/lib/service-requests";
import {
  display, NA, waLink, waGreeting, buildRequestSummary, orderedDetails,
} from "@/lib/admin-ops";
import {
  uploadRequestAttachment, attachmentUrl, isImage, REPORT_TYPES, REPORT_TYPE_LABEL,
  type AttachmentRow,
} from "@/lib/request-attachments";
import {
  ASSIGNMENT_STATUS_LABEL, ASSIGNMENT_STATUS_COLOR, DEPARTMENTS,
  fetchStaffMembers, staffLabel, type AssignmentStatus, type AssignmentEvent, type StaffMember,
} from "@/lib/staff-assignment";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/requests/$id")({
  component: RequestDetail,
});

type Req = {
  id: string; type: RequestType; status: RequestStatus;
  name: string; phone: string | null; city: string | null;
  user_id: string | null; tank_id: string | null;
  assigned_to: string | null;
  assigned_to_staff_id: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  assignment_status: AssignmentStatus;
  accepted_by_staff_at: string | null;
  assignment_department: string | null;
  assignment_note: string | null;
  details: Record<string, any> | null;
  customer_notes: string | null; admin_notes: string | null;
  preferred_times: string | null; attachments: string[];
  created_at: string; updated_at: string;
};
type Note = {
  id: string; body: string; created_at: string;
  author_id: string | null; visibility: "internal" | "public";
};
type History = { id: string; from_status: string | null; to_status: string; note: string | null; created_at: string; is_visible_to_customer: boolean };
type Appt = { id: string; kind: string; status: string; preferred_date: string | null; notes: string | null };
type Report = {
  id: string; title: string; report_type: string; body: string;
  is_visible_to_customer: boolean; created_at: string; updated_at: string;
};

type Tab = "details" | "conversation" | "internal" | "reports" | "attachments" | "timeline";

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "details", label: "التفاصيل", icon: ListTodo },
  { key: "conversation", label: "المحادثة", icon: MessageSquare },
  { key: "internal", label: "ملاحظات داخلية", icon: Lock },
  { key: "reports", label: "التقارير", icon: FileText },
  { key: "attachments", label: "المرفقات", icon: Paperclip },
  { key: "timeline", label: "سجل النشاط", icon: HistoryIcon },
];

function RequestDetail() {
  const { id } = Route.useParams();
  const [req, setReq] = useState<Req | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>("details");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [showAppt, setShowAppt] = useState(false);
  const [showReport, setShowReport] = useState<Report | "new" | null>(null);
  const [showAssign, setShowAssign] = useState<null | "assign" | "transfer">(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [events, setEvents] = useState<AssignmentEvent[]>([]);
  const { user: me, isAdmin } = useAuth();

  const load = async () => {
    setLoading(true);
    const [r, n, h, a, rep, at, ev, st] = await Promise.all([
      supabase.from("service_requests").select("*").eq("id", id).maybeSingle(),
      supabase.from("request_notes").select("*").eq("request_id", id).order("created_at", { ascending: false }),
      supabase.from("request_status_history").select("*").eq("request_id", id).order("created_at", { ascending: false }),
      supabase.from("appointments").select("id,kind,status,preferred_date,notes").eq("service_request_id", id).order("preferred_date", { ascending: true }),
      supabase.from("request_reports").select("*").eq("request_id", id).order("created_at", { ascending: false }),
      supabase.from("request_attachments").select("*").eq("request_id", id).order("created_at", { ascending: false }),
      supabase.from("request_assignment_events" as any).select("*").eq("request_id", id).order("created_at", { ascending: false }),
      fetchStaffMembers(),
    ]);
    if (!r.data) { setNotFound(true); setLoading(false); return; }
    setReq(r.data as unknown as Req);
    setNotes((n.data ?? []) as any);
    setHistory((h.data ?? []) as any);
    setAppointments((a.data ?? []) as any);
    setReports((rep.data ?? []) as any);
    setAttachments((at.data ?? []) as any);
    setEvents(((ev as any).data ?? []) as AssignmentEvent[]);
    setStaff(st);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (loading) return <p className="text-sm text-muted-foreground">جاري التحميل...</p>;
  if (notFound || !req) return (
    <div className="space-y-3">
      <Link to="/admin/requests" className="text-sm text-gold inline-flex items-center gap-1"><ArrowRight size={14} /> رجوع للطلبات</Link>
      <div className="glass rounded-2xl p-6 text-center">
        <p className="font-bold mb-1">الطلب غير موجود أو تم حذفه</p>
        <p className="text-xs text-muted-foreground">تأكد من الرابط أو ارجع لقائمة الطلبات.</p>
      </div>
    </div>
  );

  const assignedStaff = staff.find((s) => s.id === req.assigned_to_staff_id) || null;
  const assignedByStaff = staff.find((s) => s.id === req.assigned_by) || null;
  const isAssignedToMe = !!me && req.assigned_to_staff_id === me.id;

  const d = req.details ?? {};
  const wa = waLink(req.phone, waGreeting(req.name, req.type));
  const allImages: string[] = [
    ...(req.attachments ?? []),
    ...((d.place_images as string[]) ?? []),
    ...((d.existing_tank_images as string[]) ?? []),
  ].filter(Boolean);
  const ordered = orderedDetails(d);
  const publicComments = notes.filter((n) => n.visibility === "public");
  const internalNotes = notes.filter((n) => n.visibility === "internal");

  const changeStatus = async (newStatus: RequestStatus) => {
    if (newStatus === req.status) return;
    const from = req.status;
    const { error } = await supabase.from("service_requests").update({ status: newStatus }).eq("id", req.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("request_status_history").insert({
      request_id: req.id, from_status: from, to_status: newStatus, is_visible_to_customer: true,
    });
    toast.success("تم تحديث الحالة");
    load();
  };

  const copy = (text: string, label: string) => { navigator.clipboard.writeText(text); toast.success(label); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link to="/admin/requests" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowRight size={14} /> الطلبات
        </Link>
        <span className={`text-xs px-2 py-1 rounded-md ${REQUEST_STATUS_COLOR[req.status]}`}>{REQUEST_STATUS_LABEL[req.status]}</span>
      </div>

      {/* Header */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[11px] text-gold mb-1">{REQUEST_TYPE_LABEL[req.type]}</div>
            <h1 className="text-xl sm:text-2xl font-bold truncate">{display(req.name)}</h1>
            <div className="text-xs text-muted-foreground mt-1" dir="ltr">{req.phone || NA} · {display(req.city)}</div>
            <div className="text-[10px] text-muted-foreground mt-1 font-mono">#{req.id.slice(0, 8)}</div>
          </div>
          <div className="text-[11px] text-muted-foreground text-end">
            <div>أرسل: {new Date(req.created_at).toLocaleString("ar-SA")}</div>
            <div>آخر تحديث: {new Date(req.updated_at).toLocaleString("ar-SA")}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {wa ? (
            <a href={wa} target="_blank" rel="noreferrer" className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 inline-flex items-center gap-1">
              <MessageCircle size={13} /> واتساب
            </a>
          ) : (
            <button disabled className="text-xs px-2.5 py-1.5 rounded-md bg-white/5 text-muted-foreground inline-flex items-center gap-1 cursor-not-allowed">
              <MessageCircle size={13} /> واتساب (لا يوجد رقم)
            </button>
          )}
          {req.phone && (
            <>
              <a href={`tel:${req.phone}`} className="text-xs px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 inline-flex items-center gap-1">
                <Phone size={13} /> اتصال
              </a>
              <button onClick={() => copy(req.phone!, "تم نسخ الرقم")} className="text-xs px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 inline-flex items-center gap-1">
                <Copy size={13} /> نسخ الرقم
              </button>
            </>
          )}
          <button onClick={() => copy(buildRequestSummary(req), "تم نسخ ملخص الطلب")} className="text-xs px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 inline-flex items-center gap-1">
            <Copy size={13} /> نسخ الملخص
          </button>
          <button onClick={() => setShowAppt(true)} className="text-xs px-2.5 py-1.5 rounded-md bg-gold/15 text-gold hover:bg-gold/25 inline-flex items-center gap-1">
            <Calendar size={13} /> تحديد موعد
          </button>
          <select value={req.status} onChange={(e) => changeStatus(e.target.value as RequestStatus)} className="text-xs px-2 py-1.5 rounded-md bg-white/5 border border-white/10">
            {ALL_STATUSES.map((s) => <option key={s} value={s} className="bg-background">{REQUEST_STATUS_LABEL[s]}</option>)}
          </select>
        </div>
      </div>

      {/* Assignment box */}
      <AssignmentBox
        req={req}
        assignedStaff={assignedStaff}
        assignedByStaff={assignedByStaff}
        isAdmin={isAdmin}
        isAssignedToMe={isAssignedToMe}
        onAssignClick={() => setShowAssign("assign")}
        onTransferClick={() => setShowAssign("transfer")}
        onUnassign={async () => {
          if (!confirm("إزالة إسناد هذا الطلب؟")) return;
          const { error } = await supabase.from("service_requests").update({
            assigned_to_staff_id: null,
            assignment_status: "unassigned",
            assignment_department: null,
            assignment_note: null,
            assigned_at: null,
            accepted_by_staff_at: null,
          } as any).eq("id", req.id);
          if (error) toast.error(error.message);
          else { toast.success("تم إزالة الإسناد"); load(); }
        }}
        onAccept={async () => {
          const { error } = await supabase.from("service_requests").update({
            assignment_status: "accepted",
            accepted_by_staff_at: new Date().toISOString(),
          } as any).eq("id", req.id);
          if (error) toast.error(error.message);
          else { toast.success("تم استلام الطلب"); load(); }
        }}
      />

      {/* Tabs */}
      <div className="glass rounded-2xl p-1 flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const count =
            t.key === "conversation" ? publicComments.length :
            t.key === "internal" ? internalNotes.length :
            t.key === "reports" ? reports.length :
            t.key === "attachments" ? attachments.length :
            t.key === "timeline" ? history.length + appointments.length + events.length : 0;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs whitespace-nowrap transition ${
                active ? "bg-gold/20 text-gold" : "text-muted-foreground hover:bg-white/5"
              }`}>
              <Icon size={13} />
              <span>{t.label}</span>
              {count > 0 && <span className="text-[10px] px-1.5 rounded-full bg-white/10">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "details" && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="معلومات العميل">
              <KV k="الاسم" v={display(req.name)} />
              <KV k="رقم الجوال" v={display(req.phone)} ltr />
              <KV k="المدينة" v={display(req.city)} />
              <KV k="الحي" v={display(d.neighborhood)} />
              <KV k="طريقة التواصل المفضلة" v={display(d.preferred_contact)} />
            </Section>
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
          {allImages.length > 0 && (
            <Section title={`صور الطلب (${allImages.length})`} icon={<ImageIcon size={14} />}>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {allImages.map((p, i) => (
                  <button key={i} onClick={() => setLightbox(publicUrl(p))} className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-gold/40">
                    <img src={publicUrl(p)} onError={onImageError} alt="" loading="lazy" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {tab === "conversation" && (
        <NotesPanel
          requestId={req.id}
          notes={publicComments}
          visibility="public"
          emptyText="لا توجد تعليقات مع العميل بعد. أي تعليق هنا سيظهر للعميل في صفحة الطلب."
          onChanged={load}
        />
      )}

      {tab === "internal" && (
        <NotesPanel
          requestId={req.id}
          notes={internalNotes}
          visibility="internal"
          emptyText="لا توجد ملاحظات داخلية. الملاحظات هنا لا تظهر للعميل."
          onChanged={load}
          legacyAdminNote={req.admin_notes}
        />
      )}

      {tab === "reports" && (
        <ReportsPanel
          reports={reports}
          onNew={() => setShowReport("new")}
          onEdit={(r) => setShowReport(r)}
          onToggleVisibility={async (r) => {
            await supabase.from("request_reports").update({ is_visible_to_customer: !r.is_visible_to_customer }).eq("id", r.id);
            load();
          }}
          onDelete={async (r) => {
            if (!confirm("حذف التقرير؟")) return;
            await supabase.from("request_reports").delete().eq("id", r.id);
            load();
          }}
        />
      )}

      {tab === "attachments" && (
        <AttachmentsPanel
          requestId={req.id}
          attachments={attachments}
          isAdmin
          onChanged={load}
          onOpen={setLightbox}
        />
      )}

      {tab === "timeline" && (
        <Section title="سجل النشاط الكامل">
          {history.length === 0 && appointments.length === 0 && reports.length === 0 && (
            <p className="text-xs text-muted-foreground">لا يوجد نشاط بعد.</p>
          )}
          <div className="space-y-1.5">
            {history.map((h) => (
              <div key={`h-${h.id}`} className="text-xs flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-1.5">
                <HistoryIcon size={12} className="text-gold" />
                <span className="text-muted-foreground">{h.from_status ? REQUEST_STATUS_LABEL[h.from_status as RequestStatus] || h.from_status : "بدء"}</span>
                <span>←</span>
                <span className="text-gold">{REQUEST_STATUS_LABEL[h.to_status as RequestStatus] || h.to_status}</span>
                {!h.is_visible_to_customer && <span className="text-[9px] px-1 rounded bg-white/10">داخلي</span>}
                <span className="text-muted-foreground ms-auto">{new Date(h.created_at).toLocaleString("ar-SA")}</span>
              </div>
            ))}
            {reports.map((r) => (
              <div key={`r-${r.id}`} className="text-xs flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-1.5">
                <FileText size={12} className="text-gold" />
                <span>تقرير: {r.title}</span>
                {!r.is_visible_to_customer && <span className="text-[9px] px-1 rounded bg-white/10">مخفي</span>}
                <span className="text-muted-foreground ms-auto">{new Date(r.created_at).toLocaleString("ar-SA")}</span>
              </div>
            ))}
            {appointments.map((a) => (
              <div key={`a-${a.id}`} className="text-xs flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-1.5">
                <Calendar size={12} className="text-gold" />
                <span>{a.kind}</span>
                <span className="text-muted-foreground">{a.preferred_date ? new Date(a.preferred_date).toLocaleString("ar-SA") : NA}</span>
                <span className="ms-auto text-[10px] px-1.5 py-0.5 rounded bg-white/10">{a.status}</span>
              </div>
            ))}
            {events.map((e) => (
              <div key={`e-${e.id}`} className="text-xs flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-1.5">
                <UserCheck size={12} className="text-gold" />
                <span>{assignmentEventLabel(e, staff)}</span>
                {!e.visible_to_customer && <span className="text-[9px] px-1 rounded bg-white/10">داخلي</span>}
                <span className="text-muted-foreground ms-auto">{new Date(e.created_at).toLocaleString("ar-SA")}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 left-4 p-2 rounded-full bg-white/10" onClick={() => setLightbox(null)}><X size={20} /></button>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-xl"
            onError={(e) => { e.currentTarget.src = IMAGE_PLACEHOLDER; }} />
        </div>
      )}

      {showAppt && (
        <AppointmentModal requestId={req.id} userId={req.user_id} onClose={() => setShowAppt(false)} onSaved={() => { setShowAppt(false); load(); }} />
      )}

      {showReport && (
        <ReportModal
          requestId={req.id}
          report={showReport === "new" ? null : showReport}
          onClose={() => setShowReport(null)}
          onSaved={() => { setShowReport(null); load(); }}
        />
      )}

      {showAssign && (
        <AssignDialog
          mode={showAssign}
          req={req}
          staff={staff}
          onClose={() => setShowAssign(null)}
          onSaved={() => { setShowAssign(null); load(); }}
        />
      )}
    </div>
  );
}

function assignmentEventLabel(e: AssignmentEvent, staff: StaffMember[]): string {
  const to = staff.find((s) => s.id === e.to_staff_id);
  const from = staff.find((s) => s.id === e.from_staff_id);
  switch (e.event_type) {
    case "assigned": return `تم إسناد الطلب إلى ${staffLabel(to)}`;
    case "accepted": return `${staffLabel(to)} استلم الطلب`;
    case "transferred": return `تم تحويل الطلب من ${staffLabel(from)} إلى ${staffLabel(to)}`;
    case "unassigned": return `تم إزالة المسؤول عن الطلب`;
  }
}

function AssignmentBox({
  req, assignedStaff, assignedByStaff, isAdmin, isAssignedToMe,
  onAssignClick, onTransferClick, onUnassign, onAccept,
}: {
  req: Req;
  assignedStaff: StaffMember | null;
  assignedByStaff: StaffMember | null;
  isAdmin: boolean;
  isAssignedToMe: boolean;
  onAssignClick: () => void;
  onTransferClick: () => void;
  onUnassign: () => void;
  onAccept: () => void;
}) {
  const st = req.assignment_status as AssignmentStatus;
  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-bold text-gold flex items-center gap-1.5">
          <UserCheck size={14} /> إسناد الطلب
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-md ${ASSIGNMENT_STATUS_COLOR[st]}`}>
          {ASSIGNMENT_STATUS_LABEL[st]}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-2 text-xs">
        <div className="bg-white/5 rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground mb-0.5">الموظف المسؤول</div>
          <div className="font-semibold">{staffLabel(assignedStaff)}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground mb-0.5">القسم</div>
          <div>{req.assignment_department || "—"}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground mb-0.5">وقت الإسناد</div>
          <div>{req.assigned_at ? new Date(req.assigned_at).toLocaleString("ar-SA") : "—"}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground mb-0.5">من قام بالإسناد</div>
          <div>{staffLabel(assignedByStaff)}</div>
        </div>
        {req.accepted_by_staff_at && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2.5 sm:col-span-2">
            <div className="text-[10px] text-emerald-300 mb-0.5">وقت الاستلام</div>
            <div className="text-emerald-200">{new Date(req.accepted_by_staff_at).toLocaleString("ar-SA")}</div>
          </div>
        )}
        {req.assignment_note && (
          <div className="bg-white/5 rounded-lg p-2.5 sm:col-span-2">
            <div className="text-[10px] text-muted-foreground mb-0.5">ملاحظة الإسناد</div>
            <div className="whitespace-pre-wrap" dir="auto">{req.assignment_note}</div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {isAssignedToMe && st !== "accepted" && (
          <button onClick={onAccept}
            className="text-xs px-3 py-1.5 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 inline-flex items-center gap-1">
            <CheckCircle2 size={13} /> استلام الطلب
          </button>
        )}
        {isAdmin && !req.assigned_to_staff_id && (
          <button onClick={onAssignClick}
            className="text-xs px-3 py-1.5 rounded-md bg-gold/20 text-gold hover:bg-gold/30 inline-flex items-center gap-1">
            <UserPlus size={13} /> إسناد الطلب
          </button>
        )}
        {isAdmin && req.assigned_to_staff_id && (
          <>
            <button onClick={onAssignClick}
              className="text-xs px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 inline-flex items-center gap-1">
              <UserPlus size={13} /> تغيير الموظف
            </button>
            <button onClick={onTransferClick}
              className="text-xs px-3 py-1.5 rounded-md bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 inline-flex items-center gap-1">
              <ArrowLeftRight size={13} /> تحويل لموظف آخر
            </button>
            <button onClick={onUnassign}
              className="text-xs px-3 py-1.5 rounded-md bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 inline-flex items-center gap-1">
              <UserMinus size={13} /> إزالة الإسناد
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AssignDialog({ mode, req, staff, onClose, onSaved }: {
  mode: "assign" | "transfer";
  req: Req;
  staff: StaffMember[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [staffId, setStaffId] = useState<string>("");
  const [dept, setDept] = useState<string>(req.assignment_department || "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const choices = staff.filter((s) => s.id !== req.assigned_to_staff_id);

  const save = async () => {
    if (!staffId) { toast.error("اختر الموظف"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const isTransfer = mode === "transfer";
    const { error } = await supabase.from("service_requests").update({
      assigned_to_staff_id: staffId,
      assigned_by: user?.id ?? null,
      assigned_at: new Date().toISOString(),
      assignment_status: isTransfer ? "transferred" : "assigned",
      assignment_department: dept || null,
      assignment_note: note || null,
      accepted_by_staff_at: null,
    } as any).eq("id", req.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(isTransfer ? "تم التحويل" : "تم إسناد الطلب"); onSaved(); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass rounded-2xl p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">{mode === "transfer" ? "تحويل الطلب" : "إسناد الطلب"}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X size={16} /></button>
        </div>

        <label className="block">
          <div className="text-[11px] text-muted-foreground mb-1">الموظف</div>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm">
            <option value="" className="bg-background">— اختر موظف —</option>
            {choices.map((s) => (
              <option key={s.id} value={s.id} className="bg-background">
                {staffLabel(s)} {s.role === "admin" ? "(مدير)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="text-[11px] text-muted-foreground mb-1">القسم (اختياري)</div>
          <select value={dept} onChange={(e) => setDept(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm">
            <option value="" className="bg-background">—</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d} className="bg-background">{d}</option>)}
          </select>
        </label>

        <label className="block">
          <div className="text-[11px] text-muted-foreground mb-1">
            {mode === "transfer" ? "سبب التحويل (اختياري)" : "ملاحظة (اختياري)"}
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm resize-none" dir="auto" />
        </label>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-md bg-white/5">إلغاء</button>
          <button onClick={save} disabled={saving}
            className="text-xs px-3 py-1.5 rounded-md bg-gold/20 text-gold inline-flex items-center gap-1 disabled:opacity-50">
            <Save size={12} /> حفظ
          </button>
        </div>
      </div>
    </div>
  );
}


function Section({ title, icon, children, action }: { title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="text-sm font-bold text-gold flex items-center gap-1.5">{icon}{title}</div>
        {action}
      </div>
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

function NotesPanel({
  requestId, notes, visibility, emptyText, onChanged, legacyAdminNote,
}: {
  requestId: string;
  notes: Note[];
  visibility: "internal" | "public";
  emptyText: string;
  onChanged: () => void;
  legacyAdminNote?: string | null;
}) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("request_notes").insert({
      request_id: requestId, body: text, visibility, author_id: user?.id ?? null,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { setBody(""); toast.success(visibility === "public" ? "تم نشر التعليق للعميل" : "تم حفظ الملاحظة الداخلية"); onChanged(); }
  };

  return (
    <Section
      title={visibility === "public" ? "محادثة مع العميل" : "ملاحظات داخلية"}
      icon={visibility === "public" ? <MessageSquare size={14} /> : <Lock size={14} />}
    >
      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          dir="auto"
          placeholder={visibility === "public" ? "اكتب رد للعميل..." : "اكتب ملاحظة داخلية..."}
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold/60 whitespace-pre-wrap"
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[10px] text-muted-foreground">
            {visibility === "public" ? "العميل سيرى هذا التعليق في صفحة الطلب." : "هذه الملاحظة لا تظهر للعميل."}
          </p>
          <button onClick={add} disabled={saving || !body.trim()}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-gold/20 text-gold hover:bg-gold/30 disabled:opacity-50">
            <Save size={13} /> حفظ
          </button>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {notes.length === 0 && <p className="text-xs text-muted-foreground">{emptyText}</p>}
        {notes.map((n) => (
          <div key={n.id} className={`text-sm rounded-lg p-2.5 ${
            visibility === "internal" ? "bg-amber-500/5 border border-amber-500/20" : "bg-white/5"
          }`}>
            <div className="whitespace-pre-wrap" dir="auto">{n.body}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("ar-SA")}</div>
          </div>
        ))}
        {visibility === "internal" && legacyAdminNote && (
          <div className="text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
            <div className="text-amber-300 mb-1">ملاحظة قديمة محفوظة:</div>
            <div className="whitespace-pre-wrap" dir="auto">{legacyAdminNote}</div>
          </div>
        )}
      </div>
    </Section>
  );
}

function ReportsPanel({ reports, onNew, onEdit, onToggleVisibility, onDelete }: {
  reports: Report[];
  onNew: () => void;
  onEdit: (r: Report) => void;
  onToggleVisibility: (r: Report) => void;
  onDelete: (r: Report) => void;
}) {
  return (
    <Section
      title="التقارير المرسلة للعميل"
      icon={<FileText size={14} />}
      action={
        <button onClick={onNew} className="text-xs px-3 py-1.5 rounded-md bg-gold/20 text-gold inline-flex items-center gap-1">
          <Plus size={13} /> تقرير جديد
        </button>
      }
    >
      {reports.length === 0 ? (
        <p className="text-xs text-muted-foreground">لا توجد تقارير بعد. أرسل تقرير معاينة أو توصيات للعميل.</p>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="bg-white/5 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <div className="font-bold text-sm">{r.title}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>{REPORT_TYPE_LABEL[r.report_type] || r.report_type}</span>
                    <span>·</span>
                    <span>{new Date(r.created_at).toLocaleString("ar-SA")}</span>
                  </div>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                  r.is_visible_to_customer ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-muted-foreground"
                }`}>
                  {r.is_visible_to_customer ? "ظاهر للعميل" : "مخفي"}
                </span>
              </div>
              {r.body && <div className="text-sm whitespace-pre-wrap text-muted-foreground mt-1" dir="auto">{r.body}</div>}
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => onEdit(r)} className="text-[11px] px-2 py-1 rounded bg-white/5 hover:bg-white/10">تعديل</button>
                <button onClick={() => onToggleVisibility(r)} className="text-[11px] px-2 py-1 rounded bg-white/5 hover:bg-white/10">
                  {r.is_visible_to_customer ? "إخفاء عن العميل" : "إظهار للعميل"}
                </button>
                <button onClick={() => onDelete(r)} className="text-[11px] px-2 py-1 rounded bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 inline-flex items-center gap-1">
                  <Trash2 size={10} /> حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function ReportModal({ requestId, report, onClose, onSaved }: {
  requestId: string; report: Report | null; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(report?.title ?? "");
  const [type, setType] = useState(report?.report_type ?? "general");
  const [body, setBody] = useState(report?.body ?? "");
  const [visible, setVisible] = useState(report?.is_visible_to_customer ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) { toast.error("أدخل عنوان التقرير"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      request_id: requestId, title: title.trim(), report_type: type, body,
      is_visible_to_customer: visible, created_by: user?.id ?? null,
    };
    const { error } = report
      ? await supabase.from("request_reports").update(payload).eq("id", report.id)
      : await supabase.from("request_reports").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(report ? "تم تعديل التقرير" : "تم إنشاء التقرير"); onSaved(); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass rounded-2xl p-5 w-full max-w-lg space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">{report ? "تعديل التقرير" : "تقرير جديد"}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X size={16} /></button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان التقرير"
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm" dir="auto" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm">
          {REPORT_TYPES.map((t) => <option key={t.value} value={t.value} className="bg-background">{t.label}</option>)}
        </select>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="نص التقرير (يدعم الأسطر والمسافات)"
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm resize-y whitespace-pre-wrap" dir="auto" />
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="accent-gold" />
          <span>ظاهر للعميل</span>
        </label>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-md bg-white/5">إلغاء</button>
          <button onClick={save} disabled={saving} className="text-xs px-3 py-1.5 rounded-md bg-gold/20 text-gold inline-flex items-center gap-1 disabled:opacity-50">
            <Save size={12} /> حفظ
          </button>
        </div>
      </div>
    </div>
  );
}

export function AttachmentsPanel({
  requestId, attachments, isAdmin, onChanged, onOpen,
}: {
  requestId: string;
  attachments: AttachmentRow[];
  isAdmin: boolean;
  onChanged: () => void;
  onOpen: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [visible, setVisible] = useState(true);

  const onPick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        await uploadRequestAttachment(requestId, f, { visibleToCustomer: isAdmin ? visible : true });
      }
      toast.success("تم رفع المرفقات");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "فشل الرفع");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (a: AttachmentRow) => {
    if (!confirm("حذف المرفق؟")) return;
    await supabase.storage.from("media").remove([a.file_path]);
    await supabase.from("request_attachments").delete().eq("id", a.id);
    toast.success("تم الحذف");
    onChanged();
  };

  return (
    <Section
      title="المرفقات"
      icon={<Paperclip size={14} />}
      action={
        <div className="flex items-center gap-2">
          {isAdmin && (
            <label className="text-[11px] inline-flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="accent-gold" />
              ظاهر للعميل
            </label>
          )}
          <label className="text-xs px-3 py-1.5 rounded-md bg-gold/20 text-gold inline-flex items-center gap-1 cursor-pointer">
            <Upload size={13} /> {uploading ? "جاري الرفع..." : "رفع"}
            <input type="file" multiple accept="image/*,application/pdf" className="hidden"
              disabled={uploading} onChange={(e) => onPick(e.target.files)} />
          </label>
        </div>
      }
    >
      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">لا توجد مرفقات. الأنواع المسموحة: صور و PDF (حتى 10 ميجابايت).</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {attachments.map((a) => {
            const url = attachmentUrl(a.file_path);
            const img = isImage(a.file_type, a.file_name);
            return (
              <div key={a.id} className="bg-white/5 rounded-lg overflow-hidden border border-white/10">
                {img ? (
                  <button onClick={() => onOpen(url)} className="block w-full aspect-square">
                    <img src={url} onError={onImageError} alt={a.file_name} loading="lazy" className="w-full h-full object-cover" />
                  </button>
                ) : (
                  <a href={url} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center aspect-square text-muted-foreground hover:text-gold">
                    <FileText size={28} />
                    <span className="text-[10px] mt-1 px-2 truncate w-full text-center">PDF</span>
                  </a>
                )}
                <div className="p-2 text-[10px] space-y-1">
                  <div className="truncate" title={a.file_name}>{a.file_name}</div>
                  <div className="flex items-center justify-between gap-1">
                    {isAdmin && (
                      <span className={`px-1 py-0.5 rounded text-[9px] ${
                        a.is_visible_to_customer ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-muted-foreground"
                      }`}>
                        {a.is_visible_to_customer ? "ظاهر" : "داخلي"}
                      </span>
                    )}
                    {isAdmin && (
                      <button onClick={() => remove(a)} className="text-rose-300 hover:text-rose-200">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
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
      user_id: owner, kind, status: "scheduled", preferred_date,
      notes: notes || null, service_request_id: requestId,
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
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm" />
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm">
          <option className="bg-background">معاينة</option>
          <option className="bg-background">صيانة</option>
          <option className="bg-background">تركيب</option>
          <option className="bg-background">اتصال</option>
        </select>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="ملاحظات (اختياري)"
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm resize-none" dir="auto" />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-md bg-white/5">إلغاء</button>
          <button onClick={save} disabled={saving} className="text-xs px-3 py-1.5 rounded-md bg-gold/20 text-gold inline-flex items-center gap-1 disabled:opacity-50">
            <Plus size={12} /> حفظ الموعد
          </button>
        </div>
      </div>
    </div>
  );
}
