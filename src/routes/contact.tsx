import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Reveal } from "../components/Reveal";
import { Instagram, MapPin, Phone, MessageCircle, Mail, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ContactContent, SocialItem } from "@/lib/site-pages";
import { getSessionUser } from "@/lib/client-auth";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "تواصل معنا — أكوا هيفن" },
      { name: "description", content: "تواصل مع أكوا هيفن للاستفسار، طلب مشروع، الدعم الفني، أو الشراكات التجارية." },
      { property: "og:title", content: "تواصل معنا — أكوا هيفن" },
      { property: "og:description", content: "تواصل معنا في الرياض." },
      { property: "og:url", content: "/contact" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

function TikTokIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.6 6.3a5.3 5.3 0 0 1-3.1-1V16a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3a2.6 2.6 0 1 0 1.7 2.5V2h2.9a5.3 5.3 0 0 0 3.2 4.3z" />
    </svg>
  );
}

function socialIcon(platform: SocialItem["platform"]) {
  if (platform === "instagram") return <Instagram size={18} />;
  if (platform === "tiktok") return <TikTokIcon />;
  return <span className="text-xs font-bold uppercase">{platform.slice(0, 2)}</span>;
}

function whatsappLinkFor(number: string, message: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function ContactPage() {
  const [c, setC] = useState<ContactContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    supabase.from("site_pages").select("content").eq("page_key", "contact").maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setError(error.message);
        else {
          const content = (data?.content as unknown as ContactContent) ?? null;
          setC(content);
          if (content?.request_types?.[0]) setType(content.request_types[0]);
        }
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!c) return;
    const user = await getSessionUser();
    const payload: { name: string; phone: string; type: string; message: string; user_id?: string } = {
      name, phone, type, message,
    };
    if (user) payload.user_id = user.id;
    const { error } = await supabase.from("contact_requests").insert(payload);
    if (error) { toast.error("تعذر إرسال الطلب"); return; }
    toast.success(c.form.success_message || "تم الاستلام");
    if (c.whatsapp_number) {
      const text =
        `السلام عليكم، أنا ${name}.\n` +
        `نوع الطلب: ${type}\n` +
        `الجوال: ${phone}\n` +
        `الرسالة: ${message}`;
      window.open(whatsappLinkFor(c.whatsapp_number, text), "_blank");
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-gold" /></div>;
  if (error) return <div className="mx-auto max-w-2xl px-6 py-24 text-center text-red-400">حدث خطأ: {error}</div>;
  if (!c) return <div className="mx-auto max-w-2xl px-6 py-24 text-center text-muted-foreground">لا يوجد محتوى بعد.</div>;

  const visibleSocials = (c.socials ?? []).filter((s) => s.visible && s.href);
  const requestTypes = c.request_types?.length ? c.request_types : ["استفسار"];

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <Reveal>
        <div className="text-center mb-14">
          {c.hero.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{c.hero.kicker}</div>}
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{c.hero.heading}</h1>
          {c.hero.description && (
            <p className="text-muted-foreground max-w-2xl mx-auto">{c.hero.description}</p>
          )}
        </div>
      </Reveal>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <Reveal>
          <div className="space-y-4">
            {(c.phone || c.whatsapp_number) && (
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-2 text-gradient-gold">
                  <Phone size={18} /> <span className="font-bold">الهاتف / واتساب</span>
                </div>
                {c.phone && (
                  <a href={`tel:${c.phone.replace(/\s/g, "")}`} dir="ltr" className="text-lg block text-right">{c.phone}</a>
                )}
                {c.whatsapp_number && (
                  <a href={whatsappLinkFor(c.whatsapp_number, "السلام عليكم")} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-sm block text-right text-muted-foreground hover:text-gold mt-1">
                    wa.me/{c.whatsapp_number}
                  </a>
                )}
              </div>
            )}

            {c.email && (
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-2 text-gradient-gold">
                  <Mail size={18} /> <span className="font-bold">البريد</span>
                </div>
                <a href={`mailto:${c.email}`} dir="ltr" className="text-base block text-right">{c.email}</a>
              </div>
            )}

            {c.city && (
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-2 text-gradient-gold">
                  <MapPin size={18} /> <span className="font-bold">الموقع</span>
                </div>
                <p className="text-muted-foreground">{c.city}</p>
              </div>
            )}

            {c.working_hours && (
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-2 text-gradient-gold">
                  <Clock size={18} /> <span className="font-bold">أوقات العمل</span>
                </div>
                <p className="text-muted-foreground">{c.working_hours}</p>
              </div>
            )}

            {visibleSocials.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4 text-gradient-gold">
                  <span className="font-bold">تابعنا</span>
                </div>
                <div className="flex gap-3 flex-wrap">
                  {visibleSocials.map((s) => (
                    <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer" title={s.label}
                      className="grid place-items-center h-11 w-11 rounded-xl glass hover:glass-gold transition">
                      {socialIcon(s.platform)}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {c.whatsapp_card.visible && c.whatsapp_number && (
              <a href={whatsappLinkFor(c.whatsapp_number, "السلام عليكم")} target="_blank" rel="noopener noreferrer"
                className="glass-gold rounded-2xl p-6 flex items-center gap-4 hover:scale-[1.02] transition-transform">
                <div className="grid place-items-center h-12 w-12 rounded-full" style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
                  <MessageCircle className="text-white" size={22} />
                </div>
                <div>
                  <div className="font-bold">{c.whatsapp_card.title}</div>
                  {c.whatsapp_card.subtitle && <div className="text-xs text-muted-foreground">{c.whatsapp_card.subtitle}</div>}
                </div>
              </a>
            )}
          </div>
        </Reveal>

        <Reveal delay={120}>
          <form onSubmit={onSubmit} className="glass rounded-3xl p-8 md:p-10 space-y-5">
            <div>
              <label className="block text-sm mb-2">الاسم</label>
              <input required value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60 transition"
                placeholder="اسمك الكامل" />
            </div>
            <div>
              <label className="block text-sm mb-2">الجوال</label>
              <input required type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60 transition text-right"
                placeholder="05xxxxxxxx" />
            </div>
            <div>
              <label className="block text-sm mb-2">نوع الطلب</label>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60 transition">
                {requestTypes.map((t) => <option key={t} value={t} className="bg-background">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-2">الرسالة</label>
              <textarea required rows={5} value={message} onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60 transition resize-none"
                placeholder="اكتب تفاصيل طلبك هنا..." />
            </div>
            <button type="submit" className="btn-gold w-full rounded-xl px-6 py-3.5 text-sm">
              {c.form.submit_label || "إرسال"}
            </button>
          </form>
        </Reveal>
      </div>
    </div>
  );
}
