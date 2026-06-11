import { createFileRoute, Link } from "@tanstack/react-router";
import { Reveal } from "../components/Reveal";
import { ArrowLeft, Clock } from "lucide-react";
import betta from "../assets/article-betta.jpg";
import shrimp from "../assets/article-shrimp.jpg";
import chem from "../assets/article-chemistry.jpg";
import planted from "../assets/project-4.jpg";

export const Route = createFileRoute("/knowledge")({
  head: () => ({
    meta: [
      { title: "مركز المعرفة — أكوا هيفن" },
      { name: "description", content: "أدلة احترافية للعناية بالأسماك والنباتات وكيمياء المياه من أكوا هيفن." },
      { property: "og:title", content: "مركز المعرفة — أكوا هيفن" },
      { property: "og:description", content: "أدلة العناية بعالمك المائي." },
    ],
  }),
  component: KnowledgePage,
});

const articles = [
  { id: 1, img: betta, title: "العناية بسمك البيتا", excerpt: "كل ما تحتاج معرفته لتربية البيتا في بيئة مناسبة وصحية.", time: "6 دقائق", tag: "العناية بالأسماك" },
  { id: 2, img: planted, title: "تأسيس حوض نباتي", excerpt: "خطوات تأسيس حوض نباتي ناجح من الصفر.", time: "10 دقائق", tag: "الأحواض النباتية" },
  { id: 3, img: shrimp, title: "تربية الروبيان", excerpt: "دليلك المبسط لتربية روبيان النيوكاريدينا والكرستال.", time: "8 دقائق", tag: "اللافقاريات" },
  { id: 4, img: chem, title: "كيمياء المياه", excerpt: "فهم pH والأمونيا والنتريت لحوض صحي ومستقر.", time: "12 دقيقة", tag: "أساسيات" },
  { id: 5, img: planted, title: "اختيار النباتات المناسبة", excerpt: "كيف تختار نباتات تتناسب مع إضاءتك وحوضك.", time: "7 دقائق", tag: "الأحواض النباتية" },
  { id: 6, img: shrimp, title: "تكاثر الروبيان", excerpt: "متطلبات نجاح تكاثر الروبيان في المنزل.", time: "9 دقائق", tag: "اللافقاريات" },
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
          <Reveal key={a.id} delay={i * 80}>
            <article className="glass rounded-2xl overflow-hidden group h-full flex flex-col hover:glass-gold transition-all">
              <div className="overflow-hidden">
                <img src={a.img} alt={a.title} width={1024} height={768} loading="lazy"
                  className="h-56 w-full object-cover transition-transform duration-700 group-hover:scale-110" />
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span className="text-gradient-gold">{a.tag}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {a.time}</span>
                </div>
                <h3 className="text-lg font-bold mb-2">{a.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">{a.excerpt}</p>
                <Link to="/knowledge" className="inline-flex items-center gap-2 text-sm text-gradient-gold">
                  اقرأ المقال <ArrowLeft size={14} />
                </Link>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
