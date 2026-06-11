import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Reveal } from "../components/Reveal";
import { ArrowRight, Clock } from "lucide-react";
import styledAquariumAsset from "../assets/aqh-styled-aquarium.png.asset.json";
import counterAquariumAsset from "../assets/aqh-counter-aquarium.png.asset.json";
import canisterFilterAsset from "../assets/aqh-canister-filter.jpg.asset.json";
import livingRoomTankAsset from "../assets/aqh-living-room-tank.png.asset.json";

const styledAquarium = styledAquariumAsset.url;
const counterAquarium = counterAquariumAsset.url;
const canisterFilter = canisterFilterAsset.url;
const livingRoomTank = livingRoomTankAsset.url;

type Article = {
  slug: string;
  title: string;
  excerpt: string;
  img: string;
  time: string;
  tag: string;
  body: { h: string; p: string }[];
};

const articles: Article[] = [
  {
    slug: "betta-care", title: "العناية بسمك البيتا", excerpt: "دليلك الشامل لتربية البيتا في بيئة صحية ومستقرة.",
    img: styledAquarium, time: "6 دقائق", tag: "العناية بالأسماك",
    body: [
      { h: "الحوض المناسب", p: "البيتا يحتاج حداً أدنى 20 لتراً، مع غطاء لأنه قافز بطبيعته. تجنّب الأحواض الدائرية الصغيرة فهي غير مناسبة لصحته." },
      { h: "درجة الحرارة والمياه", p: "الحرارة المثالية بين 24-28°م، مع pH بين 6.5 و7.5. استخدم سخاناً وتأكد من ثبات الحرارة." },
      { h: "التغذية", p: "أطعم البيتا حبيبات مخصصة 1-2 مرة يومياً بكميات صغيرة، مع يوم صيام أسبوعي لتجنب مشاكل الهضم." },
      { h: "الترفيق", p: "ذكور البيتا عدوانية مع بعضها. يمكن دمج البيتا مع أسماك هادئة لا تشبهها كثيراً في الشكل." },
    ],
  },
  {
    slug: "shrimp-breeding", title: "تربية الروبيان", excerpt: "كل ما تحتاج لتربية روبيان النيوكاريدينا بنجاح.",
    img: counterAquarium, time: "8 دقائق", tag: "اللافقاريات",
    body: [
      { h: "نوع الروبيان", p: "ابدأ بالنيوكاريدينا (الشيري) فهو الأسهل، ثم انتقل إلى الكاريدينا (الكرستال) بعد اكتساب الخبرة." },
      { h: "المياه", p: "النيوكاريدينا يفضل pH بين 6.5-7.5 وقساوة معتدلة. الكاريدينا تحتاج مياهاً أنعم وحموضة أقل." },
      { h: "النباتات والمخبأ", p: "وفر طحالب الموس والنباتات الكثيفة لتوفير ملاجئ للصغار. تجنب الأسماك المفترسة." },
      { h: "الغذاء", p: "أطعمهم بياضاً معتدلاً مرة كل يومين، مع تقديم أوراق نباتية مغلية أحياناً." },
    ],
  },
  {
    slug: "planted-tank", title: "تأسيس حوض نباتي", excerpt: "خطوات تأسيس حوض نباتي ناجح من الصفر.",
    img: livingRoomTank, time: "10 دقائق", tag: "الأحواض النباتية",
    body: [
      { h: "الركيزة المغذية", p: "استخدم ركيزة نشطة أو أضف طبقة سماد تحت رمل الحوض لتوفير المغذيات للنباتات." },
      { h: "الإضاءة", p: "إضاءة LED طيف كامل بـ 6500K لمدة 6-8 ساعات يومياً تكفي لمعظم النباتات." },
      { h: "ثاني أكسيد الكربون", p: "حقن CO₂ يضاعف نمو النباتات ويقلل الطحالب، لكنه ليس ضرورياً لجميع الأنواع." },
      { h: "اختيار النباتات", p: "ابدأ بنباتات سهلة كـ Anubias و Java Fern و Vallisneria قبل الانتقال للنباتات الحساسة." },
    ],
  },
  {
    slug: "water-chemistry", title: "كيمياء المياه", excerpt: "أساسيات pH والقساوة وتوازن الأمونيا في حوضك.",
    img: canisterFilter, time: "12 دقيقة", tag: "أساسيات",
    body: [
      { h: "ما هي الدورة النيتروجينية؟", p: "تحويل الأمونيا الناتجة من الفضلات إلى نتريت ثم نترات أقل ضرراً، وهي أهم عملية في أي حوض." },
      { h: "pH والقساوة", p: "pH يقيس الحموضة، KH يثبتها. حافظ على قيم مستقرة بدلاً من السعي للأرقام المثالية." },
      { h: "الفحص الدوري", p: "افحص الأمونيا والنتريت والنترات أسبوعياً في الأحواض الجديدة، وكل شهر للأحواض المستقرة." },
      { h: "تغيير المياه", p: "غيّر 20-30٪ من المياه أسبوعياً للحفاظ على نظافة وصحة النظام البيئي." },
    ],
  },
  {
    slug: "choosing-plants", title: "اختيار النباتات المناسبة", excerpt: "كيف تختار نباتات تتناسب مع إضاءتك وحوضك.",
    img: livingRoomTank, time: "7 دقائق", tag: "الأحواض النباتية",
    body: [
      { h: "النباتات منخفضة الإضاءة", p: "Anubias, Java Moss, Cryptocoryne مناسبة للإضاءة المتوسطة بلا CO₂." },
      { h: "النباتات عالية الإضاءة", p: "HC Cuba, Monte Carlo, Rotala تحتاج إضاءة قوية و CO₂ للحصول على نمو مثالي." },
      { h: "الترتيب", p: "ضع النباتات الطويلة في الخلف والقصيرة في المقدمة، مع ترك مساحات للحركة." },
    ],
  },
  {
    slug: "shrimp-breeding-advanced", title: "تكاثر الروبيان", excerpt: "متطلبات نجاح تكاثر الروبيان في المنزل.",
    img: counterAquarium, time: "9 دقائق", tag: "اللافقاريات",
    body: [
      { h: "النضج الجنسي", p: "يصل الروبيان لمرحلة التكاثر بعد 3-4 أشهر. يمكنك تمييز الأنثى من سرجها الأصفر تحت البطن." },
      { h: "البيئة المثالية", p: "مياه مستقرة، حرارة 22-26°م، ونباتات كثيفة تشجع التكاثر." },
      { h: "رعاية الصغار", p: "الصغار صور مصغرة من الكبار. وفر مساحات آمنة وأطعمة دقيقة جداً." },
    ],
  },
];

