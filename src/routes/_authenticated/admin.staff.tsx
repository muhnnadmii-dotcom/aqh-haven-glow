import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  component: StaffAdmin,
});

type Row = { user_id: string; roles: string[]; full_name: string | null; phone: string | null };

function StaffAdmin() {
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    const { data: r } = await supabase.from("user_roles").select("user_id, role").in("role", ["admin", "staff"]);
    const grouped = new Map<string, string[]>();
    (r ?? []).forEach((x: any) => {
      grouped.set(x.user_id, [...(grouped.get(x.user_id) ?? []), x.role]);
    });
    const ids = Array.from(grouped.keys());
    if (ids.length === 0) { setRows([]); return; }
    const { data: profs } = await supabase.from("profiles").select("id, full_name, phone").in("id", ids);
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    setRows(ids.map((uid) => ({
      user_id: uid,
      roles: grouped.get(uid)!,
      full_name: (map.get(uid) as any)?.full_name ?? null,
      phone: (map.get(uid) as any)?.phone ?? null,
    })));
  };
  useEffect(() => { load(); }, []);

  const remove = async (user_id: string, role: string) => {
    if (!confirm(`إزالة دور ${role}؟`)) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", user_id).eq("role", role as "admin" | "staff" | "customer");
    if (error) toast.error(error.message); else { toast.success("تمت الإزالة"); load(); }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">الموظفون والإدارة</h1>
      <p className="text-sm text-muted-foreground">لإضافة موظف: اطلب منه التسجيل في الموقع، ثم من قسم <span className="text-gold">"العملاء"</span> عيّن له دور <b>staff</b> أو <b>admin</b>.</p>
      <div className="grid gap-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد فريق عمل بعد.</p>}
        {rows.map((s) => (
          <div key={s.user_id} className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-bold flex items-center gap-2 flex-wrap">
                {s.full_name || "بدون اسم"}
                <span className="flex gap-1">
                  {s.roles.map((r) => (
                    <span key={r} className="text-[10px] px-2 py-0.5 rounded-md bg-gold/15 text-gold">{r}</span>
                  ))}
                </span>
              </div>
              <div className="text-xs text-muted-foreground" dir="ltr">{s.phone || "—"}</div>
            </div>
            <div className="flex gap-2">
              {s.roles.map((r) => (
                <button key={r} onClick={() => remove(s.user_id, r)} className="text-red-400 text-xs flex items-center gap-1 hover:bg-red-500/10 px-2 py-1 rounded-lg">
                  <Trash2 size={12} /> إزالة {r}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
