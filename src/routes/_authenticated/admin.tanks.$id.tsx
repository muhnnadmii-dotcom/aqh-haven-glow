import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl, getImageUrl, onImageError } from "@/lib/storage";
import { toast } from "sonner";
import {
  ArrowRight, Fish, Droplets, FlaskConical, Camera, StickyNote,
  AlertTriangle, CheckCircle2, ExternalLink,
} from "lucide-react";
import { REQUEST_TYPE_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_COLOR, type RequestType, type RequestStatus } from "@/lib/service-requests";

export const Route = createFileRoute("/_authenticated/admin/tanks/$id")({
  component: AdminTankDetail,
});

type Tank = any;
type Log = {
  id: string; created_at: string; log_type: string;
  status: string | null; water_change_percentage: number | null;
  note: string | null; note_category: string | null;
  image_paths: string[] | null;
};
type Reading = any;
type Issue = {
  id: string; created_at: string; issue_type: string;
  description: string | null; status: string; image_paths: string[] | null;
  wants_followup: boolean; service_request_id: string | null;
};
type Req = {
  id: string; type: RequestType; status: RequestStatus; created_at: string;
  assigned_to_staff_id: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  excellent: "ممتاز", normal: "مستقر", needs_attention: "يحتاج متابعة", problem: "توجد مشكلة",
};
const ISSUE_LABEL: Record<string, string> = {
  water_clarity: "عكارة في الماء", sick_fish: "سمكة تعبانة", algae: "طحالب",
  smell: "رائحة", equipment: "فلتر / جهاز", death: "موت كائنات", other: "أخرى",
};
const ISSUE_STATUS_LABEL: Record<string, string> = {
  open: "مفتوحة", in_review: "قيد المراجعة", resolved: "تم الحل", closed: "مغلقة",
};
const ISSUE_STATUSES = ["open", "in_review", "resolved", "closed"] as const;

function ago(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "اليوم";
  if (d === 1) return "أمس";
  return `قبل ${d} يوم`;
}