export const Route = createFileRoute("/knowledge/$slug")({
  loader: ({ params }) => {
    const article = articles.find((a) => a.slug === params.slug);
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData, params }) => {
    const a = loaderData?.article;
    return {
      meta: [
        { title: a ? `${a.title} — مركز المعرفة | أكوا هيفن` : "مقال — أكوا هيفن" },
        { name: "description", content: a?.excerpt ?? "" },
        { property: "og:title", content: a?.title ?? "" },
        { property: "og:description", content: a?.excerpt ?? "" },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `/knowledge/${params.slug}` },
      ],
      links: [{ rel: "canonical", href: `/knowledge/${params.slug}` }],
      scripts: a
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: a.title,
                description: a.excerpt,
                articleSection: a.tag,
                author: { "@type": "Organization", name: "أكوا هيفن" },
              }),
            },
          ]
        : undefined,
    };
  },
  component: ArticlePage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-2xl font-bold mb-3">المقال غير موجود</h1>
      <Link to="/knowledge" className="btn-gold rounded-xl px-5 py-2.5 text-sm inline-flex">العودة للمقالات</Link>
    </div>
  ),
});

function ArticlePage() {
  const { article } = Route.useLoaderData() as { article: Article };
  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <Reveal>
        <Link to="/knowledge" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowRight size={16} aria-hidden /> العودة لمركز المعرفة
        </Link>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
          <span className="text-gradient-gold">{article.tag}</span>
          <span className="flex items-center gap-1"><Clock size={12} aria-hidden /> {article.time}</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">{article.title}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-8">{article.excerpt}</p>
        <img
          src={article.img}
          alt={article.title}
          width={1024}
          height={520}
          className="w-full h-64 md:h-96 object-cover rounded-2xl mb-10"
        />
      </Reveal>

      <div className="space-y-8">
        {article.body.map((sec, i) => (
          <Reveal key={sec.h} delay={i * 60}>
            <section>
              <h2 className="text-xl md:text-2xl font-bold mb-3 text-gradient-gold">{sec.h}</h2>
              <p className="text-foreground/85 leading-loose">{sec.p}</p>
            </section>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="mt-14 glass-gold rounded-2xl p-6 text-center">
          <div className="font-bold mb-2">هل تحتاج استشارة متخصصة؟</div>
          <p className="text-sm text-muted-foreground mb-4">فريقنا جاهز لمساعدتك في تطبيق ما تعلمته.</p>
          <Link to="/contact" className="btn-gold rounded-xl px-6 py-3 text-sm inline-flex">تواصل معنا</Link>
        </div>
      </Reveal>
    </article>
  );
}
