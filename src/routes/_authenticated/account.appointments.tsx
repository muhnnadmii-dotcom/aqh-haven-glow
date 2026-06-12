import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/account/appointments")({
  component: AppointmentsPage,
});

type Appt = { id: string; kind: string; status: string; preferred_date: string | null; notes: string | null; admin_notes: string | null; created_at: string };

function AppointmentsPage() {
  const [list, setList] = useState<Appt[]>([]);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
      const { data } = await supabase.from("appointments").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false });
      setList((data ?? []) as Appt[]);
    })();
  }, []);
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">مواعيدي</h1>
      <div className="grid gap-3">
        {list.length === 0 && <p className="text-sm text-muted-foreground">لا توجد مواعيد بعد. استخدم "طلبات سريعة" من القائمة الجانبية.</p>}
        {list.map((a) => (
          <div key={a.id} className="glass rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">{labelKind(a.kind)}</div>
              <span className={`text-xs px-2 py-0.5 rounded-md ${statusClass(a.status)}`}>{labelStatus(a.status)}</span>
            </div>
            {a.preferred_date && <div className="text-xs text-muted-foreground mt-1">التاريخ المفضل: {new Date(a.preferred_date).toLocaleString("ar-SA")}</div>}
            {a.notes && <p className="text-sm mt-2">{a.notes}</p>}
            {a.admin_notes && <p className="text-sm mt-2 text-gold"><b>رد الإدارة:</b> {a.admin_notes}</p>}
            <div className="text-xs text-muted-foreground mt-2">{new Date(a.created_at).toLocaleString("ar-SA")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function labelKind(k: string) { return ({ consultation: "استشارة", visit: "معاينة", design: "تصميم", maintenance: "صيانة" } as Record<string,string>)[k] ?? k; }
function labelStatus(s: string) { return ({ new: "جديد", confirmed: "مؤكد", in_progress: "قيد التنفيذ", done: "منجز", cancelled: "ملغي" } as Record<string,string>)[s] ?? s; }
function statusClass(s: string) { return ({ new: "bg-blue-500/20 text-blue-300", confirmed: "bg-cyan-500/20 text-cyan-300", in_progress: "bg-yellow-500/20 text-yellow-300", done: "bg-green-500/20 text-green-300", cancelled: "bg-red-500/20 text-red-300" } as Record<string,string>)[s] ?? "bg-white/10"; }
