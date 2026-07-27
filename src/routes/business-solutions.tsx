import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Building2, Landmark, Hotel, UtensilsCrossed, Briefcase, ShoppingBag, HeartPulse, GraduationCap,
  ShieldCheck, Wrench, Layers, Cpu, ClipboardCheck, PenTool, HardHat, Users, Clock, Award, TrendingUp,
  MessageCircle, ArrowLeft, CheckCircle2, Sparkles, Waves, Gauge, FileCheck2, Phone, Mail, MapPin,
  Plus, Minus,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { Bubbles } from "@/components/Bubbles";
import { whatsappLink } from "@/components/WhatsAppButton";
import bannerTankAsset from "@/assets/aqh-banner-tank.png.asset.json";
import livingRoomTankAsset from "@/assets/aqh-living-room-tank.png.asset.json";
import marineCubeAsset from "@/assets/aqh-marine-cube.png.asset.json";
import counterAquariumAsset from "@/assets/aqh-counter-aquarium.png.asset.json";
import styledAquariumAsset from "@/assets/aqh-styled-aquarium.png.asset.json";
import saudiServiceAsset from "@/assets/aqh-saudi-service.png.asset.json";

export const Route = createFileRoute("/business-solutions")({
  head: () => ({
    meta: [
      { title: "حلول الشركات B2B — أكوا هيفن" },
      { name: "description", content: "شريك أكوا هيفن للشركات والجهات الحكومية والفنادق والمطاعم والمولات والمستشفيات: تصميم وتنفيذ وصيانة أنظمة الأحواض المائية بعقود SLA احترافية في جميع أنحاء المملكة." },
      { property: "og:title", content: "حلول الشركات B2B — أكوا هيفن" },
      { property: "og:description", content: "أنظمة أحواض مؤسسية، صيانة بعقود SLA، وإدارة مشاريع تسليم مفتاح للجهات الحكومية والقطاع الخاص." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "/business-solutions" },
    ],
    links: [{ rel: "canonical", href: "/business-solutions" }],
  }),
  component: BusinessSolutionsPage,
});

const stats = [
  { value: "+9", label: "سنوات خبرة مؤسسية", icon: Award },
  { value: "+240", label: "مشروع منفذ", icon: Building2 },
  { value: "24/7", label: "دعم فني للعقود", icon: Clock },
  { value: "13", label: "منطقة تغطية بالمملكة", icon: MapPin },
];

const solutions = [
  { icon: Layers, title: "حلول الشركات المتكاملة", desc: "تصميم وتنفيذ أنظمة أحواض تعزز الهوية البصرية لمقر الشركة وتصنع تجربة زوار استثنائية." },
  { icon: Waves, title: "الأحواض التجارية", desc: "أحواض عرض للمولات والمعارض ونقاط البيع بمقاسات وأشكال مخصصة تدعم البراند وتزيد التفاعل." },
  { icon: Cpu, title: "أنظمة الأحواض المركزية", desc: "أنظمة فلترة وتشغيل مركزية لعدة أحواض من غرفة تقنية واحدة — كفاءة تشغيلية أعلى وتكلفة أقل." },
  { icon: Wrench, title: "الصيانة الدورية بعقود SLA", desc: "عقود صيانة بمستويات خدمة موثقة، زيارات مجدولة، وتدخل طارئ خلال 24 ساعة كحد أقصى." },
  { icon: PenTool, title: "التصميم والتنفيذ", desc: "استوديو تصميم داخلي يقدم مخططات 3D ومحاكاة واقعية قبل التنفيذ، ثم تنفيذ بمعايير هندسية دقيقة." },
  { icon: ClipboardCheck, title: "إدارة المشاريع", desc: "مدير مشروع مخصص لكل عقد، جداول زمنية معتمدة، وتقارير تقدم أسبوعية للجهة المستفيدة." },
];

