import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Eye, MessageCircle, UserCheck } from "lucide-react";
import {
  REQUEST_TYPE_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_COLOR,
  ALL_TYPES, ALL_STATUSES, type RequestType, type RequestStatus,
} from "@/lib/service-requests";
import {
  ASSIGNMENT_STATUS_LABEL, ASSIGNMENT_STATUS_COLOR,
  fetchStaffMembers, staffLabel, type AssignmentStatus, type StaffMember,
} from "@/lib/staff-assignment";
import { useAuth } from "@/hooks/use-auth";
import { display, waLink, waGreeting, NA } from "@/lib/admin-ops";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/requests/")({
  component: AdminRequestsPage,
});

type Req = {
  id: string; type: RequestType; status: RequestStatus;
  name: string; phone: string | null; city: string | null;
  details: Record<string, any> | null;
  assigned_to_staff_id: string | null;
  assignment_status: AssignmentStatus;
  assignment_department: string | null;
  created_at: string; updated_at: string;
};

type AssignFilter = "all" | "unassigned" | "assigned" | "accepted" | "mine";
const ASSIGN_FILTERS: { key: AssignFilter; label: string }[] = [
  { key: "all", label: "كل الإسناد" },
  { key: "unassigned", label: "غير مسندة" },
  { key: "assigned", label: "مسندة" },
  { key: "accepted", label: "تم استلامها" },
  { key: "mine", label: "طلباتي" },
];

const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60";

