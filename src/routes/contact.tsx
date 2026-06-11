import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Reveal } from "../components/Reveal";
import { whatsappLink, WHATSAPP_NUMBER } from "../components/WhatsAppButton";
import { Instagram, MapPin, Phone, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "تواصل معنا — أكوا هيفن" },
      { name: "description", content: "تواصل مع أكوا هيفن للاستفسار، طلب مشروع، الدعم الفني، أو الشراكات التجارية." },
      { property: "og:title", content: "تواصل معنا — أكوا هيفن" },
      { property: "og:description", content: "تواصل معنا في الرياض." },
    ],
  }),
  component: ContactPage,
});

const types = [
  "استفسار",
  "طلب مشروع",
  "دعم فني",
  "شراكة تجارية",
] as const;

function TikTokIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.6 6.3a5.3 5.3 0 0 1-3.1-1V16a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3a2.6 2.6 0 1 0 1.7 2.5V2h2.9a5.3 5.3 0 0 0 3.2 4.3z" />
    </svg>
  );
}

function ContactPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<(typeof types)[number]>("استفسار");
  const [message, setMessage] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text =
      `السلام عليكم، أنا ${name}.\n` +
      `نوع الطلب: ${type}\n` +
      `الجوال: ${phone}\n` +
      `الرسالة: ${message}`;
    window.open(whatsappLink(text), "_blank");
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <Reveal>
        <div className="text-center mb-14">
          <div className="text-xs tracking-widest text-gradient-gold mb-3">CONTACT</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">تواصل معنا</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            ابدأ محادثتك معنا. سيتم إرسال طلبك مباشرة عبر واتساب لفريقنا.
          </p>
        </div>
      </Reveal>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <Reveal>
          <div className="space-y-4">
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-2 text-gradient-gold">
                <Phone size={18} /> <span className="font-bold">الهاتف / واتساب</span>
              </div>
              <a href={`tel:+${WHATSAPP_NUMBER}`} className="text-lg block">+966 52 704 4200</a>
            </div>
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-2 text-gradient-gold">
                <MapPin size={18} /> <span className="font-bold">الموقع</span>
              </div>
              <p className="text-muted-foreground">الرياض، المملكة العربية السعودية</p>
            </div>
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4 text-gradient-gold">
                <span className="font-bold">تابعنا</span>
              </div>
              <div className="flex gap-3">
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"
                  className="grid place-items-center h-11 w-11 rounded-xl glass hover:glass-gold transition">
                  <Instagram size={18} />
                </a>
                <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer"
                  className="grid place-items-center h-11 w-11 rounded-xl glass hover:glass-gold transition">
                  <TikTokIcon />
                </a>
              </div>
            </div>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer"
              className="glass-gold rounded-2xl p-6 flex items-center gap-4 hover:scale-[1.02] transition-transform">
              <div className="grid place-items-center h-12 w-12 rounded-full" style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
                <MessageCircle className="text-white" size={22} />
              </div>
              <div>
                <div className="font-bold">دردشة واتساب فورية</div>
                <div className="text-xs text-muted-foreground">رد سريع خلال ساعات العمل</div>
              </div>
            </a>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <form onSubmit={onSubmit} className="glass rounded-3xl p-8 md:p-10 space-y-5">
            <div>
              <label className="block text-sm mb-2">الاسم</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60 transition"
                placeholder="اسمك الكامل"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">الجوال</label>
              <input
                required
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60 transition text-right"
                placeholder="05xxxxxxxx"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">نوع الطلب</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as (typeof types)[number])}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60 transition"
              >
                {types.map((t) => (
                  <option key={t} value={t} className="bg-background">{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-2">الرسالة</label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60 transition resize-none"
                placeholder="اكتب تفاصيل طلبك هنا..."
              />
            </div>
            <button type="submit" className="btn-gold w-full rounded-xl px-6 py-3.5 text-sm">
              إرسال عبر واتساب
            </button>
          </form>
        </Reveal>
      </div>
    </div>
  );
}
