import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/appointments")({
  component: AppointmentsAdmin,
});

type Row = {
  id: string; user_id: string; kind: string; status: string; preferred_date: string | null;
  notes: string | null; admin_notes: string | null; created_at: string;
  profile?: { full_name: string | null; phone: string | null };
};

function AppointmentsAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = async () => {
    const { data } = await supabase.from("appointments").select("*").order("created_at", { ascending: false });
    const items = (data ?? []) as Row[];
    const ids = [...new Set(items.map(r => r.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, phone").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      items.forEach(r => r.profile = map.get(r.user_id) as any);
    }
    setRows(items);
  };
  useEffect(() => { load(); }, []);

  const update = async (id: string, patch: Partial<Row>) => {
    const { error } = await supabase.from("appointments").update(patch).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم"); load(); }
  };
  const remove = async (id: string) => {
    if (!confirm("حذف الموعد؟")) return;
    await supabase.from("appointments").delete().eq("id", id); load();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">المواعيد</h1>
      <div className="grid gap-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">لا توجد مواعيد بعد.</p>}
        {rows.map((r) => (
          <div key={r.id} className="glass rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-bold">{r.profile?.full_name || "عميل"} <span className="text-xs text-gold mx-2">— {labelKind(r.kind)}</span></div>
                <div className="text-xs text-muted-foreground" dir="ltr">{r.profile?.phone || "—"}</div>
              </div>
              <div className="flex items-center gap-2">
                <select value={r.status} onChange={(e) => update(r.id, { status: e.target.value })}
                  className="rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs">
                  <option value="new" className="bg-background">جديد</option>
                  <option value="confirmed" className="bg-background">مؤكد</option>
                  <option value="in_progress" className="bg-background">قيد التنفيذ</option>
                  <option value="done" className="bg-background">منجز</option>
                  <option value="cancelled" className="bg-background">ملغي</option>
                </select>
                <button onClick={() => remove(r.id)} className="text-xs text-red-400">حذف</button>
              </div>
            </div>
            {r.preferred_date && <div className="text-xs text-muted-foreground">التاريخ المفضل: {new Date(r.preferred_date).toLocaleString("ar-SA")}</div>}
            {r.notes && <p className="text-sm whitespace-pre-wrap">{r.notes}</p>}
            <textarea defaultValue={r.admin_notes ?? ""} onBlur={(e) => e.target.value !== (r.admin_notes ?? "") && update(r.id, { admin_notes: e.target.value })}
              placeholder="ملاحظاتك..." rows={2}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm resize-none" />
            <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-SA")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function labelKind(k: string) {
  return ({ consultation: "استشارة", visit: "معاينة", design: "تصميم", maintenance: "صيانة" } as Record<string,string>)[k] ?? k;
}
