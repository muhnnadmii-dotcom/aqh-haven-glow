import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { publicUrl } from "@/lib/storage";
import { Phone, Search } from "lucide-react";
import {
  REQUEST_TYPE_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_COLOR,
  ALL_TYPES, ALL_STATUSES, type RequestType, type RequestStatus,
} from "@/lib/service-requests";

export const Route = createFileRoute("/_authenticated/admin/requests")({
  component: AdminRequestsPage,
});

type Req = {
  id: string; type: RequestType; status: RequestStatus; name: string; phone: string; city: string | null;
  details: Record<string, any>; customer_notes: string | null; admin_notes: string | null;
  preferred_times: string | null; attachments: string[]; tank_id: string | null;
  created_at: string;
};
type TankRef = { id: string; name: string; tank_type: string | null; volume_liters: number | null; dimensions: string | null; [k: string]: any };

function AdminRequestsPage() {
  const [list, setList] = useState<Req[]>([]);
  const [tanks, setTanks] = useState<Record<string, TankRef>>({});
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<RequestType | "">("");
  const [status, setStatus] = useState<RequestStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("service_requests").select("*").order("created_at", { ascending: false });
    const reqs = (data ?? []) as unknown as Req[];
    setList(reqs);
    const ids = Array.from(new Set(reqs.map((r) => r.tank_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: t } = await supabase.from("customer_tanks").select("*").in("id", ids);
      const map: Record<string, TankRef> = {};
      (t ?? []).forEach((x: any) => { map[x.id] = x; });
      setTanks(map);
    } else setTanks({});
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => list.filter((r) => {
    if (type && r.type !== type) return false;
    if (status && r.status !== status) return false;
    if (from && r.created_at < from) return false;
    if (to && r.created_at > to + "T23:59:59") return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      if (!r.name.toLowerCase().includes(s) && !r.phone.includes(s)) return false;
    }
    return true;
  }), [list, type, status, from, to, q]);

  const update = async (id: string, patch: Partial<Req>) => {
    const { error } = await supabase.from("service_requests").update(patch as any).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم"); load(); }
  };
  const remove = async (id: string) => {
    if (!confirm("حذف الطلب؟")) return;
    const { error } = await supabase.from("service_requests").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">الطلبات ({filtered.length})</h1>

      <div className="glass rounded-2xl p-4 grid gap-3 sm:grid-cols-5">
        <select value={type} onChange={(e) => setType(e.target.value as any)} className={inp}>
          <option value="" className="bg-background">كل الأنواع</option>
          {ALL_TYPES.map((t) => <option key={t} value={t} className="bg-background">{REQUEST_TYPE_LABEL[t]}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={inp}>
          <option value="" className="bg-background">كل الحالات</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s} className="bg-background">{REQUEST_STATUS_LABEL[s]}</option>)}
        </select>
        <input type="date" className={inp} value={from} onChange={(e) => setFrom(e.target.value)} title="من" />
        <input type="date" className={inp} value={to} onChange={(e) => setTo(e.target.value)} title="إلى" />
        <div className="relative">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className={inp + " pr-9"} value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم/الجوال" />
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">جاري التحميل...</p>}
      {!loading && filtered.length === 0 && <p className="text-sm text-muted-foreground">لا توجد طلبات مطابقة.</p>}

      <div className="space-y-3">
        {filtered.map((r) => {
          const tank = r.tank_id ? tanks[r.tank_id] : null;
          return (
            <div key={r.id} className="glass rounded-2xl p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-md bg-gold/10 text-gold">{REQUEST_TYPE_LABEL[r.type]}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-md ${REQUEST_STATUS_COLOR[r.status]}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
                  </div>
                  <div className="font-bold mt-1">{r.name} {r.city && <span className="text-xs text-muted-foreground">— {r.city}</span>}</div>
                  <a href={`tel:${r.phone}`} dir="ltr" className="text-sm text-gold flex items-center gap-1 mt-1"><Phone size={12} /> {r.phone}</a>
                </div>
                <div className="flex items-center gap-2">
                  <select value={r.status} onChange={(e) => update(r.id, { status: e.target.value as RequestStatus })}
                    className="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs">
                    {ALL_STATUSES.map((s) => <option key={s} value={s} className="bg-background">{REQUEST_STATUS_LABEL[s]}</option>)}
                  </select>
                  <button onClick={() => remove(r.id)} className="text-xs text-red-400 hover:underline">حذف</button>
                </div>
              </div>

              {tank && (
                <div className="text-xs bg-white/5 rounded-xl p-2">
                  <b>الحوض المرتبط:</b> {tank.name} · {tank.tank_type ?? ""} · {tank.dimensions ?? ""} {tank.volume_liters ? `· ${tank.volume_liters}L` : ""}
                </div>
              )}

              {tank && tank.tank_type === "marine" && (r.type === "consultation" || r.type === "maintenance") && (
                <MarineCard tank={tank} />
              )}

              {Object.keys(r.details ?? {}).length > 0 && (
                <div className="text-xs grid sm:grid-cols-2 gap-1">
                  {Object.entries(r.details).map(([k, v]) => v ? (
                    <div key={k}><b className="text-muted-foreground">{k}:</b> {String(v)}</div>
                  ) : null)}
                </div>
              )}

              {r.preferred_times && <p className="text-xs"><b>المواعيد المناسبة:</b> {r.preferred_times}</p>}
              {r.customer_notes && <p className="text-sm whitespace-pre-wrap">{r.customer_notes}</p>}

              {r.attachments?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {r.attachments.map((p) => (
                    <a key={p} href={publicUrl(p)} target="_blank" rel="noreferrer">
                      <img src={publicUrl(p)} alt="" className="h-20 w-20 rounded-xl object-cover border border-white/10" />
                    </a>
                  ))}
                </div>
              )}

              <textarea defaultValue={r.admin_notes ?? ""}
                onBlur={(e) => e.target.value !== (r.admin_notes ?? "") && update(r.id, { admin_notes: e.target.value })}
                placeholder="ملاحظات داخلية..." rows={2}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm resize-none" />
              <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-SA")}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60";
