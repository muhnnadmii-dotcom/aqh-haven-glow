import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Reveal } from "@/components/Reveal";
import { toast } from "sonner";
import { LogOut, MessagesSquare, Phone } from "lucide-react";

type ContactReq = { id: string; name: string; phone: string; type: string; message: string; status: string; created_at: string };
type ConsultReq = { id: string; name: string; phone: string; tank_type: string | null; goal: string | null; size: string | null; details: string; status: string; created_at: string };

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ full_name: string; phone: string } | null>(null);
  const [email, setEmail] = useState("");
  const [contacts, setContacts] = useState<ContactReq[]>([]);
  const [consults, setConsults] = useState<ConsultReq[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? "");
      const { data: p } = await supabase.from("profiles").select("full_name, phone").eq("id", u.user.id).maybeSingle();
      setProfile({ full_name: p?.full_name ?? "", phone: p?.phone ?? "" });
      const { data: c } = await supabase.from("contact_requests").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false });
      setContacts((c ?? []) as ContactReq[]);
      const { data: cs } = await supabase.from("consultation_requests").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false });
      setConsults((cs ?? []) as ConsultReq[]);
    })();
  }, []);

  const onSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("profiles").upsert({ id: u.user.id, full_name: profile.full_name, phone: profile.phone });
    setSaving(false);
    if (error) toast.error("تعذر الحفظ"); else toast.success("تم الحفظ");
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { new: "bg-blue-500/20 text-blue-300", in_progress: "bg-yellow-500/20 text-yellow-300", closed: "bg-green-500/20 text-green-300" };
    const label: Record<string, string> = { new: "جديد", in_progress: "قيد المتابعة", closed: "مغلق" };
    return <span className={`px-2 py-0.5 rounded-md text-xs ${map[s] ?? ""}`}>{label[s] ?? s}</span>;
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 space-y-8">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs tracking-widest text-gradient-gold mb-2">ACCOUNT</div>
            <h1 className="text-3xl md:text-4xl font-bold">حسابي</h1>
          </div>
          <button onClick={onLogout} className="glass rounded-xl px-4 py-2 text-sm flex items-center gap-2 hover:bg-white/10">
            <LogOut size={16} /> تسجيل خروج
          </button>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-bold text-gradient-gold">بياناتي</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm mb-1 text-muted-foreground">البريد</label>
              <input disabled value={email} dir="ltr" className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-right opacity-70" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-muted-foreground">الاسم</label>
              <input value={profile?.full_name ?? ""} onChange={(e) => setProfile({ ...profile!, full_name: e.target.value })}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-muted-foreground">الجوال</label>
              <input value={profile?.phone ?? ""} dir="ltr" onChange={(e) => setProfile({ ...profile!, phone: e.target.value })}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-right" />
            </div>
          </div>
          <button onClick={onSave} disabled={saving} className="btn-gold rounded-xl px-5 py-2 text-sm">حفظ</button>
        </div>
      </Reveal>

      <Reveal delay={160}>
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Phone className="text-gold" size={18} />
            <h2 className="font-bold">طلبات التواصل ({contacts.length})</h2>
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">ما عندك طلبات تواصل بعد. <Link to="/contact" className="text-gold hover:underline">أرسل طلب</Link></p>
          ) : (
            <ul className="space-y-3">
              {contacts.map((c) => (
                <li key={c.id} className="glass rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="font-semibold">{c.type}</div>
                    {statusBadge(c.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">{c.message}</p>
                  <div className="text-xs text-muted-foreground mt-2">{new Date(c.created_at).toLocaleString("ar-SA")}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Reveal>

      <Reveal delay={220}>
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessagesSquare className="text-gold" size={18} />
            <h2 className="font-bold">طلبات الاستشارة ({consults.length})</h2>
          </div>
          {consults.length === 0 ? (
            <p className="text-sm text-muted-foreground">ما عندك استشارات بعد. <Link to="/consultation" className="text-gold hover:underline">احجز استشارة</Link></p>
          ) : (
            <ul className="space-y-3">
              {consults.map((c) => (
                <li key={c.id} className="glass rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="font-semibold">{c.goal ?? "استشارة"}</div>
                    {statusBadge(c.status)}
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">نوع الحوض: {c.tank_type ?? "—"} · {c.size ?? "—"}</div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.details}</p>
                  <div className="text-xs text-muted-foreground mt-2">{new Date(c.created_at).toLocaleString("ar-SA")}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Reveal>
    </div>
  );
}
