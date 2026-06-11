import { createFileRoute } from "@tanstack/react-router";
import { Reveal } from "../components/Reveal";
import { whatsappLink } from "../components/WhatsAppButton";
import { Fish, Building2, Wrench, MessagesSquare } from "lucide-react";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "خدماتنا — أكوا هيفن" },
      { name: "description", content: "تصميم أحواض مخصصة، أنظمة مأكولات بحرية حية للمطاعم، صيانة دورية، واستشارات احترافية." },
      { property: "og:title", content: "خدماتنا — أكوا هيفن" },
      { property: "og:description", content: "خدمات متكاملة لعالمك المائي من التصميم حتى الصيانة." },
      { property: "og:url", content: "/services" },
    ],
    links: [{ rel: "canonical", href: "/services" }],
  }),
  component: ServicesPage,
});

const services = [
  {
    icon: Fish,
    title: "تصميم وتركيب أحواض مخصصة",
    desc: "نبدأ من رؤيتك ونصمم حوضاً مائياً فريداً يلائم مساحتك وذوقك. نتولى التصميم الهندسي، اختيار المواد، التركيب، وتأسيس النظام البيئي الكامل بأعلى المعايير العالمية.",
    points: ["استشارة وتصميم ثلاثي الأبعاد", "تنفيذ بزجاج بصري عالي الجودة", "تركيب أنظمة الفلترة والإضاءة", "تأسيس النظام البيئي وتزويده"],
    msg: "السلام عليكم، أرغب بطلب خدمة تصميم وتركيب حوض مخصص.",
  },
  {
    icon: Building2,
    title: "أنظمة المأكولات البحرية الحية للمطاعم",
    desc: "حلول متكاملة للمطاعم والفنادق لعرض وحفظ المأكولات البحرية الحية بجودة وكفاءة. أنظمة تبريد متقدمة وفلترة احترافية تضمن صحة المخزون وجمال العرض.",
    points: ["تصميم خاص لكل مطعم", "أنظمة تبريد وفلترة احترافية", "صيانة وضمان", "تدريب الكادر التشغيلي"],
    msg: "السلام عليكم، أرغب بالاستفسار عن نظام مأكولات بحرية حية لمطعمنا.",
  },
  {
    icon: Wrench,
    title: "خطط الصيانة الدورية",
    desc: "خطط صيانة شهرية أو ربع سنوية تضمن استمرار جمال وصحة حوضك. فريق متخصص يتولى التنظيف، فحص الكيمياء، وتغيير المعدات عند الحاجة.",
    points: ["زيارات مجدولة", "فحص شامل للمياه والمعدات", "تنظيف وتغيير جزئي للمياه", "تقرير دوري للعميل"],
    msg: "السلام عليكم، أرغب بالاشتراك في خطة صيانة دورية.",
  },
  {
    icon: MessagesSquare,
    title: "استشارات متخصصة",
    desc: "تواصل مع خبرائنا للحصول على استشارة احترافية حول حوضك الحالي، أو لتخطيط مشروعك القادم. ندعمك بخبرة تتجاوز عقداً من الزمن.",
    points: ["تشخيص مشاكل الأحواض", "تحسين الأنظمة الحالية", "اختيار الأسماك والنباتات", "تخطيط مشاريع جديدة"],
    msg: "السلام عليكم، أرغب بحجز استشارة متخصصة.",
  },
];

function ServicesPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <Reveal>
        <div className="text-center mb-16">
          <div className="text-xs tracking-widest text-gradient-gold mb-3">SERVICES</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">خدماتنا</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            من التصميم الأولي وحتى الصيانة المستمرة — حلول متكاملة لعالمك المائي.
          </p>
        </div>
      </Reveal>

      <div className="space-y-8">
        {services.map((s, i) => (
          <Reveal key={s.title} delay={i * 80}>
            <div className={`glass rounded-3xl p-8 md:p-12 grid gap-8 md:grid-cols-[auto_1fr_auto] items-start`}>
              <div className="grid h-16 w-16 place-items-center rounded-2xl glass-gold">
                <s.icon className="text-gradient-gold" size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3">{s.title}</h3>
                <p className="text-muted-foreground leading-relaxed mb-5">{s.desc}</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {s.points.map((p) => (
                    <li key={p} className="text-sm flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold flex-shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={whatsappLink(s.msg)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold rounded-xl px-6 py-3 text-sm whitespace-nowrap inline-flex items-center self-center"
              >
                اطلب الخدمة
              </a>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
