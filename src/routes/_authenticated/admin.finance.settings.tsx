import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { Plus, Eye, EyeOff, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/finance/settings")({
  ssr: false,
  component: SettingsPage,
});

function SettingsPage() {
  const roles = useFinanceRoles();
  const [sources, setSources] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  if (!roles.canSettings) return <div className="text-sm text-muted-foreground">لا تملك صلاحية إدارة الإعدادات.</div>;

  const load = async () => {
    const { data } = await supabase.from("finance_income_sources").select("*").order("display_order");
    setSources(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (s: any) => {
    const { error } = await supabase.from("finance_income_sources").update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-base font-semibold">إعدادات المالية</h2>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">مصادر الدخل</div>
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[11px]"><Plus size={11} /> إضافة</button>
        </div>
        <div className="space-y-1.5">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded bg-white/5 text-[12px]">
              <span className={s.is_active ? "" : "text-muted-foreground line-through"}>{s.name}</span>
              <button onClick={() => toggle(s)} className="p-1 hover:bg-white/10 rounded">{s.is_active ? <EyeOff size={12} /> : <Eye size={12} />}</button>
            </div>
          ))}
        </div>
      </div>
      {creating && <NewSourceDialog onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
    </div>
  );
}

function NewSourceDialog({ onClose, onSaved }: any) {
  const [name, setName] = useState("");
  const save = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("finance_income_sources").insert({ name: name.trim(), display_order: 999 });
    if (error) toast.error(error.message); else { toast.success("تمت الإضافة"); onSaved(); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-background border border-white/10 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><div className="font-semibold text-sm">مصدر دخل جديد</div><button onClick={onClose}><X size={16} /></button></div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px] bg-white/5">إلغاء</button>
          <button onClick={save} className="px-4 py-1.5 rounded-lg text-[12px] bg-gold/20 border border-gold/40 text-gold">حفظ</button>
        </div>
      </div>
    </div>
  );
}
