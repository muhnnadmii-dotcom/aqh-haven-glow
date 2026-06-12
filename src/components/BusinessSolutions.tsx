import { useState } from "react";
import { Reveal } from "./Reveal";
import { whatsappLink } from "./WhatsAppButton";
import { Coffee, UtensilsCrossed, PartyPopper, Fish, Plus, Minus, MessageCircle, CheckCircle2 } from "lucide-react";
import marineCubeAsset from "../assets/aqh-marine-cube.png.asset.json";
import counterAquariumAsset from "../assets/aqh-counter-aquarium.png.asset.json";
import livingRoomTankAsset from "../assets/aqh-living-room-tank.png.asset.json";
import bannerTankAsset from "../assets/aqh-banner-tank.png.asset.json";

type Section = {
  id: string;
  icon: typeof Coffee;
  title: string;
  tagline: string;
  idea: string;
  concerns: { q: string; a: string }[];
  features: string[];
  payment: string[];
  images: string[];
  cta: string;
};

const sections: Section[] = [
  {
    id: "cafes",
    icon: Coffee,
    title: "كافيهات",
    tagline: "حوض مرجاني أو نباتي يحوّل مقهاك إلى تجربة بصرية لا تُنسى.",
    idea:
      "نصمم لكافيهك حوضاً يصبح نقطة الجذب الأولى لزوارك — جدارية مائية، طاولة مدخل، أو جزيرة بحرية وسط القاعة. حوض هادئ، صحي، يثري الديكور ويصنع محتوى ينشره الزوار.",
    concerns: [
      { q: "هل يصدر الحوض رائحة؟", a: "أبداً. أنظمتنا المغلقة والفلترة المتقدمة (بروتين سكيمر للبحري + كاربون مفعّل) تحافظ على المياه شفافة والهواء حول الحوض نظيف." },
      { q: "هل يحتاج صيانة يومية من فريقك؟", a: "لا. التشغيل اليومي تلقائي بالكامل (إضاءة + تغذية أوتوماتيكية)، ونحن نتولى الصيانة الدورية ضمن اشتراك شهري مرن." },
      { q: "هل يزعج العملاء بالضوضاء؟", a: "كل المضخات هادئة (تقنية DC) ومخفية داخل الكابينة السفلية. الصوت لا يتجاوز همس خفيف لا يلاحظه أحد." },
      { q: "هل يستهلك كهرباء عالية؟", a: "الاستهلاك معقول ومحسوب مسبقاً (LED موفّر، مضخات DC). نقدّم لك توقعاً دقيقاً للاستهلاك قبل التنفيذ." },
      { q: "ماذا يحدث إذا انقطعت الكهرباء؟", a: "نوفر بطاريات احتياطية للمضخة الأساسية + تنبيهات على جوالك، وندعم تركيب UPS عند الحاجة." },
    ],
    features: [
      "تصميم يتناسب مع هوية المكان وألوان البراند",
      "إضاءة قابلة للبرمجة (سحر بصري وقت الذروة)",
      "صور وفيديوهات احترافية بعد التسليم لاستخدامها في تسويقك",
      "صيانة دورية بعقد سنوي يضمن جمال الحوض دائماً",
    ],
    payment: [
      "دفعة أولى 50٪ عند توقيع العقد",
      "الدفعة الثانية 40٪ عند التسليم",
      "10٪ بعد فترة التشغيل التجريبي (٧ أيام)",
      "تقسيط متاح عبر تمارا / تابي للمشاريع المؤهلة",
      "اشتراك صيانة شهري ثابت يضمن استقرار الحوض",
    ],
    images: [marineCubeAsset.url, counterAquariumAsset.url],
    cta: "السلام عليكم، أرغب بحوض مخصص لكافيه. أتمنى التواصل لمناقشة التفاصيل.",
  },
  {
    id: "restaurants",
    icon: UtensilsCrossed,
    title: "مطاعم",
    tagline: "أنظمة عرض راقية، وأحواض مأكولات بحرية حية للمطاعم الفاخرة.",
    idea:
      "للمطاعم: نقدم خيارين — حوض ديكور (مرجاني أو نباتي) يرفع مستوى تجربة الضيوف، أو نظام عرض مأكولات بحرية حية (Live Seafood) للمطاعم البحرية، يعرض جمبري، لوبستر، أسماك حية بأنظمة تبريد وفلترة احترافية.",
    concerns: [
      { q: "هل أنظمة المأكولات الحية موثوقة؟", a: "نعم. نستخدم تشيلر تبريد دقيق + فلترة بيولوجية تحافظ على حياة الكائنات لفترة طويلة بصحة ممتازة." },
      { q: "هل يؤثر الحوض على رائحة الطعام؟", a: "لا. الأنظمة المغلقة ومعالجة المياه تضمن عدم وجود أي رائحة بحرية في القاعة." },
      { q: "كم يستهلك من الفضاء؟", a: "نصمم وفق مساحتك المتاحة — من ٨٠ سم حتى جدار كامل، مع إخفاء المعدات في كابينة سفلية أو غرفة خلفية." },
      { q: "هل تدربون الكادر على التشغيل اليومي؟", a: "نعم. تدريب كامل للكادر على التغذية، النظافة السطحية، وقراءة المؤشرات. الصيانة العميقة من فريقنا." },
    ],
    features: [
      "نظام Live Seafood بمعايير صحية معتمدة",
      "إضاءة عرض احترافية تبرز جمال الكائنات",
      "إمدادات مستمرة للكائنات الحية حسب الطلب",
      "صيانة شهرية شاملة + تدخل طارئ خلال ٢٤ ساعة",
    ],
    payment: [
      "عرض سعر مفصل بعد المعاينة المجانية",
      "دفعة أولى 40-50٪ — مرونة في الدفعات الوسطى",
      "عقد صيانة سنوي مع تخفيض على الزيارات",
      "إمكانية الإيجار التشغيلي للأنظمة الكبيرة",
    ],
    images: [counterAquariumAsset.url, bannerTankAsset.url],
    cta: "السلام عليكم، أرغب بمناقشة حوض/نظام مأكولات بحرية لمطعمنا.",
  },
  {
    id: "events",
    icon: PartyPopper,
    title: "فعاليات ومعارض",
    tagline: "أحواض مؤقتة لافتتاحيات، أعراس، فعاليات أطفال، ومعارض تجارية.",
    idea:
      "نوفّر أحواضاً جاهزة للتركيب المؤقت في فعاليتك — لمسة فاخرة تثير إعجاب الحضور. مناسبة للأعراس، الافتتاحيات، فعاليات الأطفال (تجربة تفاعلية مع كائنات بحرية بسيطة)، ومعارض البراندات.",
    concerns: [
      { q: "كم تستغرق عملية التركيب؟", a: "نُجهّز الحوض قبل الفعالية بـ ٢٤-٤٨ ساعة لضمان استقرار البيئة، والإزالة في نفس اليوم بعد الفعالية." },
      { q: "ماذا عن سلامة الأطفال؟", a: "كل الأحواض مؤمّنة بحواجز شفافة وأنظمة كهربائية معزولة، ونوفر مشرفاً مع أي تجربة تفاعلية." },
      { q: "هل الكائنات بأمان أثناء النقل؟", a: "نستخدم بروتوكولات نقل احترافية بدرجة حرارة وأكسجين مضبوطين، وتعود الكائنات بصحة كاملة لمرافقنا بعد الفعالية." },
    ],
    features: [
      "أحواض مؤقتة من ٥٠ لتر حتى ١٠٠٠ لتر",
      "تركيب وفك في نفس اليوم",
      "خيار إضافة كائنات حية للعرض",
      "تجارب تفاعلية للأطفال (touch pool) عند الطلب",
    ],
    payment: [
      "تسعير يومي شامل التركيب والكائنات",
      "خصومات للفعاليات متعددة الأيام",
      "دفعة تأمين قابلة للاسترداد",
    ],
    images: [livingRoomTankAsset.url, marineCubeAsset.url],
    cta: "السلام عليكم، أرغب بحوض لفعالية. أتمنى مناقشة التفاصيل والتاريخ.",
  },
  {
    id: "live-seafood",
    icon: Fish,
    title: "بيع الأسماك الحية للأكل",
    tagline: "إمداد محلات السوبرماركت والمطاعم البحرية بأسماك وقشريات حية.",
    idea:
      "للمحلات والمطاعم البحرية: نوفّر إمدادات منتظمة من الأسماك والقشريات الحية للأكل، مع أنظمة عرض احترافية في موقعك تضمن جودة وحياة المنتج حتى لحظة الطلب.",
    concerns: [
      { q: "ما هي الكائنات المتاحة؟", a: "جمبري، لوبستر، سرطان البحر، وأنواع مختلفة من الأسماك الطازجة حسب الموسم والطلب." },
      { q: "ما مدى انتظام التوريد؟", a: "نوفر جدول توريد أسبوعي ثابت، مع توريد طارئ خلال ٢٤ ساعة حسب الحاجة." },
      { q: "هل تشمل الخدمة تأسيس نظام العرض؟", a: "نعم — نصمم وننفذ نظام العرض في محلك أو مطبخ المطعم، ونتولى صيانته." },
    ],
    features: [
      "توريد منتظم من مصادر موثوقة",
      "نظام عرض احترافي بمواصفات معتمدة",
      "ضمان حياة الكائنات حتى التسليم",
      "أسعار جملة تنافسية للعملاء الدائمين",
    ],
    payment: [
      "عقد توريد شهري بأسعار ثابتة",
      "دفعات أسبوعية أو شهرية حسب اتفاقك",
      "خصم على نظام العرض عند توقيع عقد توريد",
    ],
    images: [counterAquariumAsset.url, bannerTankAsset.url],
    cta: "السلام عليكم، أرغب بالاستفسار عن توريد أسماك حية للأكل.",
  },
];

