import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Reveal } from "../components/Reveal";
import { X } from "lucide-react";
import p1 from "../assets/project-1.jpg";
import p2 from "../assets/project-2.jpg";
import p3 from "../assets/project-3.jpg";
import p4 from "../assets/project-4.jpg";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "أعمالنا — أكوا هيفن" },
      { name: "description", content: "مجموعة مختارة من مشاريع أكوا هيفن: أحواض منزلية ومشاريع تجارية وأحواض بحرية ونباتية." },
      { property: "og:title", content: "أعمالنا — أكوا هيفن" },
      { property: "og:description", content: "مشاريع مختارة من أحواض منزلية وتجارية وبحرية ونباتية." },
    ],
  }),
  component: PortfolioPage,
});

type Cat = "all" | "home" | "commercial" | "marine" | "planted";

const projects: {
  id: number;
  img: string;
  title: string;
  cat: Exclude<Cat, "all">;
  catLabel: string;
  dims: string;
  system: string;
  equip: string;
  desc: string;
}[] = [
  { id: 1, img: p1, title: "حوض فيلا الرياض", cat: "home", catLabel: "حوض منزلي", dims: "240×80×70 سم", system: "نباتي مفتوح", equip: "فلتر خارجي، إضاءة LED مخصصة", desc: "حوض جداري فاخر مدمج في صالة فيلا، يجمع بين الديكور المعاصر وحياة مائية متنوعة." },
  { id: 2, img: p2, title: "مطعم الواجهة البحرية", cat: "commercial", catLabel: "مشروع تجاري", dims: "400×120×100 سم", system: "حي بحري", equip: "نظام تبريد متقدم، فلتر بروتين", desc: "نظام مأكولات بحرية حية يضمن جودة عرض وحفظ المخزون الحي في المطعم." },
  { id: 3, img: p3, title: "حوض مرجاني خاص", cat: "marine", catLabel: "حوض بحري", dims: "180×60×60 سم", system: "ريف بحري", equip: "إضاءة Reef LED، Skimmer، Wave Maker", desc: "حوض مرجاني مزدهر بمرجانيات ملونة وأسماك مهرج، بإضاءة احترافية." },
  { id: 4, img: p4, title: "حوض نباتي طبيعي", cat: "planted", catLabel: "حوض نباتي", dims: "120×50×50 سم", system: "نباتي عذب", equip: "CO₂، ركيزة مغذية، فلتر داخلي", desc: "تكوين Aquascape طبيعي على طراز الغابات اليابانية." },
  { id: 5, img: p1, title: "مكتب تنفيذي - حي السفارات", cat: "home", catLabel: "حوض منزلي", dims: "200×60×70 سم", system: "نباتي عذب", equip: "إضاءة احترافية، Sump فلتر", desc: "حوض زجاجي بإطار خفي، تركيب في مكتب تنفيذي." },
  { id: 6, img: p2, title: "فندق راقي - الرياض", cat: "commercial", catLabel: "مشروع تجاري", dims: "600×100×150 سم", system: "بحري سيكلت", equip: "نظام إعادة تدوير، فلتر صناعي", desc: "حوض ضخم في لوبي فندق ٥ نجوم بأسماك بحرية متنوعة." },
];

const tabs: { id: Cat; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "home", label: "أحواض منزلية" },
  { id: "commercial", label: "مشاريع تجارية" },
  { id: "marine", label: "أحواض بحرية" },
  { id: "planted", label: "أحواض نباتية" },
];

function PortfolioPage() {
  const [cat, setCat] = useState<Cat>("all");
  const [open, setOpen] = useState<(typeof projects)[number] | null>(null);

  const filtered = cat === "all" ? projects : projects.filter((p) => p.cat === cat);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <Reveal>
        <div className="text-center mb-12">
          <div className="text-xs tracking-widest text-gradient-gold mb-3">PORTFOLIO</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">أعمالنا</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            مجموعة من مشاريعنا المختارة التي تجسد فلسفتنا في الجمع بين التصميم الفاخر والهندسة الدقيقة.
          </p>
        </div>
      </Reveal>

      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setCat(t.id)}
            className={`px-5 py-2.5 rounded-xl text-sm transition-all ${
              cat === t.id ? "btn-gold" : "glass hover:glass-gold"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p, i) => (
          <Reveal key={p.id} delay={i * 80}>
            <button onClick={() => setOpen(p)} className="group block w-full text-right">
              <div className="relative overflow-hidden rounded-2xl glass">
                <img src={p.img} alt={p.title} width={1024} height={768} loading="lazy"
                  className="h-72 w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
                <div className="absolute bottom-0 right-0 left-0 p-5">
                  <div className="text-xs text-gradient-gold mb-1">{p.catLabel}</div>
                  <div className="text-lg font-bold">{p.title}</div>
                </div>
              </div>
            </button>
          </Reveal>
        ))}
      </div>

      {open && (
        <div
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md grid place-items-center p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass rounded-3xl max-w-4xl w-full overflow-hidden relative my-8"
          >
            <button
              onClick={() => setOpen(null)}
              className="absolute top-4 left-4 z-10 grid place-items-center h-10 w-10 rounded-full glass-gold"
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>
            <img src={open.img} alt={open.title} className="w-full h-80 object-cover" />
            <div className="p-8">
              <div className="text-xs text-gradient-gold mb-2">{open.catLabel}</div>
              <h3 className="text-2xl font-bold mb-4">{open.title}</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">{open.desc}</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="glass-gold rounded-xl p-4">
                  <div className="text-xs text-muted-foreground mb-1">الأبعاد</div>
                  <div className="font-semibold text-sm">{open.dims}</div>
                </div>
                <div className="glass-gold rounded-xl p-4">
                  <div className="text-xs text-muted-foreground mb-1">النظام</div>
                  <div className="font-semibold text-sm">{open.system}</div>
                </div>
                <div className="glass-gold rounded-xl p-4">
                  <div className="text-xs text-muted-foreground mb-1">المعدات</div>
                  <div className="font-semibold text-sm">{open.equip}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
