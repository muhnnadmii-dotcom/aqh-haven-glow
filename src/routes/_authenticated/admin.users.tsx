import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Eye, MessageCircle } from "lucide-react";
import { display, NA, waLink } from "@/lib/admin-ops";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: CustomersList,
});

type Row = {
  id: string; full_name: string | null; phone: string | null;
  city: string | null; tanks: number; requests: number;
  last_request_at: string | null; roles: string[];
};

const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60";

function CustomersList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");

  const load = async () => {
    setLoading(true);
    const [profs, roles, tanks, reqs] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("customer_tanks").select("user_id"),
      supabase.from("service_requests").select("user_id, city, created_at").order("created_at", { ascending: false }),
    ]);
    const tCount = new Map<string, number>();
    (tanks.data ?? []).forEach((t: any) => tCount.set(t.user_id, (tCount.get(t.user_id) ?? 0) + 1));
    const rCount = new Map<string, number>();
    const lastReq = new Map<string, string>();
    const cityMap = new Map<string, string | null>();
    (reqs.data ?? []).forEach((r: any) => {
      if (!r.user_id) return;
      rCount.set(r.user_id, (rCount.get(r.user_id) ?? 0) + 1);
      if (!lastReq.has(r.user_id)) lastReq.set(r.user_id, r.created_at);
      if (!cityMap.has(r.user_id)) cityMap.set(r.user_id, r.city);
    });
    const roleMap = new Map<string, string[]>();
    (roles.data ?? []).forEach((r: any) => roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]));
    setRows((profs.data ?? []).map((p: any) => ({
      id: p.id, full_name: p.full_name, phone: p.phone,
      city: cityMap.get(p.id) ?? null,
      tanks: tCount.get(p.id) ?? 0,
      requests: rCount.get(p.id) ?? 0,
      last_request_at: lastReq.get(p.id) ?? null,
      roles: roleMap.get(p.id) ?? [],
    })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const cities = useMemo(
    () => Array.from(new Set(rows.map((r) => r.city).filter(Boolean))) as string[],
    [rows],
  );

  const filtered = useMemo(() => rows.filter((r) => {
    if (city && r.city !== city) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      if (!(r.full_name || "").toLowerCase().includes(s) && !(r.phone || "").includes(s)) return false;
    }
    return true;
  }), [rows, q, city]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl sm:text-3xl font-bold">العملاء ({filtered.length})</h1>

      <div className="glass rounded-2xl p-3 grid gap-2 grid-cols-2">
        <div className="relative">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className={inp + " pr-9"} value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم/الجوال" />
        </div>
        <select value={city} onChange={(e) => setCity(e.target.value)} className={inp}>
          <option value="" className="bg-background">كل المدن</option>
          {cities.map((c) => <option key={c} value={c} className="bg-background">{c}</option>)}
        </select>
      </div>

      {loading && <p className="text-sm text-muted-foreground">جاري التحميل...</p>}
      {!loading && filtered.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد عملاء.</p>}

      <div className="space-y-2">
        {filtered.map((u) => {
          const wa = waLink(u.phone);
          return (
            <div key={u.id} className="glass rounded-xl p-3 sm:p-4 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate flex items-center gap-2">
                  {display(u.full_name)}
                  {u.roles.filter((r) => r !== "customer").map((r) =>
                    <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-gold/15 text-gold">{r}</span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5" dir="ltr">
                  {u.phone || NA} · {u.city || NA}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <Stat label="طلبات" value={u.requests} />
                <Stat label="أحواض" value={u.tanks} />
              </div>
              <div className="flex items-center gap-1.5">
                <Link to="/admin/users/$id" params={{ id: u.id }}
                  className="text-xs px-2 py-1.5 rounded-md bg-gold/15 text-gold inline-flex items-center gap-1">
                  <Eye size={12} /> عرض
                </Link>
                {wa && <a href={wa} target="_blank" rel="noreferrer"
                  className="text-xs px-2 py-1.5 rounded-md bg-emerald-500/15 text-emerald-300 inline-flex items-center gap-1">
                  <MessageCircle size={12} /> واتساب
                </a>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="font-bold text-sm">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
