import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRight, Calendar, MessageSquare, FileText, Paperclip, Save, X,
  Image as ImageIcon, History as HistoryIcon, Upload, Send,
} from "lucide-react";
import { publicUrl, onImageError, IMAGE_PLACEHOLDER } from "@/lib/storage";
import {
  REQUEST_TYPE_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_COLOR,
  type RequestType, type RequestStatus,
} from "@/lib/service-requests";
import { display, NA, orderedDetails } from "@/lib/admin-ops";
import {
  uploadRequestAttachment, attachmentUrl, isImage, REPORT_TYPE_LABEL,
  type AttachmentRow,
} from "@/lib/request-attachments";

export const Route = createFileRoute("/_authenticated/account/requests/$id")({
  component: CustomerRequestDetail,
});

type Req = {
  id: string; type: RequestType; status: RequestStatus;
  user_id: string | null;
  name: string; phone: string | null; city: string | null;
  details: Record<string, any> | null;
  customer_notes: string | null;
  preferred_times: string | null; attachments: string[];
  created_at: string; updated_at: string;
};
type PublicNote = { id: string; body: string; created_at: string; author_id: string | null; visibility: string };
type Report = { id: string; title: string; report_type: string; body: string; created_at: string };
type Appt = { id: string; kind: string; status: string; preferred_date: string | null; notes: string | null };
type StatusEvent = { id: string; from_status: string | null; to_status: string; created_at: string };

type Tab = "summary" | "updates" | "comments" | "reports" | "attachments" | "appointments";

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "summary", label: "ملخص الطلب", icon: FileText },
  { key: "updates", label: "التحديثات", icon: HistoryIcon },
  { key: "comments", label: "التعليقات", icon: MessageSquare },
  { key: "reports", label: "التقارير", icon: FileText },
  { key: "attachments", label: "المرفقات", icon: Paperclip },
  { key: "appointments", label: "المواعيد", icon: Calendar },
];

