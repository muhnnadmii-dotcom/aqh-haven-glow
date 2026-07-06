import { createFileRoute, Link, redirect, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getImageUrl, onImageError } from "@/lib/storage";
import { whatsappLink } from "@/components/WhatsAppButton";
import { Reveal } from "@/components/Reveal";
import * as Icons from "lucide-react";
import {
  ArrowRight, CheckCircle2, MessageCircle, ChevronDown,
  Sparkles, ShieldCheck, Heart, Waves,
} from "lucide-react";
import {
  fetchConsultationContent,
  CONSULTATION_DEFAULTS,
  type ConsultationContent,
} from "@/lib/consultation-page";


type Svc = {
  id: string; slug: string; title: string;
  short_description: string | null; full_description: string | null; description: string | null;
  image_path: string | null; icon: string | null;
  category: string | null; price_label: string | null;
  features: string[]; includes: string[]; suitable_for: string[]; process_steps: string[];
  faqs: { q: string; a: string }[];
  meta_title: string | null; meta_description: string | null;
  linked_page_type: string; linked_page_url: string | null;
};

function adapt(r: any): Svc {
  return {
    ...r,
    features: Array.isArray(r.features) ? r.features : [],
    includes: Array.isArray(r.includes) ? r.includes : [],
    suitable_for: Array.isArray(r.suitable_for) ? r.suitable_for : [],
    process_steps: Array.isArray(r.process_steps) ? r.process_steps : [],
    faqs: Array.isArray(r.faqs) ? r.faqs : [],
  } as Svc;
}

export const Route = createFileRoute("/services/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase.from("services").select("*").eq("slug", params.slug).eq("published", true).maybeSingle();
    if (!data) throw notFound();
    const svc = adapt(data);
    if ((svc.linked_page_type === "existing_page" || svc.linked_page_type === "external_link") && svc.linked_page_url) {
      throw redirect({ href: svc.linked_page_url });
    }
    const { data: relData } = await supabase.from("services").select("*").eq("published", true).neq("id", svc.id).limit(6);
    const related = ((relData ?? []) as any[])
      .map(adapt)
      .filter((r) => !svc.category || r.category === svc.category || r.linked_page_type === "custom_service_page")
      .slice(0, 3);
    return { svc, related };
  },
  head: ({ params, loaderData }) => {
    const t = loaderData?.svc?.meta_title || loaderData?.svc?.title || params.slug;
    const d = loaderData?.svc?.meta_description || loaderData?.svc?.short_description || "";
    return {
      meta: [
        { title: `${t} — أكوا هيفن` },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
        { property: "og:url", content: `/services/${params.slug}` },
      ],
      links: [{ rel: "canonical", href: `/services/${params.slug}` }],
    };
  },
  component: ServiceDetail,
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="text-3xl font-bold mb-3">الخدمة غير موجودة</h1>
      <Link to="/services" className="text-gradient-gold">رجوع للخدمات</Link>
    </div>
  ),
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-24 text-center">
      <p className="text-muted-foreground mb-3">تعذر تحميل الخدمة.</p>
      <Link to="/services" className="text-gradient-gold">رجوع للخدمات</Link>
    </div>
  ),
});

function IconOf({ name }: { name?: string | null }) {
  if (!name) return null;
  const Cmp = (Icons as any)[name];
  if (!Cmp) return null;
  return <Cmp className="text-gold" size={24} aria-hidden />;
}