export function BusinessSolutions() {
  const [openId, setOpenId] = useState<string>("cafes");
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  return (
    <section id="business" className="mt-24 pt-16 border-t border-white/10">
      <Reveal>
        <div className="text-center mb-12">
          <div className="text-xs tracking-widest text-gradient-gold mb-3">BUSINESS</div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">حلول لأصحاب الأعمال</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            قسم مخصص لأصحاب الكافيهات، المطاعم، الفعاليات، والمحلات — كل ما تحتاج معرفته قبل اتخاذ قرار الشراكة معنا.
          </p>
        </div>
      </Reveal>

      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {sections.map((s) => {
          const active = openId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => { setOpenId(s.id); setOpenFaq(null); }}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-all ${
                active ? "btn-gold" : "glass hover:glass-gold"
              }`}
            >
              <s.icon size={16} /> {s.title}
            </button>
          );
        })}
      </div>

      {sections.filter((s) => s.id === openId).map((s) => (
        <Reveal key={s.id}>
          <div className="glass rounded-3xl p-6 md:p-10 space-y-10">
            {/* Header + Idea */}
            <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] items-start">
              <div>
                <div className="inline-flex items-center gap-2 glass-gold rounded-full px-3 py-1.5 text-xs mb-4">
                  <s.icon size={14} className="text-gold" /> قسم {s.title}
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-3">{s.tagline}</h3>
                <p className="text-muted-foreground leading-relaxed">{s.idea}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {s.images.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={`${s.title} مثال ${i + 1}`}
                    loading="lazy"
                    width={800}
                    height={600}
                    className="h-40 sm:h-48 w-full object-cover rounded-2xl"
                  />
                ))}
              </div>
            </div>

            {/* Features */}
            <div>
              <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="h-1 w-6 rounded-full bg-[color:var(--gold)]" /> ماذا نوفّر لك
              </h4>
              <ul className="grid gap-3 sm:grid-cols-2">
                {s.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 glass rounded-xl px-4 py-3 text-sm border border-white/10">
                    <CheckCircle2 size={16} className="text-gold mt-0.5 shrink-0" />
                    <span className="text-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Concerns / FAQ */}
            <div>
              <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="h-1 w-6 rounded-full bg-[color:var(--gold)]" /> مخاوف شائعة وأسئلة الأصحاب
              </h4>
              <div className="space-y-2">
                {s.concerns.map((c, i) => {
                  const key = `${s.id}-${i}`;
                  const open = openFaq === key;
                  return (
                    <div key={key} className="glass rounded-2xl overflow-hidden">
                      <button
                        onClick={() => setOpenFaq(open ? null : key)}
                        className="w-full flex items-center justify-between gap-4 p-4 text-right"
                      >
                        <span className="font-bold text-sm">{c.q}</span>
                        <span className="grid place-items-center h-7 w-7 rounded-lg glass-gold shrink-0">
                          {open ? <Minus size={12} /> : <Plus size={12} />}
                        </span>
                      </button>
                      <div className="grid transition-all duration-300" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
                        <div className="overflow-hidden">
                          <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{c.a}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment */}
            <div>
              <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="h-1 w-6 rounded-full bg-[color:var(--gold)]" /> طرق الدفع والاشتراك
              </h4>
              <ul className="grid gap-2 sm:grid-cols-2">
                {s.payment.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] shrink-0" />
                    <span className="text-foreground/90 leading-relaxed">{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <div className="gradient-border rounded-2xl p-6 text-center">
              <div className="font-bold mb-3">جاهز لمناقشة مشروعك؟</div>
              <a
                href={whatsappLink(s.cta)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold rounded-xl px-6 py-3 text-sm inline-flex items-center gap-2"
              >
                <MessageCircle size={16} /> تواصل عبر واتساب
              </a>
            </div>
          </div>
        </Reveal>
      ))}
    </section>
  );
}
