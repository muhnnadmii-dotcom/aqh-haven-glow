import { Link } from "@tanstack/react-router";
import { useState, type ReactNode, type FormEvent, type CSSProperties } from "react";
import * as Icons from "lucide-react";
import { CheckCircle2, MessageCircle, ChevronDown, ArrowLeft, Plus, Minus, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Reveal } from "@/components/Reveal";
import { whatsappLink } from "@/components/WhatsAppButton";
import { getImageUrl, onImageError } from "@/lib/storage";
import { submitBusinessLead } from "@/lib/business-leads.functions";
import { usePageDoc } from "./api";
import { getPageMeta } from "./registry";
import type {
  Section, PageDoc, BusinessTabsSection,
  MediaHeroSection, StatBarSection, FeatureGridSection,
  CaseStudiesSection, SlaTiersSection, LeadFormSection, PortalMockupSection,
} from "./types";
import { useLang } from "@/lib/i18n/LangProvider";


function Icon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  const Cmp = (Icons as any)[name] ?? Icons.Sparkles;
  return <Cmp size={size} className={className} />;
}

// ─── Auto-balancing card layout ───────────────────────────────────────────
// Uses flex-wrap + justify-center so the last row centers automatically and
// cards redistribute when items are added/removed. Works in RTL and LTR.
type _Cols = 1 | 2 | 3 | 4 | 5;
type _Gap = 3 | 4 | 5;
const AUTO_CONTAINER: Record<_Gap, string> = {
  3: "flex flex-wrap justify-center gap-3",
  4: "flex flex-wrap justify-center gap-4",
  5: "flex flex-wrap justify-center gap-5",
};
const AUTO_ITEM: Record<_Gap, Record<_Cols, string>> = {
  3: {
    1: "basis-full max-w-md min-w-0 flex",
    2: "basis-full sm:basis-[calc((100%-0.75rem)/2)] min-w-0 flex",
    3: "basis-full sm:basis-[calc((100%-0.75rem)/2)] lg:basis-[calc((100%-1.5rem)/3)] min-w-0 flex",
    4: "basis-full sm:basis-[calc((100%-0.75rem)/2)] lg:basis-[calc((100%-2.25rem)/4)] min-w-0 flex",
    5: "basis-full sm:basis-[calc((100%-0.75rem)/2)] lg:basis-[calc((100%-3rem)/5)] min-w-0 flex",
  },
  4: {
    1: "basis-full max-w-md min-w-0 flex",
    2: "basis-full sm:basis-[calc((100%-1rem)/2)] min-w-0 flex",
    3: "basis-full sm:basis-[calc((100%-1rem)/2)] lg:basis-[calc((100%-2rem)/3)] min-w-0 flex",
    4: "basis-full sm:basis-[calc((100%-1rem)/2)] lg:basis-[calc((100%-3rem)/4)] min-w-0 flex",
    5: "basis-full sm:basis-[calc((100%-1rem)/2)] lg:basis-[calc((100%-4rem)/5)] min-w-0 flex",
  },
  5: {
    1: "basis-full max-w-md min-w-0 flex",
    2: "basis-full sm:basis-[calc((100%-1.25rem)/2)] min-w-0 flex",
    3: "basis-full sm:basis-[calc((100%-1.25rem)/2)] lg:basis-[calc((100%-2.5rem)/3)] min-w-0 flex",
    4: "basis-full sm:basis-[calc((100%-1.25rem)/2)] lg:basis-[calc((100%-3.75rem)/4)] min-w-0 flex",
    5: "basis-full sm:basis-[calc((100%-1.25rem)/2)] lg:basis-[calc((100%-5rem)/5)] min-w-0 flex",
  },
};
function autoCols(count: number, max: number): _Cols {
  return Math.min(Math.max(1, count), Math.min(5, max)) as _Cols;
}

