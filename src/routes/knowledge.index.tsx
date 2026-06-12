import { createFileRoute, Link } from "@tanstack/react-router";
import { Reveal } from "../components/Reveal";
import { ArrowLeft, Clock } from "lucide-react";
import styledAquariumAsset from "../assets/aqh-styled-aquarium.png.asset.json";
import counterAquariumAsset from "../assets/aqh-counter-aquarium.png.asset.json";
import canisterFilterAsset from "../assets/aqh-canister-filter.jpg.asset.json";
import livingRoomTankAsset from "../assets/aqh-living-room-tank.png.asset.json";

const styledAquarium = styledAquariumAsset.url;
const counterAquarium = counterAquariumAsset.url;
const canisterFilter = canisterFilterAsset.url;
const livingRoomTank = livingRoomTankAsset.url;

export const Route = createFileRoute("/knowledge/")({
  head: () => ({
    meta: [
      { title: "مركز المعرفة — أكوا هيفن" },
      { name: "description", content: "أدلة احترافية للعناية بالأسماك والنباتات وكيمياء المياه من خبراء أكوا هيفن." },
      { property: "og:title", content: "مركز المعرفة — أكوا هيفن" },
      { property: "og:description", content: "أدلة العناية بعالمك المائي." },
      { property: "og:url", content: "/knowledge" },
    ],
    links: [{ rel: "canonical", href: "/knowledge" }],
  }),
  component: KnowledgePage,
});

const articles = [
  { slug: "betta-care", img: styledAquarium, title: "العناية بسمك البيتا", excerpt: "كل ما تحتاج معرفته لتربية البيتا في بيئة مناسبة وصحية.", time: "6 دقائق", tag: "العناية بالأسماك" },
  { slug: "planted-tank", img: livingRoomTank, title: "تأسيس حوض نباتي", excerpt: "خطوات تأسيس حوض نباتي ناجح من الصفر.", time: "10 دقائق", tag: "الأحواض النباتية" },
  { slug: "shrimp-breeding", img: counterAquarium, title: "تربية الروبيان", excerpt: "دليلك المبسط لتربية روبيان النيوكاريدينا والكرستال.", time: "8 دقائق", tag: "اللافقاريات" },
  { slug: "water-chemistry", img: canisterFilter, title: "كيمياء المياه", excerpt: "فهم pH والأمونيا والنتريت لحوض صحي ومستقر.", time: "12 دقيقة", tag: "أساسيات" },
  { slug: "choosing-plants", img: livingRoomTank, title: "اختيار النباتات المناسبة", excerpt: "كيف تختار نباتات تتناسب مع إضاءتك وحوضك.", time: "7 دقائق", tag: "الأحواض النباتية" },
  { slug: "shrimp-breeding-advanced", img: counterAquarium, title: "تكاثر الروبيان", excerpt: "متطلبات نجاح تكاثر الروبيان في المنزل.", time: "9 دقائق", tag: "اللافقاريات" },
  { slug: "reef-basics", img: styledAquarium, title: "أساسيات الحوض البحري المرجاني", excerpt: "كل ما يحتاجه المبتدئ لبدء حوض ريف ناجح.", time: "14 دقيقة", tag: "الأحواض البحرية" },
  { slug: "marine-cycling", img: canisterFilter, title: "دورة الحوض البحري", excerpt: "كيف تؤسس الدورة البيولوجية في حوض بحري جديد.", time: "11 دقيقة", tag: "الأحواض البحرية" },
  { slug: "lighting-guide", img: livingRoomTank, title: "دليل الإضاءة الكامل", excerpt: "اختيار الإضاءة المناسبة بين الأحواض النهرية والبحرية.", time: "9 دقائق", tag: "أساسيات" },
  { slug: "fighting-algae", img: counterAquarium, title: "محاربة الطحالب", excerpt: "أسباب ظهور الطحالب وأفضل الطرق للتعامل معها.", time: "8 دقائق", tag: "أساسيات" },
  { slug: "feeding-schedule", img: styledAquarium, title: "جدول التغذية المثالي", excerpt: "كم مرة وكم كمية يجب أن تطعم أسماكك.", time: "5 دقائق", tag: "العناية بالأسماك" },
  { slug: "co2-system", img: canisterFilter, title: "نظام ثاني أكسيد الكربون", excerpt: "متى تحتاج CO₂ وكيف تختار النظام المناسب.", time: "10 دقائق", tag: "الأحواض النباتية" },
];

function KnowledgePage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <Reveal>
        <div className="text-center mb-14">
          <div className="text-xs tracking-widest text-gradient-gold mb-3">KNOWLEDGE</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">مركز المعرفة</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            أدلة عملية مكتوبة بخبرة لمساعدتك على بناء عالم مائي مزدهر.
          </p>
        </div>
      </Reveal>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((a, i) => (
          <Reveal key={a.slug} delay={i * 80}>
            <Link to="/knowledge/$slug" params={{ slug: a.slug }} className="block h-full">
              <article className="glass rounded-2xl overflow-hidden group h-full flex flex-col hover:glass-gold transition-all">
                <div className="overflow-hidden">
                  <img src={a.img} alt={a.title} width={1024} height={768} loading="lazy"
                    className="h-56 w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span className="text-gradient-gold">{a.tag}</span>
                    <span className="flex items-center gap-1"><Clock size={12} aria-hidden /> {a.time}</span>
                  </div>
                  <h2 className="text-lg font-bold mb-2">{a.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">{a.excerpt}</p>
                  <span className="inline-flex items-center gap-2 text-sm text-gradient-gold">
                    اقرأ المقال <ArrowLeft size={14} aria-hidden />
                  </span>
                </div>
              </article>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
