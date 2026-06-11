import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bubbles } from "../components/Bubbles";
import { Reveal } from "../components/Reveal";
import { Counter } from "../components/Counter";
import {
  Fish, Building2, Wrench, MessagesSquare, ArrowLeft,
  ShieldCheck, Sparkles, Clock, BadgeCheck,
  Search, PenTool, Hammer, LifeBuoy, Plus, Minus, Star, Quote,
} from "lucide-react";
import livingRoomTankAsset from "../assets/aqh-living-room-tank.png.asset.json";
import saudiServiceAsset from "../assets/aqh-saudi-service.png.asset.json";
import marineCubeAsset from "../assets/aqh-marine-cube.png.asset.json";
import styledAquariumAsset from "../assets/aqh-styled-aquarium.png.asset.json";
import counterAquariumAsset from "../assets/aqh-counter-aquarium.png.asset.json";
import canisterFilterAsset from "../assets/aqh-canister-filter.jpg.asset.json";

const hero = livingRoomTankAsset.url;
const livingRoomTank = livingRoomTankAsset.url;
const saudiService = saudiServiceAsset.url;
const marineCube = marineCubeAsset.url;
const styledAquarium = styledAquariumAsset.url;
const counterAquarium = counterAquariumAsset.url;
const canisterFilter = canisterFilterAsset.url;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "أكوا هيفن — عالمك المائي يبدأ من هنا" },
      { name: "description", content: "تصميم وتركيب وصيانة الأحواض المائية الفاخرة والأنظمة التجارية في المملكة العربية السعودية. خبرة تتجاوز 12 عاماً." },
      { property: "og:title", content: "أكوا هيفن — عالمك المائي يبدأ من هنا" },
      { property: "og:description", content: "تصميم وتركيب وصيانة الأحواض المائية الفاخرة في الرياض." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
});

const services = [
  { icon: Fish, title: "أحواض مخصصة", desc: "تصميم وتنفيذ أحواض مائية تحاكي رؤيتك بدقة هندسية وجمالية." },
  { icon: Building2, title: "أنظمة تجارية", desc: "أنظمة المأكولات البحرية الحية للمطاعم والفنادق الراقية." },
  { icon: Wrench, title: "صيانة دورية", desc: "خطط صيانة مجدولة تضمن استدامة جمال أحواضك وصحة سكانها." },
  { icon: MessagesSquare, title: "استشارات", desc: "استشارات متخصصة في تأسيس وتطوير عالمك المائي." },
];

const whyUs = [
  { icon: ShieldCheck, title: "ضمان فعلي", desc: "ضمان على التنفيذ يمتد حتى 24 شهراً مع متابعة دورية." },
  { icon: Sparkles, title: "تصميم فاخر", desc: "تصاميم استوديو خاصة تليق بالمساحات الراقية." },
  { icon: BadgeCheck, title: "كادر معتمد", desc: "فريق فني محترف مدرّب على أحدث الأنظمة العالمية." },
  { icon: Clock, title: "تسليم في الموعد", desc: "جدول زمني واضح، تسليم منضبط، وشفافية في كل مرحلة." },
];

const process = [
  { icon: Search, n: "01", title: "الاستكشاف", desc: "نزور موقعك ونفهم رؤيتك واحتياجاتك بدقة." },
  { icon: PenTool, n: "02", title: "التصميم", desc: "نقدم تصميماً ثلاثي الأبعاد مع كل التفاصيل التقنية." },
  { icon: Hammer, n: "03", title: "التنفيذ", desc: "تركيب احترافي يضمن الجودة والمتانة والجمال." },
  { icon: LifeBuoy, n: "04", title: "العناية", desc: "متابعة وصيانة دورية لاستدامة حوضك بأفضل حالة." },
];

const featured = [
  { img: livingRoomTank, title: "حوض فيلا الرياض", cat: "حوض منزلي" },
  { img: saudiService, title: "تنفيذ احترافي داخل الموقع", cat: "خدمة ميدانية" },
  { img: marineCube, title: "حوض بحري خاص", cat: "حوض بحري" },
];