const audiences = [
  { icon: Landmark, title: "الجهات الحكومية", desc: "مقرات وزارية، هيئات، ومباني عامة — بمواصفات المشتريات الحكومية وشهادات الجودة." },
  { icon: Hotel, title: "الفنادق والمنتجعات", desc: "لوبيات، أجنحة، ومطاعم فندقية بمعايير الضيافة الفاخرة." },
  { icon: UtensilsCrossed, title: "المطاعم والكافيهات", desc: "أحواض ديكور وأنظمة عرض مأكولات بحرية حية بمعايير صحية." },
  { icon: Briefcase, title: "المكاتب والشركات", desc: "مساحات استقبال وقاعات اجتماعات تعكس هوية الشركة." },
  { icon: ShoppingBag, title: "المولات ومراكز التسوق", desc: "منحوتات مائية مركزية تصنع نقاط جذب وتزيد وقت البقاء." },
  { icon: HeartPulse, title: "المستشفيات والعيادات", desc: "أحواض علاجية تخفف التوتر بمعايير سلامة ونظافة صارمة." },
  { icon: GraduationCap, title: "المدارس والجامعات", desc: "أحواض تعليمية وأنظمة أكواسكب لبيئات التعلم." },
  { icon: Building2, title: "المجمعات السكنية والفلل", desc: "أحواض بانورامية ومشاريع أكواسكب للمساحات الفاخرة." },
];

const process = [
  { n: "01", t: "الاستشارة والمعاينة", d: "زيارة موقعية مجانية لتقييم المساحة، دراسة الإضاءة والبنية التحتية، وفهم أهداف المشروع." },
  { n: "02", t: "التصميم والمحاكاة", d: "مقترحات تصميم بصور 3D، دراسة هندسية، ومواصفات تقنية موثقة." },
  { n: "03", t: "عرض السعر والعقد", d: "عرض سعر تفصيلي شفاف، جدول دفعات، وعقد بمستويات خدمة واضحة." },
  { n: "04", t: "التصنيع والتجهيز", d: "تصنيع الحوض والكابينة، تجهيز الأنظمة، واختبار جودة داخلي قبل النقل." },
  { n: "05", t: "التركيب والتشغيل", d: "تركيب احترافي، تشغيل تجريبي، تهيئة الكائنات، وتسليم بروتوكولات التشغيل." },
  { n: "06", t: "الصيانة والدعم", d: "عقد صيانة دورية، مراقبة عن بعد، وتقارير أداء دورية." },
];

const whyUs = [
  { icon: ShieldCheck, t: "امتثال ومعايير", d: "توافق مع اشتراطات الدفاع المدني، الغرفة التجارية، ومواصفات المشتريات الحكومية." },
  { icon: Award, t: "خبرة موثقة", d: "أكثر من 9 سنوات في تنفيذ مشاريع مؤسسية معقدة داخل المملكة." },
  { icon: Gauge, t: "SLA ملزم", d: "استجابة مضمونة، زيارات موثقة، وتقارير أداء قابلة للتدقيق." },
  { icon: Users, t: "فريق متخصص", d: "مهندسون، أخصائيو أحياء مائية، وفنيون معتمدون." },
  { icon: FileCheck2, t: "توثيق كامل", d: "كل مشروع يُسلَّم بمخططات، أدلة تشغيل، وشهادات ضمان." },
  { icon: TrendingUp, t: "ROI حقيقي", d: "زيادة موثقة في وقت بقاء العملاء والتفاعل مع نقاط البيع." },
];

const projects = [
  { img: bannerTankAsset.url, cat: "فندق", title: "لوبي فندق فاخر", loc: "الرياض" },
  { img: livingRoomTankAsset.url, cat: "مجمع سكني", title: "حوض استقبال بانورامي", loc: "الرياض" },
  { img: marineCubeAsset.url, cat: "مقر شركة", title: "مكعب مرجاني مركزي", loc: "جدة" },
  { img: counterAquariumAsset.url, cat: "مطعم", title: "نظام عرض مأكولات بحرية", loc: "الخبر" },
  { img: styledAquariumAsset.url, cat: "مول", title: "منحوتة مائية", loc: "الرياض" },
  { img: saudiServiceAsset.url, cat: "جهة حكومية", title: "قاعة استقبال رسمية", loc: "الرياض" },
];

