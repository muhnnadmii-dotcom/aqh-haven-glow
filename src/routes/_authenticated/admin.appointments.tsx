import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, MessageCircle, Search, Eye, X } from "lucide-react";
import { display, NA, waLink } from "@/lib/admin-ops";

export const Route = createFileRoute("/_authenticated/admin/appointments")({
  component: AppointmentsAdmin,
});

const APPT_STATUSES = ["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const;
type ApptStatus = typeof APPT_STATUSES[number];
const STATUS_LABEL: Record<ApptStatus, string> = {
  scheduled: "مجدول", confirmed: "تم التأكيد", completed: "مكتمل",
  cancelled: "ملغي", no_show: "لم يتم",
};
const STATUS_COLOR: Record<ApptStatus, string> = {
  scheduled: "bg-blue-500/20 text-blue-300",
  confirmed: "bg-emerald-500/20 text-emerald-300",
  completed: "bg-teal-500/20 text-teal-300",
  cancelled: "bg-rose-500/20 text-rose-300",
  no_show: "bg-amber-500/20 text-amber-300",
};

type Row = {
  id: string; user_id: string; kind: string; status: string;
  preferred_date: string | null; notes: string | null; admin_notes: string | null;
  created_at: string; service_request_id: string | null;
  profile?: { full_name: string | null; phone: string | null };
  request?: { name: string | null; phone: string | null; city: string | null } | null;
};

const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60";

function AppointmentsAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [kindFilter, setKindFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApptStatus | "">("");
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("appointments").select("*").order("preferred_date", { ascending: false });
    const items = (data ?? []) as Row[];
    const uids = [...new Set(items.map((r) => r.user_id).filter(Boolean))];
    const rids = [...new Set(items.map((r) => r.service_request_id).filter(Boolean) as string[])];
    if (uids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, phone").in("id", uids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      items.forEach((r) => { r.profile = map.get(r.user_id) as any; });
    }
    if (rids.length) {
      const { data: reqs } = await supabase.from("service_requests").select("id,name,phone,city").in("id", rids);
      const map = new Map((reqs ?? []).map((r: any) => [r.id, r]));
      items.forEach((r) => { if (r.service_request_id) r.request = map.get(r.service_request_id) as any; });
    }
    setRows(items);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const kinds = useMemo(() => Array.from(new Set(rows.map((r) => r.kind).filter(Boolean))), [rows]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return rows.filter((r) => {
      const t = r.preferred_date ? new Date(r.preferred_date).getTime() : 0;
      const upcoming = !r.preferred_date || t >= now;
      if (tab === "upcoming" && !upcoming) return false;
      if (tab === "past" && upcoming) return false;
      if (kindFilter && r.kind !== kindFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (q.trim()) {
        const s = q.trim().toLowerCase();
        const name = (r.request?.name || r.profile?.full_name || "").toLowerCase();
        const phone = r.request?.phone || r.profile?.phone || "";
        if (!name.includes(s) && !phone.includes(s)) return false;
      }
      return true;
    });
  }, [rows, tab, kindFilter, statusFilter, q]);

  const update = async (id: string, patch: Partial<Row>) => {
    if (savingId) return;
    setSavingId(id);
    const { error } = await supabase.from("appointments").update(patch as any).eq("id", id);
    setSavingId(null);
    if (error) toast.error(error.message); else { toast.success("تم"); load(); }
  };

  const cancel = async (id: string) => {
    if (!confirm("إلغاء الموعد؟")) return;
    update(id, { status: "cancelled" });
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl sm:text-3xl font-bold">المواعيد</h1>

      <div className="flex flex-wrap gap-1.5">
        <Tab active={tab === "upcoming"} onClick={() => setTab("upcoming")} label="القادمة" />
        <Tab active={tab === "past"} onClick={() => setTab("past")} label="السابقة" />
      </div>

      <div className="glass rounded-2xl p-3 grid gap-2 grid-cols-2 sm:grid-cols-4">
        <div className="relative col-span-2">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className={inp + " pr-9"} value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الجوال" />
        </div>
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className={inp}>
          <option value="" className="bg-background">كل الأنواع</option>
          {kinds.map((k) => <option key={k} value={k} className="bg-background">{k}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className={inp}>
          <option value="" className="bg-background">كل الحالات</option>
          {APPT_STATUSES.map((s) => <option key={s} value={s} className="bg-background">{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      {loading && <p className="text-sm text-muted-foreground">جاري التحميل...</p>}
      {!loading && filtered.length === 0 && <p className="text-sm text-muted-foreground">لا توجد مواعيد.</p>}

      <div className="space-y-2">
        {filtered.map((r) => {
          const name = r.request?.name || r.profile?.full_name || NA;
          const phone = r.request?.phone || r.profile?.phone || null;
          const city = r.request?.city;
          const wa = waLink(phone);
          const status = (r.status as ApptStatus);
          return (
            <div key={r.id} className="glass rounded-xl p-3 sm:p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{display(name)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap" dir="ltr">
                    <span>{phone || NA}</span>
                    {city && <><span>·</span><span>{city}</span></>}
                  </div>
                </div>
                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-md ${STATUS_COLOR[status] || "bg-white/10"}`}>
                  {STATUS_LABEL[status] || r.status}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gold/10 text-gold">
                  <Calendar size={11} /> {r.kind}
                </span>
                <span className="text-muted-foreground">
                  {r.preferred_date ? new Date(r.preferred_date).toLocaleString("ar-SA") : NA}
                </span>
              </div>
              {r.notes && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{r.notes}</p>}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {r.service_request_id && (
                  <Link to="/admin/requests/$id" params={{ id: r.service_request_id }}
                    className="text-xs px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 inline-flex items-center gap-1">
                    <Eye size={11} /> الطلب
                  </Link>
                )}
                {wa && <a href={wa} target="_blank" rel="noreferrer"
                  className="text-xs px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 inline-flex items-center gap-1">
                  <MessageCircle size={11} /> واتساب
                </a>}
                <select value={r.status} onChange={(e) => update(r.id, { status: e.target.value })}
                  disabled={savingId === r.id}
                  className="text-xs px-2 py-1 rounded-md bg-white/5 border border-white/10">
                  {APPT_STATUSES.map((s) => <option key={s} value={s} className="bg-background">{STATUS_LABEL[s]}</option>)}
                </select>
                {r.status !== "cancelled" && (
                  <button onClick={() => cancel(r.id)}
                    className="text-xs px-2 py-1 rounded-md bg-rose-500/10 text-rose-300 inline-flex items-center gap-1">
                    <X size={11} /> إلغاء
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Tab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={`text-sm px-3 py-1.5 rounded-full border transition ${
        active ? "bg-gold/20 text-gold border-gold/40" : "bg-white/5 border-white/10 hover:bg-white/10"
      }`}>{label}</button>
  );
}