const stats = [
  { num: 12, suffix: "+", label: "سنوات خبرة" },
  { num: 320, suffix: "+", label: "مشروع منجز" },
  { num: 850, suffix: "+", label: "عميل سعيد" },
  { num: 100, suffix: "٪", label: "التزام بالموعد" },
];

const partners = [
  "EHEIM", "JBL", "FLUVAL", "RED SEA", "ADA", "SEACHEM", "TUNZE", "CHIHIROS",
];

const testimonials = [
  { name: "م. عبدالله الحربي", role: "صاحب فيلا - الرياض", quote: "تجربة فاخرة من البداية للنهاية. الحوض أصبح قطعة الديكور الأهم في المنزل.", rating: 5 },
  { name: "شيف خالد", role: "مدير مطعم بحري", quote: "نظام المأكولات البحرية يعمل بكفاءة منذ سنتين بلا أي مشاكل. فريق محترف.", rating: 5 },
  { name: "نورة العنزي", role: "هاوية أحواض نباتية", quote: "أفضل استشارة حصلت عليها. ساعدوني خطوة بخطوة وما زالوا يدعموني.", rating: 5 },
];

const articles = [
  { slug: "betta-care", img: styledAquarium, title: "العناية بسمك البيتا", excerpt: "دليلك الشامل لتربية سمكة البيتا في بيئة مثالية." },
  { slug: "shrimp-breeding", img: counterAquarium, title: "تربية الروبيان", excerpt: "كل ما تحتاج معرفته عن تربية روبيان النيوكاريدينا." },
  { slug: "water-chemistry", img: canisterFilter, title: "كيمياء المياه", excerpt: "أساسيات pH والقساوة وتوازن الأمونيا في حوضك." },
];

const faqs = [
  { q: "كم يستغرق تنفيذ حوض مخصص؟", a: "يعتمد على حجم المشروع وتعقيده، عادة من 2 إلى 6 أسابيع تشمل التصميم والتنفيذ والتأسيس البيئي." },
  { q: "هل تقدمون خدماتكم خارج الرياض؟", a: "نعم، نخدم جميع مناطق المملكة. قد تختلف رسوم النقل والتركيب حسب الموقع." },
  { q: "ما الذي تشمله خطة الصيانة الدورية؟", a: "تشمل فحص المياه، تنظيف الفلاتر، تغيير جزئي للمياه، فحص المعدات، وتقرير دوري بحالة الحوض." },
  { q: "هل توفرون ضماناً على التنفيذ؟", a: "نعم، نقدم ضماناً على التنفيذ والمعدات يصل إلى 24 شهراً حسب المشروع." },
  { q: "كيف أطلب مشروعاً جديداً؟", a: "تواصل معنا عبر نموذج التواصل أو واتساب، وسيقوم فريقنا بترتيب زيارة استكشافية مجانية." },
];

