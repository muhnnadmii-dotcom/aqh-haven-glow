import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  component: StaffAdmin,
});

type Row = { user_id: string; role: string; full_name: string | null; phone: string | null };

function StaffAdmin() {
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    const { data: r } = await supabase.from("user_roles").select("user_id, role").in("role", ["admin", "staff"]);
    const ids = (r ?? []).map((x: any) => x.user_id);
    if (ids.length === 0) { setRows([]); return; }
    const { data: profs } = await supabase.from("profiles").select("id, full_name, phone").in("id", ids);
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    setRows((r ?? []).map((x: any) => ({
      user_id: x.user_id, role: x.role,
      full_name: (map.get(x.user_id) as any)?.full_name ?? null,
      phone: (map.get(x.user_id) as any)?.phone ?? null,
    })));
  };
  useEffect(() => { load(); }, []);

  const remove = async (user_id: string, role: string) => {
    if (!confirm(`إزالة دور ${role}؟`)) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", user_id).eq("role", role);
    if (error) toast.error(error.message); else { toast.success("تمت الإزالة"); load(); }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">الموظفون والإدارة</h1>
      <p className="text-sm text-muted-foreground">لإضافة موظف: اطلب منه التسجيل في الموقع، ثم من قسم <span className="text-gold">"العملاء"</span> عيّن له دور <b>staff</b> أو <b>admin</b>.</p>
      <div className="grid gap-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد فريق عمل بعد.</p>}
        {rows.map((s) => (
          <div key={s.user_id + s.role} className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-bold">{s.full_name || "بدون اسم"} <span className="text-xs text-gold mx-2">[{s.role}]</span></div>
              <div className="text-xs text-muted-foreground" dir="ltr">{s.phone || "—"}</div>
            </div>
            <button onClick={() => remove(s.user_id, s.role)} className="text-red-400"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
