import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bubbles } from "../components/Bubbles";
import { Reveal } from "../components/Reveal";
import { Counter } from "../components/Counter";
import {
  ArrowLeft,
  Plus, Minus, Star, Quote,
} from "lucide-react";
import livingRoomTankAsset from "../assets/aqh-living-room-tank.png.asset.json";
import marineCubeAsset from "../assets/aqh-marine-cube.png.asset.json";
import styledAquariumAsset from "../assets/aqh-styled-aquarium.png.asset.json";
import counterAquariumAsset from "../assets/aqh-counter-aquarium.png.asset.json";
import canisterFilterAsset from "../assets/aqh-canister-filter.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl } from "@/lib/storage";
import {
  ICONS,
  type HeroContent, type ExploreContent, type ServicesContent,
  type WhyUsContent, type ProcessContent, type FaqContent, type CtaContent, type SectionHeader,
  type PartnersContent, type HomeTestimonialsContent,
} from "@/lib/home-sections";
import { getImageUrl, onImageError } from "@/lib/storage";


const heroFallback = livingRoomTankAsset.url;
const styledAquarium = styledAquariumAsset.url;
const serviceFallbacks = [marineCubeAsset.url, counterAquariumAsset.url, canisterFilterAsset.url, styledAquariumAsset.url];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "أكوا هيفن — عالمك المائي يبدأ من هنا" },
      { name: "description", content: "تصميم وتركيب وصيانة الأحواض المائية الفاخرة والأنظمة التجارية في الرياض. خبرة 9 سنوات." },
      { property: "og:title", content: "أكوا هيفن — عالمك المائي يبدأ من هنا" },
      { property: "og:description", content: "تصميم وتركيب وصيانة الأحواض المائية الفاخرة في الرياض." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
});


type FeaturedArticle = { slug: string; title: string; excerpt: string | null; cover_path: string | null };

type Sections = {
  hero: { enabled: boolean; content: HeroContent } | null;
  explore: { enabled: boolean; content: ExploreContent } | null;
  services: { enabled: boolean; content: ServicesContent } | null;
  why_us: { enabled: boolean; content: WhyUsContent } | null;
  process: { enabled: boolean; content: ProcessContent } | null;
  faq: { enabled: boolean; content: FaqContent } | null;
  cta: { enabled: boolean; content: CtaContent } | null;
  partners: { enabled: boolean; content: PartnersContent } | null;
  testimonials_header: { enabled: boolean; content: SectionHeader } | null;
  knowledge_header: { enabled: boolean; content: SectionHeader } | null;
  homepage_testimonials: { enabled: boolean; content: HomeTestimonialsContent } | null;
};

const EMPTY_SECTIONS: Sections = {
  hero: null, explore: null, services: null,
  why_us: null, process: null, faq: null, cta: null, partners: null,
  testimonials_header: null, knowledge_header: null, homepage_testimonials: null,
};

const SECTION_KEYS = ["hero", "explore", "services", "why_us", "process", "faq", "cta", "partners", "testimonials_header", "knowledge_header", "homepage_testimonials"];