const faqs = [
  { q: "ما مدة تنفيذ المشروع المؤسسي؟", a: "من 3 إلى 10 أسابيع حسب حجم وتعقيد المشروع، ونلتزم بجدول زمني موثق ضمن العقد." },
  { q: "هل تقدمون فواتير ضريبية معتمدة؟", a: "نعم، جميع فواتيرنا ضريبية مطابقة لهيئة الزكاة والضريبة، ونتعامل مع أنظمة اعتماد الموردين الحكومية." },
  { q: "ما مستويات عقود SLA المتاحة؟", a: "ثلاث باقات: أساسي (شهري)، احترافي (نصف شهري + استجابة 48 ساعة)، ومؤسسي (أسبوعي + استجابة 24 ساعة + مراقبة عن بعد)." },
  { q: "هل تغطون خارج الرياض؟", a: "نعم، نغطي 13 منطقة داخل المملكة عبر شبكة فنيين معتمدين ومكاتب إقليمية." },
  { q: "هل يمكن ربط الحوض بأنظمة المبنى الذكي؟", a: "نعم، ندعم التكامل مع أنظمة BMS للتحكم بالإضاءة، درجة الحرارة، والتنبيهات." },
];

export default function BusinessSolutionsPage() {
  return <Page />;
}

function Page() {
  return (
    <main>
      <Hero />
      <StatsBar />
      <Solutions />
      <Audiences />
      <Process />
      <WhyUs />
      <Projects />
      <SlaTiers />
      <Faq />
      <QuoteForm />
      <FinalCta />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <img src={bannerTankAsset.url} alt="" className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>
      <Bubbles />
      <div className="mx-auto max-w-7xl px-6 pt-24 pb-20 sm:pt-32 sm:pb-28">
        <Reveal>
          <div className="inline-flex items-center gap-2 glass-gold rounded-full px-4 py-1.5 text-xs mb-6">
            <Sparkles size={14} className="text-gold" />
            <span>حلول مؤسسية · Enterprise B2B</span>
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black leading-tight max-w-4xl">
            شريكك الموثوق في
            <span className="block text-gradient-gold">أنظمة الأحواض المؤسسية</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">
            نصمم وننفذ ونصون أنظمة أحواض مائية بمعايير عالمية للجهات الحكومية، الفنادق، الشركات، المطاعم، المولات، والمستشفيات — بعقود SLA ملزمة وفريق متخصص.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#quote" className="btn-gold rounded-xl px-6 py-3.5 text-sm font-bold inline-flex items-center gap-2">
              <FileCheck2 size={16} /> اطلب عرض سعر مؤسسي
            </a>
            <a href={whatsappLink("السلام عليكم، أرغب بحجز استشارة B2B مع أكوا هيفن.")}
               target="_blank" rel="noopener noreferrer"
               className="glass hover:glass-gold rounded-xl px-6 py-3.5 text-sm font-bold inline-flex items-center gap-2 border border-white/10">
              <MessageCircle size={16} /> احجز استشارة مجانية
            </a>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-gold" /> مورد معتمد للجهات الحكومية</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-gold" /> فواتير ضريبية مطابقة</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-gold" /> ضمان تشغيلي حتى 3 سنوات</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function StatsBar() {
  return (
    <section className="border-y border-white/10 bg-black/20">
      <div className="mx-auto max-w-7xl px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <s.icon className="mx-auto text-gold mb-2" size={22} />
            <div className="text-3xl sm:text-4xl font-black text-gradient-gold">{s.value}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHead({ kicker, title, desc }: { kicker: string; title: string; desc?: string }) {
  return (
    <div className="text-center mb-12">
      <div className="text-xs tracking-widest text-gradient-gold mb-3">{kicker}</div>
      <h2 className="text-3xl sm:text-4xl font-bold mb-4">{title}</h2>
      {desc && <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">{desc}</p>}
    </div>
  );
}

function Solutions() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <Reveal><SectionHead kicker="SOLUTIONS" title="حلولنا للشركات" desc="منظومة متكاملة تغطي دورة حياة المشروع بالكامل من التصميم حتى الصيانة." /></Reveal>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {solutions.map((s, i) => (
          <Reveal key={s.title} delay={i * 60}>
            <div className="group glass rounded-2xl p-6 h-full border border-white/10 hover:border-[color:var(--gold)]/40 transition-all">
              <div className="grid place-items-center h-12 w-12 rounded-xl glass-gold mb-4 group-hover:scale-110 transition-transform">
                <s.icon size={22} className="text-gold" />
              </div>
              <h3 className="text-lg font-bold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Audiences() {
  return (
    <section className="bg-black/20 border-y border-white/10">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <Reveal><SectionHead kicker="INDUSTRIES" title="الجهات المستفيدة" desc="نخدم قطاعات متنوعة بحلول مخصصة لكل بيئة عمل." /></Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map((a, i) => (
            <Reveal key={a.title} delay={i * 40}>
              <div className="glass rounded-2xl p-5 border border-white/10 h-full">
                <a.icon size={26} className="text-gold mb-3" />
                <h3 className="font-bold mb-1.5">{a.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{a.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Process() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <Reveal><SectionHead kicker="PROCESS" title="مراحل التنفيذ" desc="منهجية موثقة بست مراحل تضمن التسليم في الوقت وبالجودة المطلوبة." /></Reveal>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {process.map((p, i) => (
          <Reveal key={p.n} delay={i * 60}>
            <div className="relative glass rounded-2xl p-6 border border-white/10 h-full">
              <div className="text-5xl font-black text-gradient-gold opacity-80 mb-3">{p.n}</div>
              <h3 className="text-lg font-bold mb-2">{p.t}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function WhyUs() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-40">
        <img src={styledAquariumAsset.url} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/85 to-background" />
      </div>
      <div className="mx-auto max-w-7xl px-6 py-20">
        <Reveal><SectionHead kicker="WHY AQUA HAVEN" title="لماذا أكوا هيفن" desc="ما يميزنا كشريك مؤسسي طويل الأمد." /></Reveal>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {whyUs.map((w, i) => (
            <Reveal key={w.t} delay={i * 50}>
              <div className="glass rounded-2xl p-6 border border-white/10 h-full flex gap-4">
                <div className="grid place-items-center h-11 w-11 rounded-xl glass-gold shrink-0">
                  <w.icon size={20} className="text-gold" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold mb-1.5">{w.t}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{w.d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Projects() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <Reveal>
        <SectionHead kicker="PORTFOLIO" title="معرض مشاريع B2B" desc="نماذج من تنفيذنا للقطاعات المؤسسية." />
      </Reveal>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p, i) => (
          <Reveal key={p.title} delay={i * 60}>
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 aspect-[4/3]">
              <img src={p.img} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="inline-block glass-gold rounded-full px-3 py-1 text-[11px] mb-2">{p.cat}</div>
                <h3 className="font-bold text-lg">{p.title}</h3>
                <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1">
                  <MapPin size={12} /> {p.loc}
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <div className="text-center mt-10">
        <Link to="/portfolio" className="glass hover:glass-gold rounded-xl px-6 py-3 text-sm inline-flex items-center gap-2 border border-white/10">
          <ArrowLeft size={16} /> استعرض جميع مشاريعنا
        </Link>
      </div>
    </section>
  );
}

const slaTiers = [
  { name: "أساسي", freq: "زيارة شهرية", resp: "استجابة 72 ساعة", best: "المكاتب والمساحات الصغيرة", items: ["فحص شامل شهري", "تنظيف عام", "تقرير حالة", "دعم واتساب"] },
  { name: "احترافي", freq: "زيارتان شهرياً", resp: "استجابة 48 ساعة", best: "المطاعم والفنادق والشركات", items: ["كل ما في الأساسي", "تحاليل مياه دورية", "تبديل قطع تشغيلية", "أولوية جدولة"], featured: true },
  { name: "مؤسسي", freq: "أسبوعي + مراقبة عن بعد", resp: "استجابة 24 ساعة", best: "الجهات الحكومية والمولات والمستشفيات", items: ["كل ما في الاحترافي", "مراقبة IoT 24/7", "مدير حساب مخصص", "تقارير KPI شهرية"] },
];

function SlaTiers() {
  return (
    <section className="bg-black/20 border-y border-white/10">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <Reveal><SectionHead kicker="SLA CONTRACTS" title="عقود الصيانة الدورية" desc="ثلاث باقات بمستويات خدمة موثقة، صممناها لتناسب حجم ومتطلبات كل عميل." /></Reveal>
        <div className="grid gap-5 md:grid-cols-3">
          {slaTiers.map((t, i) => (
            <Reveal key={t.name} delay={i * 80}>
              <div className={`relative rounded-2xl p-6 h-full border ${t.featured ? "gradient-border border-transparent" : "glass border-white/10"}`}>
                {t.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 btn-gold rounded-full px-3 py-1 text-[10px] font-bold">الأكثر طلباً</div>
                )}
                <h3 className="text-xl font-bold mb-1">{t.name}</h3>
                <div className="text-xs text-muted-foreground mb-4">{t.best}</div>
                <div className="flex gap-2 mb-5">
                  <span className="glass-gold rounded-lg px-2.5 py-1 text-[11px]">{t.freq}</span>
                  <span className="glass rounded-lg px-2.5 py-1 text-[11px] border border-white/10">{t.resp}</span>
                </div>
                <ul className="space-y-2.5 mb-6">
                  {t.items.map((it) => (
                    <li key={it} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 size={16} className="text-gold mt-0.5 shrink-0" />
                      <span className="text-foreground/90">{it}</span>
                    </li>
                  ))}
                </ul>
                <a href="#quote" className={`w-full block text-center rounded-xl px-4 py-2.5 text-sm font-bold ${t.featured ? "btn-gold" : "glass hover:glass-gold border border-white/10"}`}>
                  اطلب تفاصيل الباقة
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <Reveal><SectionHead kicker="FAQ" title="الأسئلة الشائعة" /></Reveal>
      <div className="space-y-3">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="glass rounded-2xl border border-white/10 overflow-hidden">
              <button onClick={() => setOpen(isOpen ? null : i)} className="w-full flex items-center justify-between gap-4 p-5 text-right">
                <span className="font-bold">{f.q}</span>
                <span className="grid place-items-center h-8 w-8 rounded-lg glass-gold shrink-0">
                  {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                </span>
              </button>
              <div className="grid transition-all duration-300" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function QuoteForm() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    org: "", sector: "", contact: "", email: "", phone: "", city: "", project: "", timeline: "", budget: "", details: "",
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = `طلب عرض سعر مؤسسي — أكوا هيفن\n\nالجهة: ${form.org}\nالقطاع: ${form.sector}\nالمسؤول: ${form.contact}\nالبريد: ${form.email}\nالجوال: ${form.phone}\nالمدينة: ${form.city}\nنوع المشروع: ${form.project}\nالجدول الزمني: ${form.timeline}\nالميزانية: ${form.budget}\n\nالتفاصيل:\n${form.details}`;
    window.open(whatsappLink(msg), "_blank");
    setSent(true);
  };
  const input = "w-full glass rounded-xl px-4 py-3 text-sm border border-white/10 focus:border-[color:var(--gold)]/60 outline-none transition";
  return (
    <section id="quote" className="mx-auto max-w-6xl px-6 py-20">
      <Reveal>
        <div className="gradient-border rounded-3xl p-1">
          <div className="glass rounded-[calc(1.5rem-4px)] p-8 md:p-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <div className="text-xs tracking-widest text-gradient-gold mb-3">REQUEST A QUOTE</div>
                <h2 className="text-3xl font-bold mb-4">نموذج طلب عرض سعر مؤسسي</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  املأ البيانات وسيتواصل معك مدير حسابات مؤسسية خلال ساعات العمل مع عرض سعر مبدئي ومقترح جدول زمني.
                </p>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3"><Phone size={16} className="text-gold" /> +966 55 000 0000</div>
                  <div className="flex items-center gap-3"><Mail size={16} className="text-gold" /> b2b@aqh.sa</div>
                  <div className="flex items-center gap-3"><MapPin size={16} className="text-gold" /> الرياض — تغطية جميع مناطق المملكة</div>
                </div>
                <div className="mt-8 glass-gold rounded-2xl p-5 border border-[color:var(--gold)]/20">
                  <div className="flex items-center gap-2 font-bold mb-2"><HardHat size={16} className="text-gold" /> ما ستحصل عليه</div>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li>• عرض سعر مفصّل خلال 48 ساعة</li>
                    <li>• مقترح تصميم مبدئي مع خيارات</li>
                    <li>• جدول زمني ومسودة عقد SLA</li>
                  </ul>
                </div>
              </div>
              <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
                <input required placeholder="اسم الجهة" value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} className={input} />
                <select required value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} className={input}>
                  <option value="">القطاع</option>
                  {["جهة حكومية","فندق / منتجع","شركة / مقر أعمال","مطعم / كافيه","مول / معرض","مستشفى / عيادة","مدرسة / جامعة","مجمع سكني","أخرى"].map(s => <option key={s}>{s}</option>)}
                </select>
                <input required placeholder="اسم المسؤول" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className={input} />
                <input placeholder="البريد الإلكتروني" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
                <input required placeholder="رقم الجوال" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} />
                <input required placeholder="المدينة" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={input} />
                <select required value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} className={input}>
                  <option value="">نوع المشروع</option>
                  {["توريد وتركيب حوض جديد","نظام أحواض مركزي","عقد صيانة SLA","أحواض عرض تجارية","نظام مأكولات بحرية حية","استشارة تصميم فقط"].map(s => <option key={s}>{s}</option>)}
                </select>
                <select value={form.timeline} onChange={(e) => setForm({ ...form, timeline: e.target.value })} className={input}>
                  <option value="">الجدول الزمني</option>
                  {["خلال شهر","1-3 أشهر","3-6 أشهر","أكثر من 6 أشهر"].map(s => <option key={s}>{s}</option>)}
                </select>
                <select value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className={`${input} sm:col-span-2`}>
                  <option value="">الميزانية التقديرية</option>
                  {["أقل من 25,000 ريال","25,000 - 75,000 ريال","75,000 - 200,000 ريال","200,000 - 500,000 ريال","أكثر من 500,000 ريال"].map(s => <option key={s}>{s}</option>)}
                </select>
                <textarea placeholder="تفاصيل إضافية عن المشروع، المساحة، والمتطلبات الخاصة" rows={4} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} className={`${input} sm:col-span-2 resize-none`} />
                <button type="submit" className="btn-gold rounded-xl px-6 py-3.5 text-sm font-bold sm:col-span-2 inline-flex items-center justify-center gap-2">
                  <MessageCircle size={16} /> إرسال الطلب عبر واتساب
                </button>
                {sent && <div className="text-xs text-gold sm:col-span-2 text-center">تم فتح واتساب. سنعود إليك خلال 48 ساعة.</div>}
              </form>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-white/10">
      <div className="absolute inset-0 -z-10">
        <img src={marineCubeAsset.url} alt="" className="w-full h-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/70" />
      </div>
      <div className="mx-auto max-w-4xl px-6 py-24 text-center">
        <Reveal>
          <h2 className="text-3xl sm:text-5xl font-black mb-5">
            جاهزون لبناء
            <span className="text-gradient-gold"> شراكة طويلة الأمد</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            احجز استشارة مجانية مع فريقنا المؤسسي، ودعنا نصمم لك حلاً يعكس مكانة مؤسستك.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/consultation" className="btn-gold rounded-xl px-6 py-3.5 text-sm font-bold inline-flex items-center gap-2">
              احجز استشارة مجانية <ArrowLeft size={16} />
            </Link>
            <a href={whatsappLink("السلام عليكم، أرغب بمناقشة مشروع B2B مع أكوا هيفن.")}
               target="_blank" rel="noopener noreferrer"
               className="glass hover:glass-gold rounded-xl px-6 py-3.5 text-sm font-bold inline-flex items-center gap-2 border border-white/10">
              <MessageCircle size={16} /> تواصل مباشر
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
