import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getImageUrl, onImageError } from "@/lib/storage";
import { whatsappLink } from "@/components/WhatsAppButton";
import { Reveal } from "@/components/Reveal";
import * as Icons from "lucide-react";
import { ArrowLeft, CheckCircle2, MessageCircle, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/services/")({
  head: () => ({
    meta: [
      { title: "خدماتنا — أكوا هيفن" },
      { name: "description", content: "من التصميم الأولي وحتى الصيانة المستمرة — حلول متكاملة لعالمك المائي." },
      { property: "og:title", content: "خدماتنا — أكوا هيفن" },
      { property: "og:description", content: "حلول متكاملة لكل من يطمح لعالم مائي استثنائي." },
      { property: "og:url", content: "/services" },
    ],
    links: [{ rel: "canonical", href: "/services" }],
  }),
  loader: async () => {
    const { data } = await supabase.from("services").select("*").eq("published", true).order("sort_order");
    const list = ((data ?? []) as any[]).map((r) => ({
      ...r,
      features: Array.isArray(r.features) ? r.features : [],
    })) as Svc[];
    return { list };
  },
  component: ServicesIndex,
});

type Svc = {
  id: string; slug: string; title: string;
  short_description: string | null; description: string | null;
  image_path: string | null; icon: string | null;
  category: string | null; price_label: string | null;
  features: string[]; cta_label: string | null;
  linked_page_type: string; linked_page_url: string | null;
};

function resolveHref(s: Svc): { href: string; external?: boolean } {
  if (s.linked_page_type === "existing_page" && s.linked_page_url) return { href: s.linked_page_url };
  if (s.linked_page_type === "external_link" && s.linked_page_url) return { href: s.linked_page_url, external: true };
  if (s.linked_page_type === "whatsapp") {
    return { href: whatsappLink(`السلام عليكم، أرغب بالاستفسار عن خدمة: ${s.title}`), external: true };
  }
  return { href: `/services/${s.slug}` };
}

function IconOf({ name, className }: { name?: string | null; className?: string }) {
  if (!name) return null;
  const Cmp = (Icons as any)[name];
  if (!Cmp) return null;
  return <Cmp className={className} size={20} aria-hidden />;
}

const generalFaqs = [
  { q: "كم تكلفة الحوض؟", a: "تختلف حسب الحجم، النوع (نهري/بحري)، والديكور. نقدّم عرضًا دقيقًا بعد فهم احتياجك أو معاينة المكان." },
  { q: "هل توفرون صيانة؟", a: "نعم، لدينا باقات صيانة منتظمة شهرية أو نصف شهرية للأحواض النهرية والبحرية." },
  { q: "هل أحتاج خبرة قبل أن أطلب حوضًا؟", a: "لا. نتولى كل شيء من التصميم حتى التشغيل، ونمنحك إرشادات بسيطة للعناية." },
  { q: "هل يمكن تصميم الحوض حسب المساحة؟", a: "نعم، نصمم وننفذ أحواضًا مخصصة بمقاسات وأشكال تناسب مكانك وذوقك." },
  { q: "هل تقدمون حلولًا للمشاريع التجارية؟", a: "نعم، لدينا حلول مخصصة للكافيهات والمطاعم والمكاتب والمعارض." },
  { q: "هل أقدر أرسل صورة المكان فقط؟", a: "بالتأكيد. أرسلها عبر واتساب وسنرشدك بأنسب الخيارات." },
];

const guideOptions = [
  { t: "أريد حوضًا جديدًا", d: "تصميم وتركيب أحواض مخصصة", href: "/services/custom-aquariums" },
  { t: "حوضي يحتاج تنظيف", d: "صيانة دورية وطارئة", href: "/maintenance" },
  { t: "عندي مشكلة سمك أو ماء", d: "استشارة مشاكل الأحواض", href: "/services/aquarium-consultation" },
  { t: "عندي كافيه أو مشروع", d: "حلول الأعمال والمشاريع", href: "/business-solutions" },
  { t: "أريد منتجات ومستلزمات", d: "الكاتلوج والمتجر", href: "/catalog" },
];

const processSteps = [
  "نسمع احتياجك",
  "نعاين أو نراجع الصور",
  "نقترح الحل المناسب",
  "نجهز وننفذ",
  "نتابع بعد التسليم",
];

