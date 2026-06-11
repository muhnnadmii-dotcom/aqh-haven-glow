import { createFileRoute, Link } from "@tanstack/react-router";
import { Reveal } from "../components/Reveal";
import { Bubbles } from "../components/Bubbles";
import { Award, Eye, Heart, Sparkles } from "lucide-react";
import consultationTankAsset from "../assets/aqh-consultation-tank.png.asset.json";

const hero = consultationTankAsset.url;

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
  component: AboutPage,
});

const values = [
  { icon: Award, title: "الإتقان", desc: "نسعى للكمال في كل تفصيلة من أحواضنا." },
  { icon: Heart, title: "الشغف", desc: "نحب ما نعمل، وهذا يظهر في كل مشروع." },
  { icon: Sparkles, title: "الفخامة", desc: "نقدم تجربة فاخرة من الاستشارة حتى التسليم." },
  { icon: Eye, title: "الرؤية", desc: "نرى الجمال في الطبيعة ونعيد تشكيله." },
];

function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={hero} alt="" className="h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 to-background" />
        </div>
        <Bubbles count={12} />
        <div className="relative mx-auto max-w-4xl px-6 py-24 text-center">
          <Reveal>
            <div className="text-xs tracking-widest text-gradient-gold mb-3">ABOUT</div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">من نحن</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              أكوا هيفن (AQH) شركة سعودية متخصصة في تصميم وتنفيذ الأحواض المائية الفاخرة. انطلقنا من الرياض برؤية واضحة:
              أن نقدم تجربة مائية لا مثيل لها — تجمع بين الفن الهندسي والاحترافية في الرعاية.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-10 md:grid-cols-2 items-start">
          <Reveal>
            <div className="glass rounded-3xl p-10">
              <div className="text-xs tracking-widest text-gradient-gold mb-3">قصتنا</div>
              <h2 className="text-3xl font-bold mb-5">رحلة من الشغف إلى الاحتراف</h2>
              <p className="text-muted-foreground leading-relaxed">
                بدأت أكوا هيفن من شغف عميق بعالم الأسماك والأحواض. ومع مرور السنين، تطورنا من هواة إلى مرجع موثوق في
                المملكة، نخدم عشاق هذا العالم — من المنازل الراقية حتى أكبر المطاعم والفنادق.
              </p>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="glass-gold rounded-3xl p-10">
              <div className="text-xs tracking-widest text-gradient-gold mb-3">رؤيتنا</div>
              <h2 className="text-3xl font-bold mb-5">العلامة الرائدة في السعودية</h2>
              <p className="text-muted-foreground leading-relaxed">
                أن نكون العلامة الأولى المرجعية في عالم الأحواض المائية بالمملكة، وأن نقدم تجارب استثنائية تتحدث عن
                نفسها. نؤمن بأن كل حوض يجب أن يكون تحفة فنية تنبض بالحياة.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <Reveal>
          <div className="text-center mb-12">
            <div className="text-xs tracking-widest text-gradient-gold mb-3">قيمنا</div>
            <h2 className="text-3xl md:text-4xl font-bold">ما يحركنا</h2>
          </div>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v, i) => (
            <Reveal key={v.title} delay={i * 100}>
              <div className="glass rounded-2xl p-6 text-center h-full">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl glass-gold mb-4">
                  <v.icon className="text-gold" size={24} />
                </div>
                <h3 className="font-bold mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground">{v.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <Reveal>
          <div className="glass rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
            <Bubbles count={8} />
            <div className="relative">
              <div className="text-xs tracking-widest text-gradient-gold mb-3">رؤية مستقبلية</div>
              <h2 className="text-3xl md:text-4xl font-bold mb-5">
                مركز تجربة أكوا هيفن في <span className="text-gradient-gold">الرياض</span>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
                نعمل على افتتاح أول مركز تجربة ومعرض دائم في الرياض — مساحة تجمع بين أرقى الأحواض والمنتجات والاستشارات
                المباشرة من فريقنا. قريباً، عش التجربة الكاملة.
              </p>
              <Link to="/contact" className="btn-gold rounded-xl px-7 py-3.5 text-sm inline-flex">
                كن أول من يعلم
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
