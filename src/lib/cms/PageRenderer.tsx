import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import * as Icons from "lucide-react";
import { CheckCircle2, MessageCircle, ChevronDown, ArrowLeft } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { whatsappLink } from "@/components/WhatsAppButton";
import { getImageUrl, onImageError } from "@/lib/storage";
import { usePageDoc } from "./api";
import { getPageMeta } from "./registry";
import type { Section, PageDoc } from "./types";


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
  }
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