function ServicesIndex() {
  const list = Route.useLoaderData().list as Svc[];
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <Reveal>
        <div className="text-center mb-12">
          <div className="text-xs tracking-widest text-gradient-gold mb-3">SERVICES</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">خدماتنا</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            من التصميم الأولي وحتى الصيانة المستمرة — حلول متكاملة لعالمك المائي.
          </p>
        </div>
      </Reveal>

      {/* Cards */}
      {list.length === 0 ? null : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-20 items-stretch">
          {list.map((s, i) => {
            const link = resolveHref(s);
            const img = getImageUrl(s.image_path);
            const wa = whatsappLink(`السلام عليكم، أرغب بطلب خدمة: ${s.title}`);
            return (
              <Reveal key={s.id} delay={i * 80}>
                <article className="glass rounded-2xl overflow-hidden h-full flex flex-col hover:-translate-y-1 transition">
                  <div className="relative aspect-[16/10] overflow-hidden bg-white/5">
                    <img src={img} alt={s.title} loading="lazy" onError={onImageError}
                      className="absolute inset-0 h-full w-full object-cover" />
                    {s.icon && (
                      <div className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-xl glass-gold">
                        <IconOf name={s.icon} className="text-gold" />
                      </div>
                    )}
                    {s.category && (
                      <span className="absolute top-3 left-3 text-[10px] tracking-wider bg-black/60 backdrop-blur rounded-full px-2.5 py-1 text-white">{s.category}</span>
                    )}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                    {s.short_description && <p className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-3">{s.short_description}</p>}
                    {s.price_label && <div className="text-sm font-bold text-gradient-gold mb-3">{s.price_label}</div>}
                    {s.features?.length > 0 && (
                      <ul className="space-y-1.5 mb-4">
                        {s.features.slice(0, 3).map((f) => (
                          <li key={f} className="text-xs flex items-start gap-1.5">
                            <CheckCircle2 size={12} className="text-gold mt-0.5 shrink-0" /> <span className="text-foreground/80">{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-auto flex gap-2 pt-2">
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-gold rounded-xl px-3 py-2 text-xs flex-1 text-center">اطلب الخدمة</a>
                      {link.external ? (
                        <a href={link.href} target="_blank" rel="noopener noreferrer" className="btn-outline-gold rounded-xl px-3 py-2 text-xs flex-1 text-center">تفاصيل أكثر</a>
                      ) : (
                        <a href={link.href} className="btn-outline-gold rounded-xl px-3 py-2 text-xs flex-1 text-center">تفاصيل أكثر</a>
                      )}
                    </div>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      )}

      {/* Guide */}
      <Reveal>
        <section className="mb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">اختر الخدمة المناسبة لك</h2>
            <p className="text-muted-foreground text-sm">دلّنا على احتياجك ونوصلك للحل المباشر.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {guideOptions.map((o) => (
              <a key={o.t} href={o.href} className="glass rounded-2xl p-4 hover:glass-gold transition flex flex-col">
                <div className="font-bold text-sm mb-1.5">{o.t}</div>
                <div className="text-xs text-muted-foreground flex-1">{o.d}</div>
                <span className="inline-flex items-center gap-1 text-xs text-gradient-gold mt-3">انتقل <ArrowLeft size={12} /></span>
              </a>
            ))}
          </div>
        </section>
      </Reveal>

      {/* Process */}
      <Reveal>
        <section className="glass rounded-3xl p-8 md:p-10 mb-20">
          <h2 className="text-2xl font-bold text-center mb-8">طريقة العمل</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {processSteps.map((s, i) => (
              <div key={s} className="text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full glass-gold text-gold font-bold mb-3">{i + 1}</div>
                <div className="text-sm">{s}</div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* FAQ */}
      <Reveal>
        <section className="mb-20">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">الأسئلة الشائعة</h2>
          <div className="space-y-3 max-w-3xl mx-auto">
            {generalFaqs.map((f, i) => (
              <div key={f.q} className="glass rounded-2xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full p-5 flex items-center justify-between gap-3 text-right">
                  <span className="font-bold text-sm">{f.q}</span>
                  <ChevronDown size={16} className={`shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{f.a}</div>}
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* Final CTA */}
      <Reveal>
        <section className="gradient-border rounded-3xl p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">مو متأكد أي خدمة تناسبك؟</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">ارسل لنا صورة المكان أو الحوض، ونقترح لك الحل المناسب.</p>
          <a href={whatsappLink("السلام عليكم، أرغب باستشارة لاختيار الخدمة المناسبة.")} target="_blank" rel="noopener noreferrer"
            className="btn-gold rounded-xl px-6 py-3 text-sm inline-flex items-center gap-2">
            <MessageCircle size={16} /> تواصل عبر واتساب
          </a>
        </section>
      </Reveal>
    </div>
  );
}
