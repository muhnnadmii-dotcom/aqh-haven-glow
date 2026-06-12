import { createFileRoute, Link } from "@tanstack/react-router";
import { Reveal } from "../components/Reveal";
import { whatsappLink } from "../components/WhatsAppButton";
import { Wrench, CheckCircle2, MessageCircle, Calendar, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/maintenance")({
  head: () => ({
    meta: [
      { title: "باقات الصيانة الدورية — أكوا هيفن" },
      { name: "description", content: "باقات صيانة شهرية للأحواض النهرية والبحرية بمختلف المقاسات في الرياض. أسعار شفافة وفريق محترف." },
      { property: "og:title", content: "باقات الصيانة الدورية — أكوا هيفن" },
      { property: "og:description", content: "خطط صيانة مرنة لكل نوع وحجم حوض." },
      { property: "og:url", content: "/maintenance" },
    ],
    links: [{ rel: "canonical", href: "/maintenance" }],
  }),
  component: MaintenancePage,
});

type Tier = { size: string; price: string; freq: string };
type Group = { type: "نهري" | "بحري"; desc: string; tiers: Tier[] };

const groups: Group[] = [
  {
    type: "نهري",
    desc: "أحواض المياه العذبة المزروعة وأحواض الأسماك الاستوائية.",
    tiers: [
      { size: "نانو — حتى ٦٠ لتر", price: "٢٥٠ ر.س / زيارة", freq: "زيارة كل أسبوعين" },
      { size: "متوسط — ٦٠ إلى ٢٠٠ لتر", price: "٤٥٠ ر.س / زيارة", freq: "زيارة شهرية أو نصف شهرية" },
      { size: "كبير — ٢٠٠ إلى ٥٠٠ لتر", price: "٧٥٠ ر.س / زيارة", freq: "زيارة شهرية" },
      { size: "ضخم — أكثر من ٥٠٠ لتر", price: "حسب المعاينة", freq: "خطة مخصصة" },
    ],
  },
  {
    type: "بحري",
    desc: "أحواض الشعاب المرجانية والأنظمة البحرية الكاملة.",
    tiers: [
      { size: "نانو ريف — حتى ٨٠ لتر", price: "٤٥٠ ر.س / زيارة", freq: "زيارة كل أسبوعين" },
      { size: "متوسط — ٨٠ إلى ٣٠٠ لتر", price: "٧٥٠ ر.س / زيارة", freq: "زيارة كل أسبوعين" },
      { size: "كبير — ٣٠٠ إلى ٧٠٠ لتر", price: "١٢٠٠ ر.س / زيارة", freq: "زيارة أسبوعية" },
      { size: "ضخم — أكثر من ٧٠٠ لتر", price: "حسب المعاينة", freq: "خطة مخصصة" },
    ],
  },
];

const includes = [
  "فحص شامل لجودة المياه (pH, KH, NO₃, NH₃...)",
  "تغيير جزئي للمياه وتنظيف الأرضية",
  "تنظيف الزجاج من الداخل والخارج",
  "غسيل وفحص وسائط الفلتر",
  "فحص الإضاءة والمضخات والسخان",
  "تقرير دوري مكتوب عن حالة الحوض",
];

function MaintenancePage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <Reveal>
        <div className="text-center mb-12">
          <div className="text-xs tracking-widest text-gradient-gold mb-3">MAINTENANCE</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">باقات الصيانة الدورية</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            خطط صيانة منتظمة تحافظ على صحة حوضك وجمال مظهره. الأسعار أدناه تقريبية تبدأ منها، والسعر النهائي يحدد
            بعد المعاينة حسب موقع الحوض ومحتوياته.
          </p>
        </div>
      </Reveal>

      <div className="grid gap-3 sm:grid-cols-3 mb-12 max-w-3xl mx-auto">
        {[
          { icon: Calendar, t: "جدول مرن", d: "زيارات أسبوعية أو شهرية حسب احتياجك" },
          { icon: ShieldCheck, t: "فريق محترف", d: "خبرة ميدانية بالأحواض الفاخرة" },
          { icon: Wrench, t: "أدوات احترافية", d: "نأتي بكل ما يلزم لكل زيارة" },
        ].map((b, i) => (
          <Reveal key={b.t} delay={i * 80}>
            <div className="glass rounded-2xl p-5 text-center">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl glass-gold mb-3">
                <b.icon className="text-gold" size={20} />
              </div>
              <div className="font-bold mb-1">{b.t}</div>
              <div className="text-xs text-muted-foreground">{b.d}</div>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="space-y-10">
        {groups.map((g, gi) => (
          <Reveal key={g.type} delay={gi * 100}>
            <div>
              <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
                <div>
                  <h2 className="text-2xl font-bold">أحواض {g.type}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{g.desc}</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {g.tiers.map((tier) => (
                  <div key={tier.size} className="glass rounded-2xl p-5 hover:glass-gold transition flex flex-col">
                    <div className="text-xs text-gradient-gold mb-2">{g.type}</div>
                    <h3 className="font-bold mb-2 text-sm">{tier.size}</h3>
                    <div className="text-xl font-bold text-gradient-gold mb-1">{tier.price}</div>
                    <div className="text-xs text-muted-foreground mb-4">{tier.freq}</div>
                    <a
                      href={whatsappLink(`السلام عليكم، أرغب بباقة صيانة لحوض ${g.type} — ${tier.size}.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto btn-outline-gold rounded-xl px-4 py-2.5 text-xs text-center inline-flex justify-center"
                    >
                      اطلب الباقة
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="glass rounded-3xl p-8 mt-14">
          <h2 className="text-xl font-bold mb-5">ماذا تشمل كل زيارة صيانة؟</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {includes.map((it) => (
              <li key={it} className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 size={16} className="text-gold mt-0.5 shrink-0" />
                <span className="text-foreground/90">{it}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal>
        <div className="gradient-border rounded-3xl p-8 md:p-12 mt-10 text-center">
          <h2 className="text-2xl font-bold mb-3">احصل على عرض دقيق بعد المعاينة</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            تواصل معنا لتحديد موعد معاينة مجانية داخل الرياض، وسنقدّم لك خطة صيانة مفصّلة.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={whatsappLink("السلام عليكم، أرغب بحجز معاينة لخطة صيانة.")}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold rounded-xl px-6 py-3 text-sm inline-flex items-center gap-2"
            >
              <MessageCircle size={16} /> تواصل واتساب
            </a>
            <Link to="/contact" className="btn-outline-gold rounded-xl px-6 py-3 text-sm">
              نموذج التواصل
            </Link>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
