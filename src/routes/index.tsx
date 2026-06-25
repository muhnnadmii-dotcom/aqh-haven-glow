import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bubbles } from "../components/Bubbles";
import { Reveal } from "../components/Reveal";
import { Counter } from "../components/Counter";
import {
  ArrowLeft,
  Plus, Minus, Star, Quote, Wrench, Building2, MapPin, Ruler, MessageCircle,
} from "lucide-react";
import livingRoomTankAsset from "../assets/aqh-living-room-tank.png.asset.json";
import marineCubeAsset from "../assets/aqh-marine-cube.png.asset.json";
import styledAquariumAsset from "../assets/aqh-styled-aquarium.png.asset.json";
import counterAquariumAsset from "../assets/aqh-counter-aquarium.png.asset.json";
import canisterFilterAsset from "../assets/aqh-canister-filter.jpg.asset.json";
import saudiServiceAsset from "../assets/aqh-saudi-service.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl } from "@/lib/storage";
import {
  ICONS,
  type HeroContent, type ExploreContent, type ServicesContent,
  type WhyUsContent, type ProcessContent, type FaqContent, type CtaContent, type SectionHeader,
  type PartnersContent, type HomeTestimonialsContent,
} from "@/lib/home-sections";
import { getImageUrl, onImageError } from "@/lib/storage";
import { whatsappLink } from "@/components/WhatsAppButton";
import { CustomerHomeCard } from "@/components/CustomerHomeCard";


const heroFallback = livingRoomTankAsset.url;
const styledAquarium = styledAquariumAsset.url;
const maintenanceImg = saudiServiceAsset.url;
const businessImg = counterAquariumAsset.url;
const projectFallbacks = [livingRoomTankAsset.url, marineCubeAsset.url, styledAquariumAsset.url, counterAquariumAsset.url, canisterFilterAsset.url, saudiServiceAsset.url];
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
  loader: async () => {
    const [sectionsRes, articlesRes, projectsRes, servicesRes, statsRes] = await Promise.all([
      supabase.from("home_sections").select("section_key, enabled, content").in("section_key", SECTION_KEYS),
      supabase.from("articles").select("slug, title, excerpt, cover_path")
        .eq("published", true).eq("visible", true).eq("featured_on_home", true)
        .order("home_order", { ascending: true }).limit(3),
      supabase.from("projects").select("slug, title, category_label, location, description, cover_path, cover, specs")
        .eq("published", true).order("featured", { ascending: false }).order("sort_order", { ascending: true }).limit(6),
      supabase.from("services").select("id, slug, title, short_description, description, image_path, icon, linked_page_type, linked_page_url")
        .eq("published", true).eq("is_featured", true).order("sort_order").limit(6),
      supabase.rpc("get_home_hero_stats"),
    ]);
    const m: any = { ...EMPTY_SECTIONS };
    (sectionsRes.data ?? []).forEach((r: any) => { m[r.section_key] = { enabled: r.enabled, content: r.content }; });
    const statsRow: any = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
    return {
      sections: m as Sections,
      articles: (articlesRes.data ?? []) as unknown as FeaturedArticle[],
      projects: (projectsRes.data ?? []) as unknown as FeaturedProject[],
      dbServices: (servicesRes.data ?? []) as unknown as FeaturedService[],
      liveStats: {
        customers: Number(statsRow?.customers ?? 0),
        tanks: Number(statsRow?.tanks ?? 0),
        projects: Number(statsRow?.projects ?? 0),
      },
    };
  },
  component: HomePage,
});


