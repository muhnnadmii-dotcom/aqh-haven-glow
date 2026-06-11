import { createFileRoute, Link } from "@tanstack/react-router";
import { Bubbles } from "../components/Bubbles";
import { Reveal } from "../components/Reveal";
import { Fish, Building2, Wrench, MessagesSquare, ArrowLeft } from "lucide-react";
import hero from "../assets/hero-aquarium.jpg";
import p1 from "../assets/project-1.jpg";
import p2 from "../assets/project-2.jpg";
import p3 from "../assets/project-3.jpg";
import aBetta from "../assets/article-betta.jpg";
import aShrimp from "../assets/article-shrimp.jpg";
import aChem from "../assets/article-chemistry.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "أكوا هيفن — عالمك المائي يبدأ من هنا" },
      { name: "description", content: "تصميم وتركيب وصيانة الأحواض المائية الفاخرة والأنظمة التجارية في المملكة العربية السعودية." },
      { property: "og:title", content: "أكوا هيفن — عالمك المائي يبدأ من هنا" },
      { property: "og:description", content: "تصميم وتركيب وصيانة الأحواض المائية الفاخرة في الرياض." },
    ],
  }),
  component: HomePage,
});

const services = [
  { icon: Fish, title: "أحواض مخصصة", desc: "تصميم وتنفيذ أحواض مائية تحاكي رؤيتك بدقة هندسية وجمالية." },
  { icon: Building2, title: "أنظمة تجارية", desc: "أنظمة المأكولات البحرية الحية للمطاعم والفنادق الراقية." },
  { icon: Wrench, title: "صيانة دورية", desc: "خطط صيانة مجدولة تضمن استدامة جمال أحواضك وصحة سكانها." },
  { icon: MessagesSquare, title: "استشارات", desc: "استشارات متخصصة في تأسيس وتطوير عالمك المائي." },
];

const featured = [
  { img: p1, title: "حوض فيلا الرياض", cat: "حوض منزلي" },
  { img: p2, title: "مطعم الواجهة البحرية", cat: "مشروع تجاري" },
  { img: p3, title: "حوض مرجاني خاص", cat: "حوض بحري" },
];

const stats = [
  { num: "12+", label: "سنوات خبرة" },
  { num: "320+", label: "مشروع منجز" },
  { num: "850+", label: "عميل سعيد" },
  { num: "24/7", label: "دعم متواصل" },
];

const articles = [
  { img: aBetta, title: "العناية بسمك البيتا", excerpt: "دليلك الشامل لتربية سمكة البيتا في بيئة مثالية." },
  { img: aShrimp, title: "تربية الروبيان", excerpt: "كل ما تحتاج معرفته عن تربية روبيان النيوكاريدينا." },
  { img: aChem, title: "كيمياء المياه", excerpt: "أساسيات pH والقساوة وتوازن الأمونيا في حوضك." },
];

function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="relative min-h-[92vh] overflow-hidden -mt-24 pt-24 flex items-center">
        <div className="absolute inset-0">
          <img src={hero} alt="" className="h-full w-full object-cover opacity-40" width={1920} height={1080} />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/40 to-background" />
        </div>
        <Bubbles count={22} />

        <div className="relative mx-auto max-w-7xl px-6 py-20 text-center">
          <Reveal>
            <span className="inline-block glass-gold rounded-full px-4 py-1.5 text-xs tracking-widest text-gradient-gold mb-6">
              AQUA HAVEN · الرياض
            </span>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.15] mb-6">
              عالمك المائي <br />
              <span className="text-gradient-gold">يبدأ من هنا</span>
            </h1>
          </Reveal>
          <Reveal delay={240}>
            <p className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed mb-10">
              نصمم ونبني أنظمة بيئية مائية فاخرة — أحواض مخصصة، تركيبات تجارية، وعناية متواصلة بأعلى المعايير.
            </p>
          </Reveal>
          <Reveal delay={360}>
            <div className="flex flex-wrap justify-center gap-3">
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
        </div>
      </section>

      {/* SERVICES */}
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <div className="text-center mb-14">
              <div className="text-xs tracking-widest text-gradient-gold mb-3">خدماتنا</div>
              <h2 className="text-3xl sm:text-4xl font-bold">ماذا نقدم</h2>
            </div>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s, i) => (
              <Reveal key={s.title} delay={i * 100}>
                <div className="glass rounded-2xl p-6 h-full hover:glass-gold transition-all duration-500 hover:-translate-y-1">
                  <div className="grid h-12 w-12 place-items-center rounded-xl glass-gold mb-4">
                    <s.icon className="text-gradient-gold" size={22} />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
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
                <div className="text-xs tracking-widest text-gradient-gold mb-3">أعمالنا</div>
                <h2 className="text-3xl sm:text-4xl font-bold">مشاريع مختارة</h2>
              </div>
              <Link to="/portfolio" className="inline-flex items-center gap-2 text-sm text-gradient-gold">
                عرض الكل <ArrowLeft size={16} />
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

      {/* STATS */}
      <section className="relative py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="glass rounded-3xl p-10 md:p-14 relative overflow-hidden">
            <div className="absolute inset-0 opacity-30">
              <Bubbles count={10} />
            </div>
            <div className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4 text-center">
              {stats.map((s, i) => (
                <Reveal key={s.label} delay={i * 100}>
                  <div>
                    <div className="text-5xl md:text-6xl font-bold text-gradient-gold mb-2">{s.num}</div>
                    <div className="text-sm text-muted-foreground tracking-wide">{s.label}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* KNOWLEDGE */}
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4 mb-14">
              <div>
                <div className="text-xs tracking-widest text-gradient-gold mb-3">مركز المعرفة</div>
                <h2 className="text-3xl sm:text-4xl font-bold">أحدث المقالات</h2>
              </div>
              <Link to="/knowledge" className="inline-flex items-center gap-2 text-sm text-gradient-gold">
                كل المقالات <ArrowLeft size={16} />
              </Link>
            </div>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {articles.map((a, i) => (
              <Reveal key={a.title} delay={i * 120}>
                <article className="glass rounded-2xl overflow-hidden group hover:glass-gold transition-all">
                  <div className="overflow-hidden">
                    <img src={a.img} alt={a.title} width={1024} height={768} loading="lazy"
                      className="h-52 w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-bold mb-2">{a.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{a.excerpt}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal>
            <div className="glass-gold rounded-3xl p-10 md:p-14 text-center">
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
          </Reveal>
        </div>
      </section>
    </>
  );
}
