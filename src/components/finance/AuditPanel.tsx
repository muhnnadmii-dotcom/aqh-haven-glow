import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { History } from "lucide-react";

export function AuditPanel({ relatedType, relatedId }: { relatedType: string; relatedId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [actors, setActors] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("finance_audit_logs")
        .select("*")
        .eq("related_type", relatedType)
        .eq("related_id", relatedId)
        .order("changed_at", { ascending: false })
        .limit(50);
      const list = data ?? [];
      setRows(list);
      const ids = Array.from(new Set(list.map((r: any) => r.changed_by).filter(Boolean)));
      if (ids.length > 0) {
        const { data: names } = await supabase.rpc("finance_get_actor_names", { ids });
        const map: Record<string, string> = {};
        (names ?? []).forEach((n: any) => { map[n.id] = n.name; });
        setActors(map);
      }
    })();
  }, [relatedType, relatedId]);

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-[12px] font-semibold flex items-center gap-1.5 mb-2"><History size={13} /> سجل التعديلات</div>
      {rows.length === 0 ? (
        <div className="text-[11px] text-muted-foreground text-center py-3">لا توجد سجلات</div>
      ) : (
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {rows.map((r) => (
            <div key={r.id} className="text-[11px] border-b border-white/5 pb-1.5">
              <div className="flex items-center justify-between text-muted-foreground gap-2">
                <span>{actionLabel(r.action)}{r.field_name ? ` · ${r.field_name}` : ""}</span>
                <span className="text-foreground/80">{r.changed_by ? (actors[r.changed_by] ?? "—") : "—"}</span>
                <span>{new Date(r.changed_at).toLocaleString("ar-SA")}</span>
              </div>
              {r.field_name && (
                <div className="mt-0.5 text-foreground/80">
                  <span className="text-red-300/80 line-through">{r.old_value ?? "—"}</span>
                  {" → "}
                  <span className="text-emerald-300/80">{r.new_value ?? "—"}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function actionLabel(a: string) {
  if (a === "create") return "إنشاء";
  if (a === "delete") return "حذف";
  if (a === "update") return "تعديل";
  return a;
}