function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <>
      {/* HERO */}
      <section className="relative min-h-[92dvh] overflow-hidden -mt-24 pt-24 flex items-center">
        <div className="absolute inset-0">
          <img src={hero} alt="حوض نباتي فاخر داخل مساحة معيشة عصرية من أعمال أكوا هيفن" className="h-full w-full object-cover opacity-40" width={1920} height={1080} />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/40 to-background" />
        </div>
        <div className="light-rays" aria-hidden />
        <Bubbles count={22} />

        <div className="relative mx-auto max-w-7xl px-6 py-20 text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 glass-gold rounded-full px-4 py-1.5 text-xs tracking-widest text-gradient-gold mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
              AQUA HAVEN · الرياض
            </span>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.15] mb-6 tracking-tight">
              عالمك المائي <br />
              <span className="text-gradient-gold">يبدأ من هنا</span>
            </h1>
          </Reveal>
          <Reveal delay={240}>
            <p className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed mb-10">
              نصمم ونبني أنظمة بيئية مائية فاخرة — أحواض مخصصة، تركيبات تجارية، وعناية متواصلة بأعلى المعايير العالمية.
            </p>
          </Reveal>
          <Reveal delay={360}>
            <div className="flex flex-wrap justify-center gap-3 mb-12">
              <a href="https://aqh.sa" target="_blank" rel="noopener noreferrer"
                className="btn-gold inline-flex items-center rounded-xl px-7 py-3.5 text-sm">
                تسوق الآن
              </a>
              <Link to="/contact"
                className="btn-outline-gold inline-flex items-center rounded-xl px-7 py-3.5 text-sm">
                اطلب مشروعك
              </Link>
            </div>
          </Reveal>
          <Reveal delay={480}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {stats.map((s) => (
                <div key={s.label} className="glass rounded-2xl p-4">
                  <div className="text-2xl md:text-3xl font-bold text-gradient-gold">
                    <Counter to={s.num} suffix={s.suffix} />
                  </div>
                  <div className="text-[11px] md:text-xs text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* PARTNERS MARQUEE */}
      <section className="relative py-10 border-y border-white/5 overflow-hidden bg-[oklch(0.10_0.05_245/0.4)]">
        <div className="text-center text-xs tracking-[0.3em] text-muted-foreground mb-6">العلامات التي نثق بها</div>
        <div className="marquee-track gap-16 text-2xl md:text-3xl font-bold text-white/30 select-none">
          {[...partners, ...partners].map((p, i) => (
            <span key={i} className="whitespace-nowrap" dir="ltr">{p}</span>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <div className="text-center mb-14">
              <div className="text-xs tracking-widest text-gradient-gold mb-3">SERVICES</div>
              <h2 className="text-3xl sm:text-4xl font-bold">ماذا نقدم</h2>
              <p className="text-muted-foreground mt-3 max-w-xl mx-auto">حلول متكاملة لكل من يطمح لعالم مائي استثنائي.</p>
            </div>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s, i) => (
              <Reveal key={s.title} delay={i * 100}>
                <div className="gradient-border rounded-2xl p-6 h-full hover:-translate-y-1 transition-transform duration-500">
                  <div className="grid h-12 w-12 place-items-center rounded-xl glass-gold mb-4">
                    <s.icon className="text-gold" size={22} aria-hidden />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section className="relative py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] items-center">
            <Reveal>
              <div>
                <div className="text-xs tracking-widest text-gradient-gold mb-3">WHY AQH</div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">لماذا أكوا هيفن؟</h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  لأن الحوض ليس مجرد زجاج وماء — بل تجربة تعيشها كل يوم. نهتم بأدق التفاصيل من الهندسة حتى الإضاءة.
                </p>
                <Link to="/about" className="inline-flex items-center gap-2 text-sm text-gradient-gold">
                  تعرف علينا أكثر <ArrowLeft size={16} aria-hidden />
                </Link>
              </div>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2">
              {whyUs.map((w, i) => (
                <Reveal key={w.title} delay={i * 100}>
                  <div className="glass rounded-2xl p-5 hover:glass-gold transition">
                    <div className="grid h-11 w-11 place-items-center rounded-xl glass-gold mb-3">
                      <w.icon className="text-gold" size={20} aria-hidden />
                    </div>
                    <h3 className="font-bold mb-1.5">{w.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{w.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <div className="text-center mb-14">
              <div className="text-xs tracking-widest text-gradient-gold mb-3">PROCESS</div>
              <h2 className="text-3xl sm:text-4xl font-bold">كيف نعمل</h2>
              <p className="text-muted-foreground mt-3 max-w-xl mx-auto">أربع خطوات منضبطة من الفكرة حتى الصيانة المستمرة.</p>
            </div>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 relative">
            {process.map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <div className="glass rounded-2xl p-6 h-full relative overflow-hidden group">
                  <div className="absolute -top-2 -left-2 text-7xl font-black text-gradient-gold opacity-20 group-hover:opacity-40 transition">{s.n}</div>
                  <div className="grid h-12 w-12 place-items-center rounded-xl glass-gold mb-4 relative">
                    <s.icon className="text-gold" size={22} aria-hidden />
                  </div>
                  <h3 className="text-lg font-bold mb-2 relative">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed relative">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED PROJECTS */}
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4 mb-14">
              <div>
                <div className="text-xs tracking-widest text-gradient-gold mb-3">PORTFOLIO</div>
                <h2 className="text-3xl sm:text-4xl font-bold">مشاريع مختارة</h2>
              </div>
              <Link to="/portfolio" className="inline-flex items-center gap-2 text-sm text-gradient-gold">
                عرض الكل <ArrowLeft size={16} aria-hidden />
              </Link>
            </div>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {featured.map((f, i) => (
              <Reveal key={f.title} delay={i * 120}>
                <Link to="/portfolio" className="block group">
                  <div className="relative overflow-hidden rounded-2xl glass">
                    <img src={f.img} alt={f.title} width={1024} height={768} loading="lazy"
                      className="h-72 w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                    <div className="absolute bottom-0 right-0 left-0 p-5">
                      <div className="text-xs text-gradient-gold mb-1">{f.cat}</div>
                      <div className="text-lg font-bold">{f.title}</div>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <div className="text-center mb-14">
              <div className="text-xs tracking-widest text-gradient-gold mb-3">TESTIMONIALS</div>
              <h2 className="text-3xl sm:text-4xl font-bold">آراء عملائنا</h2>
            </div>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 120}>
                <div className="glass rounded-2xl p-7 h-full relative">
                  <Quote className="absolute top-5 left-5 text-gold opacity-40" size={28} aria-hidden />
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, k) => (
                      <Star key={k} size={14} className="fill-gold text-gold" aria-hidden />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90 mb-5">"{t.quote}"</p>
                  <div className="border-t border-white/5 pt-4">
                    <div className="font-bold text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.role}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* KNOWLEDGE */}
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4 mb-14">
              <div>
                <div className="text-xs tracking-widest text-gradient-gold mb-3">KNOWLEDGE</div>
                <h2 className="text-3xl sm:text-4xl font-bold">أحدث المقالات</h2>
              </div>
              <Link to="/knowledge" className="inline-flex items-center gap-2 text-sm text-gradient-gold">
                كل المقالات <ArrowLeft size={16} aria-hidden />
              </Link>
            </div>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {articles.map((a, i) => (
              <Reveal key={a.slug} delay={i * 120}>
                <Link to="/knowledge/$slug" params={{ slug: a.slug }} className="block">
                  <article className="glass rounded-2xl overflow-hidden group hover:glass-gold transition-all h-full">
                    <div className="overflow-hidden">
                      <img src={a.img} alt={a.title} width={1024} height={768} loading="lazy"
                        className="h-52 w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    </div>
                    <div className="p-6">
                      <h3 className="text-lg font-bold mb-2">{a.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{a.excerpt}</p>
                    </div>
                  </article>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative py-24">
        <div className="mx-auto max-w-3xl px-6">
          <Reveal>
            <div className="text-center mb-12">
              <div className="text-xs tracking-widest text-gradient-gold mb-3">FAQ</div>
              <h2 className="text-3xl sm:text-4xl font-bold">الأسئلة الشائعة</h2>
            </div>
          </Reveal>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <Reveal key={f.q} delay={i * 60}>
                <div className="glass rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 p-5 text-right"
                    aria-expanded={openFaq === i}
                  >
                    <span className="font-bold text-sm md:text-base">{f.q}</span>
                    <span className="grid place-items-center h-8 w-8 rounded-lg glass-gold flex-shrink-0" aria-hidden>
                      {openFaq === i ? <Minus size={14} /> : <Plus size={14} />}
                    </span>
                  </button>
                  <div
                    className="grid transition-all duration-300 ease-out"
                    style={{ gridTemplateRows: openFaq === i ? "1fr" : "0fr" }}
                  >
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

      {/* CTA */}
      <section className="relative py-20">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal>
            <div className="gradient-border rounded-3xl p-10 md:p-14 text-center relative overflow-hidden">
              <div className="light-rays" aria-hidden />
              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">جاهز لتأسيس عالمك المائي؟</h2>
                <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                  تواصل معنا اليوم ودعنا نحول رؤيتك إلى تحفة مائية فاخرة.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Link to="/contact" className="btn-gold rounded-xl px-7 py-3.5 text-sm">ابدأ مشروعك</Link>
                  <a href="https://aqh.sa" target="_blank" rel="noopener noreferrer"
                    className="btn-outline-gold rounded-xl px-7 py-3.5 text-sm">زيارة المتجر</a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