function renderSection(s: Section) {
  if (!s.enabled) return null;
  switch (s.type) {
    case "hero":
      return (
        <Reveal key={s.id}>
          <div className="text-center mb-12">
            {s.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{s.kicker}</div>}
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{s.title}</h1>
            {s.description && (
              <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed whitespace-pre-line">{s.description}</p>
            )}
            {s.image_path && (
              <img src={getImageUrl(s.image_path)} onError={onImageError} alt={s.title}
                className="mx-auto mt-8 rounded-3xl max-h-[420px] object-cover" />
            )}
          </div>
        </Reveal>
      );

    case "badge_grid":
      if (!s.items.length) return null;
      {
        const cols = autoCols(s.items.length, 3);
        return (
          <div key={s.id} className={`${AUTO_CONTAINER[4]} mb-12 max-w-3xl mx-auto`}>
            {s.items.map((b, i) => (
              <div key={b.id} className={AUTO_ITEM[4][cols]}>
                <Reveal delay={i * 80} className="w-full">
                  <div className="glass rounded-2xl p-5 text-center h-full w-full">
                    <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl glass-gold mb-3">
                      <Icon name={b.icon} size={20} className="text-gold" />
                    </div>
                    <div className="font-bold mb-1">{b.title}</div>
                    <div className="text-xs text-muted-foreground">{b.desc}</div>
                  </div>
                </Reveal>
              </div>
            ))}
          </div>
        );
      }

    case "pricing_groups":
      if (!s.items.length) return null;
      return (
        <div key={s.id} className="space-y-10 mb-10">
          {s.items.map((g, gi) => (
            <Reveal key={g.id} delay={gi * 100}>
              <div>
                <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
                  <div>
                    <h2 className="text-2xl font-bold">{g.heading}</h2>
                    {g.desc && <p className="text-sm text-muted-foreground mt-1">{g.desc}</p>}
                  </div>
                </div>
                <div className={AUTO_CONTAINER[4]}>
                  {g.tiers.map((tier) => {
                    const msg = s.whatsapp_template
                      .replace("{group}", g.heading)
                      .replace("{tier}", tier.size);
                    const cols = autoCols(g.tiers.length, 4);
                    return (
                      <div key={tier.id} className={AUTO_ITEM[4][cols]}>
                        <div className="glass rounded-2xl p-5 hover:glass-gold transition flex flex-col w-full h-full">
                          <div className="text-xs text-gradient-gold mb-2">{g.heading}</div>
                          <h3 className="font-bold mb-2 text-sm">{tier.size}</h3>
                          <div className="text-xl font-bold text-gradient-gold mb-1">{tier.price}</div>
                          <div className="text-xs text-muted-foreground mb-4">{tier.freq}</div>
                          <a href={whatsappLink(msg)} target="_blank" rel="noopener noreferrer"
                            className="mt-auto btn-outline-gold rounded-xl px-4 py-2.5 text-xs text-center inline-flex justify-center">
                            {s.cta_label || "اطلب الآن"}
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      );

    case "checklist":
      if (!s.items.length) return null;
      return (
        <Reveal key={s.id}>
          <div className="glass rounded-3xl p-8 mb-10">
            {s.heading && <h2 className="text-xl font-bold mb-5">{s.heading}</h2>}
            <ul className="grid gap-3 sm:grid-cols-2">
              {s.items.map((it) => (
                <li key={it.id} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 size={16} className="text-gold mt-0.5 shrink-0" />
                  <span className="text-foreground/90">{it.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      );

    case "cta_band":
      return (
        <Reveal key={s.id}>
          <div className="gradient-border rounded-3xl p-8 md:p-12 my-10 text-center">
            <h2 className="text-2xl font-bold mb-3">{s.heading}</h2>
            {s.description && <p className="text-muted-foreground mb-6 max-w-xl mx-auto">{s.description}</p>}
            <div className="flex flex-wrap justify-center gap-3">
              {s.primary_label && (
                <a
                  href={s.primary_whatsapp_template
                    ? whatsappLink(s.primary_whatsapp_template)
                    : (s.primary_href || "#")}
                  target={s.primary_whatsapp_template ? "_blank" : undefined}
                  rel={s.primary_whatsapp_template ? "noopener noreferrer" : undefined}
                  className="btn-gold rounded-xl px-6 py-3 text-sm inline-flex items-center gap-2"
                >
                  {s.primary_whatsapp_template && <MessageCircle size={16} />}
                  {s.primary_label}
                </a>
              )}
              {s.secondary_label && s.secondary_href && (
                <Link to={s.secondary_href as any} className="btn-outline-gold rounded-xl px-6 py-3 text-sm">
                  {s.secondary_label}
                </Link>
              )}
            </div>
          </div>
        </Reveal>
      );

    case "rich_text":
      if (!s.body) return null;
      return (
        <Reveal key={s.id}>
          <div className="glass rounded-3xl p-8 my-10 max-w-3xl mx-auto">
            {s.heading && <h2 className="text-xl font-bold mb-4">{s.heading}</h2>}
            <div className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{s.body}</div>
          </div>
        </Reveal>
      );

    case "link_cards": {
      if (!s.items.length) return null;
      const maxCols = Math.max(2, Math.min(5, s.columns ?? 5));
      const cols = autoCols(s.items.length, maxCols);
      return (
        <Reveal key={s.id}>
          <section className="mb-16">
            {(s.heading || s.subheading) && (
              <div className="text-center mb-8">
                {s.heading && <h2 className="text-2xl md:text-3xl font-bold mb-2">{s.heading}</h2>}
                {s.subheading && <p className="text-muted-foreground text-sm">{s.subheading}</p>}
              </div>
            )}
            <div className={AUTO_CONTAINER[3]}>
              {s.items.map((o) => {
                const isExternal = /^https?:\/\//.test(o.href) || o.href.startsWith("mailto:") || o.href.startsWith("tel:");
                const cls = "glass rounded-2xl p-4 hover:glass-gold transition flex flex-col w-full h-full";
                const inner: ReactNode = (
                  <>
                    <div className="font-bold text-sm mb-1.5">{o.title}</div>
                    {o.desc && <div className="text-xs text-muted-foreground flex-1">{o.desc}</div>}
                    <span className="inline-flex items-center gap-1 text-xs text-gradient-gold mt-3">انتقل <ArrowLeft size={12} /></span>
                  </>
                );
                return (
                  <div key={o.id} className={AUTO_ITEM[3][cols]}>
                    {isExternal ? (
                      <a href={o.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
                    ) : (
                      <a href={o.href} className={cls}>{inner}</a>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </Reveal>
      );
    }

    case "step_list":
      if (!s.items.length) return null;
      {
        const cols = autoCols(s.items.length, 5);
        return (
          <Reveal key={s.id}>
            <section className="glass rounded-3xl p-8 md:p-10 mb-16">
              {s.heading && <h2 className="text-2xl font-bold text-center mb-8">{s.heading}</h2>}
              <div className={AUTO_CONTAINER[4]}>
                {s.items.map((it, i) => (
                  <div key={it.id} className={AUTO_ITEM[4][cols]}>
                    <div className="text-center w-full">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full glass-gold text-gold font-bold mb-3">{i + 1}</div>
                      <div className="text-sm">{it.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>
        );
      }

    case "faq":
      if (!s.items.length) return null;
      return <FaqBlock key={s.id} heading={s.heading} items={s.items} />;

    case "dynamic_slot": {
      const R = dynamicSlots[s.slot];
      return R ? <div key={s.id}>{R()}</div> : null;
    }

    case "business_tabs":
      return <BusinessTabsBlock key={s.id} section={s} />;

    case "media_hero":
      return <MediaHeroBlock key={s.id} section={s} />;
    case "stat_bar":
      return <StatBarBlock key={s.id} section={s} />;
    case "feature_grid":
      return <FeatureGridBlock key={s.id} section={s} />;
    case "case_studies":
      return <CaseStudiesBlock key={s.id} section={s} />;
    case "sla_tiers":
      return <SlaTiersBlock key={s.id} section={s} />;
    case "lead_form":
      return <LeadFormBlock key={s.id} section={s} />;
    case "portal_mockup":
      return <PortalMockupBlock key={s.id} section={s} />;
  }
}


function hexToRgba(hex: string | undefined, opacityPct: number | undefined, fallback: string): string {
  const op = Math.max(0, Math.min(100, opacityPct ?? 60)) / 100;
  const h = (hex ?? "").trim().replace("#", "");
  if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h)) return fallback;
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${op})`;
}

function MediaHeroBlock({ section: s }: { section: MediaHeroSection }) {
  const primaryHref = s.primary_whatsapp_template
    ? whatsappLink(s.primary_whatsapp_template)
    : (s.primary_href || "#");
  const secondaryHref = s.secondary_whatsapp_template
    ? whatsappLink(s.secondary_whatsapp_template)
    : (s.secondary_href || "");
  const primaryTarget = s.primary_whatsapp_template ? "_blank" : undefined;
  const secondaryTarget = s.secondary_whatsapp_template ? "_blank" : undefined;

  const overlayOn = s.overlay_enabled !== false;
  const mode = s.overlay_mode ?? "gradient";
  let overlayStyle: CSSProperties | undefined;
  if (overlayOn) {
    if (mode === "solid") {
      overlayStyle = { background: hexToRgba(s.overlay_color, s.overlay_opacity ?? 60, "rgba(0,0,0,0.6)") };
    } else {
      const from = hexToRgba(s.overlay_from_color, s.overlay_from_opacity ?? 60, "rgba(10,15,25,0.6)");
      const to = hexToRgba(s.overlay_to_color, s.overlay_to_opacity ?? 100, "hsl(var(--background))");
      overlayStyle = { background: `linear-gradient(to bottom, ${from}, ${to})` };
    }
  }

  return (
    <section className="relative overflow-hidden -mx-6 -mt-16 mb-16">
      <div className="absolute inset-0 -z-10">
        {s.image_path && (
          <img src={getImageUrl(s.image_path)} onError={onImageError} alt="" className="w-full h-full object-cover" />
        )}
        {overlayOn && <div className="absolute inset-0" style={overlayStyle} />}
      </div>
      <div className="mx-auto max-w-7xl px-6 pt-24 pb-20 sm:pt-32 sm:pb-28">
        <Reveal>
          <div className="flex flex-col items-center text-center mx-auto">
            {s.kicker && (
              <div className="inline-flex items-center gap-2 glass-gold rounded-full px-4 py-1.5 text-xs mb-6">
                <Sparkles size={14} className="text-gold" /> <span>{s.kicker}</span>
              </div>
            )}
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black leading-tight max-w-4xl mx-auto">
              {s.title}
              {s.title_highlight && <span className="block text-gradient-gold">{s.title_highlight}</span>}
            </h1>
            {s.description && (
              <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed whitespace-pre-line">{s.description}</p>
            )}
            {(s.primary_label || s.secondary_label) && (
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {s.primary_label && (
                  <a href={primaryHref} target={primaryTarget} rel={primaryTarget ? "noopener noreferrer" : undefined}
                    className="btn-gold rounded-xl px-6 py-3.5 text-sm font-bold inline-flex items-center gap-2">
                    {s.primary_whatsapp_template && <MessageCircle size={16} />}
                    {s.primary_label}
                  </a>
                )}
                {s.secondary_label && secondaryHref && (
                  <a href={secondaryHref} target={secondaryTarget} rel={secondaryTarget ? "noopener noreferrer" : undefined}
                    className="glass hover:glass-gold rounded-xl px-6 py-3.5 text-sm font-bold inline-flex items-center gap-2 border border-white/10">
                    {s.secondary_whatsapp_template && <MessageCircle size={16} />}
                    {s.secondary_label}
                  </a>
                )}
              </div>
            )}
            {s.badges && s.badges.length > 0 && (
              <div className="mt-10 flex flex-wrap justify-center items-center gap-x-6 gap-y-3 text-xs text-muted-foreground">
                {s.badges.map((b) => (
                  <span key={b.id} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-gold" /> {b.text}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}


function StatBarBlock({ section: s }: { section: StatBarSection }) {
  if (!s.items.length) return null;
  return (
    <section className="border-y border-white/10 bg-black/20 -mx-6 mb-16">
      <div className="mx-auto max-w-7xl px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
        {s.items.map((it) => (
          <div key={it.id} className="text-center">
            <Icon name={it.icon} size={22} className="mx-auto text-gold mb-2" />
            <div className="text-3xl sm:text-4xl font-black text-gradient-gold">{it.value}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-1">{it.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureGridBlock({ section: s }: { section: FeatureGridSection }) {
  if (!s.items.length) return null;
  const maxCols = Math.max(2, Math.min(4, s.columns ?? 3));
  const cols = autoCols(s.items.length, maxCols);
  return (
    <section className="mb-16">
      <Reveal>
        {(s.kicker || s.heading || s.subheading) && (
          <div className="text-center mb-10">
            {s.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{s.kicker}</div>}
            {s.heading && <h2 className="text-3xl sm:text-4xl font-bold mb-3">{s.heading}</h2>}
            {s.subheading && <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">{s.subheading}</p>}
          </div>
        )}
      </Reveal>
      <div className={AUTO_CONTAINER[5]}>
        {s.items.map((it, i) => (
          <div key={it.id} className={AUTO_ITEM[5][cols]}>
            <Reveal delay={i * 60} className="w-full">
              <div className="group glass rounded-2xl p-6 h-full w-full border border-white/10 hover:border-[color:var(--gold)]/40 transition-all">
                <div className="grid place-items-center h-12 w-12 rounded-xl glass-gold mb-4 group-hover:scale-110 transition-transform">
                  <Icon name={it.icon} size={22} className="text-gold" />
                </div>
                <h3 className="text-lg font-bold mb-2">{it.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{it.desc}</p>
              </div>
            </Reveal>
          </div>
        ))}
      </div>
    </section>
  );
}

function CaseStudiesBlock({ section: s }: { section: CaseStudiesSection }) {
  if (!s.items.length) return null;
  return (
    <section className="mb-16">
      <Reveal>
        {(s.kicker || s.heading || s.subheading) && (
          <div className="text-center mb-10">
            {s.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{s.kicker}</div>}
            {s.heading && <h2 className="text-3xl sm:text-4xl font-bold mb-3">{s.heading}</h2>}
            {s.subheading && <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">{s.subheading}</p>}
          </div>
        )}
      </Reveal>
      <div className={AUTO_CONTAINER[5]}>
        {s.items.map((p, i) => {
          const cols = autoCols(s.items.length, 3);
          return (
            <div key={p.id} className={AUTO_ITEM[5][cols]}>
              <Reveal delay={i * 60} className="w-full">
                <div className="group relative overflow-hidden rounded-2xl border border-white/10 aspect-[4/3] w-full">
                  {p.image_path && (
                    <img src={getImageUrl(p.image_path)} onError={onImageError} alt={p.title} loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    {p.category && <div className="inline-block text-[10px] tracking-wider text-gold mb-1.5 px-2 py-0.5 rounded-md glass-gold">{p.category}</div>}
                    <h3 className="font-bold">{p.title}</h3>
                    {p.location && <div className="text-xs text-muted-foreground mt-0.5">{p.location}</div>}
                  </div>
                </div>
              </Reveal>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SlaTiersBlock({ section: s }: { section: SlaTiersSection }) {
  if (!s.items.length) return null;
  return (
    <section className="mb-16">
      <Reveal>
        {(s.kicker || s.heading || s.subheading) && (
          <div className="text-center mb-10">
            {s.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{s.kicker}</div>}
            {s.heading && <h2 className="text-3xl sm:text-4xl font-bold mb-3">{s.heading}</h2>}
            {s.subheading && <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">{s.subheading}</p>}
          </div>
        )}
      </Reveal>
      <div className={AUTO_CONTAINER[5]}>
        {s.items.map((t, i) => {
          const href = t.cta_whatsapp_template ? whatsappLink(t.cta_whatsapp_template) : "#quote";
          const target = t.cta_whatsapp_template ? "_blank" : undefined;
          const cols = autoCols(s.items.length, 3);
          return (
            <div key={t.id} className={AUTO_ITEM[5][cols]}>
              <Reveal delay={i * 80} className="w-full">
                <div className={`rounded-2xl p-6 h-full w-full flex flex-col border ${t.highlighted ? "gradient-border glass-gold" : "glass border-white/10"}`}>
                  {t.badge && <div className="inline-block text-[10px] tracking-wider text-gold mb-2 px-2 py-0.5 rounded-md glass-gold self-start">{t.badge}</div>}
                  <h3 className="text-xl font-bold mb-1">{t.name}</h3>
                  {t.price && <div className="text-2xl font-black text-gradient-gold mt-2">{t.price}</div>}
                  {t.price_note && <div className="text-xs text-muted-foreground mb-4">{t.price_note}</div>}
                  <ul className="space-y-2 my-5 flex-1">
                    {t.features.map((f) => (
                      <li key={f.id} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 size={15} className="text-gold mt-0.5 shrink-0" />
                        <span className="text-foreground/90">{f.text}</span>
                      </li>
                    ))}
                  </ul>
                  {t.cta_label && (
                    <a href={href} target={target} rel={target ? "noopener noreferrer" : undefined}
                      className={`${t.highlighted ? "btn-gold" : "btn-outline-gold"} rounded-xl px-5 py-2.5 text-sm text-center inline-flex justify-center items-center gap-2`}>
                      {t.cta_whatsapp_template && <MessageCircle size={14} />} {t.cta_label}
                    </a>
                  )}
                </div>
              </Reveal>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LeadFormBlock({ section: s }: { section: LeadFormSection }) {
  const submit = useServerFn(submitBusinessLead);
  const anchor = s.form_anchor || "quote";
  const preset = s.fields_preset || "default";
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", company: "",
    industry: "", city: "", budget: "", timeline: "", message: "",
    facility_name: "", facility_type: "", need_type: "", preferred_time: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const inp = "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm focus:outline-none focus:border-[color:var(--gold)]/60";
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.message.trim()) {
      toast.error("الاسم والجوال والملاحظات مطلوبة");
      return;
    }
    setSubmitting(true);
    try {
      await submit({
        data: {
          ...form,
          source: s.lead_source || "business_lead",
          page: typeof window !== "undefined" ? window.location.pathname : "",
        },
      });
      setSent(true);
      toast.success(s.success_message || "تم استلام طلبك");
      setForm({
        name: "", phone: "", email: "", company: "", industry: "", city: "",
        budget: "", timeline: "", message: "",
        facility_name: "", facility_type: "", need_type: "", preferred_time: "",
      });
    } catch (err: any) {
      toast.error(err?.message ?? "تعذر الإرسال");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <section id={anchor} className="mb-16 scroll-mt-24">
      <Reveal>
        <div className="glass rounded-3xl p-6 md:p-10 border border-white/10 max-w-4xl mx-auto">
          <div className="text-center mb-8">
            {s.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{s.kicker}</div>}
            {s.heading && <h2 className="text-2xl md:text-3xl font-bold mb-3">{s.heading}</h2>}
            {s.description && <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed whitespace-pre-line">{s.description}</p>}
          </div>
          {sent ? (
            <div className="text-center py-8">
              <div className="mx-auto grid place-items-center h-14 w-14 rounded-full glass-gold mb-4">
                <CheckCircle2 size={26} className="text-gold" />
              </div>
              <p className="text-lg font-bold mb-2">{s.success_message || "تم استلام طلبك"}</p>
              <button type="button" onClick={() => setSent(false)} className="mt-4 btn-outline-gold rounded-xl px-4 py-2 text-xs">
                إرسال طلب آخر
              </button>
            </div>
          ) : preset === "business_visit" ? (
            <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
              <input className={inp} placeholder="اسم المنشأة *" value={form.facility_name}
                onChange={(e) => { set("facility_name", e.target.value); set("company", e.target.value); }} required />
              <input className={inp} placeholder="اسم المسؤول *" value={form.name} onChange={(e) => set("name", e.target.value)} required />
              <input className={inp} placeholder="رقم الجوال *" value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
              <select className={inp} value={form.facility_type}
                onChange={(e) => { set("facility_type", e.target.value); set("industry", e.target.value); }}>
                <option value="">نوع المنشأة</option>
                {(s.facility_types ?? []).map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
              </select>
              <input className={inp} placeholder="المدينة" value={form.city} onChange={(e) => set("city", e.target.value)} />
              <select className={inp} value={form.need_type} onChange={(e) => set("need_type", e.target.value)}>
                <option value="">نوع الاحتياج</option>
                {(s.need_types ?? []).map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
              </select>
              <select className={inp + " sm:col-span-2"} value={form.preferred_time} onChange={(e) => set("preferred_time", e.target.value)}>
                <option value="">الوقت المناسب للتواصل</option>
                {(s.preferred_times ?? []).map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
              </select>
              <textarea className={inp + " min-h-[120px] sm:col-span-2"} placeholder="ملاحظات / تفاصيل إضافية *"
                value={form.message} onChange={(e) => set("message", e.target.value)} required />
              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-gold" /> {s.contact_note || "بياناتك سرّية."}
                </div>
                <div className="flex gap-2">
                  {s.whatsapp_fallback_template && (
                    <a href={whatsappLink(s.whatsapp_fallback_template)} target="_blank" rel="noopener noreferrer"
                      className="btn-outline-gold rounded-xl px-5 py-2.5 text-sm inline-flex items-center gap-2">
                      <MessageCircle size={14} /> {s.whatsapp_fallback_label || "أو تواصل عبر واتساب"}
                    </a>
                  )}
                  <button type="submit" disabled={submitting}
                    className="btn-gold rounded-xl px-6 py-2.5 text-sm inline-flex items-center gap-2 disabled:opacity-60">
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                    {s.submit_label || "إرسال الطلب"}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
              <input className={inp} placeholder="الاسم الكامل *" value={form.name} onChange={(e) => set("name", e.target.value)} required />
              <input className={inp} placeholder="رقم الجوال *" value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
              <input className={inp} placeholder="البريد الإلكتروني" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              <input className={inp} placeholder="اسم الشركة / الجهة" value={form.company} onChange={(e) => set("company", e.target.value)} />
              <select className={inp} value={form.industry} onChange={(e) => set("industry", e.target.value)}>
                <option value="">القطاع</option>
                {s.industries.map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
              </select>
              <input className={inp} placeholder="المدينة" value={form.city} onChange={(e) => set("city", e.target.value)} />
              <select className={inp} value={form.budget} onChange={(e) => set("budget", e.target.value)}>
                <option value="">الميزانية التقريبية</option>
                {s.budgets.map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
              </select>
              <select className={inp} value={form.timeline} onChange={(e) => set("timeline", e.target.value)}>
                <option value="">الإطار الزمني</option>
                {s.timelines.map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
              </select>
              <textarea className={inp + " min-h-[120px] sm:col-span-2"} placeholder="تفاصيل المشروع / المتطلبات *"
                value={form.message} onChange={(e) => set("message", e.target.value)} required />
              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-gold" /> {s.contact_note || "بياناتك سرّية."}
                </div>
                <div className="flex gap-2">
                  {s.whatsapp_fallback_template && (
                    <a href={whatsappLink(s.whatsapp_fallback_template)} target="_blank" rel="noopener noreferrer"
                      className="btn-outline-gold rounded-xl px-5 py-2.5 text-sm inline-flex items-center gap-2">
                      <MessageCircle size={14} /> {s.whatsapp_fallback_label || "أو تواصل عبر واتساب"}
                    </a>
                  )}
                  <button type="submit" disabled={submitting}
                    className="btn-gold rounded-xl px-6 py-2.5 text-sm inline-flex items-center gap-2 disabled:opacity-60">
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                    {s.submit_label || "إرسال الطلب"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </Reveal>
    </section>
  );
}

function PortalMockupBlock({ section: s }: { section: PortalMockupSection }) {
  return (
    <section className="mb-16">
      <Reveal>
        <div className="text-center mb-8">
          {s.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{s.kicker}</div>}
          {s.heading && <h2 className="text-3xl sm:text-4xl font-bold mb-3">{s.heading}</h2>}
          {s.description && <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">{s.description}</p>}
        </div>
      </Reveal>
      <Reveal>
        <div className="glass rounded-3xl border border-white/10 overflow-hidden shadow-2xl max-w-5xl mx-auto">
          {/* fake window chrome */}
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10 bg-black/30">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
            <span className="ms-3 text-[11px] text-muted-foreground">portal.aqh.sa</span>
          </div>
          <div className="p-6 md:p-8 grid gap-6 md:grid-cols-[1.2fr_1fr]">
            {/* Left: hero card + score */}
            <div className="rounded-2xl glass-gold p-6 flex flex-col justify-between min-h-[220px]">
              <div>
                <div className="text-xs text-muted-foreground">{s.status_label || "حالة الحوض"}</div>
                <div className="text-2xl md:text-3xl font-bold mt-1">{s.status_value || "—"}</div>
                <div className="mt-4 text-xs text-muted-foreground">{s.last_visit_label || "آخر زيارة"}</div>
                <div className="text-sm font-bold mt-0.5">{s.last_visit_value || "—"}</div>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-[11px] text-muted-foreground">{s.score_label || "Health Score"}</div>
                  <div className="text-5xl font-black text-gradient-gold leading-none mt-1">{s.score_value || "—"}</div>
                </div>
                <div className="text-[11px] text-muted-foreground">/ 100</div>
              </div>
            </div>
            {/* Right: tiles */}
            <div className="grid grid-cols-2 gap-3">
              {s.tiles.map((t) => (
                <div key={t.id} className="rounded-2xl border border-white/10 p-4 bg-white/[0.02]">
                  <div className="grid place-items-center h-9 w-9 rounded-lg glass-gold mb-3">
                    <Icon name={t.icon} size={16} className="text-gold" />
                  </div>
                  <div className="text-xs text-muted-foreground">{t.label}</div>
                  <div className="text-sm font-bold mt-0.5">{t.value}</div>
                </div>
              ))}
            </div>
          </div>
          {s.note && (
            <div className="px-6 pb-4 text-[11px] text-muted-foreground text-center">{s.note}</div>
          )}
        </div>
      </Reveal>
    </section>
  );
}


function BusinessTabsBlock({ section }: { section: BusinessTabsSection }) {
  const [openId, setOpenId] = useState<string>(section.items[0]?.id ?? "");
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  if (!section.items.length) return null;
  const active = section.items.find((x) => x.id === openId) ?? section.items[0];
  return (
    <Reveal>
      <section className="mb-16">
        {(section.kicker || section.heading || section.description) && (
          <div className="text-center mb-10">
            {section.kicker && <div className="text-xs tracking-widest text-gradient-gold mb-3">{section.kicker}</div>}
            {section.heading && <h2 className="text-3xl sm:text-4xl font-bold mb-4">{section.heading}</h2>}
            {section.description && <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">{section.description}</p>}
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {section.items.map((s) => {
            const isOn = active.id === s.id;
            return (
              <button key={s.id} onClick={() => { setOpenId(s.id); setOpenFaq(null); }}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-all ${isOn ? "btn-gold" : "glass hover:glass-gold"}`}>
                <Icon name={s.icon} size={16} /> {s.title}
              </button>
            );
          })}
        </div>
        <div className="glass rounded-3xl p-6 md:p-10 space-y-10">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] items-start">
            <div>
              <div className="inline-flex items-center gap-2 glass-gold rounded-full px-3 py-1.5 text-xs mb-4">
                <Icon name={active.icon} size={14} className="text-gold" /> {(section.tab_badge_prefix ?? "قسم")} {active.title}
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-3">{active.tagline}</h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{active.idea}</p>
            </div>
            {active.images.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {active.images.map((img) => (
                  <img key={img.id} src={getImageUrl(img.path)} onError={onImageError} alt={active.title}
                    loading="lazy" className="h-40 sm:h-48 w-full object-cover rounded-2xl" />
                ))}
              </div>
            )}
          </div>
          {active.features.length > 0 && (
            <div>
              <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="h-1 w-6 rounded-full bg-[color:var(--gold)]" /> {section.features_heading ?? "ماذا نوفّر لك"}
              </h4>
              <ul className="grid gap-3 sm:grid-cols-2">
                {active.features.map((f) => (
                  <li key={f.id} className="flex items-start gap-2.5 glass rounded-xl px-4 py-3 text-sm border border-white/10">
                    <CheckCircle2 size={16} className="text-gold mt-0.5 shrink-0" />
                    <span className="text-foreground/90">{f.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {active.concerns.length > 0 && (
            <div>
              <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="h-1 w-6 rounded-full bg-[color:var(--gold)]" /> {section.concerns_heading ?? "أسئلة ومخاوف شائعة"}
              </h4>
              <div className="space-y-2">
                {active.concerns.map((c) => {
                  const open = openFaq === c.id;
                  return (
                    <div key={c.id} className="glass rounded-2xl overflow-hidden">
                      <button onClick={() => setOpenFaq(open ? null : c.id)}
                        className="w-full flex items-center justify-between gap-4 p-4 text-right">
                        <span className="font-bold text-sm">{c.q}</span>
                        <span className="grid place-items-center h-7 w-7 rounded-lg glass-gold shrink-0">
                          {open ? <Minus size={12} /> : <Plus size={12} />}
                        </span>
                      </button>
                      {open && <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{c.a}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {active.payment.length > 0 && (
            <div>
              <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="h-1 w-6 rounded-full bg-[color:var(--gold)]" /> {section.payment_heading ?? "طرق الدفع والاشتراك"}
              </h4>
              <ul className="grid gap-2 sm:grid-cols-2">
                {active.payment.map((p) => (
                  <li key={p.id} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] shrink-0" />
                    <span className="text-foreground/90 leading-relaxed">{p.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {active.cta && (
            <div className="gradient-border rounded-2xl p-6 text-center">
              <div className="font-bold mb-3">{section.cta_heading ?? "جاهز لمناقشة مشروعك؟"}</div>
              <a href={whatsappLink(active.cta)} target="_blank" rel="noopener noreferrer"
                className="btn-gold rounded-xl px-6 py-3 text-sm inline-flex items-center gap-2">
                <MessageCircle size={16} /> {section.cta_button_label ?? "تواصل عبر واتساب"}
              </a>
            </div>
          )}
        </div>
      </section>
    </Reveal>
  );
}

// ─── Dynamic slot registry ────────────────────────────────────────────────
const dynamicSlots: Record<string, () => ReactNode> = {};
export function registerDynamicSlot(key: string, render: () => ReactNode) {
  dynamicSlots[key] = render;
}

function FaqBlock({ heading, items }: { heading?: string; items: { id: string; q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Reveal>
      <section className="mb-16">
        {heading && <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">{heading}</h2>}
        <div className="space-y-3 max-w-3xl mx-auto">
          {items.map((f, i) => (
            <div key={f.id} className="glass rounded-2xl overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)}
                className="w-full p-5 flex items-center justify-between gap-3 text-right">
                <span className="font-bold text-sm">{f.q}</span>
                <ChevronDown size={16} className={`shrink-0 transition ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{f.a}</div>}
            </div>
          ))}
        </div>
      </section>
    </Reveal>
  );
}

/** Renders sections only — no outer wrapper. For embedding inside hybrid pages. */
export function PageSections({ doc }: { doc: PageDoc }) {
  return <>{doc.sections.map((s) => renderSection(s))}</>;
}

/** Full-page renderer with standard wrapper. */
export function PageRenderer({ doc }: { doc: PageDoc }) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <PageSections doc={doc} />
    </div>
  );
}

/**
 * Hybrid slot: fetches CMS doc by pageKey and renders sections only.
 * Used inside existing layouts to inject editable Hero/CTA/etc.
 */
export function CmsSlot({ pageKey }: { pageKey: string }) {
  const { doc } = usePageDoc(pageKey);
  const fallback = getPageMeta(pageKey)?.defaults ?? { sections: [] };
  return <PageSections doc={doc ?? fallback} />;
}

