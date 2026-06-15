import { createFileRoute, Link, redirect, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getImageUrl, onImageError } from "@/lib/storage";
import { whatsappLink } from "@/components/WhatsAppButton";
import { Reveal } from "@/components/Reveal";
import * as Icons from "lucide-react";
import { ArrowRight, CheckCircle2, MessageCircle, ChevronDown } from "lucide-react";

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
