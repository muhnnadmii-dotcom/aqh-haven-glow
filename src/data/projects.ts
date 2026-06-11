import livingRoomTank from "../assets/aqh-living-room-tank.png.asset.json";
import saudiService from "../assets/aqh-saudi-service.png.asset.json";
import marineCube from "../assets/aqh-marine-cube.png.asset.json";
import styledAquarium from "../assets/aqh-styled-aquarium.png.asset.json";
import consultationTank from "../assets/aqh-consultation-tank.png.asset.json";
import counterAquarium from "../assets/aqh-counter-aquarium.png.asset.json";
import bannerTank from "../assets/aqh-banner-tank.png.asset.json";

export type ProjectCategory = "home" | "commercial" | "marine" | "planted";

export type Project = {
  id: number;
  slug: string;
  title: string;
  cat: ProjectCategory;
  catLabel: string;
  featured?: boolean;
  location: string;
  year: string;
  duration: string;
  cover: string;
  images: string[];
  description: string;
  specs: {
    dimensions: string;
    volumeLiters: string;
    glassType: string;
    systemType: string;
  };
  equipment: {
    filter: string;
    lighting: string;
    heatingCooling?: string;
    waveMakers?: string;
    co2?: string;
  };
  contents: {
    fish: string[];
    plantsOrCorals?: string[];
    decor?: string;
  };
  priceRange: { min: number; max: number; currency: "SAR" };
};

