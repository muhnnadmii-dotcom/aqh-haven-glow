import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { Plus, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/finance/categories")({
  ssr: false,
  component: CategoriesPage,
});

function CategoriesPage() {
  const roles = useFinanceRoles();
  const [rows, setRows] = useState<any[]>([]);
  const [creating, setCreating] = useState<{ kind: "main" | "sub"; parent_id?: string } | null>(null);
  const canEdit = roles.canSettings;

  const load = async () => {
    const { data } = await supabase.from("finance_categories").select("*").order("display_order");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (r: any) => {
    const { error } = await supabase.from("finance_categories").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) toast.error(error.message); else load();
  };

  const mains = rows.filter((r) => r.kind === "main");
  const subsOf = (id: string) => rows.filter((r) => r.kind === "sub" && r.parent_id === id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">التصنيفات</h2>
        {canEdit && (
          <button onClick={() => setCreating({ kind: "main" })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[12px] hover:bg-gold/25"><Plus size={14} /> تصنيف رئيسي</button>
        )}
      </div>

      <div className="space-y-2">
        {mains.map((m) => (
          <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-[13px] flex items-center gap-2">
                <span>{m.name}</span>
                {!m.is_active && <span className="text-[10px] text-muted-foreground">(مخفي)</span>}
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <button onClick={() => setCreating({ kind: "sub", parent_id: m.id })} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px]"><Plus size={11} /></button>
                  <button onClick={() => toggle(m)} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px]">{m.is_active ? <EyeOff size={11} /> : <Eye size={11} />}</button>
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {subsOf(m.id).map((s) => (
                <span key={s.id} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] border ${s.is_active ? "bg-white/5 border-white/10" : "bg-white/[0.02] border-white/5 opacity-50"}`}>
                  {s.name}
                  {canEdit && <button onClick={() => toggle(s)} className="opacity-60 hover:opacity-100">{s.is_active ? <EyeOff size={10} /> : <Eye size={10} />}</button>}
                </span>
              ))}
              {subsOf(m.id).length === 0 && <span className="text-[11px] text-muted-foreground">لا توجد تصنيفات فرعية</span>}
            </div>
          </div>
        ))}
      </div>

      {creating && (
        <CategoryDialog kind={creating.kind} parent_id={creating.parent_id} mains={mains} onClose={() => setCreating(null)} onSaved={() => { setCreating(null); load(); }} />
      )}
    </div>
  );
}

function CategoryDialog({ kind, parent_id, mains, onClose, onSaved }: any) {
  const [name, setName] = useState("");
  const [parent, setParent] = useState(parent_id ?? mains[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) { toast.error("الاسم مطلوب"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("finance_categories").insert({
        name: name.trim(),
        kind,
        parent_id: kind === "sub" ? parent : null,
        display_order: 999,
      });
      if (error) throw error;
      toast.success("تمت الإضافة");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-background border border-white/10 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-semibold text-sm">{kind === "main" ? "تصنيف رئيسي" : "تصنيف فرعي"}</div>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        {kind === "sub" && (
          <label className="block"><div className="text-[11px] text-muted-foreground mb-1">تابع لـ</div>
            <select value={parent} onChange={(e) => setParent(e.target.value)} className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]">
              {mains.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select></label>
        )}
        <label className="block"><div className="text-[11px] text-muted-foreground mb-1">الاسم</div>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]" /></label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px] bg-white/5">إلغاء</button>
          <button disabled={saving} onClick={save} className="px-4 py-1.5 rounded-lg text-[12px] bg-gold/20 border border-gold/40 text-gold">{saving ? "..." : "حفظ"}</button>
        </div>
      </div>
    </div>
  );
}
