import { createFileRoute, Link } from "@tanstack/react-router";
import { Reveal } from "../components/Reveal";
import { Bubbles } from "../components/Bubbles";
import consultationTankAsset from "../assets/aqh-consultation-tank.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl } from "@/lib/storage";
import { ICONS } from "@/lib/home-sections";
import type { AboutContent } from "@/lib/site-pages";

const heroFallback = consultationTankAsset.url;

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "من نحن — أكوا هيفن" },
      { name: "description", content: "قصة أكوا هيفن ورؤيتنا لنكون العلامة الرائدة في عالم الأحواض المائية بالمملكة." },
      { property: "og:title", content: "من نحن — أكوا هيفن" },
      { property: "og:description", content: "قصة ورؤية أكوا هيفن AQH." },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  loader: async () => {
    const { data } = await supabase.from("site_pages").select("content").eq("page_key", "about").maybeSingle();
    return { content: ((data?.content as unknown) as AboutContent | null) ?? null };
  },
  component: AboutPage,
});

function AboutPage() {
  const c = Route.useLoaderData().content as AboutContent | null;
  if (!c) return <div className="mx-auto max-w-2xl px-6 py-24 text-center text-muted-foreground">لا يوجد محتوى بعد.</div>;

  const heroImg = c.hero.image_path ? publicUrl(c.hero.image_path) : heroFallback;
  const sortedValues = (c.values ?? []).filter((v) => v.visible).sort((a, b) => a.order - b.order);
  const sortedStats = (c.stats ?? []).filter((s) => s.visible).sort((a, b) => a.order - b.order);

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImg} alt="" className="h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 to-background" />
        </div>
        <Bubbles count={12} />
        <div className="relative mx-auto max-w-4xl px-6 py-24 text-center">
          <Reveal>
            {c.hero.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{c.hero.kicker}</div>}
            <h1 className="text-4xl md:text-6xl font-bold mb-6">{c.hero.heading}</h1>
            {c.hero.description && (
              <p className="text-lg text-muted-foreground leading-relaxed">{c.hero.description}</p>
            )}
          </Reveal>
        </div>
      </section>

      {(c.story.heading || c.story.body || c.vision.heading || c.vision.body) && (
        <section className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-10 md:grid-cols-2 items-start">
            {(c.story.heading || c.story.body) && (
              <Reveal>
                <div className="glass rounded-3xl p-10">
                  {c.story.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{c.story.kicker}</div>}
                  {c.story.heading && <h2 className="text-3xl font-bold mb-5">{c.story.heading}</h2>}
                  {c.story.body && <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{c.story.body}</p>}
                </div>
              </Reveal>
            )}
            {(c.vision.heading || c.vision.body) && (
              <Reveal delay={150}>
                <div className="glass-gold rounded-3xl p-10">
                  {c.vision.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{c.vision.kicker}</div>}
                  {c.vision.heading && <h2 className="text-3xl font-bold mb-5">{c.vision.heading}</h2>}
                  {c.vision.body && <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{c.vision.body}</p>}
                </div>
              </Reveal>
            )}
          </div>
        </section>
      )}

      {sortedValues.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 py-16">
          <Reveal>
            <div className="text-center mb-12">
              {c.values_kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{c.values_kicker}</div>}
              {c.values_heading && <h2 className="text-3xl md:text-4xl font-bold">{c.values_heading}</h2>}
            </div>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {sortedValues.map((v, i) => {
              const Icon = ICONS[v.icon] ?? ICONS.Sparkles;
              return (
                <Reveal key={v.id} delay={i * 100}>
                  <div className="glass rounded-2xl p-6 text-center h-full">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl glass-gold mb-4">
                      <Icon className="text-gold" size={24} />
                    </div>
                    <h3 className="font-bold mb-2">{v.title}</h3>
                    {v.desc && <p className="text-sm text-muted-foreground">{v.desc}</p>}
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}

      {sortedStats.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-12">
          <div className="grid gap-4 sm:grid-cols-3">
            {sortedStats.map((s) => (
              <div key={s.id} className="glass rounded-2xl p-6 text-center">
                <div className="text-3xl font-bold text-gradient-gold">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {c.cta.visible && (c.cta.heading || c.cta.body) && (
        <section className="mx-auto max-w-5xl px-6 py-20">
          <Reveal>
            <div className="glass rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
              <Bubbles count={8} />
              <div className="relative">
                {c.cta.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{c.cta.kicker}</div>}
                {c.cta.heading && <h2 className="text-3xl md:text-4xl font-bold mb-5">{c.cta.heading}</h2>}
                {c.cta.body && <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8 whitespace-pre-line">{c.cta.body}</p>}
                {c.cta.button_label && (
                  c.cta.button_href?.startsWith("http") ? (
                    <a href={c.cta.button_href} target="_blank" rel="noopener noreferrer" className="btn-gold rounded-xl px-7 py-3.5 text-sm inline-flex">{c.cta.button_label}</a>
                  ) : (
                    <Link to={c.cta.button_href || "/"} className="btn-gold rounded-xl px-7 py-3.5 text-sm inline-flex">{c.cta.button_label}</Link>
                  )
                )}
              </div>
            </div>
          </Reveal>
        </section>
      )}
    </>
  );
}
