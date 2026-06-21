import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { Plus, X, Eye, EyeOff, Pencil, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/finance/categories")({
  ssr: false,
  component: CategoriesPage,
});

function CategoriesPage() {
  const roles = useFinanceRoles();
  const [rows, setRows] = useState<any[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState<{ kind: "main" | "sub"; parent_id?: string } | null>(null);
  const canEdit = roles.canSettings;

  const load = async () => {
    const [{ data: cats }, { data: exps }] = await Promise.all([
      supabase.from("finance_categories").select("*").order("display_order"),
      supabase.from("finance_expenses").select("main_category_id, sub_category_id"),
    ]);
    setRows(cats ?? []);
    const u: Record<string, number> = {};
    (exps ?? []).forEach((e: any) => {
      if (e.main_category_id) u[e.main_category_id] = (u[e.main_category_id] ?? 0) + 1;
      if (e.sub_category_id) u[e.sub_category_id] = (u[e.sub_category_id] ?? 0) + 1;
    });
    setUsage(u);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (r: any) => {
    const { error } = await supabase.from("finance_categories").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) toast.error(error.message); else load();
  };

  const move = async (r: any, dir: -1 | 1) => {
    const siblings = rows.filter((x) => x.kind === r.kind && x.parent_id === r.parent_id);
    const idx = siblings.findIndex((s) => s.id === r.id);
    const other = siblings[idx + dir];
    if (!other) return;
    await Promise.all([
      supabase.from("finance_categories").update({ display_order: other.display_order }).eq("id", r.id),
      supabase.from("finance_categories").update({ display_order: r.display_order }).eq("id", other.id),
    ]);
    load();
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
      <div className="text-[11px] text-muted-foreground">
        التصنيف المستخدم في عمليات سابقة لا يمكن حذفه — يمكن تعطيله فقط. التصنيف المعطل لا يظهر في الإضافة الجديدة، ويبقى في العمليات القديمة.
      </div>

      <div className="space-y-2">
        {mains.map((m, mi) => (
          <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-[13px] flex items-center gap-2">
                <span>{m.name}</span>
                {!m.is_active && <span className="text-[10px] text-muted-foreground">(معطّل)</span>}
                {usage[m.id] ? <span className="text-[10px] text-muted-foreground">· مستخدم في {usage[m.id]}</span> : null}
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <button disabled={mi === 0} onClick={() => move(m, -1)} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30"><ArrowUp size={11} /></button>
                  <button disabled={mi === mains.length - 1} onClick={() => move(m, 1)} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30"><ArrowDown size={11} /></button>
                  <button onClick={() => setEditing(m)} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10"><Pencil size={11} /></button>
                  <button onClick={() => setCreating({ kind: "sub", parent_id: m.id })} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px]"><Plus size={11} /></button>
                  <button onClick={() => toggle(m)} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px]">{m.is_active ? <EyeOff size={11} /> : <Eye size={11} />}</button>
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {subsOf(m.id).map((s) => (
                <span key={s.id} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] border ${s.is_active ? "bg-white/5 border-white/10" : "bg-white/[0.02] border-white/5 opacity-50"}`}>
                  {s.name}
                  {usage[s.id] ? <span className="text-muted-foreground/70">({usage[s.id]})</span> : null}
                  {canEdit && (
                    <>
                      <button onClick={() => setEditing(s)} className="opacity-60 hover:opacity-100"><Pencil size={9} /></button>
                      <button onClick={() => toggle(s)} className="opacity-60 hover:opacity-100">{s.is_active ? <EyeOff size={10} /> : <Eye size={10} />}</button>
                    </>
                  )}
                </span>
              ))}
              {subsOf(m.id).length === 0 && <span className="text-[11px] text-muted-foreground">لا توجد تصنيفات فرعية</span>}
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <CategoryDialog row={editing} kind={creating?.kind ?? editing?.kind} parent_id={creating?.parent_id} mains={mains}
          onClose={() => { setCreating(null); setEditing(null); }}
          onSaved={() => { setCreating(null); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function CategoryDialog({ row, kind, parent_id, mains, onClose, onSaved }: any) {
  const isNew = !row;
  const [name, setName] = useState(row?.name ?? "");
  const [parent, setParent] = useState(row?.parent_id ?? parent_id ?? mains[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) { toast.error("الاسم مطلوب"); return; }
    setSaving(true);
    try {
      const payload: any = { name: name.trim() };
      if (kind === "sub") payload.parent_id = parent;
      const q = isNew
        ? supabase.from("finance_categories").insert({ ...payload, kind, display_order: 999 })
        : supabase.from("finance_categories").update(payload).eq("id", row.id);
      const { error } = await q;
      if (error) throw error;
      toast.success("تم الحفظ");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-background border border-white/10 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-semibold text-sm">{isNew ? (kind === "main" ? "تصنيف رئيسي" : "تصنيف فرعي") : "تعديل التصنيف"}</div>
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
