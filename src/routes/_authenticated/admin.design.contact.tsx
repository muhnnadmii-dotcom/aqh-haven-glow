import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Loader2, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { fetchSitePage, saveSitePage, newId, type ContactContent, type SocialItem } from "@/lib/site-pages";

export const Route = createFileRoute("/_authenticated/admin/design/contact")({
  component: ContactAdmin,
});

const DEFAULT: ContactContent = {
  hero: { kicker: "CONTACT", heading: "تواصل معنا", description: "" },
  city: "", phone: "", whatsapp_number: "", email: "", working_hours: "",
  socials: [],
  whatsapp_card: { title: "دردشة واتساب", subtitle: "", button_label: "دردشة واتساب", visible: true },
  form: { submit_label: "إرسال", success_message: "تم استلام طلبك", intro: "" },
  request_types: ["استفسار", "طلب مشروع"],
};

const PLATFORMS: SocialItem["platform"][] = ["instagram", "tiktok", "twitter", "snapchat", "youtube", "facebook", "linkedin", "whatsapp", "other"];

function ContactAdmin() {
  const [c, setC] = useState<ContactContent>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchSitePage<ContactContent>("contact");
        if (r?.content) setC({ ...DEFAULT, ...r.content });
      } catch (e: any) { toast.error(e?.message ?? "فشل التحميل"); }
      finally { setLoading(false); }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const cleaned: ContactContent = {
        ...c,
        request_types: (c.request_types ?? []).map((s) => s.trim()).filter(Boolean),
      };
      await saveSitePage("contact", cleaned, "تواصل معنا");
      setC(cleaned);
      toast.success("تم الحفظ");
    }
    catch (e: any) { toast.error(e?.message ?? "فشل الحفظ"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-gold" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">صفحة التواصل</h1>
          <p className="text-sm text-muted-foreground mt-1">بيانات التواصل والسوشال ميديا.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-gold rounded-xl px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} حفظ
        </button>
      </div>

      <Section title="القسم الرئيسي">
        <Grid>
          <Field label="نص علوي"><input className={inp} value={c.hero.kicker} onChange={(e) => setC({ ...c, hero: { ...c.hero, kicker: e.target.value } })} /></Field>
          <Field label="العنوان"><input className={inp} value={c.hero.heading} onChange={(e) => setC({ ...c, hero: { ...c.hero, heading: e.target.value } })} /></Field>
          <Field label="الوصف" full><textarea rows={3} className={ta} value={c.hero.description} onChange={(e) => setC({ ...c, hero: { ...c.hero, description: e.target.value } })} /></Field>
        </Grid>
      </Section>

      <Section title="بيانات التواصل">
        <Grid>
          <Field label="رقم الهاتف للعرض"><input dir="ltr" className={inp} value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} placeholder="+966 50 000 0000" /></Field>
          <Field label="رقم الواتساب (أرقام فقط مع رمز الدولة)"><input dir="ltr" className={inp} value={c.whatsapp_number} onChange={(e) => setC({ ...c, whatsapp_number: e.target.value.replace(/[^\d]/g, "") })} placeholder="966500000000" /></Field>
          <Field label="البريد الإلكتروني"><input dir="ltr" className={inp} value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} placeholder="hello@example.com" /></Field>
          <Field label="المدينة"><input className={inp} value={c.city} onChange={(e) => setC({ ...c, city: e.target.value })} /></Field>
          <Field label="أوقات العمل" full><input className={inp} value={c.working_hours} onChange={(e) => setC({ ...c, working_hours: e.target.value })} placeholder="السبت - الخميس 9ص - 9م" /></Field>
        </Grid>
      </Section>

      <Section title="روابط السوشال ميديا">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">الروابط ({c.socials.length})</h3>
          <button onClick={() => setC({ ...c, socials: [...c.socials, { id: newId(), platform: "instagram", label: "Instagram", href: "", visible: true }] })}
            className="btn-gold rounded-xl px-3 py-1.5 text-xs flex items-center gap-2"><Plus size={14} /> إضافة رابط</button>
        </div>
        <div className="grid gap-3">
          {c.socials.map((s) => {
            const upd = (patch: Partial<SocialItem>) => setC({ ...c, socials: c.socials.map((x) => x.id === s.id ? { ...x, ...patch } : x) });
            return (
              <div key={s.id} className="glass rounded-xl p-3 grid gap-2 sm:grid-cols-[140px_1fr_2fr_auto_auto] items-end">
                <Field label="المنصة">
                  <select className={inp} value={s.platform} onChange={(e) => upd({ platform: e.target.value as SocialItem["platform"] })}>
                    {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="التسمية"><input className={inp} value={s.label} onChange={(e) => upd({ label: e.target.value })} /></Field>
                <Field label="الرابط"><input dir="ltr" className={inp} value={s.href} onChange={(e) => upd({ href: e.target.value })} /></Field>
                <IconBtn onClick={() => upd({ visible: !s.visible })}>{s.visible ? <Eye size={14} /> : <EyeOff size={14} />}</IconBtn>
                <IconBtn onClick={() => setC({ ...c, socials: c.socials.filter((x) => x.id !== s.id) })} danger><Trash2 size={14} /></IconBtn>
              </div>
            );
          })}
          {c.socials.length === 0 && <p className="text-xs text-muted-foreground">لا توجد روابط.</p>}
        </div>
      </Section>

      <Section title="بطاقة الواتساب الترويجية">
        <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
          <input type="checkbox" checked={c.whatsapp_card.visible} onChange={(e) => setC({ ...c, whatsapp_card: { ...c.whatsapp_card, visible: e.target.checked } })} /> إظهار البطاقة
        </label>
        <Grid>
          <Field label="العنوان"><input className={inp} value={c.whatsapp_card.title} onChange={(e) => setC({ ...c, whatsapp_card: { ...c.whatsapp_card, title: e.target.value } })} /></Field>
          <Field label="العنوان الفرعي"><input className={inp} value={c.whatsapp_card.subtitle} onChange={(e) => setC({ ...c, whatsapp_card: { ...c.whatsapp_card, subtitle: e.target.value } })} /></Field>
          <Field label="نص الزر" full><input className={inp} value={c.whatsapp_card.button_label} onChange={(e) => setC({ ...c, whatsapp_card: { ...c.whatsapp_card, button_label: e.target.value } })} /></Field>
        </Grid>
      </Section>

      <Section title="نموذج التواصل">
        <Grid>
          <Field label="نص توضيحي" full><textarea rows={2} className={ta} value={c.form.intro} onChange={(e) => setC({ ...c, form: { ...c.form, intro: e.target.value } })} /></Field>
          <Field label="نص زر الإرسال"><input className={inp} value={c.form.submit_label} onChange={(e) => setC({ ...c, form: { ...c.form, submit_label: e.target.value } })} /></Field>
          <Field label="رسالة النجاح"><input className={inp} value={c.form.success_message} onChange={(e) => setC({ ...c, form: { ...c.form, success_message: e.target.value } })} /></Field>
          <Field label="أنواع الطلبات (واحد في كل سطر)" full>
            <textarea rows={4} className={ta} value={(c.request_types ?? []).join("\n")}
              onChange={(e) => setC({ ...c, request_types: e.target.value.split("\n") })} />
            <span className="text-[11px] text-muted-foreground block mt-1">يتم تجاهل الأسطر الفارغة عند الحفظ.</span>
          </Field>
        </Grid>
      </Section>
    </div>
  );
}

const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:border-gold/60";
const ta = inp + " resize-none";
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`block ${full ? "sm:col-span-2" : ""}`}><span className="text-xs text-muted-foreground block mb-1">{label}</span>{children}</label>;
}
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid gap-3 sm:grid-cols-2">{children}</div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="glass rounded-2xl p-5"><h2 className="font-bold mb-4">{title}</h2>{children}</div>;
}
function IconBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`grid place-items-center h-8 w-8 rounded-lg glass hover:bg-white/10 ${danger ? "text-red-400" : ""}`}>{children}</button>;
}
