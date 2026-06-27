import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceRoles } from "@/lib/finance/use-finance-roles";
import { Plus, Eye, EyeOff, X, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ACCOUNT_TYPES } from "@/lib/finance/constants";

export const Route = createFileRoute("/_authenticated/admin/finance/settings")({
  ssr: false,
  component: SettingsPage,
});

function SettingsPage() {
  const roles = useFinanceRoles();
  const [sources, setSources] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
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

  const move = async (s: any, dir: -1 | 1) => {
    const idx = sources.findIndex((x) => x.id === s.id);
    const other = sources[idx + dir];
    if (!other) return;
    await Promise.all([
      supabase.from("finance_income_sources").update({ display_order: other.display_order }).eq("id", s.id),
      supabase.from("finance_income_sources").update({ display_order: s.display_order }).eq("id", other.id),
    ]);
    load();
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <h2 className="text-base font-semibold">إعدادات المالية</h2>

      <BusinessSettingsCard />


      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">مصادر الدخل</div>
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-[11px]"><Plus size={11} /> إضافة</button>
        </div>
        <div className="space-y-1.5">
          {sources.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded bg-white/5 text-[12px]">
              <span className={s.is_active ? "" : "text-muted-foreground line-through"}>{s.name}</span>
              <div className="flex items-center gap-1">
                <button disabled={i === 0} onClick={() => move(s, -1)} className="p-1 hover:bg-white/10 rounded disabled:opacity-30"><ArrowUp size={12} /></button>
                <button disabled={i === sources.length - 1} onClick={() => move(s, 1)} className="p-1 hover:bg-white/10 rounded disabled:opacity-30"><ArrowDown size={12} /></button>
                <button onClick={() => setEditing(s)} className="p-1 hover:bg-white/10 rounded"><Pencil size={12} /></button>
                <button onClick={() => toggle(s)} className="p-1 hover:bg-white/10 rounded">{s.is_active ? <EyeOff size={12} /> : <Eye size={12} />}</button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[11px] text-muted-foreground">المصدر المعطل لا يظهر في الإضافة الجديدة، لكنه يبقى في العمليات القديمة.</div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold mb-2">أنواع الحسابات المسموحة</div>
        <div className="flex flex-wrap gap-2">
          {ACCOUNT_TYPES.map((a) => (
            <span key={a.value} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[12px]">{a.label}</span>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">للعرض فقط — لا يمكن حذفها حاليًا.</div>
      </div>

      {(creating || editing) && (
        <SourceDialog row={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); load(); }} />
      )}
    </div>
  );
}

function SourceDialog({ row, onClose, onSaved }: any) {
  const isNew = !row;
  const [name, setName] = useState(row?.name ?? "");
  const save = async () => {
    if (!name.trim()) return;
    const q = isNew
      ? supabase.from("finance_income_sources").insert({ name: name.trim(), display_order: 999 })
      : supabase.from("finance_income_sources").update({ name: name.trim() }).eq("id", row.id);
    const { error } = await q;
    if (error) toast.error(error.message); else { toast.success("تم الحفظ"); onSaved(); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-background border border-white/10 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><div className="font-semibold text-sm">{isNew ? "مصدر دخل جديد" : "تعديل المصدر"}</div><button onClick={onClose}><X size={16} /></button></div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[12px] bg-white/5">إلغاء</button>
          <button onClick={save} className="px-4 py-1.5 rounded-lg text-[12px] bg-gold/20 border border-gold/40 text-gold">حفظ</button>
        </div>
      </div>
    </div>
  );
}

function BusinessSettingsCard() {
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("aqh_business_settings" as any)
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) toast.error(error.message);
      setRow(data ?? { id: 1 });
      setLoading(false);
    })();
  }, []);

  const set = (k: string, v: any) => setRow((r: any) => ({ ...r, [k]: v }));

  const save = async () => {
    setSaving(true);
    const payload = {
      id: 1,
      company_name: row.company_name || null,
      company_sub: row.company_sub || null,
      vat_number: row.vat_number || null,
      phone: row.phone || null,
      email: row.email || null,
      logo_url: row.logo_url || null,
      default_vat_rate: row.default_vat_rate ?? 15,
    };
    const { error } = await supabase.from("aqh_business_settings" as any).upsert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("تم حفظ بيانات النشاط");
  };

  if (loading) return <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-[12px] text-muted-foreground">جاري التحميل…</div>;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="text-sm font-semibold">بيانات النشاط (تظهر في عرض السعر)</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
        <Field label="اسم الشركة" value={row.company_name ?? ""} onChange={(v) => set("company_name", v)} />
        <Field label="الوصف الفرعي" value={row.company_sub ?? ""} onChange={(v) => set("company_sub", v)} />
        <Field label="الرقم الضريبي" value={row.vat_number ?? ""} onChange={(v) => set("vat_number", v)} />
        <Field label="الجوال" value={row.phone ?? ""} onChange={(v) => set("phone", v)} />
        <Field label="البريد" value={row.email ?? ""} onChange={(v) => set("email", v)} />
        <Field label="رابط الشعار (اختياري)" value={row.logo_url ?? ""} onChange={(v) => set("logo_url", v)} />
        <Field label="نسبة الضريبة الافتراضية %" type="number" value={String(row.default_vat_rate ?? 15)} onChange={(v) => set("default_vat_rate", Number(v))} />
      </div>
      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-lg text-[12px] bg-gold/20 border border-gold/40 text-gold disabled:opacity-50">
          {saving ? "جاري الحفظ…" : "حفظ بيانات النشاط"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px]"
      />
    </label>
  );
}
