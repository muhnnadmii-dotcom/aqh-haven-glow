import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getImageUrl, onImageError } from "@/lib/storage";
import { whatsappLink } from "@/components/WhatsAppButton";
import { Reveal } from "@/components/Reveal";
import { CmsSlot, registerDynamicSlot } from "@/lib/cms/PageRenderer";
import * as Icons from "lucide-react";
import { CheckCircle2 } from "lucide-react";

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

function ServicesGrid() {
  const list = Route.useLoaderData().list as Svc[];
  if (list.length === 0) return null;
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-16 items-stretch">
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
  );
}

// Register the dynamic slot so the CMS renderer can place the grid wherever admin orders it.
registerDynamicSlot("services_grid", () => <ServicesGrid />);

function ServicesIndex() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <CmsSlot pageKey="services_index" />
    </div>
  );
}
