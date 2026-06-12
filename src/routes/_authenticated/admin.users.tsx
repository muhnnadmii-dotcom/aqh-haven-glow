import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, ShieldOff, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersAdmin,
});

type Row = { id: string; full_name: string | null; phone: string | null; roles: string[]; tanks: number };

function UsersAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const { data: tanks } = await supabase.from("customer_tanks").select("user_id");
    const tankCount = new Map<string, number>();
    (tanks ?? []).forEach((t: any) => tankCount.set(t.user_id, (tankCount.get(t.user_id) ?? 0) + 1));
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]));
    setRows((profiles ?? []).map((p: any) => ({
      id: p.id, full_name: p.full_name, phone: p.phone,
      roles: roleMap.get(p.id) ?? [], tanks: tankCount.get(p.id) ?? 0,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setRole = async (userId: string, role: "admin" | "staff" | "customer", on: boolean) => {
    if (on) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("تم التحديث"); load();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">العملاء</h1>
      {loading && <p className="text-sm text-muted-foreground">جاري التحميل...</p>}
      <div className="grid gap-3">
        {rows.map((u) => (
          <div key={u.id} className="glass rounded-2xl p-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-bold">{u.full_name || "بدون اسم"}</div>
              <div className="text-xs text-muted-foreground" dir="ltr">{u.phone || "—"} · {u.tanks} حوض</div>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {u.roles.map((r) => <span key={r} className="text-[10px] px-2 py-0.5 rounded-md bg-white/10">{r}</span>)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["admin", "staff"] as const).map((r) => (
                <button key={r} onClick={() => setRole(u.id, r, !u.roles.includes(r))}
                  className={`text-xs rounded-lg px-3 py-1.5 flex items-center gap-1 ${u.roles.includes(r) ? "bg-gold/20 text-gold" : "glass"}`}>
                  {u.roles.includes(r) ? <ShieldOff size={12} /> : <Shield size={12} />}
                  {u.roles.includes(r) ? `إزالة ${r}` : `تعيين ${r}`}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!loading && rows.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد مسجلين بعد.</p>}
      </div>
    </div>
  );
}