function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [sections, setSections] = useState<Sections>(EMPTY_SECTIONS);
  const [articles, setArticles] = useState<FeaturedArticle[]>([]);

  useEffect(() => {
    let alive = true;
    supabase.from("home_sections").select("section_key, enabled, content")
      .in("section_key", SECTION_KEYS)
      .then(({ data }) => {
        if (!alive) return;
        const m: any = { ...EMPTY_SECTIONS };
        (data ?? []).forEach((r: any) => { m[r.section_key] = { enabled: r.enabled, content: r.content }; });
        setSections(m);
      });
    supabase.from("articles").select("slug, title, excerpt, cover_path")
      .eq("published", true).eq("visible", true).eq("featured_on_home", true)
      .order("home_order", { ascending: true }).limit(3)
      .then(({ data }) => { if (alive) setArticles((data ?? []) as unknown as FeaturedArticle[]); });
    return () => { alive = false; };
  }, []);





  const hero = sections.hero?.content;
  const heroEnabled = sections.hero?.enabled ?? true;
  const heroImg = hero?.image_path ? publicUrl(hero.image_path) : heroFallback;
  const overlayOn = hero?.overlay_enabled ?? true;
  const overlayOpacity = hero?.overlay_opacity ?? 0.6;

  const explore = sections.explore?.content;
  const exploreEnabled = sections.explore?.enabled ?? true;
  const exploreItems = (explore?.items ?? []).filter((i) => i.visible).sort((a, b) => a.order - b.order);

  const services = sections.services?.content;
  const servicesEnabled = sections.services?.enabled ?? true;
  const serviceItems = (services?.items ?? []).filter((i) => i.visible).sort((a, b) => a.order - b.order);

  const why = sections.why_us?.content;
  const whyEnabled = sections.why_us?.enabled ?? true;
  const whyItems = (why?.items ?? []).filter((i) => i.visible).sort((a, b) => a.order - b.order);

  const proc = sections.process?.content;
  const procEnabled = sections.process?.enabled ?? true;
  const procItems = (proc?.items ?? []).filter((i) => i.visible).sort((a, b) => a.order - b.order);

  const faqC = sections.faq?.content;
  const faqEnabled = sections.faq?.enabled ?? true;
  const faqItems = (faqC?.items ?? []).filter((i) => i.visible).sort((a, b) => a.order - b.order);

  const ctaC = sections.cta?.content;
  const ctaEnabled = sections.cta?.enabled ?? true;

  const testHead = sections.testimonials_header?.content;
  const testHeadEnabled = sections.testimonials_header?.enabled ?? true;
  const knowHead = sections.knowledge_header?.content;
  const knowHeadEnabled = sections.knowledge_header?.enabled ?? true;

  const homeTestEnabled = sections.homepage_testimonials?.enabled ?? true;
  const testimonials = ((sections.homepage_testimonials?.content?.items ?? [])
    .filter((t) => t && (t.name?.trim() || t.body?.trim()))
    .slice(0, 3));
  const showTestimonials = testHeadEnabled && homeTestEnabled && testimonials.length > 0;


  const heroStats = (hero?.stats ?? []).filter((s) => s && s.label);
  const partnersC = sections.partners?.content;
  const partnersEnabled = sections.partners?.enabled ?? true;
  const partnerItems = (partnersC?.items ?? []).filter((i) => i.visible).sort((a, b) => a.order - b.order);



  return (
    <>
      {/* HERO */}
      {heroEnabled && (
        <section className="relative min-h-[92dvh] overflow-hidden -mt-24 pt-24 flex items-center">
          <div className="absolute inset-0">
            <img src={heroImg} alt={hero?.title ?? "أكوا هيفن"} className="h-full w-full object-cover" style={{ opacity: overlayOn ? 1 - overlayOpacity * 0.4 : 1 }} width={1920} height={1080} />
            {overlayOn && (
              <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, oklch(0.10 0.05 245 / ${overlayOpacity}), oklch(0.10 0.05 245 / ${overlayOpacity * 0.6}), var(--background))` }} />
            )}
          </div>
          <div className="light-rays" aria-hidden />
          <Bubbles count={22} />

          <div className="relative mx-auto max-w-7xl px-6 py-20 text-center">
            <Reveal delay={120}>
              <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold leading-[1.05] mb-6 tracking-tight">
                <span className="text-gradient-gold" style={{ textShadow: "0 8px 40px oklch(0.78 0.14 80 / 0.35)" }}>
                  {hero?.title ?? "عالمك المائي"}
                </span>
                {hero?.subtitle && (<><br /><span className="text-foreground/95">{hero.subtitle}</span></>)}
              </h1>
            </Reveal>
            {hero?.description && (
              <Reveal delay={240}>
                <p className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed mb-10">{hero.description}</p>
              </Reveal>
            )}
            <Reveal delay={360}>
              <div className="flex flex-wrap justify-center gap-3 mb-12">
                {hero?.primary_cta_label && (
                  <CTAButton href={hero.primary_cta_href} variant="gold">{hero.primary_cta_label}</CTAButton>
                )}
                {hero?.secondary_cta_label && (
                  <CTAButton href={hero.secondary_cta_href} variant="outline">{hero.secondary_cta_label}</CTAButton>
                )}
              </div>
            </Reveal>
            {heroStats.length > 0 && (
              <Reveal delay={480}>
                <div className={`grid gap-4 max-w-2xl mx-auto ${heroStats.length === 1 ? "grid-cols-1" : heroStats.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                  {heroStats.map((s) => (
                    <div key={s.id} className="glass rounded-2xl p-4">
                      <div className="text-2xl md:text-3xl font-bold text-gradient-gold">
                        <Counter to={s.value} suffix={s.suffix} />
                      </div>
                      <div className="text-[11px] md:text-xs text-muted-foreground mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>
              </Reveal>
            )}
          </div>
        </section>
      )}

      {/* EXPLORE CUBES */}
      {exploreEnabled && exploreItems.length > 0 && (
        <section className="relative py-16">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal>
              <div className="text-center mb-10">
                {explore?.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{explore.kicker}</div>}
                <h2 className="text-3xl sm:text-4xl font-bold">{explore?.heading ?? "استكشف أكوا هيفن"}</h2>
                {explore?.subtitle && <p className="text-muted-foreground mt-3 max-w-xl mx-auto">{explore.subtitle}</p>}
              </div>
            </Reveal>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {exploreItems.map((c, i) => {
                const Icon = c.icon ? ICONS[c.icon] : null;
                return (
                  <Reveal key={c.id} delay={i * 60}>
                    <SmartLink to={c.href} className="group relative block aspect-square rounded-2xl glass hover:glass-gold transition-all p-5 overflow-hidden hover:-translate-y-1 duration-500">
                      <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-[color:var(--gold)]/10 blur-2xl group-hover:bg-[color:var(--gold)]/25 transition" />
                      <div className="relative h-full flex flex-col items-start justify-between">
                        <div className="grid h-12 w-12 place-items-center rounded-xl glass-gold">
                          {Icon ? <Icon className="text-gold" size={22} aria-hidden /> : c.emoji ? <span className="text-2xl">{c.emoji}</span> : null}
                        </div>
                        <div>
                          <div className="text-lg sm:text-xl font-bold mb-1">{c.label}</div>
                          {c.desc && <div className="text-xs text-muted-foreground">{c.desc}</div>}
                          <div className="mt-3 inline-flex items-center gap-1 text-xs text-gradient-gold opacity-0 group-hover:opacity-100 transition">
                            ادخل <ArrowLeft size={12} aria-hidden />
                          </div>
                        </div>
                      </div>
                    </SmartLink>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* PARTNERS MARQUEE */}
      {partnersEnabled && partnerItems.length > 0 && (
        <section className="relative py-10 border-y border-white/5 overflow-hidden bg-[oklch(0.10_0.05_245/0.4)]">
          {partnersC?.title && <div className="text-center text-sm text-muted-foreground mb-6 leading-loose">{partnersC.title}</div>}
          <div className="marquee-track gap-16 text-2xl md:text-3xl font-bold text-white/30 select-none">
            {[...partnerItems, ...partnerItems].map((p, i) => (
              <span key={`${p.id}-${i}`} className="whitespace-nowrap" dir="ltr">{p.label}</span>
            ))}
          </div>
        </section>
      )}

      {/* SERVICES */}
      {servicesEnabled && serviceItems.length > 0 && (
        <section className="relative py-24">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal>
              <div className="text-center mb-14">
                {services?.kicker && <div className="text-xs text-gradient-gold mb-3" style={{ letterSpacing: "0.3em" }}>{services.kicker}</div>}
                <h2 className="text-3xl sm:text-4xl font-bold">{services?.heading ?? "ماذا نقدم"}</h2>
                {services?.description && <p className="text-muted-foreground mt-3 max-w-xl mx-auto">{services.description}</p>}
              </div>
            </Reveal>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {serviceItems.map((s, i) => {
                const Icon = s.icon ? ICONS[s.icon] : null;
                const img = s.image_path ? publicUrl(s.image_path) : serviceFallbacks[i % serviceFallbacks.length];
                return (
                  <Reveal key={s.id} delay={i * 100}>
                    <SmartLink to={s.href} className="group block h-full rounded-2xl glass overflow-hidden hover:-translate-y-1 transition-transform duration-500">
                      <div className="relative h-44 overflow-hidden">
                        <img src={img} alt={s.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" width={800} height={600} />
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                        {Icon && (
                          <div className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-xl glass-gold">
                            <Icon className="text-gold" size={18} aria-hidden />
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                        {s.desc && <p className="text-sm text-muted-foreground leading-relaxed mb-3">{s.desc}</p>}
                        <span className="inline-flex items-center gap-1 text-xs text-gradient-gold">
                          اكتشف المزيد <ArrowLeft size={12} aria-hidden />
                        </span>
                      </div>
                    </SmartLink>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* WHY US */}
      {whyEnabled && whyItems.length > 0 && (
        <section className="relative py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] items-center">
              <Reveal>
                <div>
                  {why?.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{why.kicker}</div>}
                  {why?.heading && <h2 className="text-3xl sm:text-4xl font-bold mb-4">{why.heading}</h2>}
                  {why?.description && <p className="text-muted-foreground leading-relaxed mb-6">{why.description}</p>}
                  {why?.link_label && (
                    <SmartLink to={why.link_href || "/about"} className="inline-flex items-center gap-2 text-sm text-gradient-gold">
                      {why.link_label} <ArrowLeft size={16} aria-hidden />
                    </SmartLink>
                  )}
                </div>
              </Reveal>
              <div className="grid gap-4 sm:grid-cols-2">
                {whyItems.map((w, i) => {
                  const Icon = w.icon ? ICONS[w.icon] : null;
                  return (
                    <Reveal key={w.id} delay={i * 100}>
                      <div className="glass rounded-2xl p-5 hover:glass-gold transition">
                        {Icon && (
                          <div className="grid h-11 w-11 place-items-center rounded-xl glass-gold mb-3">
                            <Icon className="text-gold" size={20} aria-hidden />
                          </div>
                        )}
                        <h3 className="font-bold mb-1.5">{w.title}</h3>
                        {w.desc && <p className="text-sm text-muted-foreground leading-relaxed">{w.desc}</p>}
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* PROCESS */}
      {procEnabled && procItems.length > 0 && (
        <section className="relative py-24">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal>
              <div className="text-center mb-14">
                {proc?.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{proc.kicker}</div>}
                {proc?.heading && <h2 className="text-3xl sm:text-4xl font-bold">{proc.heading}</h2>}
                {proc?.description && <p className="text-muted-foreground mt-3 max-w-xl mx-auto">{proc.description}</p>}
              </div>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 relative">
              {procItems.map((s, i) => {
                const Icon = s.icon ? ICONS[s.icon] : null;
                return (
                  <Reveal key={s.id} delay={i * 100}>
                    <div className="glass rounded-2xl p-6 h-full relative overflow-hidden group">
                      <div className="absolute -top-2 -left-2 text-7xl font-black text-gradient-gold opacity-20 group-hover:opacity-40 transition">{s.number}</div>
                      {Icon && (
                        <div className="grid h-12 w-12 place-items-center rounded-xl glass-gold mb-4 relative">
                          <Icon className="text-gold" size={22} aria-hidden />
                        </div>
                      )}
                      <h3 className="text-lg font-bold mb-2 relative">{s.title}</h3>
                      {s.desc && <p className="text-sm text-muted-foreground leading-relaxed relative">{s.desc}</p>}
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}



      {/* TESTIMONIALS */}
      {testHeadEnabled && testimonials.length > 0 && (
        <section className="relative py-24">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal>
              <div className="text-center mb-14">
                {testHead?.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{testHead.kicker}</div>}
                {testHead?.heading && <h2 className="text-3xl sm:text-4xl font-bold">{testHead.heading}</h2>}
                {testHead?.subtitle && <p className="text-muted-foreground mt-3 max-w-xl mx-auto">{testHead.subtitle}</p>}
              </div>
            </Reveal>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t, i) => (
                <Reveal key={t.id} delay={i * 60}>
                  <div className="glass rounded-2xl p-6 h-full relative">
                    <Quote className="absolute top-4 left-4 text-gold opacity-30" size={26} aria-hidden />
                    <div className="flex gap-1 mb-3">
                      {Array.from({ length: t.rating || 5 }).map((_, k) => (
                        <Star key={k} size={13} className="fill-gold text-gold" aria-hidden />
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/90 mb-5">{t.body}</p>
                    <div className="border-t border-white/5 pt-3 flex items-center gap-3">
                      {t.image_path ? (
                        <img src={publicUrl(t.image_path)} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-full glass-gold grid place-items-center text-gold text-sm">{t.name.charAt(0)}</div>
                      )}
                      <div>
                        <div className="font-bold text-sm">{t.name}</div>
                        {t.role && <div className="text-xs text-muted-foreground mt-0.5">{t.role}</div>}
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* KNOWLEDGE */}
      {knowHeadEnabled && (
        <section className="relative py-24">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-4 mb-14">
                <div>
                  {knowHead?.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{knowHead.kicker}</div>}
                  {knowHead?.heading && <h2 className="text-3xl sm:text-4xl font-bold">{knowHead.heading}</h2>}
                </div>
                <Link to="/knowledge" className="inline-flex items-center gap-2 text-sm text-gradient-gold">
                  {knowHead?.link_label || "كل المقالات"} <ArrowLeft size={16} aria-hidden />
                </Link>
              </div>
            </Reveal>
            {articles.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">لا توجد مقالات مميزة حالياً.</p>
            ) : (
              <div className="grid gap-6 md:grid-cols-3">
                {articles.map((a, i) => {
                  const img = a.cover_path ? publicUrl(a.cover_path) : styledAquarium;
                  return (
                    <Reveal key={a.slug} delay={i * 120}>
                      <Link to="/knowledge/$slug" params={{ slug: a.slug }} className="block">
                        <article className="glass rounded-2xl overflow-hidden group hover:glass-gold transition-all h-full">
                          <div className="overflow-hidden">
                            <img src={img} alt={a.title} width={1024} height={768} loading="lazy" className="h-52 w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                          </div>
                          <div className="p-6">
                            <h3 className="text-lg font-bold mb-2">{a.title}</h3>
                            {a.excerpt && <p className="text-sm text-muted-foreground leading-relaxed">{a.excerpt}</p>}
                          </div>
                        </article>
                      </Link>
                    </Reveal>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* FAQ */}
      {faqEnabled && faqItems.length > 0 && (
        <section className="relative py-24">
          <div className="mx-auto max-w-3xl px-6">
            <Reveal>
              <div className="text-center mb-12">
                {faqC?.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{faqC.kicker}</div>}
                {faqC?.heading && <h2 className="text-3xl sm:text-4xl font-bold">{faqC.heading}</h2>}
              </div>
            </Reveal>
            <div className="space-y-3">
              {faqItems.map((f, i) => (
                <Reveal key={f.id} delay={i * 60}>
                  <div className="glass rounded-2xl overflow-hidden">
                    <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between gap-4 p-5 text-right" aria-expanded={openFaq === i}>
                      <span className="font-bold text-sm md:text-base">{f.q}</span>
                      <span className="grid place-items-center h-8 w-8 rounded-lg glass-gold flex-shrink-0" aria-hidden>
                        {openFaq === i ? <Minus size={14} /> : <Plus size={14} />}
                      </span>
                    </button>
                    <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: openFaq === i ? "1fr" : "0fr" }}>
                      <div className="overflow-hidden">
                        <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      {ctaEnabled && (ctaC?.heading || ctaC?.description) && (
        <section className="relative py-20">
          <div className="mx-auto max-w-5xl px-6">
            <Reveal>
              <div className="gradient-border rounded-3xl p-10 md:p-14 text-center relative overflow-hidden">
                <div className="light-rays" aria-hidden />
                <div className="relative">
                  {ctaC?.heading && <h2 className="text-3xl md:text-4xl font-bold mb-4">{ctaC.heading}</h2>}
                  {ctaC?.description && <p className="text-muted-foreground mb-8 max-w-xl mx-auto">{ctaC.description}</p>}
                  <div className="flex flex-wrap justify-center gap-3">
                    {ctaC?.primary_label && (
                      <CTAButton href={ctaC.primary_href} variant="gold">{ctaC.primary_label}</CTAButton>
                    )}
                    {ctaC?.secondary_label && (
                      <CTAButton href={ctaC.secondary_href} variant="outline">{ctaC.secondary_label}</CTAButton>
                    )}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}


    </>
  );
}

function isExternal(href: string) {
  return /^https?:\/\//i.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");
}

function CTAButton({ href, variant, children }: { href: string; variant: "gold" | "outline"; children: React.ReactNode }) {
  const cls = variant === "gold"
    ? "btn-gold inline-flex items-center rounded-xl px-7 py-3.5 text-sm"
    : "btn-outline-gold inline-flex items-center rounded-xl px-7 py-3.5 text-sm";
  if (isExternal(href)) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{children}</a>;
  }
  return <a href={href || "#"} className={cls}>{children}</a>;
}

function SmartLink({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  if (!to) return <div className={className}>{children}</div>;
  if (isExternal(to)) {
    return <a href={to} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
  }
  return <a href={to} className={className}>{children}</a>;
}
