import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save, Fish } from "lucide-react";
import { ImageUploader } from "@/components/ImageUploader";
import { publicUrl } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/account/tanks")({
  component: TanksPage,
});

type Tank = {
  id?: string; name: string; tank_type: string | null; dimensions: string | null;
  volume_liters: number | null; install_date: string | null; image_path: string | null;
  notes: string | null; livestock: string | null;
};
const blank: Tank = { name: "", tank_type: "", dimensions: "", volume_liters: null, install_date: null, image_path: null, notes: "", livestock: "" };

function TanksPage() {
  const [list, setList] = useState<Tank[]>([]);
  const [editing, setEditing] = useState<Tank | null>(null);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
    const { data } = await supabase.from("customer_tanks").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false });
    setList((data ?? []) as unknown as Tank[]);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
    const payload = { ...editing, user_id: u.user.id };
    const { error } = editing.id
      ? await supabase.from("customer_tanks").update(payload).eq("id", editing.id)
      : await supabase.from("customer_tanks").insert(payload);
    if (error) toast.error(error.message); else { toast.success("تم"); setEditing(null); load(); }
  };
  const remove = async (id: string) => {
    if (!confirm("حذف الحوض؟")) return;
    await supabase.from("customer_tanks").delete().eq("id", id); load();
  };

  if (editing) {
    const v = editing;
    const set = <K extends keyof Tank>(k: K, val: Tank[K]) => setEditing({ ...v, [k]: val });
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">{v.id ? "تعديل الحوض" : "حوض جديد"}</h1>
        <div className="glass rounded-2xl p-5 grid gap-4 sm:grid-cols-2">
          <label><span className="text-xs text-muted-foreground block mb-1">الاسم</span>
            <input className={inp} value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="حوض الصالة" /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">النوع</span>
            <select className={inp} value={v.tank_type ?? ""} onChange={(e) => set("tank_type", e.target.value)}>
              <option value="" className="bg-background">—</option>
              <option value="freshwater" className="bg-background">عذب</option>
              <option value="planted" className="bg-background">نباتي</option>
              <option value="marine" className="bg-background">مالح</option>
              <option value="reef" className="bg-background">شعاب مرجانية</option>
            </select></label>
          <label><span className="text-xs text-muted-foreground block mb-1">الأبعاد</span>
            <input className={inp} value={v.dimensions ?? ""} onChange={(e) => set("dimensions", e.target.value)} placeholder="100×40×40 سم" /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">الحجم (لتر)</span>
            <input type="number" className={inp} value={v.volume_liters ?? ""} onChange={(e) => set("volume_liters", e.target.value ? Number(e.target.value) : null)} /></label>
          <label><span className="text-xs text-muted-foreground block mb-1">تاريخ التركيب</span>
            <input type="date" className={inp} value={v.install_date ?? ""} onChange={(e) => set("install_date", e.target.value || null)} /></label>
          <div><span className="text-xs text-muted-foreground block mb-1">الصورة</span>
            <ImageUploader value={v.image_path} onChange={(p) => set("image_path", p)} folder="tanks" /></div>
          <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">المحتويات (سمك/نبات/مرجان)</span>
            <textarea rows={2} className={inp + " resize-none"} value={v.livestock ?? ""} onChange={(e) => set("livestock", e.target.value)} /></label>
          <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">ملاحظات</span>
            <textarea rows={3} className={inp + " resize-none"} value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></label>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(null)} className="glass rounded-xl px-4 py-2 text-sm">إلغاء</button>
          <button onClick={save} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Save size={16} /> حفظ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">أحواضي</h1>
        <button onClick={() => setEditing({ ...blank })} className="btn-gold rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Plus size={16} /> حوض جديد</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.length === 0 && <p className="text-sm text-muted-foreground">لا توجد أحواض. أضف حوضك لمتابعة الصيانة والتحاليل.</p>}
        {list.map((t) => (
          <div key={t.id} className="glass rounded-2xl p-4 flex gap-3">
            {t.image_path ? (
              <img src={publicUrl(t.image_path)} alt="" className="h-20 w-20 rounded-xl object-cover" />
            ) : (
              <div className="h-20 w-20 rounded-xl bg-white/5 grid place-items-center text-gold"><Fish size={24} /></div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{t.name}</div>
              <div className="text-xs text-muted-foreground">{t.dimensions || "—"} · {t.volume_liters ? `${t.volume_liters}L` : ""}</div>
              <div className="flex gap-3 mt-2 text-xs">
                <Link to="/account/tanks/$id" params={{ id: t.id! }} className="text-gold hover:underline">عرض التفاصيل</Link>
                <button onClick={() => setEditing(t)} className="text-gold hover:underline">تعديل</button>
                <button onClick={() => remove(t.id!)} className="text-red-400 hover:underline">حذف</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60";