function AdminRequestsPage() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState<Req[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<RequestType | "">("");
  const [status, setStatus] = useState<RequestStatus | "">("");
  const [assignFilter, setAssignFilter] = useState<AssignFilter>("all");
  const [staffFilter, setStaffFilter] = useState<string>("");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [city, setCity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [reqs, st] = await Promise.all([
      supabase
        .from("service_requests")
        .select("id,type,status,name,phone,city,details,assigned_to_staff_id,assignment_status,assignment_department,created_at,updated_at" as any)
        .order("created_at", { ascending: false }),
      fetchStaffMembers(),
    ]);
    setRows((reqs.data ?? []) as unknown as Req[]);
    setStaff(st);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const cities = useMemo(
    () => Array.from(new Set(rows.map((r) => r.city).filter(Boolean))) as string[],
    [rows],
  );
  const depts = useMemo(
    () => Array.from(new Set(rows.map((r) => r.assignment_department).filter(Boolean))) as string[],
    [rows],
  );

  const filtered = useMemo(() => rows.filter((r) => {
    if (type && r.type !== type) return false;
    if (status && r.status !== status) return false;
    if (city && (r.city || "") !== city) return false;
    if (from && r.created_at < from) return false;
    if (to && r.created_at > to + "T23:59:59") return false;
    if (assignFilter === "unassigned" && r.assigned_to_staff_id) return false;
    if (assignFilter === "assigned" && r.assignment_status !== "assigned") return false;
    if (assignFilter === "accepted" && r.assignment_status !== "accepted") return false;
    if (assignFilter === "mine" && (!me || r.assigned_to_staff_id !== me.id)) return false;
    if (staffFilter && r.assigned_to_staff_id !== staffFilter) return false;
    if (deptFilter && (r.assignment_department || "") !== deptFilter) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      const inName = (r.name || "").toLowerCase().includes(s);
      const inPhone = (r.phone || "").includes(s);
      if (!inName && !inPhone) return false;
    }
    return true;
  }), [rows, type, status, city, from, to, q, assignFilter, staffFilter, deptFilter, me]);

  const assignCounts = useMemo(() => ({
    all: rows.length,
    unassigned: rows.filter((r) => !r.assigned_to_staff_id).length,
    assigned: rows.filter((r) => r.assignment_status === "assigned").length,
    accepted: rows.filter((r) => r.assignment_status === "accepted").length,
    mine: me ? rows.filter((r) => r.assigned_to_staff_id === me.id).length : 0,
  }), [rows, me]);

  const counts = useMemo(() => {
    const c: Record<RequestStatus, number> = Object.fromEntries(
      ALL_STATUSES.map((s) => [s, 0]),
    ) as any;
    rows.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  const changeStatus = async (id: string, newStatus: RequestStatus) => {
    if (savingId) return;
    setSavingId(id);
    const row = rows.find((r) => r.id === id);
    const { error } = await supabase.from("service_requests").update({ status: newStatus }).eq("id", id);
    if (!error) {
      await supabase.from("request_status_history").insert({
        request_id: id, from_status: row?.status ?? null, to_status: newStatus,
      });
      toast.success("تم تحديث الحالة");
      setRows((rs) => rs.map((r) => r.id === id ? { ...r, status: newStatus } : r));
    } else toast.error(error.message);
    setSavingId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h1 className="text-2xl sm:text-3xl font-bold">الطلبات <span className="text-base text-muted-foreground">({filtered.length})</span></h1>
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-1.5">
        <Chip active={status === ""} onClick={() => setStatus("")} label={`الكل (${rows.length})`} />
        {ALL_STATUSES.map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}
            label={`${REQUEST_STATUS_LABEL[s]} (${counts[s] || 0})`}
            color={REQUEST_STATUS_COLOR[s]} />
        ))}
      </div>

      {/* Assignment chips */}
      <div className="flex flex-wrap gap-1.5">
        {ASSIGN_FILTERS.map((f) => (
          <Chip key={f.key} active={assignFilter === f.key} onClick={() => setAssignFilter(f.key)}
            label={`${f.label} (${assignCounts[f.key]})`} />
        ))}
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl p-3 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="relative col-span-2 sm:col-span-3 lg:col-span-2">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className={inp + " pr-9"} value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الجوال" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value as any)} className={inp}>
          <option value="" className="bg-background">كل الأنواع</option>
          {ALL_TYPES.map((t) => <option key={t} value={t} className="bg-background">{REQUEST_TYPE_LABEL[t]}</option>)}
        </select>
        <select value={city} onChange={(e) => setCity(e.target.value)} className={inp}>
          <option value="" className="bg-background">كل المدن</option>
          {cities.map((c) => <option key={c} value={c} className="bg-background">{c}</option>)}
        </select>
        <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className={inp}>
          <option value="" className="bg-background">كل الموظفين</option>
          {staff.map((s) => <option key={s.id} value={s.id} className="bg-background">{staffLabel(s)}</option>)}
        </select>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className={inp}>
          <option value="" className="bg-background">كل الأقسام</option>
          {depts.map((d) => <option key={d} value={d} className="bg-background">{d}</option>)}
        </select>
        <input type="date" className={inp} value={from} onChange={(e) => setFrom(e.target.value)} title="من" />
        <input type="date" className={inp} value={to} onChange={(e) => setTo(e.target.value)} title="إلى" />
      </div>

      {loading && <p className="text-sm text-muted-foreground">جاري التحميل...</p>}
      {!loading && filtered.length === 0 && <p className="text-sm text-muted-foreground">لا توجد طلبات مطابقة.</p>}

      {/* Desktop table */}
      <div className="hidden lg:block glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-xs text-muted-foreground">
            <tr>
              <th className="text-right p-3">العميل</th>
              <th className="text-right p-3">الجوال</th>
              <th className="text-right p-3">النوع</th>
              <th className="text-right p-3">المدينة</th>
              <th className="text-right p-3">الحالة</th>
              <th className="text-right p-3">الإسناد</th>
              <th className="text-right p-3">تاريخ الإرسال</th>
              <th className="text-right p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const wa = waLink(r.phone, waGreeting(r.name, r.type));
              const assigned = staff.find((s) => s.id === r.assigned_to_staff_id) || null;
              return (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="p-3 font-medium">{display(r.name)}</td>
                  <td className="p-3 text-xs" dir="ltr">{r.phone || NA}</td>
                  <td className="p-3 text-xs">{REQUEST_TYPE_LABEL[r.type]}</td>
                  <td className="p-3 text-xs">{display(r.city)}</td>
                  <td className="p-3">
                    <select
                      value={r.status}
                      onChange={(e) => changeStatus(r.id, e.target.value as RequestStatus)}
                      disabled={savingId === r.id}
                      className={`text-xs px-2 py-1 rounded-md bg-white/5 border border-white/10 ${REQUEST_STATUS_COLOR[r.status]}`}
                    >
                      {ALL_STATUSES.map((s) => <option key={s} value={s} className="bg-background text-foreground">{REQUEST_STATUS_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td className="p-3 text-xs">
                    <div className="flex flex-col gap-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${ASSIGNMENT_STATUS_COLOR[r.assignment_status]}`}>
                        {ASSIGNMENT_STATUS_LABEL[r.assignment_status]}
                      </span>
                      <span className="text-[11px]">{assigned ? staffLabel(assigned) : "—"}</span>
                      {r.assignment_department && <span className="text-[10px] text-muted-foreground">{r.assignment_department}</span>}
                    </div>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar-SA")}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <Link to="/admin/requests/$id" params={{ id: r.id }}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-gold/15 text-gold hover:bg-gold/25">
                        <Eye size={12} /> عرض
                      </Link>
                      {wa && (
                        <a href={wa} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25">
                          <MessageCircle size={12} /> واتساب
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile compact cards */}
      <div className="lg:hidden space-y-2">
        {filtered.map((r) => {
          const wa = waLink(r.phone, waGreeting(r.name, r.type));
          return (
            <div key={r.id} className="glass rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{display(r.name)}</div>
                  <div className="text-[11px] text-muted-foreground" dir="ltr">{r.phone || NA} · {display(r.city)}</div>
                </div>
                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-md ${REQUEST_STATUS_COLOR[r.status]}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{REQUEST_TYPE_LABEL[r.type]}</span>
                <span>{new Date(r.created_at).toLocaleDateString("ar-SA")}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className={`px-1.5 py-0.5 rounded ${ASSIGNMENT_STATUS_COLOR[r.assignment_status]} inline-flex items-center gap-1`}>
                  <UserCheck size={10} /> {ASSIGNMENT_STATUS_LABEL[r.assignment_status]}
                </span>
                <span className="text-muted-foreground truncate">
                  {staffLabel(staff.find((s) => s.id === r.assigned_to_staff_id) || null)}
                  {r.assignment_department ? ` · ${r.assignment_department}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link to="/admin/requests/$id" params={{ id: r.id }}
                  className="flex-1 text-center text-xs px-2 py-1.5 rounded-md bg-gold/15 text-gold">عرض التفاصيل</Link>
                {wa && <a href={wa} target="_blank" rel="noreferrer"
                  className="text-xs px-2 py-1.5 rounded-md bg-emerald-500/15 text-emerald-300">واتساب</a>}
                <select
                  value={r.status}
                  onChange={(e) => changeStatus(r.id, e.target.value as RequestStatus)}
                  disabled={savingId === r.id}
                  className="text-xs px-2 py-1.5 rounded-md bg-white/5 border border-white/10"
                >
                  {ALL_STATUSES.map((s) => <option key={s} value={s} className="bg-background">{REQUEST_STATUS_LABEL[s]}</option>)}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition ${
        active
          ? "bg-gold/20 text-gold border-gold/40"
          : color
            ? `${color} border-transparent hover:border-white/20`
            : "bg-white/5 border-white/10 hover:bg-white/10"
      }`}
    >{label}</button>
  );
}