function ServiceDetail() {
  const data = Route.useLoaderData();
  const svc = data.svc as Svc;
  const related = data.related as Svc[];
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const img = getImageUrl(svc.image_path);
  const wa = whatsappLink(`مرحبًا Aqua Haven، أرغب بالاستفسار عن خدمة: ${svc.title}`);

  if (svc.slug === "aquarium-consultation") {
    return <ConsultationDetail svc={svc} related={related} img={img} wa={wa} />;
  }



  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link to="/services" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-gold mb-6">
        <ArrowRight size={14} /> رجوع للخدمات
      </Link>

      {/* Hero */}
      <Reveal>
        <section className="grid gap-6 md:grid-cols-2 mb-12">
          <div className="relative aspect-[4/3] rounded-3xl overflow-hidden glass">
            <img src={img} alt={svc.title} onError={onImageError} className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div className="flex flex-col justify-center">
            {svc.category && <div className="text-xs tracking-widest text-gradient-gold mb-3">{svc.category}</div>}
            <div className="flex items-center gap-3 mb-4">
              <IconOf name={svc.icon} />
              <h1 className="text-3xl md:text-4xl font-bold">{svc.title}</h1>
            </div>
            {svc.short_description && <p className="text-muted-foreground leading-relaxed mb-5">{svc.short_description}</p>}
            {svc.price_label && <div className="text-xl font-bold text-gradient-gold mb-5">{svc.price_label}</div>}
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-gold rounded-xl px-6 py-3 text-sm inline-flex items-center justify-center gap-2 w-fit">
              <MessageCircle size={16} /> تواصل عبر واتساب
            </a>
          </div>
        </section>
      </Reveal>

      {/* Includes */}
      {svc.includes.length > 0 && (
        <Reveal>
          <section className="glass rounded-3xl p-8 mb-10">
            <h2 className="text-xl font-bold mb-5">ماذا تشمل الخدمة؟</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {svc.includes.map((it) => (
                <li key={it} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 size={16} className="text-gold mt-0.5 shrink-0" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      )}

      {/* Suitable for */}
      {svc.suitable_for.length > 0 && (
        <Reveal>
          <section className="glass rounded-3xl p-8 mb-10">
            <h2 className="text-xl font-bold mb-5">مناسبة لمن؟</h2>
            <div className="flex flex-wrap gap-2">
              {svc.suitable_for.map((it) => (
                <span key={it} className="text-xs px-3 py-1.5 rounded-full glass-gold text-foreground/90">{it}</span>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {/* Process steps */}
      {svc.process_steps.length > 0 && (
        <Reveal>
          <section className="glass rounded-3xl p-8 mb-10">
            <h2 className="text-xl font-bold mb-6">خطوات التنفيذ</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {svc.process_steps.map((s, i) => (
                <div key={s} className="flex items-start gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full glass-gold text-gold font-bold shrink-0">{i + 1}</div>
                  <div className="text-sm pt-1.5">{s}</div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {/* Full description */}
      {(svc.full_description || svc.description) && (
        <Reveal>
          <section className="glass rounded-3xl p-8 mb-10">
            <h2 className="text-xl font-bold mb-4">التفاصيل</h2>
            <div className="text-sm leading-loose text-foreground/85 whitespace-pre-line">
              {svc.full_description || svc.description}
            </div>
          </section>
        </Reveal>
      )}

      {/* FAQs */}
      {svc.faqs.length > 0 && (
        <Reveal>
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-5">أسئلة شائعة</h2>
            <div className="space-y-3">
              {svc.faqs.map((f, i) => (
                <div key={i} className="glass rounded-2xl overflow-hidden">
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
      )}

      {/* Related */}
      {related.length > 0 && (
        <Reveal>
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-5">خدمات مرتبطة</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <a key={r.id} href={r.linked_page_type === "existing_page" && r.linked_page_url ? r.linked_page_url : `/services/${r.slug}`}
                  className="glass rounded-2xl overflow-hidden hover:-translate-y-1 transition flex flex-col">
                  <div className="relative aspect-[16/10]">
                    <img src={getImageUrl(r.image_path)} alt={r.title} onError={onImageError}
                      className="absolute inset-0 h-full w-full object-cover" />
                  </div>
                  <div className="p-4">
                    <div className="font-bold text-sm mb-1">{r.title}</div>
                    {r.short_description && <div className="text-xs text-muted-foreground line-clamp-2">{r.short_description}</div>}
                  </div>
                </a>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {/* Final CTA */}
      <Reveal>
        <section className="gradient-border rounded-3xl p-8 md:p-12 text-center mt-10">
          <h2 className="text-2xl font-bold mb-3">جاهز نبدأ؟</h2>
          <p className="text-muted-foreground mb-6">تواصل معنا الآن وسنرد على استفساراتك مباشرة.</p>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-gold rounded-xl px-6 py-3 text-sm inline-flex items-center gap-2">
            <MessageCircle size={16} /> تواصل عبر واتساب
          </a>
        </section>
      </Reveal>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Service",
        name: svc.title,
        description: svc.meta_description || svc.short_description,
        provider: { "@type": "Organization", name: "Aqua Haven" },
      })}} />
    </div>
  );
}

/* ============================================================
   Premium Consultation Landing — aquarium-consultation
   ============================================================ */
function ConsultationDetail({
  svc, related, img, wa,
}: { svc: Svc; related: Svc[]; img: string; wa: string }) {
  const [c, setC] = useState<ConsultationContent>(CONSULTATION_DEFAULTS);
  useEffect(() => {
    fetchConsultationContent().then(setC).catch(() => setC(CONSULTATION_DEFAULTS));
  }, []);

  const waBook = whatsappLink(c.hero.primary_button_whatsapp || "السلام عليكم، أبغى أحجز استشارة لحوضي مع Aqua Haven.");
  const waFinal = whatsappLink(c.final_cta.primary_whatsapp || c.hero.primary_button_whatsapp);
  const waFinalSecondary = c.final_cta.secondary_whatsapp
    ? whatsappLink(c.final_cta.secondary_whatsapp)
    : wa;
  const waHighlight = whatsappLink(c.pricing.highlight.button_whatsapp);
  const waStandard = whatsappLink(c.pricing.standard.button_whatsapp);
  const heroImg = c.hero.image_path ? getImageUrl(c.hero.image_path) : img;

  const trustChips = (c.hero.trust_chips ?? []).filter((x) => x.visible);
  const stats = (c.trust.stats ?? []).filter((x) => x.visible);
  const includesItems = (c.includes.items ?? []).filter((x) => x.visible);
  const suitableItems = (c.suitable.items ?? []).filter((x) => x.visible);

  return (
    <div className="-mt-6">
      {/* HERO */}
      <Reveal>
        <section className="relative w-full overflow-hidden rounded-b-[2.5rem]">
          <div className="relative h-[78vh] min-h-[560px] w-full">
            <img src={heroImg} alt={svc.title} onError={onImageError}
              className="absolute inset-0 h-full w-full object-cover scale-105" />
            <div className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(5,16,29,0.55) 0%, rgba(5,16,29,0.75) 55%, rgba(5,16,29,0.98) 100%)" }} />
            <div className="absolute inset-0"
              style={{ background: "radial-gradient(70% 50% at 50% 40%, rgba(0,0,0,0) 0%, rgba(5,16,29,0.55) 100%)" }} />

            <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col items-center justify-center px-6 text-center">
              <Link to="/services" className="absolute top-6 right-6 inline-flex items-center gap-1 text-xs text-white/70 hover:text-gold">
                <ArrowRight size={14} /> الخدمات
              </Link>

              {c.hero.kicker && (
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-black/30 px-4 py-1.5 backdrop-blur-md">
                  <Sparkles size={14} className="text-gold" />
                  <span className="text-xs tracking-wide text-gold">{c.hero.kicker}</span>
                </div>
              )}

              <h1 className="text-balance text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl">
                {c.hero.title_line1}{c.hero.title_line1 && " "}
                {c.hero.title_highlight && <span className="text-gradient-gold">{c.hero.title_highlight}</span>}
                {c.hero.title_line2 && <><br className="hidden sm:block" /> {c.hero.title_line2}</>}
              </h1>
              {c.hero.description && (
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
                  {c.hero.description}
                </p>
              )}

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a href={waBook} target="_blank" rel="noopener noreferrer"
                  className="btn-gold rounded-2xl px-7 py-3.5 text-sm font-bold inline-flex items-center gap-2 shadow-deep">
                  {c.hero.primary_button_label} <ArrowRight size={16} className="rotate-180" />
                </a>
                <a href={wa} target="_blank" rel="noopener noreferrer"
                  className="rounded-2xl border border-white/20 bg-white/5 backdrop-blur-md px-6 py-3.5 text-sm font-medium text-white inline-flex items-center gap-2 hover:bg-white/10 transition">
                  <MessageCircle size={16} /> {c.hero.secondary_button_label}
                </a>
              </div>

              {trustChips.length > 0 && (
                <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-white/70">
                  {trustChips.map((chip) => (
                    <TrustChip key={chip.id} iconName={chip.icon} text={chip.text} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </Reveal>

      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        {/* TRUST BLOCK */}
        {c.trust.visible && (
          <Reveal>
            <section className="mt-16 sm:mt-24 grid gap-6 md:grid-cols-[1.1fr_1fr] items-center">
              <div>
                {c.trust.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{c.trust.kicker}</div>}
                <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
                  {c.trust.heading_line1}{c.trust.heading_line1 && " "}
                  {c.trust.heading_highlight && <span className="text-gradient-gold">{c.trust.heading_highlight}</span>}
                </h2>
                {c.trust.body && <p className="mt-5 text-foreground/80 leading-loose">{c.trust.body}</p>}
                {c.trust.disclaimer && (
                  <div className="mt-6 flex items-start gap-3 rounded-2xl border border-gold/15 bg-[#0a1825]/60 p-4">
                    <Heart size={18} className="text-gold mt-0.5 shrink-0" />
                    <p className="text-xs text-foreground/70 leading-relaxed">{c.trust.disclaimer}</p>
                  </div>
                )}
              </div>

              {stats.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  {stats.map((s) => <StatCard key={s.id} big={s.big} label={s.label} />)}
                </div>
              )}
            </section>
          </Reveal>
        )}

        {/* INCLUDES */}
        {c.includes.visible && includesItems.length > 0 && (
          <Reveal>
            <section className="mt-20 sm:mt-28">
              <div className="text-center mb-10">
                {c.includes.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{c.includes.kicker}</div>}
                {c.includes.heading && <h2 className="text-3xl sm:text-4xl font-bold">{c.includes.heading}</h2>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {includesItems.map((it) => (
                  <div key={it.id}
                    className="group relative rounded-3xl border border-white/5 bg-[#0a1825]/80 p-6 transition hover:-translate-y-1 hover:border-gold/30">
                    <div className="mb-4 inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20">
                      <IconByName name={it.icon} size={22} className="text-gold" />
                    </div>
                    <h3 className="font-bold text-base mb-2">{it.title}</h3>
                    <p className="text-sm text-foreground/70 leading-relaxed">{it.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>
        )}

        {/* SUITABLE FOR */}
        {c.suitable.visible && suitableItems.length > 0 && (
          <Reveal>
            <section className="mt-20 sm:mt-28">
              <div className="text-center mb-10">
                {c.suitable.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{c.suitable.kicker}</div>}
                {c.suitable.heading && <h2 className="text-3xl sm:text-4xl font-bold">{c.suitable.heading}</h2>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {suitableItems.map((s) => (
                  <div key={s.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/5 bg-[#0a1825]/80 px-4 py-3.5 hover:border-gold/30 transition">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold/10 border border-gold/20">
                      <IconByName name={s.icon} size={16} className="text-gold" />
                    </span>
                    <span className="text-sm font-medium text-foreground/90">{s.label}</span>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>
        )}

        {/* PRICING */}
        {c.pricing.visible && (c.pricing.highlight.visible || c.pricing.standard.visible) && (
          <Reveal>
            <section className="mt-20 sm:mt-28">
              <div className="text-center mb-10">
                {c.pricing.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{c.pricing.kicker}</div>}
                {c.pricing.heading && <h2 className="text-3xl sm:text-4xl font-bold">{c.pricing.heading}</h2>}
              </div>

              <div className={`grid gap-6 ${c.pricing.highlight.visible && c.pricing.standard.visible ? "md:grid-cols-2" : "max-w-xl mx-auto"}`}>
                {/* HIGHLIGHT */}
                {c.pricing.highlight.visible && (
                  <div className="relative rounded-3xl p-[1.5px] bg-gradient-to-br from-emerald-400/70 via-emerald-500/30 to-transparent">
                    <div className="relative h-full rounded-[calc(1.5rem-1.5px)] bg-[#0a1825] p-8">
                      {c.pricing.highlight.badge && (
                        <div className="absolute -top-3 right-6 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-bold text-emerald-950 tracking-wide">
                          {c.pricing.highlight.badge}
                        </div>
                      )}
                      {c.pricing.highlight.pill && (
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-400/30 px-3 py-1 mb-5">
                          <ShieldCheck size={14} className="text-emerald-400" />
                          <span className="text-[11px] text-emerald-300 font-medium">{c.pricing.highlight.pill}</span>
                        </div>
                      )}
                      <h3 className="text-xl font-bold mb-2">{c.pricing.highlight.title}</h3>
                      {c.pricing.highlight.description && <p className="text-sm text-foreground/70 mb-6">{c.pricing.highlight.description}</p>}
                      <div className="flex items-baseline gap-2 mb-6">
                        <span className="text-5xl font-bold text-emerald-400">{c.pricing.highlight.price}</span>
                        {c.pricing.highlight.price_suffix && <span className="text-sm text-foreground/60">{c.pricing.highlight.price_suffix}</span>}
                      </div>
                      <ul className="space-y-3 mb-8">
                        {c.pricing.highlight.features.map((b) => (
                          <li key={b.id} className="flex items-start gap-2.5 text-sm">
                            <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                            <span className="text-foreground/85">{b.text}</span>
                          </li>
                        ))}
                      </ul>
                      <a href={waHighlight} target="_blank" rel="noopener noreferrer"
                        className="block w-full text-center rounded-2xl bg-emerald-500 hover:bg-emerald-400 transition px-6 py-3.5 text-sm font-bold text-emerald-950">
                        {c.pricing.highlight.button_label}
                      </a>
                      {c.pricing.highlight.footnote && <p className="text-[11px] text-foreground/55 text-center mt-3">{c.pricing.highlight.footnote}</p>}
                    </div>
                  </div>
                )}

                {/* STANDARD */}
                {c.pricing.standard.visible && (
                  <div className="relative rounded-3xl p-[1.5px] bg-gradient-to-br from-gold/60 via-gold/20 to-transparent">
                    <div className="relative h-full rounded-[calc(1.5rem-1.5px)] bg-[#0a1825] p-8">
                      {c.pricing.standard.pill && (
                        <div className="inline-flex items-center gap-2 rounded-full bg-gold/10 border border-gold/30 px-3 py-1 mb-5">
                          <Sparkles size={14} className="text-gold" />
                          <span className="text-[11px] text-gold font-medium">{c.pricing.standard.pill}</span>
                        </div>
                      )}
                      <h3 className="text-xl font-bold mb-2">{c.pricing.standard.title}</h3>
                      {c.pricing.standard.description && <p className="text-sm text-foreground/70 mb-6">{c.pricing.standard.description}</p>}
                      <div className="flex items-baseline gap-2 mb-6">
                        <span className="text-5xl font-bold text-gradient-gold">{c.pricing.standard.price}</span>
                        {c.pricing.standard.price_suffix && <span className="text-sm text-foreground/60">{c.pricing.standard.price_suffix}</span>}
                      </div>
                      <ul className="space-y-3 mb-8">
                        {c.pricing.standard.features.map((b) => (
                          <li key={b.id} className="flex items-start gap-2.5 text-sm">
                            <CheckCircle2 size={16} className="text-gold mt-0.5 shrink-0" />
                            <span className="text-foreground/85">{b.text}</span>
                          </li>
                        ))}
                      </ul>
                      <a href={waStandard} target="_blank" rel="noopener noreferrer"
                        className="btn-gold block w-full text-center rounded-2xl px-6 py-3.5 text-sm font-bold">
                        {c.pricing.standard.button_label}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </Reveal>
        )}

        {/* FINAL CTA */}
        {c.final_cta.visible && (
          <Reveal>
            <section className="mt-24 sm:mt-32">
              <div className="relative overflow-hidden rounded-[2rem] border border-gold/20 p-10 sm:p-14 text-center"
                style={{ background: "radial-gradient(120% 100% at 50% 0%, rgba(201,168,76,0.18) 0%, rgba(10,24,37,0.9) 60%)" }}>
                <Waves className="absolute -top-6 -left-6 text-gold/10" size={140} />
                <Waves className="absolute -bottom-10 -right-8 text-gold/10" size={180} />
                <h2 className="relative text-3xl sm:text-4xl font-bold leading-tight">
                  {c.final_cta.heading_line1}{c.final_cta.heading_line1 && " "}
                  {c.final_cta.heading_highlight && <span className="text-gradient-gold">{c.final_cta.heading_highlight}</span>}
                  {c.final_cta.heading_line2 && <> {c.final_cta.heading_line2}</>}
                </h2>
                {c.final_cta.description && (
                  <p className="relative mt-4 text-foreground/75 max-w-xl mx-auto">{c.final_cta.description}</p>
                )}
                <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
                  <a href={waFinal} target="_blank" rel="noopener noreferrer"
                    className="btn-gold rounded-2xl px-8 py-4 text-sm font-bold inline-flex items-center gap-2 shadow-deep">
                    {c.final_cta.primary_label} <ArrowRight size={16} className="rotate-180" />
                  </a>
                  <a href={waFinalSecondary} target="_blank" rel="noopener noreferrer"
                    className="rounded-2xl border border-white/15 bg-white/5 px-7 py-4 text-sm font-medium text-white inline-flex items-center gap-2 hover:bg-white/10 transition">
                    <MessageCircle size={16} /> {c.final_cta.secondary_label}
                  </a>
                </div>
              </div>
            </section>
          </Reveal>
        )}

        {/* RELATED */}
        {c.show_related && related.length > 0 && (
          <Reveal>
            <section className="mt-20 sm:mt-28 mb-20">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <div className="text-xs tracking-widest text-gradient-gold mb-2">خدمات مرتبطة</div>
                  <h2 className="text-2xl sm:text-3xl font-bold">قد تهمّك أيضًا</h2>
                </div>
                <Link to="/services" className="text-sm text-gold hover:underline">كل الخدمات ←</Link>
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                {related.map((r) => (
                  <a key={r.id}
                    href={r.linked_page_type === "existing_page" && r.linked_page_url ? r.linked_page_url : `/services/${r.slug}`}
                    className="group rounded-3xl border border-white/5 bg-[#0a1825]/80 overflow-hidden hover:-translate-y-1 hover:border-gold/30 transition flex flex-col">
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <img src={getImageUrl(r.image_path)} alt={r.title} onError={onImageError}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0a1825] via-transparent to-transparent" />
                    </div>
                    <div className="p-5">
                      <div className="font-bold mb-1.5 group-hover:text-gold transition">{r.title}</div>
                      {r.short_description && <div className="text-xs text-foreground/65 line-clamp-2 leading-relaxed">{r.short_description}</div>}
                    </div>
                  </a>
                ))}
              </div>
            </section>
          </Reveal>
        )}
      </div>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Service",
        name: svc.title,
        description: svc.meta_description || svc.short_description,
        provider: { "@type": "Organization", name: "Aqua Haven" },
      })}} />
    </div>
  );
}

function IconByName({ name, size, className }: { name?: string | null; size?: number; className?: string }) {
  if (!name) return null;
  const Cmp = (Icons as any)[name];
  if (!Cmp) return null;
  return <Cmp size={size} className={className} />;
}

function TrustChip({ iconName, text }: { iconName: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <IconByName name={iconName} size={14} className="text-gold" />
      {text}
    </span>
  );
}

function StatCard({ big, label }: { big: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-[#0a1825]/80 p-5 text-center">
      <div className="text-3xl font-bold text-gradient-gold">{big}</div>
      <div className="text-xs text-foreground/65 mt-1">{label}</div>
    </div>
  );
}