type FeaturedArticle = { slug: string; title: string; excerpt: string | null; cover_path: string | null };
type FeaturedProject = { slug: string; title: string; category_label: string | null; location: string | null; description: string | null; cover_path: string | null; cover: string | null; specs: any };
type FeaturedService = {
  id: string; slug: string; title: string; short_description: string | null; description: string | null;
  image_path: string | null; icon: string | null;
  linked_page_type: string; linked_page_url: string | null;
};

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
  const initial = Route.useLoaderData() as { sections: Sections; articles: FeaturedArticle[]; projects: FeaturedProject[]; dbServices: FeaturedService[]; liveStats: { customers: number; tanks: number; projects: number } };
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const sections = initial.sections;
  const articles = initial.articles;
  const projects = initial.projects;
  const dbServices = initial.dbServices;
  const liveStats = initial.liveStats;





  const hero = sections.hero?.content;
  const heroEnabled = sections.hero?.enabled ?? true;
  const heroImg = hero?.image_path ? publicUrl(hero.image_path) : heroFallback;
  const heroImgMobile = hero?.mobile_image_enabled && hero?.image_path_mobile ? publicUrl(hero.image_path_mobile) : null;
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


  const configuredStats = (hero?.stats ?? []).filter((s) => s && s.label);
  const heroStats = configuredStats.length > 0 ? configuredStats : [
    { id: "s1", value: Math.max(liveStats.customers, 0), suffix: "+", label: "عميل مسجّل" },
    { id: "s2", value: 9, suffix: "+", label: "سنوات خبرة" },
    { id: "s3", value: Math.max(liveStats.projects, 0), suffix: "+", label: "مشروع منفذ" },
    { id: "s4", value: Math.max(liveStats.tanks, 0), suffix: "+", label: "حوض مُدار" },
  ];
  const partnersC = sections.partners?.content;
  const partnersEnabled = sections.partners?.enabled ?? true;
  const partnerItems = (partnersC?.items ?? []).filter((i) => i.visible).sort((a, b) => a.order - b.order);



  return (
    <>
      {/* HERO */}
      {heroEnabled && (
        <section className="relative min-h-[92dvh] overflow-hidden -mt-24 pt-24 flex flex-col">
          <div className="absolute inset-0">
            <picture className="block h-full w-full">
              {heroImgMobile && <source media="(max-width: 640px)" srcSet={heroImgMobile} />}
              <img src={heroImg} alt={hero?.title ?? "أكوا هيفن"} className="h-full w-full object-cover" style={{ opacity: overlayOn ? 1 - overlayOpacity * 0.4 : 1 }} width={1920} height={1080} />
            </picture>
            {overlayOn && (
              <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, oklch(0.10 0.05 245 / ${overlayOpacity}), oklch(0.10 0.05 245 / ${overlayOpacity * 0.6}), var(--background))` }} />
            )}
          </div>
          <div className="light-rays" aria-hidden />
          <Bubbles count={22} />

          <div className="relative mx-auto w-full max-w-7xl px-5 pt-12 sm:pt-16 text-center flex-1 flex flex-col">
            <div className="my-auto space-y-6">
              {(hero?.title || hero?.subtitle) && (
                <Reveal delay={120}>
                  <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold leading-[1.1] tracking-tight">
                    {hero?.title && (
                      <span className="text-gradient-gold" style={{ textShadow: "0 8px 40px oklch(0.78 0.14 80 / 0.35)" }}>
                        {hero.title}
                      </span>
                    )}
                    {hero?.subtitle && (
                      <>
                        {hero?.title && <br />}
                        <span className="text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">{hero.subtitle}</span>
                      </>
                    )}
                  </h1>
                </Reveal>
              )}
              {hero?.description && (
                <Reveal delay={240}>
                  <p className="mx-auto max-w-2xl text-base sm:text-lg md:text-xl text-white/90 leading-relaxed px-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                    {hero.description}
                  </p>
                </Reveal>
              )}
            </div>


            <div className="mt-auto pt-16 sm:pt-20 pb-10 sm:pb-12">
              <Reveal delay={360}>
                <div className="flex flex-wrap justify-center gap-3 mb-8 sm:mb-10">
                  <CTAButton href={hero?.primary_cta_href || "/contact"} variant="gold">{hero?.primary_cta_label || "اطلب مشروعك"}</CTAButton>
                </div>
              </Reveal>

              {heroStats.length > 0 && (
                <Reveal delay={480}>
                  <div className={`grid gap-3 sm:gap-4 max-w-3xl mx-auto ${heroStats.length === 1 ? "grid-cols-1" : heroStats.length === 2 ? "grid-cols-2" : heroStats.length >= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"}`}>
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
          </div>
        </section>

      )}

      {/* Customer welcome card — visible only for signed-in users */}
      <CustomerHomeCard />

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
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
              {exploreItems.map((c, i) => {
                const Icon = c.icon ? ICONS[c.icon] : null;
                const img = getImageUrl(c.image_path);
                return (
                  <Reveal key={c.id} delay={i * 60}>
                    <SmartLink to={c.href} className="group block h-full rounded-2xl glass overflow-hidden hover:glass-gold hover:-translate-y-1 transition-all duration-500 flex flex-col">
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-white/5">
                        <img
                          src={img}
                          alt={c.label}
                          loading="lazy"
                          onError={onImageError}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                          width={800}
                          height={500}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-background/10 to-transparent" />
                        {(Icon || c.emoji) && (
                          <div className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-xl glass-gold">
                            {Icon ? <Icon className="text-gold" size={18} aria-hidden /> : <span className="text-lg">{c.emoji}</span>}
                          </div>
                        )}
                      </div>
                      <div className="p-5 flex flex-col flex-1">
                        <h3 className="text-lg font-bold mb-1.5">{c.label}</h3>
                        {c.desc && <p className="text-xs text-muted-foreground leading-relaxed flex-1">{c.desc}</p>}
                        <div className="mt-3 inline-flex items-center gap-1 text-xs text-gradient-gold">
                          ادخل <ArrowLeft size={12} aria-hidden />
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
          <div className="marquee-track gap-16 text-2xl md:text-3xl font-bold text-white/30 select-none items-center">
            {[...partnerItems, ...partnerItems].map((p, i) => {
              const isImage = (p.display_type ?? (p.logo_path ? "image" : "text")) === "image" && p.logo_path;
              return isImage ? (
                <img
                  key={`${p.id}-${i}`}
                  src={publicUrl(p.logo_path!)}
                  alt={p.label}
                  loading="lazy"
                  onError={onImageError}
                  className="h-12 md:h-14 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity"
                />
              ) : (
                <span key={`${p.id}-${i}`} className="whitespace-nowrap" dir="ltr">{p.label}</span>
              );
            })}
          </div>
        </section>
      )}

      {/* SERVICES — sourced from DB (services table, is_featured) */}
      {servicesEnabled && dbServices.length > 0 && (
        <section className="relative py-24">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal>
              <div className="text-center mb-14">
                <div className="text-xs text-gradient-gold mb-3" style={{ letterSpacing: "0.3em" }}>{services?.kicker ?? "SERVICES"}</div>
                <h2 className="text-3xl sm:text-4xl font-bold">{services?.heading ?? "ماذا نقدم"}</h2>
                <p className="text-muted-foreground mt-3 max-w-xl mx-auto">{services?.description ?? "حلول متكاملة لكل من يطمح لعالم مائي استثنائي."}</p>
              </div>
            </Reveal>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {dbServices.map((s, i) => {
                const Icon = s.icon ? ICONS[s.icon] : null;
                const img = getImageUrl(s.image_path);
                const href = s.linked_page_type === "existing_page" && s.linked_page_url
                  ? s.linked_page_url
                  : s.linked_page_type === "external_link" && s.linked_page_url
                  ? s.linked_page_url
                  : s.linked_page_type === "whatsapp"
                  ? whatsappLink(`السلام عليكم، أرغب بالاستفسار عن خدمة: ${s.title}`)
                  : `/services/${s.slug}`;
                return (
                  <Reveal key={s.id} delay={i * 100}>
                    <SmartLink to={href} className="group block h-full rounded-2xl glass overflow-hidden hover:-translate-y-1 transition-transform duration-500 flex flex-col">
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <img src={img} alt={s.title} onError={onImageError} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
                        {Icon && (
                          <div className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-xl glass-gold">
                            <Icon className="text-gold" size={18} aria-hidden />
                          </div>
                        )}
                      </div>
                      <div className="p-5 flex flex-col flex-1">
                        <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                        {(s.short_description || s.description) && (
                          <p className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-3 flex-1">
                            {s.short_description || s.description}
                          </p>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs text-gradient-gold mt-auto">
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
              <div className="grid gap-4 sm:grid-cols-2 items-stretch auto-rows-fr">
                {whyItems.map((w, i) => {
                  const Icon = w.icon ? ICONS[w.icon] : null;
                  return (
                    <Reveal key={w.id} delay={i * 100} className="h-full">
                      <div className="glass rounded-2xl p-5 hover:glass-gold transition h-full flex flex-col">
                        {Icon && (
                          <div className="grid h-11 w-11 place-items-center rounded-xl glass-gold mb-3 shrink-0">
                            <Icon className="text-gold" size={20} aria-hidden />
                          </div>
                        )}
                        <h3 className="font-bold mb-1.5">{w.title}</h3>
                        {w.desc && <p className="text-sm text-muted-foreground leading-relaxed flex-1">{w.desc}</p>}
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FEATURED PROJECTS */}
      <FeaturedProjectsSection projects={projects} />

      {/* MAINTENANCE TEASER */}
      <section className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <div className="glass rounded-3xl overflow-hidden grid md:grid-cols-2 items-stretch">
            <div className="relative h-56 md:h-auto min-h-[220px]">
              <img src={maintenanceImg} alt="صيانة أحواض" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-l from-background/80 via-background/30 to-transparent md:bg-gradient-to-r" />
            </div>
            <div className="p-6 sm:p-10 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 text-xs tracking-widest text-gradient-gold mb-3">
                <Wrench size={14} /> صيانة احترافية
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">حوضك بأفضل حال طوال السنة</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-6">
                باقات صيانة دورية تشمل تنظيف، فحص جودة الماء، فلاتر، إضاءة، وأسماك ونباتات. متابعة مستمرة من فريق متخصص.
              </p>
              <div className="flex flex-wrap gap-3">
                <CTAButton href="/maintenance" variant="gold">احجز صيانة</CTAButton>
                <CTAButton href={whatsappLink("أرغب بحجز صيانة لحوضي")} variant="outline">استفسار سريع</CTAButton>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BUSINESS SOLUTIONS TEASER */}
      <section className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-6">
          <div className="glass rounded-3xl overflow-hidden grid md:grid-cols-2 items-stretch">
            <div className="p-6 sm:p-10 flex flex-col justify-center order-2 md:order-1">
              <div className="inline-flex items-center gap-2 text-xs tracking-widest text-gradient-gold mb-3">
                <Building2 size={14} /> حلول الأعمال
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">أحواض للكافيهات والمكاتب والمطاعم</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-6">
                نصمم تجربة بصرية فاخرة تعزز هوية مكانك وتجذب عملاءك، مع عقود صيانة كاملة وضمان تشغيلي.
              </p>
              <div className="flex flex-wrap gap-3">
                <CTAButton href="/business-solutions" variant="gold">حلول الأعمال</CTAButton>
                <CTAButton href={whatsappLink("استفسار عن حلول الأعمال لأكوا هيفن")} variant="outline">تواصل معنا</CTAButton>
              </div>
            </div>
            <div className="relative h-56 md:h-auto min-h-[220px] order-1 md:order-2">
              <img src={businessImg} alt="حلول الأعمال" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/30 to-transparent md:bg-gradient-to-l" />
            </div>
          </div>
        </div>
      </section>

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
      {showTestimonials && (
        <section className="relative py-24">
          <div className="mx-auto max-w-7xl px-6">
            <Reveal>
              <div className="text-center mb-14">
                {testHead?.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{testHead.kicker}</div>}
                {testHead?.heading && <h2 className="text-3xl sm:text-4xl font-bold">{testHead.heading}</h2>}
                {testHead?.subtitle && <p className="text-muted-foreground mt-3 max-w-xl mx-auto">{testHead.subtitle}</p>}
              </div>
            </Reveal>
            <div className="grid gap-5 md:grid-cols-3 items-stretch">
              {testimonials.map((t, i) => (
                <Reveal key={t.id} delay={i * 60}>
                  <div className="glass rounded-2xl p-6 h-full relative flex flex-col">
                    <Quote className="absolute top-4 left-4 text-gold opacity-30" size={26} aria-hidden />
                    <div className="flex gap-1 mb-3">
                      {Array.from({ length: 5 }).map((_, k) => (
                        <Star key={k} size={14} className={k < (t.rating || 5) ? "fill-gold text-gold" : "text-white/20"} aria-hidden />
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/90 mb-5 flex-1">{t.body}</p>
                    <div className="border-t border-white/5 pt-3 flex items-center gap-3 mt-auto">
                      <div className="h-10 w-10 rounded-full glass-gold grid place-items-center text-gold text-sm shrink-0">{(t.name || "؟").charAt(0)}</div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{t.name || "—"}</div>
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
      {knowHeadEnabled && articles.length > 0 && (
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

      {/* FINAL WHATSAPP CTA */}
      <section className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-5 sm:px-6">
          <div className="gradient-border rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden">
            <div className="light-rays" aria-hidden />
            <div className="relative">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">جاهز تبدأ مشروعك المائي؟</h2>
              <p className="text-sm sm:text-base text-muted-foreground mb-7 max-w-lg mx-auto">
                تواصل معنا الآن واحصل على استشارة مجانية وعرض سعر مخصص لمشروعك.
              </p>
              <a
                href={whatsappLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-bold text-white shadow-deep transition-transform hover:scale-105"
                style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
              >
                <MessageCircle size={20} /> تواصل معنا عبر واتساب
              </a>
            </div>
          </div>
        </div>
      </section>


    </>
  );
}

function FeaturedProjectsSection({ projects }: { projects: FeaturedProject[] }) {
  const fallback: FeaturedProject[] = [
    { slug: "", title: "حوض غرفة المعيشة", category_label: "مياه عذبة مزروع", location: "الرياض", description: "تصميم طبيعي بنباتات حية وإضاءة احترافية.", cover_path: null, cover: null, specs: { dimensions: "150×60×60 سم" } },
    { slug: "", title: "حوض الشعاب المرجانية", category_label: "بحري ريف", location: "جدة", description: "نظام بحري متكامل مع مرجانيات وأسماك ملونة.", cover_path: null, cover: null, specs: { dimensions: "120×60×60 سم" } },
    { slug: "", title: "حوض الكافيه", category_label: "تجاري", location: "الرياض", description: "حوض مميز يعزز تجربة العملاء في الكافيه.", cover_path: null, cover: null, specs: { dimensions: "200×70×70 سم" } },
    { slug: "", title: "حوض المكتب التنفيذي", category_label: "مكتبي", location: "الرياض", description: "تصميم فاخر يضفي هدوءاً على بيئة العمل.", cover_path: null, cover: null, specs: { dimensions: "100×40×50 سم" } },
    { slug: "", title: "نانو منزلي", category_label: "نانو", location: "الدمام", description: "حوض صغير مثالي للمبتدئين بتشطيب راقٍ.", cover_path: null, cover: null, specs: { dimensions: "60×30×35 سم" } },
    { slug: "", title: "حوض المطعم", category_label: "تجاري كبير", location: "الرياض", description: "حوض جانبي ضخم يصبح نقطة جذب المطعم.", cover_path: null, cover: null, specs: { dimensions: "250×80×80 سم" } },
  ];
  const items = projects.length > 0 ? projects : fallback;
  return (
    <section className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <Reveal>
          <div className="text-center mb-12">
            <div className="text-xs tracking-widest text-gradient-gold mb-3">PORTFOLIO</div>
            <h2 className="text-3xl sm:text-4xl font-bold">أعمال مختارة</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto text-sm sm:text-base">
              نماذج من المشاريع التي نفذناها للعملاء بمختلف الأذواق والاحتياجات.
            </p>
          </div>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {items.map((p, i) => {
            const img = p.cover_path ? publicUrl(p.cover_path) : (p.cover || projectFallbacks[i % projectFallbacks.length]);
            const dims = p.specs?.dimensions || p.specs?.size;
            const waText = `أبغى نفس فكرة "${p.title}"`;
            const card = (
              <article className="glass rounded-2xl overflow-hidden group hover:glass-gold transition-all h-full flex flex-col">
                <div className="relative aspect-[16/10] overflow-hidden bg-white/5">
                  <img src={img} alt={p.title} loading="lazy" onError={onImageError} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  {p.category_label && (
                    <div className="absolute top-3 right-3 glass-gold rounded-lg px-2.5 py-1 text-[10px] font-bold text-gold">{p.category_label}</div>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="text-base sm:text-lg font-bold mb-2">{p.title}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground mb-2">
                    {dims && <span className="inline-flex items-center gap-1"><Ruler size={12} aria-hidden /> {dims}</span>}
                    {p.location && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden /> {p.location}</span>}
                  </div>
                  {p.description && <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed flex-1 line-clamp-3">{p.description}</p>}
                  <a
                    href={whatsappLink(waText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold btn-gold"
                  >
                    <MessageCircle size={14} /> أبغى نفس الفكرة
                  </a>
                </div>
              </article>
            );
            return (
              <Reveal key={p.slug || `fb-${i}`} delay={i * 80} className="h-full">
                {p.slug ? <Link to="/portfolio" className="block h-full">{card}</Link> : <div className="h-full">{card}</div>}
              </Reveal>
            );
          })}
        </div>
        <div className="text-center mt-10">
          <CTAButton href="/portfolio" variant="outline">كل الأعمال</CTAButton>
        </div>
      </div>
    </section>
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
