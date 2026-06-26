import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia, publicUrl, onImageError } from "@/lib/storage";
import { whatsappLink } from "@/components/WhatsAppButton";
import { Reveal } from "@/components/Reveal";
import { CmsSlot } from "@/lib/cms/PageRenderer";
import { toast } from "sonner";
import {
  ArrowDown, ArrowLeft, CheckCircle2, ChevronDown, MessageCircle, Loader2,
  Home, Building2, Coffee, Stethoscope, Briefcase, MapPin, Ruler, Wallet,
  Camera, Wrench, Clock, Sparkles, Fish, Leaf, Waves, Box, Upload, X,
} from "lucide-react";

const SLUG = "custom-aquariums";
const BASE = "https://aqh-haven-glow.lovable.app";

// =====================================================================
// ROUTE
// =====================================================================

export const Route = createFileRoute("/services/custom-aquariums")({
  loader: async () => {
    const { data } = await supabase
      .from("projects")
      .select("id,slug,title,cover,cover_path,image_paths,images,location,tank_type,volume_liters")
      .eq("published", true)
      .order("sort_order")
      .order("created_at", { ascending: false })
      .limit(6);
    const projects = (data ?? []).map((p: any) => {
      const cover =
        p.cover_path ||
        (Array.isArray(p.image_paths) && p.image_paths[0]) ||
        p.cover ||
        (Array.isArray(p.images) && p.images[0]) ||
        null;
      return {
        id: p.id as string,
        slug: (p.slug as string) ?? null,
        title: (p.title as string) ?? "",
        cover: cover as string | null,
        location: (p.location as string) ?? null,
        tank_type: (p.tank_type as string) ?? null,
        volume_liters: (p.volume_liters as number) ?? null,
      };
    });
    return { projects };
  },
  head: () => ({
    meta: [
      { title: "تصميم وتركيب أحواض مخصصة | Aqua Haven" },
      {
        name: "description",
        content:
          "صمم حوضك المائي حسب المساحة والذوق مع Aqua Haven. خدمة تصميم وتركيب أحواض مائية للمنازل والمكاتب والمشاريع التجارية من الفكرة إلى التشغيل.",
      },
      { property: "og:title", content: "تصميم وتركيب أحواض مخصصة | Aqua Haven" },
      {
        property: "og:description",
        content:
          "خدمة تصميم وتركيب أحواض مخصصة: ندرس المساحة، نقترح النظام المناسب، وننفذ الحوض جاهزًا للتشغيل.",
      },
      { property: "og:url", content: `${BASE}/services/${SLUG}` },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${BASE}/services/${SLUG}` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "تصميم وتركيب أحواض مخصصة",
          provider: { "@type": "Organization", name: "Aqua Haven" },
          areaServed: "SA",
          description:
            "خدمة تصميم وتركيب أحواض مائية مخصصة للمنازل والمكاتب والمشاريع التجارية.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: CustomAquariumsPage,
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-24 text-center">
      <p className="text-muted-foreground mb-3">تعذر تحميل الصفحة.</p>
      <Link to="/services" className="text-gradient-gold">رجوع للخدمات</Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-24 text-center">
      <Link to="/services" className="text-gradient-gold">رجوع للخدمات</Link>
    </div>
  ),
});

// =====================================================================
// STATIC CONTENT
// =====================================================================

const TRUST = [
  "تصميم حسب المساحة",
  "اختيار معدات مناسبة",
  "تركيب وتشغيل كامل",
  "متابعة بعد التسليم",
];

const IDEA_STEPS = [
  { t: "ندرس المساحة", d: "نراجع الصور والمقاسات وطبيعة المكان." },
  { t: "نقترح النظام المناسب", d: "نوع الحوض، المقاس، المعدات، والكائنات." },
  { t: "ننفذ ونسلم الحوض جاهزًا", d: "تركيب وتشغيل، ثم شرح طريقة العناية." },
];

const AUDIENCE = [
  { i: Home, t: "من يريد حوضًا جديدًا بدون تعقيد." },
  { i: Ruler, t: "من لا يعرف المقاس أو المعدات المناسبة." },
  { i: Sparkles, t: "من يريد حوضًا يناسب ديكور البيت أو المكتب." },
  { i: Leaf, t: "من يريد حوضًا نباتيًا أو نهريًا أو بحريًا أو نانو." },
  { i: Wrench, t: "من يريد تنفيذًا كاملًا من الفكرة إلى التشغيل." },
  { i: Briefcase, t: "من يريد حوضًا لمشروع تجاري أو مساحة استقبال." },
];

const INCLUDES = [
  "استشارة مبدئية لفهم المساحة والاحتياج",
  "اقتراح نوع الحوض المناسب",
  "تحديد المقاس المناسب حسب المكان",
  "اختيار نوع النظام: نهري / نباتي / بحري / نانو",
  "اختيار الفلتر، الإضاءة، السخان، والمعدات الأساسية",
  "تصميم الديكور الداخلي",
  "اختيار الأسماك أو النباتات أو الكائنات المناسبة",
  "التركيب والتشغيل",
  "شرح طريقة العناية بعد التسليم",
  "متابعة مبدئية بعد التنفيذ",
];

const TANK_TYPES = [
  { id: "planted", t: "أحواض نباتية", d: "تصاميم طبيعية بالنباتات الحية، مناسبة للمنازل والمكاتب ومحبي المنظر الهادئ.", i: Leaf },
  { id: "river", t: "أحواض نهريّة", d: "أحواض أسماك نهريّة بتجهيزات عملية وخيارات مناسبة للمبتدئين.", i: Fish },
  { id: "marine", t: "أحواض بحرية", d: "أنظمة بحرية بتصميم فاخر واختيار دقيق للمعدات والكائنات.", i: Waves },
  { id: "nano_reef", t: "نانو ريف", d: "أحواض بحرية صغيرة بمظهر فخم للمساحات المحدودة.", i: Box },
  { id: "office", t: "أحواض مكاتب ومجالس", d: "تصاميم تناسب الديكور وتضيف حضورًا بصريًا للمكان.", i: Building2 },
  { id: "commercial", t: "أحواض مشاريع تجارية", d: "حلول للكافيهات، المطاعم، العيادات، المعارض، وصالات الانتظار.", i: Briefcase },
];

const PROCESS = [
  "ترسل لنا صورة المكان أو الفكرة.",
  "نراجع المساحة والاحتياج.",
  "نقترح نوع النظام والمقاس المناسب.",
  "نعطيك تصورًا مبدئيًا وتكلفة تقريبية.",
  "نجهز المعدات والمواد.",
  "ننفذ التركيب والتشغيل.",
  "نسلمك تعليمات العناية والمتابعة.",
];

const NEEDS = [
  "صورة للمكان.",
  "المقاس التقريبي للمساحة.",
  "المدينة والحي.",
  "نوع الحوض المطلوب إن وجد.",
  "الميزانية التقريبية.",
  "هل يوجد حوض حالي؟",
  "هل تريد صيانة بعد التركيب؟",
  "أي صورة إلهام أو تصميم أعجبك.",
];

const FAQS = [
  { q: "كم يستغرق تنفيذ الحوض؟", a: "يختلف حسب حجم الحوض ونوع النظام. غالبًا من أيام إلى أسابيع، ونحدد جدولًا واضحًا بعد الاتفاق." },
  { q: "هل أحتاج خبرة للعناية بالحوض؟", a: "لا. نُسلّمك الحوض جاهزًا للتشغيل ونشرح لك خطوات العناية الأساسية بطريقة بسيطة." },
  { q: "هل توفرون الصيانة بعد التركيب؟", a: "نعم، نقدّم باقات صيانة دورية اختيارية بعد التسليم." },
  { q: "هل أقدر أختار شكل التصميم؟", a: "بالتأكيد. نأخذ ذوقك ومرجعك البصري بعين الاعتبار قبل اقتراح التصميم." },
  { q: "وش الأفضل لي: نهري أو بحري؟", a: "يعتمد على مستوى العناية المطلوب والميزانية. نقترح لك الأنسب بعد فهم احتياجك." },
  { q: "هل الحوض يحتاج عناية يومية؟", a: "أغلب الأنظمة تحتاج إجراءات بسيطة جدًا يوميًا، وصيانة دورية كل فترة." },
  { q: "هل توفرون الأسماك والنباتات؟", a: "نعم، نختار الكائنات المناسبة لنظام الحوض ونرتب تجهيزها." },
  { q: "هل يمكن تنفيذ الحوض حسب مساحة معينة؟", a: "نعم، نصمم الحوض بمقاسات وأشكال تناسب مكانك بدقة." },
  { q: "هل أقدر أرسل صورة فقط وتحددون المناسب؟", a: "نعم، أرسل صورة المكان وسنقترح الحل المناسب." },
  { q: "هل السعر ثابت؟", a: "السعر يختلف حسب الحجم، النظام، المعدات، والكائنات. نقدم تقديرًا واضحًا بعد فهم التفاصيل." },
];

// =====================================================================
// PAGE
// =====================================================================

type FormPrefill = { tank_type?: string; reference_project?: string };

function CustomAquariumsPage() {
  const data = Route.useLoaderData();
  const projects = data.projects;
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [prefill, setPrefill] = useState<FormPrefill>({});
  const formRef = useRef<HTMLDivElement>(null);

  // Prefill from URL (e.g. coming from gallery "أبغى مثل هذا")
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const ref_title = sp.get("ref_title");
    const tank_type = sp.get("tank_type");
    const extra: FormPrefill = {};
    if (ref_title) extra.reference_project = ref_title;
    if (tank_type) extra.tank_type = tank_type;
    if (Object.keys(extra).length) {
      setPrefill((p) => ({ ...p, ...extra }));
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } else if (window.location.hash === "#request-form") {
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, []);

  const scrollToForm = (extra?: FormPrefill) => {
    if (extra) setPrefill((p) => ({ ...p, ...extra }));
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-6 py-10 sm:py-14">
      {/* breadcrumb */}
      <Link to="/services" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-gold mb-6">
        <ArrowLeft size={12} /> رجوع للخدمات
      </Link>

      <CmsSlot pageKey="service_custom" />



      {/* HERO */}
      <Reveal>
        <section className="relative overflow-hidden rounded-3xl glass-gold p-8 sm:p-12 mb-12">
          <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-gold/10 via-transparent to-cyan-500/10 pointer-events-none" />
          <div className="relative max-w-3xl">
            <div className="text-xs tracking-widest text-gradient-gold mb-3">SERVICE</div>
            <h1 className="text-3xl sm:text-5xl font-bold mb-4 leading-tight">
              تصميم وتركيب أحواض مخصصة
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mb-6">
              نصمم وننفذ أحواضًا مائية تناسب مساحتك وذوقك، من دراسة الفكرة واختيار المقاس إلى التركيب والتشغيل والتسليم النهائي.
            </p>
            <div className="flex flex-wrap gap-3 mb-6">
              <button onClick={() => scrollToForm()} className="btn-gold rounded-xl px-6 py-3 text-sm inline-flex items-center gap-2">
                <ArrowDown size={16} /> ابدأ طلب التصميم
              </button>
              <a href="#similar-work" className="btn-outline-gold rounded-xl px-6 py-3 text-sm inline-flex items-center gap-2">
                شاهد أعمال مشابهة
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-foreground/80">
              {TRUST.map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-gold" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </Reveal>

      {/* IDEA */}
      <Reveal>
        <section className="mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 text-center">
            أنت تعطينا المساحة والفكرة، ونحن نبني لك الحوض المناسب.
          </h2>
          <p className="text-muted-foreground text-center max-w-3xl mx-auto mb-7 text-sm leading-relaxed">
            سواء كنت تريد حوضًا هادئًا للمجلس، حوضًا نباتيًا للمكتب، أو نظامًا بحريًا فاخرًا — نساعدك في اختيار المقاس، نوع النظام، المعدات، الديكور، والكائنات المناسبة حتى تحصل على حوض جميل ومستقر وسهل العناية.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {IDEA_STEPS.map((s, i) => (
              <div key={s.t} className="glass rounded-2xl p-5">
                <div className="grid h-9 w-9 place-items-center rounded-full glass-gold text-gold font-bold mb-3">{i + 1}</div>
                <div className="font-bold mb-1">{s.t}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* AUDIENCE */}
      <Reveal>
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold mb-5">لمن هذه الخدمة؟</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCE.map((a, i) => (
              <div key={i} className="glass rounded-2xl p-4 flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl glass-gold shrink-0">
                  <a.i size={18} className="text-gold" />
                </div>
                <div className="text-sm leading-relaxed pt-1">{a.t}</div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* INCLUDES */}
      <Reveal>
        <section className="glass rounded-3xl p-7 sm:p-9 mb-12">
          <h2 className="text-xl sm:text-2xl font-bold mb-5">ماذا تشمل الخدمة؟</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {INCLUDES.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 size={16} className="text-gold mt-0.5 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>
      </Reveal>

      {/* TANK TYPES */}
      <Reveal>
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold mb-5">أنواع الأحواض التي ننفذها</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TANK_TYPES.map((c) => (
              <article key={c.id} className="glass rounded-2xl p-5 flex flex-col">
                <div className="grid h-11 w-11 place-items-center rounded-xl glass-gold mb-3">
                  <c.i size={20} className="text-gold" />
                </div>
                <h3 className="font-bold mb-1">{c.t}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed flex-1 mb-4">{c.d}</p>
                <button
                  onClick={() => scrollToForm({ tank_type: c.id })}
                  className="btn-outline-gold rounded-xl px-3 py-2 text-xs inline-flex items-center justify-center gap-1"
                >
                  أطلب هذا النوع <ArrowDown size={12} />
                </button>
              </article>
            ))}
          </div>
        </section>
      </Reveal>

      {/* PROCESS */}
      <Reveal>
        <section className="glass rounded-3xl p-7 sm:p-9 mb-12">
          <h2 className="text-xl sm:text-2xl font-bold mb-6">طريقة العمل</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS.map((s, i) => (
              <li key={s} className="flex items-start gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full glass-gold text-gold font-bold shrink-0">{i + 1}</div>
                <div className="text-sm pt-1.5">{s}</div>
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      {/* NEEDS */}
      <Reveal>
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold mb-5">ماذا نحتاج منك؟</h2>
          <div className="glass rounded-2xl p-6">
            <ul className="grid gap-2 sm:grid-cols-2">
              {NEEDS.map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 size={14} className="text-gold mt-0.5 shrink-0" /> <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-4">
              كلما كانت الصور والمعلومات أوضح، قدرنا نعطيك اقتراحًا أدق.
            </p>
          </div>
        </section>
      </Reveal>

      {/* SIMILAR WORK */}
      {projects.length > 0 && (
        <Reveal>
          <section id="similar-work" className="mb-12 scroll-mt-24">
            <div className="flex items-end justify-between mb-5 flex-wrap gap-2">
              <h2 className="text-xl sm:text-2xl font-bold">أعمال مشابهة</h2>
              <Link to="/portfolio" className="text-xs text-gradient-gold inline-flex items-center gap-1">
                كل الأعمال <ArrowLeft size={12} />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p: any) => (
                <article key={p.id} className="glass rounded-2xl overflow-hidden flex flex-col">
                  <div className="relative aspect-square bg-white/5 overflow-hidden">
                    <img
                      src={publicUrl(p.cover)}
                      alt={p.title}
                      loading="lazy"
                      onError={onImageError}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-sm mb-1.5 line-clamp-1">{p.title}</h3>
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground mb-3">
                      {p.tank_type && <span className="px-2 py-0.5 rounded-full bg-white/5">{tankLabel(p.tank_type)}</span>}
                      {p.volume_liters && <span className="px-2 py-0.5 rounded-full bg-white/5">{p.volume_liters} لتر</span>}
                      {p.location && <span className="inline-flex items-center gap-1"><MapPin size={10} /> {p.location}</span>}
                    </div>
                    <button
                      onClick={() => scrollToForm({ reference_project: p.title })}
                      className="mt-auto btn-outline-gold rounded-xl px-3 py-2 text-xs inline-flex items-center justify-center gap-1"
                    >
                      أبغى مثل هذا <ArrowDown size={12} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {/* FAQ */}
      <Reveal>
        <section className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold mb-5">أسئلة شائعة</h2>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <div key={i} className="glass rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full p-5 flex items-center justify-between gap-3 text-right"
                  type="button"
                >
                  <span className="font-bold text-sm">{f.q}</span>
                  <ChevronDown size={16} className={`shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* CTA BEFORE FORM */}
      <Reveal>
        <section className="gradient-border rounded-3xl p-8 sm:p-10 text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">جاهز تبدأ تصميم حوضك؟</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto text-sm">
            عبّئ الطلب التالي، وسنراجع التفاصيل ونقترح لك الحل المناسب حسب المساحة والميزانية ونوع الحوض.
          </p>
          <button onClick={() => scrollToForm()} className="btn-gold rounded-xl px-6 py-3 text-sm inline-flex items-center gap-2">
            ابدأ الطلب الآن <ArrowDown size={14} />
          </button>
        </section>
      </Reveal>

      {/* FORM */}
      <div ref={formRef} id="request-form" className="scroll-mt-24">
        <DesignRequestForm prefill={prefill} />
      </div>
    </div>
  );
}

function tankLabel(t: string): string {
  return TANK_TYPES.find((x) => x.id === t)?.t ?? t;
}

// =====================================================================
// MULTI-STEP FORM
// =====================================================================

type ContactMethod = "whatsapp" | "call" | "message";
type PlaceType = "home" | "majlis" | "office" | "cafe" | "clinic" | "shop" | "other";
type TankTypeId = "planted" | "river" | "marine" | "nano_reef" | "decor" | "unsure";
type Budget = "lt1k" | "1k_3k" | "3k_7k" | "gt7k" | "estimate";
type Existing = "no" | "yes";
type Maintenance = "monthly" | "later" | "no";
type ContactTime = "today" | "24h" | "week" | "custom";

type FormState = {
  // step 1
  name: string;
  phone: string;
  city: string;
  neighborhood: string;
  preferred_contact: ContactMethod;
  // step 2
  place_type: PlaceType | "";
  place_type_other: string;
  // step 3
  tank_type: TankTypeId | "";
  // step 4
  knows_dimensions: "yes" | "no" | "";
  length_cm: string;
  width_cm: string;
  height_cm: string;
  liters: string;
  // step 5
  budget: Budget | "";
  // step 6
  has_existing_tank: Existing | "";
  existing_tank_notes: string;
  existing_tank_images: string[];
  // step 7
  place_images: string[];
  // step 8
  idea_description: string;
  // step 9
  wants_maintenance: Maintenance | "";
  // step 10
  contact_time: ContactTime | "";
  contact_time_custom: string;
};

const INITIAL_FORM: FormState = {
  name: "", phone: "", city: "", neighborhood: "", preferred_contact: "whatsapp",
  place_type: "", place_type_other: "",
  tank_type: "",
  knows_dimensions: "", length_cm: "", width_cm: "", height_cm: "", liters: "",
  budget: "",
  has_existing_tank: "", existing_tank_notes: "", existing_tank_images: [],
  place_images: [],
  idea_description: "",
  wants_maintenance: "",
  contact_time: "", contact_time_custom: "",
};

const TOTAL_STEPS = 10;

const FORM_INPUT_CLS =
  "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:border-gold/60";

function DesignRequestForm({ prefill }: { prefill: FormPrefill }) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [step, setStep] = useState(1);
  const [reference, setReference] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ summary: string } | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, []);

  // Apply prefill from cards (tank_type / reference project)
  useEffect(() => {
    if (prefill.tank_type) {
      setForm((f) => ({ ...f, tank_type: prefill.tank_type as TankTypeId }));
    }
    if (prefill.reference_project) {
      setReference(prefill.reference_project);
    }
  }, [prefill.tank_type, prefill.reference_project]);

  // Auto-calc liters
  useEffect(() => {
    const L = parseFloat(form.length_cm);
    const W = parseFloat(form.width_cm);
    const H = parseFloat(form.height_cm);
    if (!isNaN(L) && !isNaN(W) && !isNaN(H) && L > 0 && W > 0 && H > 0) {
      const v = Math.round((L * W * H) / 1000);
      setForm((f) => (f.liters === String(v) ? f : { ...f, liters: String(v) }));
    }
  }, [form.length_cm, form.width_cm, form.height_cm]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const stepErrors = useMemo(() => validateStep(step, form), [step, form]);

  const next = () => {
    if (stepErrors.length) return;
    setStep((s) => Math.min(TOTAL_STEPS + 1, s + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const details = {
        request_subtype: "custom_aquarium",
        source: "services/custom-aquariums",
        neighborhood: form.neighborhood || null,
        preferred_contact: form.preferred_contact,
        place_type: form.place_type,
        place_type_other: form.place_type === "other" ? form.place_type_other : null,
        tank_type: form.tank_type,
        knows_dimensions: form.knows_dimensions === "yes",
        length_cm: numOrNull(form.length_cm),
        width_cm: numOrNull(form.width_cm),
        height_cm: numOrNull(form.height_cm),
        liters: numOrNull(form.liters),
        budget: form.budget,
        has_existing_tank: form.has_existing_tank === "yes",
        existing_tank_notes: form.has_existing_tank === "yes" ? form.existing_tank_notes || null : null,
        existing_tank_images: form.has_existing_tank === "yes" ? form.existing_tank_images : [],
        place_images: form.place_images,
        idea_description: form.idea_description || null,
        wants_maintenance: form.wants_maintenance,
        contact_time: form.contact_time,
        contact_time_custom: form.contact_time === "custom" ? form.contact_time_custom || null : null,
        reference_project: reference,
      };
      const attachments = [...form.place_images, ...form.existing_tank_images];

      const { data: sess } = await supabase.auth.getSession();
      const user_id = sess.session?.user?.id ?? null;
      if (!user_id) {
        toast.error("يرجى تسجيل الدخول لإرسال الطلب.");
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/auth?next=${next}`;
        return;
      }

      const { error } = await supabase.from("service_requests").insert({
        type: "design",
        name: form.name.trim(),
        phone: form.phone.trim(),
        city: form.city.trim() || null,
        details,
        attachments,
        customer_notes: form.idea_description || null,
        preferred_times:
          form.contact_time === "custom"
            ? form.contact_time_custom
            : contactTimeLabel(form.contact_time as ContactTime),
        user_id,
      } as any);
      if (error) throw error;

      const summary = buildSummary(form, reference);
      setSuccess({ summary });
      window.scrollTo({ top: (document.getElementById("request-form")?.offsetTop ?? 0) - 80, behavior: "smooth" });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر إرسال الطلب، حاول مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return <SuccessCard summary={success.summary} />;
  }

  return (
    <section className="glass rounded-3xl p-6 sm:p-8">
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg sm:text-xl font-bold">طلب تصميم وتركيب حوض مخصص</h2>
          <span className="text-xs text-muted-foreground">
            {step <= TOTAL_STEPS ? `الخطوة ${step} من ${TOTAL_STEPS}` : "مراجعة"}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-l from-gold to-amber-500 transition-all"
            style={{ width: `${(Math.min(step, TOTAL_STEPS + 1) / (TOTAL_STEPS + 1)) * 100}%` }}
          />
        </div>
        {reference && step <= TOTAL_STEPS && (
          <div className="mt-3 text-xs glass-gold rounded-xl px-3 py-2 inline-block">
            مرجع من الأعمال: <b>{reference}</b>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {step === 1 && <Step1 form={form} set={set} errors={stepErrors} />}
        {step === 2 && <Step2 form={form} set={set} errors={stepErrors} />}
        {step === 3 && <Step3 form={form} set={set} errors={stepErrors} />}
        {step === 4 && <Step4 form={form} set={set} errors={stepErrors} />}
        {step === 5 && <Step5 form={form} set={set} errors={stepErrors} />}
        {step === 6 && <Step6 form={form} set={set} errors={stepErrors} authed={authed} />}
        {step === 7 && <Step7 form={form} set={set} errors={stepErrors} authed={authed} />}
        {step === 8 && <Step8 form={form} set={set} errors={stepErrors} />}
        {step === 9 && <Step9 form={form} set={set} errors={stepErrors} />}
        {step === 10 && <Step10 form={form} set={set} errors={stepErrors} />}
        {step === TOTAL_STEPS + 1 && <ReviewStep form={form} reference={reference} />}
      </div>

      {stepErrors.length > 0 && (
        <ul className="mt-4 text-xs text-rose-300 space-y-1">
          {stepErrors.map((e) => <li key={e}>• {e}</li>)}
        </ul>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={back}
          disabled={step === 1 || submitting}
          className="rounded-xl px-4 py-2.5 text-sm bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40"
        >
          السابق
        </button>
        {step <= TOTAL_STEPS ? (
          <button
            type="button"
            onClick={next}
            disabled={stepErrors.length > 0}
            className="btn-gold rounded-xl px-6 py-2.5 text-sm disabled:opacity-50"
          >
            التالي
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-gold rounded-xl px-6 py-2.5 text-sm inline-flex items-center gap-2 disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "جاري الإرسال..." : "إرسال طلب التصميم"}
          </button>
        )}
      </div>
      {step === TOTAL_STEPS + 1 && (
        <p className="mt-3 text-xs text-muted-foreground text-center">سنراجع التفاصيل ونتواصل معك قريبًا.</p>
      )}
    </section>
  );
}

// =====================================================================
// FORM HELPERS
// =====================================================================

function numOrNull(v: string): number | null {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function validateStep(step: number, f: FormState): string[] {
  const errs: string[] = [];
  if (step === 1) {
    if (!f.name.trim()) errs.push("الاسم مطلوب");
    if (!validPhone(f.phone)) errs.push("رقم الجوال غير صحيح");
    if (!f.city.trim()) errs.push("المدينة مطلوبة");
  }
  if (step === 2) {
    if (!f.place_type) errs.push("اختر نوع المكان");
    if (f.place_type === "other" && !f.place_type_other.trim()) errs.push("اكتب نوع المكان");
  }
  if (step === 3 && !f.tank_type) errs.push("اختر نوع الحوض");
  if (step === 4) {
    if (!f.knows_dimensions) errs.push("اختر إذا كنت تعرف المقاسات");
    if (f.knows_dimensions === "yes") {
      if (!numOrNull(f.length_cm)) errs.push("الطول مطلوب");
      if (!numOrNull(f.width_cm)) errs.push("العرض مطلوب");
      if (!numOrNull(f.height_cm)) errs.push("الارتفاع مطلوب");
    }
  }
  if (step === 5 && !f.budget) errs.push("اختر الميزانية");
  if (step === 6 && !f.has_existing_tank) errs.push("اختر إن كان هناك حوض حالي");
  if (step === 9 && !f.wants_maintenance) errs.push("اختر تفضيل الصيانة");
  if (step === 10) {
    if (!f.contact_time) errs.push("اختر وقت التواصل");
    if (f.contact_time === "custom" && !f.contact_time_custom.trim()) errs.push("اكتب الوقت المناسب");
  }
  return errs;
}

function validPhone(v: string): boolean {
  const cleaned = v.replace(/[\s-]/g, "");
  // Saudi-friendly: 05XXXXXXXX, +9665XXXXXXXX, 9665XXXXXXXX, or 7+ digits intl
  return /^(\+?966|00966)?5\d{8}$/.test(cleaned) || /^05\d{8}$/.test(cleaned) || /^\+?\d{8,15}$/.test(cleaned);
}

const PLACE_LABEL: Record<PlaceType, string> = {
  home: "منزل", majlis: "مجلس", office: "مكتب",
  cafe: "كافيه / مطعم", clinic: "عيادة / استقبال", shop: "معرض / محل", other: "أخرى",
};
const BUDGET_LABEL: Record<Budget, string> = {
  lt1k: "أقل من 1000 ريال",
  "1k_3k": "1000 إلى 3000 ريال",
  "3k_7k": "3000 إلى 7000 ريال",
  gt7k: "أكثر من 7000 ريال",
  estimate: "أحتاج تقدير بعد المراجعة",
};
const MAINT_LABEL: Record<Maintenance, string> = {
  monthly: "نعم، أحتاج صيانة شهرية",
  later: "ربما لاحقًا",
  no: "لا",
};
const CONTACT_TIME_LABEL: Record<ContactTime, string> = {
  today: "اليوم",
  "24h": "خلال 24 ساعة",
  week: "هذا الأسبوع",
  custom: "وقت محدد",
};
function contactTimeLabel(t: ContactTime | "" | null) {
  if (!t) return null;
  return CONTACT_TIME_LABEL[t];
}
const TANK_LABEL: Record<TankTypeId, string> = {
  planted: "حوض نباتي",
  river: "حوض نهري",
  marine: "حوض بحري",
  nano_reef: "نانو ريف",
  decor: "حوض ديكوري بسيط",
  unsure: "لا أعرف، أحتاج اقتراح",
};

// =====================================================================
// STEPS
// =====================================================================

type StepProps = { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void; errors: string[] };

function Step1({ form, set }: StepProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="الاسم الكامل" required>
        <input className={FORM_INPUT_CLS} value={form.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="رقم الجوال" required>
        <input className={FORM_INPUT_CLS} value={form.phone} dir="ltr" inputMode="tel" placeholder="05XXXXXXXX"
          onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Field label="المدينة" required>
        <input className={FORM_INPUT_CLS} value={form.city} onChange={(e) => set("city", e.target.value)} />
      </Field>
      <Field label="الحي (اختياري)">
        <input className={FORM_INPUT_CLS} value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} />
      </Field>
      <Field label="طريقة التواصل المفضلة" full>
        <div className="flex flex-wrap gap-2">
          {(["whatsapp", "call", "message"] as ContactMethod[]).map((c) => (
            <Choice key={c} active={form.preferred_contact === c} onClick={() => set("preferred_contact", c)}>
              {c === "whatsapp" ? "واتساب" : c === "call" ? "اتصال" : "رسالة"}
            </Choice>
          ))}
        </div>
      </Field>
    </div>
  );
}

function Step2({ form, set }: StepProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm">أين سيتم تركيب الحوض؟</p>
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
        {(Object.keys(PLACE_LABEL) as PlaceType[]).map((p) => (
          <Choice key={p} active={form.place_type === p} onClick={() => set("place_type", p)}>
            {PLACE_LABEL[p]}
          </Choice>
        ))}
      </div>
      {form.place_type === "other" && (
        <input className={FORM_INPUT_CLS} placeholder="اكتب نوع المكان"
          value={form.place_type_other} onChange={(e) => set("place_type_other", e.target.value)} />
      )}
    </div>
  );
}

function Step3({ form, set }: StepProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm">ما نوع الحوض الذي تفكر فيه؟</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(TANK_LABEL) as TankTypeId[]).map((t) => (
          <Choice key={t} active={form.tank_type === t} onClick={() => set("tank_type", t)}>
            {TANK_LABEL[t]}
          </Choice>
        ))}
      </div>
    </div>
  );
}

function Step4({ form, set }: StepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm">هل تعرف المقاسات التقريبية؟</p>
      <div className="flex flex-wrap gap-2">
        <Choice active={form.knows_dimensions === "yes"} onClick={() => set("knows_dimensions", "yes")}>نعم، أعرف المقاسات</Choice>
        <Choice active={form.knows_dimensions === "no"} onClick={() => set("knows_dimensions", "no")}>لا، أحتاج اقتراح</Choice>
      </div>
      {form.knows_dimensions === "yes" && (
        <div className="space-y-3">
          <div className="grid gap-3 grid-cols-3">
            <Field label="الطول (سم)"><input className={FORM_INPUT_CLS} inputMode="numeric" value={form.length_cm} onChange={(e) => set("length_cm", e.target.value)} /></Field>
            <Field label="العرض (سم)"><input className={FORM_INPUT_CLS} inputMode="numeric" value={form.width_cm} onChange={(e) => set("width_cm", e.target.value)} /></Field>
            <Field label="الارتفاع (سم)"><input className={FORM_INPUT_CLS} inputMode="numeric" value={form.height_cm} onChange={(e) => set("height_cm", e.target.value)} /></Field>
          </div>
          {form.liters && (
            <div className="glass-gold rounded-xl px-4 py-2.5 text-sm inline-block">
              السعة التقريبية: <b className="text-gold">{form.liters} لتر</b>
            </div>
          )}
        </div>
      )}
      {form.knows_dimensions === "no" && (
        <p className="text-xs text-muted-foreground">لا مشكلة، أرسل صورة المكان وسنقترح المقاس المناسب.</p>
      )}
    </div>
  );
}

function Step5({ form, set }: StepProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm">ما الميزانية التقريبية؟</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(BUDGET_LABEL) as Budget[]).map((b) => (
          <Choice key={b} active={form.budget === b} onClick={() => set("budget", b)}>{BUDGET_LABEL[b]}</Choice>
        ))}
      </div>
    </div>
  );
}

function Step6({ form, set, authed }: StepProps & { authed: boolean | null }) {
  return (
    <div className="space-y-4">
      <p className="text-sm">هل يوجد حوض حالي في المكان؟</p>
      <div className="flex flex-wrap gap-2">
        <Choice active={form.has_existing_tank === "no"} onClick={() => set("has_existing_tank", "no")}>لا، أريد حوضًا جديدًا</Choice>
        <Choice active={form.has_existing_tank === "yes"} onClick={() => set("has_existing_tank", "yes")}>نعم، عندي حوض</Choice>
      </div>
      {form.has_existing_tank === "yes" && (
        <div className="space-y-3">
          <Field label="وصف الحوض الحالي">
            <textarea className={FORM_INPUT_CLS} rows={3} value={form.existing_tank_notes}
              onChange={(e) => set("existing_tank_notes", e.target.value)} />
          </Field>
          <ImageUploadField
            label="صور الحوض الحالي (اختياري)"
            values={form.existing_tank_images}
            onChange={(v) => set("existing_tank_images", v)}
            folder="service-requests/custom-aquariums/existing"
            authed={authed}
          />
        </div>
      )}
    </div>
  );
}

function Step7({ form, set, authed }: StepProps & { authed: boolean | null }) {
  return (
    <div className="space-y-3">
      <p className="text-sm">صور المكان</p>
      <p className="text-xs text-muted-foreground">إرفاق صورة للمكان يساعدنا نقترح المقاس والتصميم الأنسب.</p>
      <ImageUploadField
        label="أضف صور المكان"
        values={form.place_images}
        onChange={(v) => set("place_images", v)}
        folder="service-requests/custom-aquariums/place"
        authed={authed}
      />
    </div>
  );
}

function Step8({ form, set }: StepProps) {
  return (
    <Field label="اكتب فكرتك أو أي تفاصيل مهمة">
      <textarea
        className={FORM_INPUT_CLS}
        rows={6}
        value={form.idea_description}
        onChange={(e) => set("idea_description", e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") e.stopPropagation(); }}
        placeholder="مثال: أبغى حوض بحري في غرفة المعيشة، شكله فاخر وهادئ، المساحة تقريبًا متر ونصف، وأفضل يكون سهل العناية."
      />
    </Field>
  );
}

function Step9({ form, set }: StepProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm">هل ترغب بخدمة صيانة بعد التركيب؟</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(MAINT_LABEL) as Maintenance[]).map((m) => (
          <Choice key={m} active={form.wants_maintenance === m} onClick={() => set("wants_maintenance", m)}>
            {MAINT_LABEL[m]}
          </Choice>
        ))}
      </div>
    </div>
  );
}

function Step10({ form, set }: StepProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm">متى يناسبك نتواصل معك؟</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(CONTACT_TIME_LABEL) as ContactTime[]).map((c) => (
          <Choice key={c} active={form.contact_time === c} onClick={() => set("contact_time", c)}>
            {CONTACT_TIME_LABEL[c]}
          </Choice>
        ))}
      </div>
      {form.contact_time === "custom" && (
        <input className={FORM_INPUT_CLS} placeholder="اكتب الوقت المناسب"
          value={form.contact_time_custom} onChange={(e) => set("contact_time_custom", e.target.value)} />
      )}
    </div>
  );
}

function ReviewStep({ form, reference }: { form: FormState; reference: string | null }) {
  const rows: [string, string | null][] = [
    ["الاسم", form.name],
    ["الجوال", form.phone],
    ["المدينة", form.city + (form.neighborhood ? ` — ${form.neighborhood}` : "")],
    ["نوع المكان", form.place_type ? PLACE_LABEL[form.place_type as PlaceType] : null],
    ["نوع الحوض", form.tank_type ? TANK_LABEL[form.tank_type as TankTypeId] : null],
    ["المقاسات", form.knows_dimensions === "yes"
      ? `${form.length_cm}×${form.width_cm}×${form.height_cm} سم${form.liters ? ` — ${form.liters} لتر` : ""}`
      : "بحاجة لاقتراح"],
    ["الميزانية", form.budget ? BUDGET_LABEL[form.budget as Budget] : null],
    ["حوض حالي", form.has_existing_tank === "yes" ? "نعم" : "لا"],
    ["صور مرفقة", (form.place_images.length + form.existing_tank_images.length) > 0
      ? `${form.place_images.length + form.existing_tank_images.length} صورة` : "لا توجد"],
    ["الصيانة", form.wants_maintenance ? MAINT_LABEL[form.wants_maintenance as Maintenance] : null],
    ["وقت التواصل", form.contact_time === "custom" ? form.contact_time_custom : contactTimeLabel(form.contact_time as ContactTime)],
    ["مرجع من الأعمال", reference],
  ];
  return (
    <div className="space-y-3">
      <h3 className="font-bold">مراجعة الطلب</h3>
      <div className="glass rounded-2xl p-4 grid gap-2 sm:grid-cols-2 text-sm">
        {rows.map(([k, v]) => v ? (
          <div key={k} className="flex gap-2"><b className="text-muted-foreground min-w-[110px]">{k}:</b><span>{v}</span></div>
        ) : null)}
      </div>
      {form.idea_description && (
        <div className="glass rounded-2xl p-4 text-sm">
          <b className="text-muted-foreground block mb-1">الفكرة:</b>
          <p className="whitespace-pre-wrap">{form.idea_description}</p>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// SUCCESS
// =====================================================================

function SuccessCard({ summary }: { summary: string }) {
  const wa = whatsappLink(summary);
  return (
    <section className="glass-gold rounded-3xl p-8 sm:p-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gold/20 text-gold mb-4">
        <CheckCircle2 size={28} />
      </div>
      <h2 className="text-2xl font-bold mb-2">تم استلام طلبك بنجاح</h2>
      <p className="text-muted-foreground mb-6">وصلنا طلبك، وسنراجع التفاصيل ونقترح لك الخطوة المناسبة.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-gold rounded-xl px-5 py-2.5 text-sm inline-flex items-center gap-2">
          <MessageCircle size={16} /> تواصل عبر واتساب
        </a>
        <Link to="/services" className="btn-outline-gold rounded-xl px-5 py-2.5 text-sm">العودة للخدمات</Link>
        <Link to="/portfolio" className="btn-outline-gold rounded-xl px-5 py-2.5 text-sm">شاهد أعمالنا</Link>
      </div>
    </section>
  );
}

function buildSummary(f: FormState, reference: string | null): string {
  const lines = [
    "مرحبًا Aqua Haven، أرسلت طلب تصميم حوض مخصص من الموقع.",
    `الاسم: ${f.name}`,
    `المدينة: ${f.city}${f.neighborhood ? ` — ${f.neighborhood}` : ""}`,
    f.place_type ? `نوع المكان: ${PLACE_LABEL[f.place_type as PlaceType]}` : null,
    f.tank_type ? `نوع الحوض: ${TANK_LABEL[f.tank_type as TankTypeId]}` : null,
    f.knows_dimensions === "yes" ? `المقاسات: ${f.length_cm}×${f.width_cm}×${f.height_cm} سم` : null,
    f.liters ? `السعة التقريبية: ${f.liters} لتر` : null,
    f.budget ? `الميزانية: ${BUDGET_LABEL[f.budget as Budget]}` : null,
    reference ? `مرجع: ${reference}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

// =====================================================================
// REUSABLE FIELD/CHOICE/UPLOADER
// =====================================================================

function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="block text-xs text-muted-foreground mb-1.5">
        {label} {required && <span className="text-rose-400">*</span>}
      </span>
      {children}
    </label>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2.5 text-sm border transition text-center ${
        active
          ? "bg-gold/20 border-gold text-foreground"
          : "bg-white/5 border-white/10 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function ImageUploadField({
  label, values, onChange, folder, authed,
}: {
  label: string; values: string[]; onChange: (v: string[]) => void;
  folder: string; authed: boolean | null;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (files: FileList) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const added: string[] = [];
      for (const f of Array.from(files)) {
        const p = await uploadMedia(f, folder);
        added.push(p);
      }
      onChange([...values, ...added]);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر رفع الصورة");
    } finally {
      setBusy(false);
    }
  };

  if (authed === false) {
    return (
      <div className="glass rounded-2xl p-4 text-xs text-muted-foreground space-y-2">
        <p>لرفع الصور مباشرة في النموذج، يرجى تسجيل الدخول.</p>
        <p>أو أكمل الطلب الآن وأرسل الصور لاحقًا عبر واتساب بعد الإرسال.</p>
        <Link to="/auth" className="inline-block text-gold">تسجيل الدخول</Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" disabled={busy} onClick={() => ref.current?.click()}
          className="glass rounded-xl px-4 py-2 text-sm flex items-center gap-2 hover:bg-white/10 disabled:opacity-50">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
          {busy ? "جاري الرفع..." : label}
        </button>
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
          onChange={(e) => { if (e.target.files) handle(e.target.files); e.target.value = ""; }} />
        <span className="text-xs text-muted-foreground">JPG / PNG / WEBP — حتى 5 ميجا</span>
      </div>
      {values.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {values.map((p) => (
            <div key={p} className="relative aspect-square rounded-xl overflow-hidden border border-white/10">
              <img src={publicUrl(p)} alt="" loading="lazy" onError={onImageError} className="h-full w-full object-cover" />
              <button type="button" onClick={() => onChange(values.filter((x) => x !== p))}
                className="absolute top-1 left-1 bg-black/70 rounded-full p-1 text-white hover:bg-red-500">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
