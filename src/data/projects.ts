import livingRoomTank from "../assets/aqh-living-room-tank.png.asset.json";
import saudiService from "../assets/aqh-saudi-service.png.asset.json";
import marineCube from "../assets/aqh-marine-cube.png.asset.json";
import styledAquarium from "../assets/aqh-styled-aquarium.png.asset.json";
import consultationTank from "../assets/aqh-consultation-tank.png.asset.json";
import counterAquarium from "../assets/aqh-counter-aquarium.png.asset.json";
import bannerTank from "../assets/aqh-banner-tank.png.asset.json";
import qairawan1 from "../assets/qairawan-1.png.asset.json";
import qairawan2 from "../assets/qairawan-2.png.asset.json";
import qairawan3 from "../assets/qairawan-3.png.asset.json";
import qairawan4 from "../assets/qairawan-4.png.asset.json";
import qairawan5 from "../assets/qairawan-5.png.asset.json";

export type ProjectCategory = "home" | "commercial" | "planted";

export type Project = {
  id: number;
  slug: string;
  title: string;
  cat: ProjectCategory;
  catLabel: string;
  featured?: boolean;
  location: string;
  year: string;
  cover: string;
  images: string[];
  description: string;
  specs: {
    dimensions: string;
    volumeLiters: string;
    glassType: string;
    systemType: string;
    totalSystemVolume?: string;
    glassBonding?: string;
    parIntensity?: string;
    turnover?: string;
  };
  equipment: {
    filter: string;
    lighting: string;
    heatingCooling?: string;
    waveMakers?: string;
    co2?: string;
    skimmer?: string;
    returnPump?: string;
  };
  waterSystem?: {
    roDi?: string;
    storage?: string;
    ato?: string;
    salt?: string;
  };
  automation?: {
    controller?: string;
    sensors?: string;
    dosing?: string;
    alerts?: string;
  };
  serviceWarranty?: {
    schedule: string;
    equipmentWarranty: string;
    livestockWarranty: string;
    support: string;
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
    slug: "villa-qairawan",
    title: "حوض فيلا القيروان",
    cat: "home",
    catLabel: "حوض منزلي",
    featured: true,
    location: "الرياض — حي القيروان",
    year: "2026",
    cover: qairawan3.url,
    images: [qairawan1.url, qairawan2.url, qairawan3.url, qairawan4.url, qairawan5.url],
    description:
      "حوض بحري فاخر مُنفّذ داخل فيلا بحي القيروان، يجمع بين تصميم خزانة سوداء أنيقة وإضاءة ريف احترافية تُبرز جمال الصخور الحية والمرجان. تم تجهيز الحوض بنظام دعم حياة بحري متكامل (Sump + Skimmer) لضمان الاستقرار البيولوجي.",
    specs: {
      dimensions: "165 × 80 × 80 سم",
      volumeLiters: "1,056 لتر",
      glassType: "زجاج Optiwhite منخفض الحديد بسماكة 15 ملم",
      systemType: "Mixed Reef بحري — SPS / LPS / Softies",
      totalSystemVolume: "1,276 لتر (حوض 1,056 + Sump 220)",
      glassBonding: "لصق ألماني Wacker SN السيليكون البحري",
      parIntensity: "~180 PAR على عمق 40 سم (مناسب لـ SPS)",
      turnover: "~25× في الساعة عبر مضخة العودة والموجات",
    },
    equipment: {
      filter: "Sump زجاجي مخصص 120×50×45 سم — 3 مراحل + Filter Socks 200µm + Refugium بنبات Chaeto مع إضاءة Kessil H80 + قسم العودة",
      skimmer: "Bubble Magus Curve G5 Protein Skimmer — تصريف ~400 مل/يوم + مضخة Sicce",
      returnPump: "مضخة عودة Neptune COR-20 DC قابلة للتحكم (2,000 GPH) + خرطوم Loc-Line مزدوج",
      lighting: "3 × AI Hydra 64HD (Spread + Director) — طيف كامل UV + UV-V + Royal Blue + Cool White + Green + Red + جدولة شروق/غروب 12 ساعة + ذراع تعليق RMS",
      heatingCooling: "Chiller Teco TK-500 (½ HP) مع تحكم Apex + سخان Eheim Jäger Titanium 500W احتياطي",
      waveMakers: "2 × EcoTech Marine VorTech MP40wQD + وحدة ReefLink + أنماط (Pulse / Lagoon / ReefCrest / Nutrient Transport)",
    },
    waterSystem: {
      roDi: "Spectrapure MaxCap 90 GPD — 5 مراحل (Sediment → Carbon Block → RO Membrane → DI → Refill) + قياس TDS 0 ppm",
      storage: "خزان مياه عذبة 200 لتر + خزان مياه مالحة 200 لتر مع مضخة خلط Sicce Syncra 3.0",
      ato: "نظام ATO تلقائي Tunze Osmolator 3155 + حساس بصري احتياطي مزدوج",
      salt: "ملح Tropic Marin Pro Reef — كثافة تشغيل 1.025 SG",
    },
    automation: {
      controller: "Neptune Apex Classic Controller مع وحدة EnergyBar 832 للتحكم بالكهرباء",
      sensors: "حساسات: درجة الحرارة + pH + ORP + Conductivity (الملوحة) + Leak Detect (كشف التسرب)",
      dosing: "Apex DOS موزع جرعات مزدوج — إضافة Calcium / Alkalinity / Magnesium آليًا بنظام Balling",
      alerts: "تنبيهات Apex Fusion عبر الجوال — انقطاع التيار، ارتفاع الحرارة، التسرب، انخفاض المياه",
    },
    serviceWarranty: {
      schedule: "زيارة دورية كل أسبوعين تشمل اختبارات كاملة (Ca/Alk/Mg/NO₃/PO₄)، تنظيف الزجاج والـ Sump، تبديل 10% من المياه",
      equipmentWarranty: "ضمان شامل على كافة المعدات لمدة 12 شهرًا من تاريخ التشغيل",
      livestockWarranty: "ضمان إنضاج بيولوجي وكفالة على المرجان لمدة 90 يومًا",
      support: "خط دعم واتساب على مدار الساعة لحالات الطوارئ + استجابة ميدانية خلال 24 ساعة",
    },
    contents: {
      fish: ["Sailfin Tang", "Clownfish", "Angelfish", "Wrasse"],
      plantsOrCorals: ["Live Rock", "LPS Corals", "Soft Corals"],
      decor: "صخور حية + رمل أراجونيت ناعم",
    },
    priceRange: { min: 65000, max: 95000, currency: "SAR" },
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
    cat: "home",
    catLabel: "حوض منزلي",
    featured: true,
    location: "الرياض — حي السفارات",
    year: "2025",
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
  {
    id: 4,
    slug: "natural-planted",
    title: "حوض نباتي طبيعي",
    cat: "planted",
    catLabel: "حوض نباتي",
    location: "الرياض",
    year: "2025",
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
    year: "2025",
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
    year: "2025",
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