export const projects: Project[] = [
  {
    id: 1,
    slug: "villa-riyadh",
    title: "حوض فيلا الرياض",
    cat: "home",
    catLabel: "حوض منزلي",
    featured: true,
    location: "الرياض — حي الياسمين",
    year: "2025",
    duration: "أسبوعان",
    cover: livingRoomTank.url,
    images: [livingRoomTank.url, consultationTank.url, styledAquarium.url, bannerTank.url],
    description:
      "حوض جداري فاخر مدمج في صالة فيلا، يجمع بين الديكور المعاصر وحياة مائية متنوعة. صُمم خصيصاً ليكون قطعة محورية في المجلس مع إضاءة مسرحية ونظام فلترة صامت.",
    specs: {
      dimensions: "240 × 80 × 70 سم",
      volumeLiters: "1,344 لتر",
      glassType: "زجاج Optiwhite بسماكة 15 ملم",
      systemType: "نباتي عذب مفتوح",
    },
    equipment: {
      filter: "فلتر خارجي Canister — Oase BioMaster 850",
      lighting: "إضاءة LED احترافية Chihiros WRGB II Pro",
      heatingCooling: "سخان Eheim 300W × 2 + مروحة تبريد",
      co2: "نظام CO₂ مضغوط مع ساعة ليلية",
    },
    contents: {
      fish: ["Discus", "Cardinal Tetra", "Corydoras", "Otocinclus", "Bristlenose Pleco"],
      plantsOrCorals: ["Monte Carlo", "Rotala H'ra", "Bucephalandra", "Anubias Nana"],
      decor: "صخور Seiryu وأخشاب Spider Wood",
    },
    priceRange: { min: 28000, max: 42000, currency: "SAR" },
  },
  {
    id: 2,
    slug: "waterfront-restaurant",
    title: "مطعم الواجهة البحرية",
    cat: "commercial",
    catLabel: "مشروع تجاري",
    featured: true,
    location: "الرياض — بوليفارد",
    year: "2025",
    duration: "4 أسابيع",
    cover: saudiService.url,
    images: [saudiService.url, marineCube.url, bannerTank.url],
    description:
      "حوض بحري واجهة لمطعم راقٍ، نُفِّذ بمعايير الضيافة الفاخرة مع نظام دعم حياة بحري متكامل وعقد صيانة دورية لضمان الاستقرار البيولوجي.",
    specs: {
      dimensions: "400 × 120 × 100 سم",
      volumeLiters: "4,800 لتر",
      glassType: "زجاج Low-Iron بسماكة 19 ملم",
      systemType: "حي بحري — Reef",
    },
    equipment: {
      filter: "نظام Sump احترافي + Protein Skimmer Bubble Magus",
      lighting: "إضاءة Reef LED — Radion XR30 G6 × 4",
      heatingCooling: "Chiller 1HP + سخانات Titanium",
      waveMakers: "مضخات موجة EcoTech MP40 × 2",
    },
    contents: {
      fish: ["Yellow Tang", "Clownfish", "Blue Tang", "Wrasse", "Anthias"],
      plantsOrCorals: ["SPS Corals", "LPS Corals", "Zoanthids", "Mushroom Corals"],
      decor: "صخور حية Live Rock + رمل أراجونيت",
    },
    priceRange: { min: 180000, max: 260000, currency: "SAR" },
  },
  {
    id: 3,
    slug: "private-reef-cube",
    title: "حوض مرجاني خاص",
    cat: "marine",
    catLabel: "حوض بحري",
    featured: true,
    location: "الرياض — حي السفارات",
    year: "2024",
    duration: "3 أسابيع",
    cover: marineCube.url,
    images: [marineCube.url, styledAquarium.url, counterAquarium.url],
    description:
      "حوض بحري مكعب بتصميم نظيف وتوازن بصري يبرز الأسماك والمرجان. مثالي للمكاتب التنفيذية والمساحات الخاصة.",
    specs: {
      dimensions: "180 × 60 × 60 سم",
      volumeLiters: "648 لتر",
      glassType: "زجاج Optiwhite بسماكة 12 ملم",
      systemType: "ريف بحري — Mixed Reef",
    },
    equipment: {
      filter: "Sump مدمج + Skimmer Reef Octopus",
      lighting: "AI Hydra 32HD × 2",
      heatingCooling: "Chiller صغير + سخان 200W",
      waveMakers: "MP10 × 2",
    },
    contents: {
      fish: ["Clownfish", "Royal Gramma", "Firefish", "Goby"],
      plantsOrCorals: ["Zoanthids", "Euphyllia", "Acropora"],
      decor: "Aquascape مرجاني مفتوح",
    },
    priceRange: { min: 55000, max: 85000, currency: "SAR" },
  },
  // — هياكل جاهزة للإضافة لاحقاً —
  {
    id: 4,
    slug: "natural-planted",
    title: "حوض نباتي طبيعي",
    cat: "planted",
    catLabel: "حوض نباتي",
    location: "الرياض",
    year: "2024",
    duration: "10 أيام",
    cover: styledAquarium.url,
    images: [styledAquarium.url, livingRoomTank.url],
    description: "تكوين Aquascape طبيعي على طراز الغابات اليابانية بإخراج بصري هادئ.",
    specs: {
      dimensions: "120 × 50 × 50 سم",
      volumeLiters: "300 لتر",
      glassType: "Optiwhite 10 ملم",
      systemType: "نباتي عذب",
    },
    equipment: {
      filter: "Canister خارجي",
      lighting: "Chihiros WRGB II",
      co2: "نظام CO₂ مضغوط",
    },
    contents: {
      fish: ["Neon Tetra", "Cherry Shrimp"],
      plantsOrCorals: ["Hemianthus", "Eleocharis"],
    },
    priceRange: { min: 12000, max: 22000, currency: "SAR" },
  },
  {
    id: 5,
    slug: "executive-office",
    title: "مكتب تنفيذي - حي السفارات",
    cat: "home",
    catLabel: "حوض منزلي",
    location: "الرياض",
    year: "2024",
    duration: "أسبوعان",
    cover: consultationTank.url,
    images: [consultationTank.url, livingRoomTank.url],
    description: "حوض زجاجي بإطار خفي ينسجم مع بيئات العمل والضيافة الراقية.",
    specs: {
      dimensions: "200 × 60 × 70 سم",
      volumeLiters: "840 لتر",
      glassType: "Optiwhite 12 ملم",
      systemType: "نباتي عذب",
    },
    equipment: {
      filter: "Sump فلتر",
      lighting: "إضاءة LED احترافية",
    },
    contents: {
      fish: ["Angelfish", "Tetra"],
      plantsOrCorals: ["Anubias", "Java Fern"],
    },
    priceRange: { min: 18000, max: 30000, currency: "SAR" },
  },
  {
    id: 6,
    slug: "counter-display",
    title: "ركن عرض داخلي",
    cat: "commercial",
    catLabel: "مشروع تجاري",
    location: "الرياض",
    year: "2024",
    duration: "أسبوع",
    cover: counterAquarium.url,
    images: [counterAquarium.url, bannerTank.url],
    description: "تصميم مناسب لأسطح العرض والكونترات مع حضور بصري قوي ومساحة مدمجة.",
    specs: {
      dimensions: "160 × 60 × 60 سم",
      volumeLiters: "576 لتر",
      glassType: "Optiwhite 10 ملم",
      systemType: "عذب مزروع",
    },
    equipment: {
      filter: "فلترة هادئة Hang-on",
      lighting: "إضاءة عرض LED",
    },
    contents: {
      fish: ["Guppy", "Molly"],
    },
    priceRange: { min: 9000, max: 16000, currency: "SAR" },
  },
];

export function formatPriceRange(p: Project["priceRange"]) {
  const fmt = (n: number) => n.toLocaleString("ar-SA");
  return `${fmt(p.min)} — ${fmt(p.max)} ر.س`;
}

export function formatPriceFrom(p: Project["priceRange"]) {
  return `من ${p.min.toLocaleString("ar-SA")} ر.س`;
}