function CustomerRequestDetail() {
  const { id } = Route.useParams();
  const [req, setReq] = useState<Req | null>(null);
  const [comments, setComments] = useState<PublicNote[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [history, setHistory] = useState<StatusEvent[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>("summary");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setNotFound(true); setLoading(false); return; }

    const r = await supabase.from("service_requests").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!r.data) { setNotFound(true); setLoading(false); return; }
    setReq(r.data as unknown as Req);

    const [c, rep, a, h, at] = await Promise.all([
      supabase.from("request_notes").select("*").eq("request_id", id).eq("visibility", "public").order("created_at", { ascending: true }),
      supabase.from("request_reports").select("*").eq("request_id", id).eq("is_visible_to_customer", true).order("created_at", { ascending: false }),
      supabase.from("appointments").select("id,kind,status,preferred_date,notes").eq("service_request_id", id).order("preferred_date", { ascending: true }),
      supabase.from("request_status_history").select("id,from_status,to_status,created_at").eq("request_id", id).eq("is_visible_to_customer", true).order("created_at", { ascending: false }),
      supabase.from("request_attachments").select("*").eq("request_id", id).eq("is_visible_to_customer", true).order("created_at", { ascending: false }),
    ]);
    setComments((c.data ?? []) as any);
    setReports((rep.data ?? []) as any);
    setAppointments((a.data ?? []) as any);
    setHistory((h.data ?? []) as any);
    setAttachments((at.data ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (loading) return <p className="text-sm text-muted-foreground">جاري التحميل...</p>;
  if (notFound || !req) return (
    <div className="space-y-3">
      <Link to="/account/requests" className="text-sm text-gold inline-flex items-center gap-1"><ArrowRight size={14} /> طلباتي</Link>
      <div className="glass rounded-2xl p-6 text-center">
        <p className="font-bold mb-1">الطلب غير موجود أو لا يمكن الوصول إليه</p>
        <p className="text-xs text-muted-foreground">قد يكون الطلب محذوفًا أو لا يخصك.</p>
      </div>
    </div>
  );

  const d = req.details ?? {};
  const ordered = orderedDetails(d);
  const customerImages: string[] = [
    ...(req.attachments ?? []),
    ...((d.place_images as string[]) ?? []),
    ...((d.existing_tank_images as string[]) ?? []),
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link to="/account/requests" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowRight size={14} /> طلباتي
        </Link>
        <span className={`text-xs px-2 py-1 rounded-md ${REQUEST_STATUS_COLOR[req.status]}`}>{REQUEST_STATUS_LABEL[req.status]}</span>
      </div>

      {/* Header */}
      <div className="glass rounded-2xl p-4 space-y-2">
        <div className="text-[11px] text-gold">{REQUEST_TYPE_LABEL[req.type]}</div>
        <h1 className="text-xl sm:text-2xl font-bold">طلب #{req.id.slice(0, 8)}</h1>
        <div className="text-[11px] text-muted-foreground">
          أُرسل في {new Date(req.created_at).toLocaleString("ar-SA")}
          {req.updated_at !== req.created_at && <> · آخر تحديث {new Date(req.updated_at).toLocaleString("ar-SA")}</>}
        </div>
      </div>

      {/* Tabs */}
      <div className="glass rounded-2xl p-1 flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const count =
            t.key === "comments" ? comments.length :
            t.key === "reports" ? reports.length :
            t.key === "attachments" ? attachments.length :
            t.key === "appointments" ? appointments.length :
            t.key === "updates" ? history.length : 0;
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

      {tab === "summary" && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-4">
            <div className="text-sm font-bold text-gold mb-3">تفاصيل الطلب</div>
            <div className="space-y-1">
              <KV k="نوع الطلب" v={REQUEST_TYPE_LABEL[req.type]} />
              <KV k="الاسم" v={display(req.name)} />
              <KV k="رقم الجوال" v={display(req.phone)} ltr />
              <KV k="المدينة" v={display(req.city)} />
              {ordered.map((row) => <KV key={row.key} k={row.label} v={row.value} />)}
              {req.preferred_times && <KV k="مواعيد التواصل" v={req.preferred_times} />}
            </div>
            {req.customer_notes && (
              <div className="text-sm whitespace-pre-wrap bg-white/5 rounded-lg p-2.5 mt-3" dir="auto">
                <div className="text-[11px] text-muted-foreground mb-1">ملاحظاتك:</div>
                {req.customer_notes}
              </div>
            )}
          </div>

          {customerImages.length > 0 && (
            <div className="glass rounded-2xl p-4">
              <div className="text-sm font-bold text-gold mb-3 flex items-center gap-1.5"><ImageIcon size={14} /> الصور التي أرسلتها</div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {customerImages.map((p, i) => (
                  <button key={i} onClick={() => setLightbox(publicUrl(p))} className="aspect-square rounded-lg overflow-hidden border border-white/10">
                    <img src={publicUrl(p)} onError={onImageError} alt="" loading="lazy" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "updates" && (
        <div className="glass rounded-2xl p-4">
          <div className="text-sm font-bold text-gold mb-3">تحديثات الحالة</div>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد تحديثات بعد. سنبقيك على اطلاع.</p>
          ) : (
            <div className="space-y-1.5">
              {history.map((h) => (
                <div key={h.id} className="text-xs flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-1.5">
                  <HistoryIcon size={12} className="text-gold" />
                  <span className="text-muted-foreground">{h.from_status ? REQUEST_STATUS_LABEL[h.from_status as RequestStatus] || h.from_status : "بدء"}</span>
                  <span>←</span>
                  <span className="text-gold">{REQUEST_STATUS_LABEL[h.to_status as RequestStatus] || h.to_status}</span>
                  <span className="text-muted-foreground ms-auto">{new Date(h.created_at).toLocaleString("ar-SA")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "comments" && (
        <CustomerCommentsPanel requestId={req.id} comments={comments} onChanged={load} />
      )}

      {tab === "reports" && (
        <div className="glass rounded-2xl p-4">
          <div className="text-sm font-bold text-gold mb-3 flex items-center gap-1.5"><FileText size={14} /> التقارير</div>
          {reports.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد تقارير منشورة بعد.</p>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => (
                <div key={r.id} className="bg-white/5 rounded-lg p-3">
                  <div className="font-bold text-sm">{r.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{REPORT_TYPE_LABEL[r.report_type] || r.report_type} · {new Date(r.created_at).toLocaleString("ar-SA")}</div>
                  {r.body && <div className="text-sm whitespace-pre-wrap mt-2" dir="auto">{r.body}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "attachments" && (
        <CustomerAttachmentsPanel requestId={req.id} attachments={attachments} onChanged={load} onOpen={setLightbox} />
      )}

      {tab === "appointments" && (
        <div className="glass rounded-2xl p-4">
          <div className="text-sm font-bold text-gold mb-3 flex items-center gap-1.5"><Calendar size={14} /> المواعيد</div>
          {appointments.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد مواعيد محددة لهذا الطلب.</p>
          ) : (
            <div className="space-y-2">
              {appointments.map((a) => (
                <div key={a.id} className="bg-white/5 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold">{a.kind}</div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10">{a.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{a.preferred_date ? new Date(a.preferred_date).toLocaleString("ar-SA") : NA}</div>
                  {a.notes && <div className="text-xs mt-2 whitespace-pre-wrap" dir="auto">{a.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 left-4 p-2 rounded-full bg-white/10" onClick={() => setLightbox(null)}><X size={20} /></button>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-xl"
            onError={(e) => { e.currentTarget.src = IMAGE_PLACEHOLDER; }} />
        </div>
      )}
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

function CustomerCommentsPanel({ requestId, comments, onChanged }: {
  requestId: string; comments: PublicNote[]; onChanged: () => void;
}) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("سجل الدخول"); setSaving(false); return; }
    const { error } = await supabase.from("request_notes").insert({
      request_id: requestId, body: text, visibility: "public", author_id: user.id,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { setBody(""); toast.success("تم إرسال تعليقك"); onChanged(); }
  };

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="text-sm font-bold text-gold flex items-center gap-1.5"><MessageSquare size={14} /> التعليقات</div>
      <div className="space-y-2">
        {comments.length === 0 && <p className="text-xs text-muted-foreground">لم تبدأ المحادثة بعد. اكتب أول تعليق إن أردت إضافة معلومة لفريقنا.</p>}
        {comments.map((c) => (
          <div key={c.id} className="bg-white/5 rounded-lg p-2.5 text-sm">
            <div className="whitespace-pre-wrap" dir="auto">{c.body}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{new Date(c.created_at).toLocaleString("ar-SA")}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2 pt-2 border-t border-white/10">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          dir="auto"
          placeholder="اكتب تعليقك هنا..."
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold/60 whitespace-pre-wrap"
        />
        <div className="flex justify-end">
          <button onClick={add} disabled={saving || !body.trim()}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-gold/20 text-gold hover:bg-gold/30 disabled:opacity-50">
            <Send size={13} /> إرسال
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerAttachmentsPanel({ requestId, attachments, onChanged, onOpen }: {
  requestId: string; attachments: AttachmentRow[]; onChanged: () => void; onOpen: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const onPick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        await uploadRequestAttachment(requestId, f, { visibleToCustomer: true });
      }
      toast.success("تم رفع الملف");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "فشل الرفع");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-gold flex items-center gap-1.5"><Paperclip size={14} /> المرفقات</div>
        <label className="text-xs px-3 py-1.5 rounded-md bg-gold/20 text-gold inline-flex items-center gap-1 cursor-pointer">
          <Upload size={13} /> {uploading ? "جاري الرفع..." : "إضافة ملف"}
          <input type="file" multiple accept="image/*,application/pdf" className="hidden"
            disabled={uploading} onChange={(e) => onPick(e.target.files)} />
        </label>
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">لا توجد مرفقات. يمكنك إضافة صور أو PDF حتى 10 ميجابايت.</p>
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
                    <span className="text-[10px] mt-1">PDF</span>
                  </a>
                )}
                <div className="p-2 text-[10px] truncate" title={a.file_name}>{a.file_name}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
