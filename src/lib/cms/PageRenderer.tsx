import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import * as Icons from "lucide-react";
import { CheckCircle2, MessageCircle, ChevronDown, ArrowLeft, Plus, Minus } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { whatsappLink } from "@/components/WhatsAppButton";
import { getImageUrl, onImageError } from "@/lib/storage";
import { usePageDoc } from "./api";
import { getPageMeta } from "./registry";
import type { Section, PageDoc, BusinessTabsSection } from "./types";


function Icon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  const Cmp = (Icons as any)[name] ?? Icons.Sparkles;
  return <Cmp size={size} className={className} />;
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
      return (
        <div key={s.id} className="grid gap-3 sm:grid-cols-3 mb-12 max-w-3xl mx-auto">
          {s.items.map((b, i) => (
            <Reveal key={b.id} delay={i * 80}>
              <div className="glass rounded-2xl p-5 text-center">
                <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl glass-gold mb-3">
                  <Icon name={b.icon} size={20} className="text-gold" />
                </div>
                <div className="font-bold mb-1">{b.title}</div>
                <div className="text-xs text-muted-foreground">{b.desc}</div>
              </div>
            </Reveal>
          ))}
        </div>
      );

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
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {g.tiers.map((tier) => {
                    const msg = s.whatsapp_template
                      .replace("{group}", g.heading)
                      .replace("{tier}", tier.size);
                    return (
                      <div key={tier.id} className="glass rounded-2xl p-5 hover:glass-gold transition flex flex-col">
                        <div className="text-xs text-gradient-gold mb-2">{g.heading}</div>
                        <h3 className="font-bold mb-2 text-sm">{tier.size}</h3>
                        <div className="text-xl font-bold text-gradient-gold mb-1">{tier.price}</div>
                        <div className="text-xs text-muted-foreground mb-4">{tier.freq}</div>
                        <a href={whatsappLink(msg)} target="_blank" rel="noopener noreferrer"
                          className="mt-auto btn-outline-gold rounded-xl px-4 py-2.5 text-xs text-center inline-flex justify-center">
                          {s.cta_label || "اطلب الآن"}
                        </a>
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
      const cols = Math.max(2, Math.min(5, s.columns ?? 5));
      const colsCls = ({ 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" } as Record<number, string>)[cols];
      return (
        <Reveal key={s.id}>
          <section className="mb-16">
            {(s.heading || s.subheading) && (
              <div className="text-center mb-8">
                {s.heading && <h2 className="text-2xl md:text-3xl font-bold mb-2">{s.heading}</h2>}
                {s.subheading && <p className="text-muted-foreground text-sm">{s.subheading}</p>}
              </div>
            )}
            <div className={`grid gap-3 sm:grid-cols-2 ${colsCls}`}>
              {s.items.map((o) => {
                const isExternal = /^https?:\/\//.test(o.href) || o.href.startsWith("mailto:") || o.href.startsWith("tel:");
                const cls = "glass rounded-2xl p-4 hover:glass-gold transition flex flex-col";
                const inner: ReactNode = (
                  <>
                    <div className="font-bold text-sm mb-1.5">{o.title}</div>
                    {o.desc && <div className="text-xs text-muted-foreground flex-1">{o.desc}</div>}
                    <span className="inline-flex items-center gap-1 text-xs text-gradient-gold mt-3">انتقل <ArrowLeft size={12} /></span>
                  </>
                );
                return isExternal ? (
                  <a key={o.id} href={o.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
                ) : (
                  <a key={o.id} href={o.href} className={cls}>{inner}</a>
                );
              })}
            </div>
          </section>
        </Reveal>
      );
    }

    case "step_list":
      if (!s.items.length) return null;
      return (
        <Reveal key={s.id}>
          <section className="glass rounded-3xl p-8 md:p-10 mb-16">
            {s.heading && <h2 className="text-2xl font-bold text-center mb-8">{s.heading}</h2>}
            <div className={`grid gap-4 sm:grid-cols-2 ${s.items.length >= 5 ? "lg:grid-cols-5" : s.items.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
              {s.items.map((it, i) => (
                <div key={it.id} className="text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full glass-gold text-gold font-bold mb-3">{i + 1}</div>
                  <div className="text-sm">{it.text}</div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      );

    case "faq":
      if (!s.items.length) return null;
      return <FaqBlock key={s.id} heading={s.heading} items={s.items} />;

    case "dynamic_slot": {
      const R = dynamicSlots[s.slot];
      return R ? <div key={s.id}>{R()}</div> : null;
    }

    case "business_tabs":
      return <BusinessTabsBlock key={s.id} section={s} />;
  }
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
                <Icon name={active.icon} size={14} className="text-gold" /> قسم {active.title}
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
                <span className="h-1 w-6 rounded-full bg-[color:var(--gold)]" /> ماذا نوفّر لك
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
                <span className="h-1 w-6 rounded-full bg-[color:var(--gold)]" /> أسئلة ومخاوف شائعة
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
                <span className="h-1 w-6 rounded-full bg-[color:var(--gold)]" /> طرق الدفع والاشتراك
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
              <div className="font-bold mb-3">جاهز لمناقشة مشروعك؟</div>
              <a href={whatsappLink(active.cta)} target="_blank" rel="noopener noreferrer"
                className="btn-gold rounded-xl px-6 py-3 text-sm inline-flex items-center gap-2">
                <MessageCircle size={16} /> تواصل عبر واتساب
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

