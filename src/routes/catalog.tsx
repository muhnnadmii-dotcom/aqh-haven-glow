import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Reveal } from "../components/Reveal";
import livingRoomTankAsset from "../assets/aqh-living-room-tank.png.asset.json";
import marineCubeAsset from "../assets/aqh-marine-cube.png.asset.json";
import styledAquariumAsset from "../assets/aqh-styled-aquarium.png.asset.json";
import counterAquariumAsset from "../assets/aqh-counter-aquarium.png.asset.json";
import canisterFilterAsset from "../assets/aqh-canister-filter.jpg.asset.json";
import hangonFilterAsset from "../assets/aqh-hangon-filter.jpg.asset.json";

const livingRoomTank = livingRoomTankAsset.url;
const marineCube = marineCubeAsset.url;
const styledAquarium = styledAquariumAsset.url;
const counterAquarium = counterAquariumAsset.url;
const canisterFilter = canisterFilterAsset.url;
const hangonFilter = hangonFilterAsset.url;

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "الكاتلوج — أكوا هيفن" },
      { name: "description", content: "تصفح كاتلوج أكوا هيفن من أحواض وأسماك وروبيان ونباتات ومعدات." },
      { property: "og:title", content: "الكاتلوج — أكوا هيفن" },
      { property: "og:description", content: "كاتلوج المنتجات: أحواض، أسماك، روبيان، نباتات، معدات." },
      { property: "og:url", content: "/catalog" },
    ],
    links: [{ rel: "canonical", href: "/catalog" }],
  }),
  component: CatalogPage,
});

type Cat = "all" | "tanks" | "fish" | "shrimp" | "plants" | "equipment";

const products: { id: number; name: string; cat: Exclude<Cat, "all">; desc: string; img: string }[] = [
  { id: 1, name: "حوض زجاجي بصري ١٢٠ سم", cat: "tanks", desc: "زجاج بصري عالي الشفافية بإطار خفي.", img: livingRoomTank },
  { id: 2, name: "حوض نباتي ٦٠ سم", cat: "tanks", desc: "حوض جاهز للزراعة بأبعاد مثالية.", img: styledAquarium },
  { id: 3, name: "سمكة البيتا - هاف مون", cat: "fish", desc: "خيار مثالي للأحواض الصغيرة الأنيقة.", img: styledAquarium },
  { id: 4, name: "سمكة المهرج Ocellaris", cat: "fish", desc: "سمكة بحرية شهيرة وسهلة الرعاية.", img: marineCube },
  { id: 5, name: "روبيان كرستال أحمر", cat: "shrimp", desc: "روبيان زينة بدرجة A تدريجية.", img: counterAquarium },
  { id: 6, name: "روبيان نيوكاريدينا", cat: "shrimp", desc: "ألوان متعددة وسهل التربية.", img: counterAquarium },
  { id: 7, name: "نبات Monte Carlo", cat: "plants", desc: "نبات أرضي زاحف منخفض النمو.", img: livingRoomTank },
  { id: 8, name: "نبات Buce", cat: "plants", desc: "نبات بطيء النمو ومناسب للمبتدئين.", img: styledAquarium },
  { id: 9, name: "فلتر خارجي 1200L/h", cat: "equipment", desc: "فلتر احترافي بفعالية فلترة عالية.", img: canisterFilter },
  { id: 10, name: "فلتر علوي مدمج", cat: "equipment", desc: "حل عملي للأحواض المنزلية الصغيرة والمتوسطة.", img: hangonFilter },
];

const tabs: { id: Cat; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "tanks", label: "أحواض" },
  { id: "fish", label: "أسماك" },
  { id: "shrimp", label: "روبيان" },
  { id: "plants", label: "نباتات" },
  { id: "equipment", label: "معدات" },
];

function CatalogPage() {
  const [cat, setCat] = useState<Cat>("all");
  const filtered = cat === "all" ? products : products.filter((p) => p.cat === cat);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <Reveal>
        <div className="text-center mb-12">
          <div className="text-xs tracking-widest text-gradient-gold mb-3">CATALOG</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">الكاتلوج</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            استعرض مجموعتنا. الطلب يتم مباشرة من المتجر الإلكتروني.
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

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((p, i) => (
          <Reveal key={p.id} delay={i * 60}>
            <div className="glass rounded-2xl overflow-hidden group h-full flex flex-col">
              <div className="overflow-hidden">
                <img src={p.img} alt={p.name} width={1024} height={768} loading="lazy"
                  className="h-52 w-full object-cover transition-transform duration-700 group-hover:scale-110" />
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold mb-2">{p.name}</h3>
                <p className="text-sm text-muted-foreground mb-5 flex-1">{p.desc}</p>
                <a href="https://aqh.sa" target="_blank" rel="noopener noreferrer"
                  className="btn-outline-gold rounded-xl px-4 py-2.5 text-sm text-center">
                  اطلبه من المتجر
                </a>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
