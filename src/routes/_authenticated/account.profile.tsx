import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
      setEmail(u.user.email ?? "");
      const { data: p } = await supabase.from("profiles").select("full_name, phone").eq("id", u.user.id).maybeSingle();
      setName(p?.full_name ?? ""); setPhone(p?.phone ?? "");
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser(); if (!u.user) { setSaving(false); return; }
    const { error } = await supabase.from("profiles").upsert({ id: u.user.id, full_name: name, phone });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("تم الحفظ");
  };

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">ملفي الشخصي</h1>
      <div className="glass rounded-2xl p-6 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="text-xs text-muted-foreground block mb-1">البريد</span>
          <input disabled value={email} dir="ltr" className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 opacity-70" /></label>
        <label><span className="text-xs text-muted-foreground block mb-1">الاسم</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5" /></label>
        <label><span className="text-xs text-muted-foreground block mb-1">الجوال</span>
          <input value={phone} dir="ltr" onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-right" /></label>
        <div className="sm:col-span-2 flex justify-end">
          <button onClick={save} disabled={saving} className="btn-gold rounded-xl px-5 py-2 text-sm">{saving ? "جاري الحفظ..." : "حفظ"}</button>
        </div>
      </div>
    </div>
  );
}