function AdminTankDetail() {
  const { id } = Route.useParams();
  const [tank, setTank] = useState<Tank | null>(null);
  const [owner, setOwner] = useState<{ full_name: string | null; phone: string | null } | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [requests, setRequests] = useState<Req[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: t } = await supabase.from("customer_tanks").select("*").eq("id", id).maybeSingle();
      setTank(t);
      if (t?.user_id) {
        const { data: p } = await supabase.from("profiles").select("full_name, phone").eq("id", t.user_id).maybeSingle();
        setOwner(p as any);
      }
      const [l, r, i, q] = await Promise.all([
        supabase.from("aquarium_care_logs").select("*").eq("tank_id", id).order("created_at", { ascending: false }),
        supabase.from("aquarium_readings").select("*").eq("tank_id", id).order("reading_date", { ascending: false }),
        supabase.from("aquarium_issues").select("*").eq("tank_id", id).order("created_at", { ascending: false }),
        supabase.from("service_requests").select("id, type, status, created_at, assigned_to_staff_id").eq("tank_id", id).order("created_at", { ascending: false }),
      ]);
      setLogs((l.data ?? []) as Log[]);
      setReadings((r.data ?? []) as Reading[]);
      setIssues((i.data ?? []) as Issue[]);
      setRequests((q.data ?? []) as Req[]);
      setLoading(false);
    })();
  }, [id, reloadKey]);

  const lastWC = logs.find((x) => x.log_type === "water_change");
  const lastReading = readings[0];
  const lastPhoto = logs.find((x) => x.image_paths && x.image_paths.length > 0);
  const lastStatus = logs.find((x) => x.log_type === "status_update" && x.status);
  const openIssues = issues.filter((x) => x.status === "open" || x.status === "in_review");

  const timeline = useMemo(() => {
    const a: any[] = [];
    for (const l of logs) a.push({ kind: l.log_type, date: l.created_at, data: l });
    for (const r of readings) a.push({ kind: "reading", date: r.reading_date, data: r });
    for (const i of issues) a.push({ kind: "issue", date: i.created_at, data: i });
    return a.sort((x, y) => +new Date(y.date) - +new Date(x.date));
  }, [logs, readings, issues]);

  const updateIssueStatus = async (issueId: string, status: string) => {
    const { error } = await supabase.from("aquarium_issues").update({ status }).eq("id", issueId);
    if (error) { toast.error("تعذر التحديث"); return; }
    toast.success("تم تحديث حالة المشكلة");
    setReloadKey((k) => k + 1);
  };

  if (loading) return <div className="text-sm text-muted-foreground">جاري التحميل...</div>;
  if (!tank) return <div className="text-sm">الحوض غير موجود</div>;

  const cover = tank.primary_image || tank.image_path || (Array.isArray(tank.image_paths) ? tank.image_paths[0] : null);

  return (
    <div className="space-y-5">
      <Link to="/admin/tanks" className="text-xs text-gold flex items-center gap-1 hover:underline">
        <ArrowRight size={14} /> رجوع لقائمة الأحواض
      </Link>

      {/* Tank header */}
      <div className="glass rounded-2xl p-5 flex flex-col sm:flex-row gap-4">
        {cover ? (
          <img src={getImageUrl(cover)} onError={onImageError} alt={tank.name}
            className="h-32 w-32 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="h-32 w-32 rounded-xl bg-white/5 grid place-items-center text-gold shrink-0"><Fish size={32} /></div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{tank.name}</h1>
          <div className="text-sm text-muted-foreground mt-1">
            العميل: {owner?.full_name || "—"} {owner?.phone ? `· ${owner.phone}` : ""}
          </div>
          <div className="text-sm text-muted-foreground">
            {tank.tank_type ?? "—"} {tank.volume_liters ? `· ${tank.volume_liters}L` : ""} {tank.city ? `· ${tank.city}` : ""}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            تاريخ الإضافة: {new Date(tank.created_at).toLocaleDateString("ar-SA")}
          </div>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
        <SummaryCell label="الحالة الحالية" value={lastStatus?.status ? STATUS_LABEL[lastStatus.status] : "—"} />
        <SummaryCell label="آخر تحديث" value={ago(lastStatus?.created_at ?? logs[0]?.created_at)} />
        <SummaryCell label="مشاكل مفتوحة" value={String(openIssues.length)} />
        <SummaryCell label="آخر تغيير ماء"
          value={lastWC ? `${ago(lastWC.created_at)}${lastWC.water_change_percentage ? ` · ${lastWC.water_change_percentage}%` : ""}` : "—"} />
        <SummaryCell label="آخر قراءة" value={ago(lastReading?.reading_date)} />
      </div>

      {/* Open issues */}
      {openIssues.length > 0 && (
        <section className="glass rounded-2xl p-5">
          <h2 className="font-bold mb-3 text-sm flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-300" /> المشاكل المفتوحة
          </h2>
          <ul className="space-y-3">
            {openIssues.map((iss) => <IssueCard key={iss.id} iss={iss} onChange={updateIssueStatus} />)}
          </ul>
        </section>
      )}

      {/* Linked requests */}
      <section className="glass rounded-2xl p-5">
        <h2 className="font-bold mb-3 text-sm">الطلبات المرتبطة ({requests.length})</h2>
        {requests.length === 0 ? (
          <p className="text-xs text-muted-foreground">لا توجد طلبات مرتبطة بهذا الحوض.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((q) => (
              <li key={q.id} className="glass rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-medium">{REQUEST_TYPE_LABEL[q.type]}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-md mr-2 ${REQUEST_STATUS_COLOR[q.status]}`}>{REQUEST_STATUS_LABEL[q.status]}</span>
                  <span className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString("ar-SA")}</span>
                </div>
                <Link to="/admin/requests/$id" params={{ id: q.id }} className="text-xs text-gold flex items-center gap-1 hover:underline">
                  فتح الطلب <ExternalLink size={12} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Last readings */}
      {readings.length > 0 && (
        <section className="glass rounded-2xl p-5">
          <h2 className="font-bold mb-3 text-sm">آخر القراءات</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="text-muted-foreground">
                <tr><th className="p-2">التاريخ</th><th>pH</th><th>NH3</th><th>NO2</th><th>NO3</th><th>KH</th><th>°C</th><th>SG</th><th>Ca</th><th>Mg</th><th>PO4</th></tr>
              </thead>
              <tbody>
                {readings.slice(0, 10).map((r: any) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="p-2">{new Date(r.reading_date).toLocaleDateString("ar-SA")}</td>
                    <td>{r.ph ?? "—"}</td><td>{r.ammonia ?? "—"}</td><td>{r.nitrite ?? "—"}</td><td>{r.nitrate ?? "—"}</td>
                    <td>{r.kh ?? "—"}</td><td>{r.temperature ?? "—"}</td><td>{r.salinity ?? "—"}</td>
                    <td>{r.calcium ?? "—"}</td><td>{r.magnesium ?? "—"}</td><td>{r.phosphate ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Full timeline */}
      <section className="glass rounded-2xl p-5">
        <h2 className="font-bold mb-3 text-sm">سجل العناية الكامل ({timeline.length})</h2>
        {timeline.length === 0 ? (
          <p className="text-xs text-muted-foreground">لا توجد سجلات بعد.</p>
        ) : (
          <ul className="space-y-2">
            {timeline.map((e, idx) => <TimelineItem key={idx} e={e} ownerName={owner?.full_name ?? null} />)}
          </ul>
        )}
      </section>

      {/* All issues (history) */}
      {issues.length > 0 && (
        <section className="glass rounded-2xl p-5">
          <h2 className="font-bold mb-3 text-sm">جميع المشاكل ({issues.length})</h2>
          <ul className="space-y-3">
            {issues.map((iss) => <IssueCard key={iss.id} iss={iss} onChange={updateIssueStatus} />)}
          </ul>
        </section>
      )}
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium truncate">{value}</div>
    </div>
  );
}

function IssueCard({ iss, onChange }: { iss: Issue; onChange: (id: string, s: string) => void }) {
  return (
    <li className="glass rounded-xl p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">{ISSUE_LABEL[iss.issue_type] ?? iss.issue_type}</div>
        <div className="text-[11px] text-muted-foreground">{new Date(iss.created_at).toLocaleDateString("ar-SA")}</div>
      </div>
      {iss.description && <div className="text-xs text-muted-foreground whitespace-pre-wrap">{iss.description}</div>}
      {iss.image_paths && iss.image_paths.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {iss.image_paths.map((p) => (
            <a key={p} href={publicUrl(p)} target="_blank" rel="noreferrer">
              <img src={publicUrl(p)} alt="" className="h-16 w-16 rounded-lg object-cover border border-white/10" />
            </a>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs text-muted-foreground">الحالة:</span>
        {ISSUE_STATUSES.map((s) => (
          <button key={s} onClick={() => onChange(iss.id, s)}
            className={`text-[11px] rounded-md px-2 py-1 border ${iss.status === s ? "border-gold bg-gold/10 text-gold" : "border-white/10 hover:bg-white/5"}`}>
            {ISSUE_STATUS_LABEL[s]}
          </button>
        ))}
        {iss.wants_followup && <span className="text-[11px] text-amber-300">طلب دعم Aqua Haven</span>}
        {iss.service_request_id ? (
          <Link to="/admin/requests/$id" params={{ id: iss.service_request_id }}
            className="text-[11px] text-gold flex items-center gap-1 hover:underline">
            عرض الطلب المرتبط <ExternalLink size={11} />
          </Link>
        ) : iss.wants_followup ? (
          <span className="text-[11px] text-rose-300">تحتاج إنشاء طلب يدوي</span>
        ) : null}
      </div>
    </li>
  );
}

function TimelineItem({ e, ownerName }: { e: any; ownerName: string | null }) {
  const ICONS: Record<string, any> = {
    water_change: <Droplets size={14} />, reading: <FlaskConical size={14} />,
    photo: <Camera size={14} />, note: <StickyNote size={14} />,
    issue: <AlertTriangle size={14} />, status_update: <CheckCircle2 size={14} />,
  };
  const d = e.data;
  let title = "";
  let detail = "";
  let img: string | null = null;
  if (e.kind === "water_change") {
    title = `تغيير ماء${d.water_change_percentage ? ` (${d.water_change_percentage}%)` : ""}`;
    detail = d.note ?? "";
    img = d.image_paths?.[0] ?? null;
  } else if (e.kind === "photo") {
    title = "صورة جديدة"; detail = d.note ?? ""; img = d.image_paths?.[0] ?? null;
  } else if (e.kind === "note") {
    title = "ملاحظة"; detail = d.note ?? ""; img = d.image_paths?.[0] ?? null;
  } else if (e.kind === "status_update") {
    title = `تحديث حالة: ${STATUS_LABEL[d.status] ?? d.status}`;
    detail = d.note ?? "";
  } else if (e.kind === "reading") {
    title = "قراءة جديدة";
    detail = [
      d.ph != null && `pH ${d.ph}`, d.nitrate != null && `NO3 ${d.nitrate}`,
      d.ammonia != null && `NH3 ${d.ammonia}`, d.temperature != null && `${d.temperature}°C`,
      d.salinity != null && `SG ${d.salinity}`,
    ].filter(Boolean).join(" · ");
  } else if (e.kind === "issue") {
    title = `مشكلة: ${ISSUE_LABEL[d.issue_type] ?? d.issue_type} (${ISSUE_STATUS_LABEL[d.status] ?? d.status})`;
    detail = d.description ?? "";
    img = d.image_paths?.[0] ?? null;
  }
  return (
    <li className="glass rounded-xl p-3 flex gap-3 items-start">
      <div className="h-7 w-7 rounded-full bg-gold/10 text-gold grid place-items-center shrink-0">{ICONS[e.kind]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-[11px] text-muted-foreground">
            {new Date(e.date).toLocaleString("ar-SA")} {ownerName ? `· ${ownerName}` : ""}
          </div>
        </div>
        {detail && <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{detail}</div>}
      </div>
      {img && (
        <a href={publicUrl(img)} target="_blank" rel="noreferrer" className="shrink-0">
          <img src={publicUrl(img)} alt="" className="h-12 w-12 rounded-lg object-cover border border-white/10" />
        </a>
      )}
    </li>
  );
}
