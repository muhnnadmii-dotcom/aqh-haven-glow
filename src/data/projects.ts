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
import marineNew1 from "../assets/marine-new-C55A0DB5.png.asset.json";
import marineNew2 from "../assets/marine-new-16D6673B.png.asset.json";
import marineNew3 from "../assets/marine-new-64669583.png.asset.json";
import marineNew4 from "../assets/marine-new-DF24E5B9.png.asset.json";
import aridReefExtra from "../assets/arid-reef-extra.png.asset.json";
import fahdRiver1 from "../assets/fahd-river-1.png.asset.json";
import fahdRiver2 from "../assets/fahd-river-2.png.asset.json";
import fahdRiver3 from "../assets/fahd-river-3.png.asset.json";
import fahdRiver4 from "../assets/fahd-river-4.png.asset.json";
import marineReefPurple from "../assets/marine-reef-purple.png.asset.json";

export type ProjectCategory = "living-room" | "office" | "entrance" | "commercial";

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
    systemType: string;
    glassType?: string;
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
    dosing?: string;
  };
  waterSystem?: string[];
  addOns?: string[];
  servicePackages?: string[];
  livestockWarranty?: string;
  contents: {
    fish: string[];
    plantsOrCorals?: string[];
    decor?: string;
  };
  priceRange: { min: number; max: number; currency: "SAR" };
};

export const projects: Project[] = [
  {
    id: 9,
    slug: "fahd-river-tank",
    title: "حوض نهري طبيعي",
    cat: "living-room",
    catLabel: "غرفة المعيشة",
    featured: true,
    location: "الرياض — حي الملك فهد",
    year: "2026",
    cover: fahdRiver2.url,
    images: [fahdRiver2.url, fahdRiver3.url, fahdRiver4.url, fahdRiver1.url],
    description:
      "حوض نهري طبيعي (Biotope) بتصميم Aquascape مستوحى من ضفاف الأنهار، يجمع بين خشب الموبني المتفرع والصخور الطبيعية والنباتات الحية، مع لمسة من المعابد الكلاسيكية. نظام عذب مزروع متكامل بإضاءة احترافية ونباتات حقيقية تخلق توازنًا بيولوجيًا هادئًا.",
    specs: {
      dimensions: "100 × 50 × 60 سم",
      volumeLiters: "300 لتر",
      glassType: "زجاج Optiwhite شفاف",
      systemType: "نهري عذب مزروع (Planted Biotope)",
    },
    equipment: {
      filter: "فلتر خارجي Canister متعدد المراحل + إسفنج + ميديا بيولوجية + كربون نشط",
      lighting: "إضاءة LED نباتية كاملة الطيف بجدولة شروق وغروب",
      heatingCooling: "سخان حراري مع ثرموستات",
      co2: "نظام CO₂ مضغوط مع موزع داخلي ومؤقت آلي",
    },
    waterSystem: [
      "وحدة RO/DI لتنقية المياه",
      "اختبارات دورية لـ pH / KH / NO₃",
      "نظام تسميد سائل للنباتات (Macro + Micro)",
    ],
    addOns: [
      "خشب موبني طبيعي بتصميم Aquascape",
      "صخور دراغون وسيريو",
      "رمل نهري ناعم + حصى ملونة",
      "ديكور معابد كلاسيكية + تمثال محارب",
      "موزع هواء (Air Stone) للأكسجين والمظهر البصري",
      "خلفية سوداء غير لامعة",
    ],
    servicePackages: [
      "باقة صيانة شهرية (تقليم نباتات + تبديل 25% ماء + تنظيف زجاج) — اختيارية",
      "دعم فني واتساب + زيارات ميدانية عند الحاجة — اختيارية",
    ],
    livestockWarranty: "ضمان شامل على المعدات لمدة 12 شهرًا",
    contents: {
      fish: [
        "سمك الملاك (Angelfish)",
        "نيون تترا (Neon Tetra)",
        "كاردينال تترا (Cardinal Tetra)",
        "كوريدوراس (Corydoras)",
        "أوتوسينكلوس (Otocinclus)",
      ],
      plantsOrCorals: [
        "أنوبياس (Anubias)",
        "أمازون سورد (Amazon Sword)",
        "فالسنيريا (Vallisneria)",
        "روتالا (Rotala)",
        "لودفيجيا (Ludwigia)",
        "موس جافا (Java Moss)",
      ],
      decor: "خشب موبني + صخور طبيعية + رمل نهري + ديكور معابد كلاسيكية",
    },
    priceRange: { min: 18000, max: 28000, currency: "SAR" },
  },
  {
    id: 7,
    slug: "marine-reef-showcase",
    title: "حوض بحري مرجاني",
    cat: "living-room",
    catLabel: "غرفة المعيشة",
    featured: true,
    location: "الرياض — حي العارض",
    year: "2025",
    cover: marineNew1.url,
    images: [marineNew1.url, marineNew2.url, marineNew3.url, marineNew4.url, aridReefExtra.url, marineReefPurple.url],
    description:
      "حوض بحري مرجاني متكامل بتصميم Aquascape احترافي يجمع بين المرجان السوفتي والأسماك البحرية والكائنات اللافقارية، مع نظام دعم حياة بحري كامل لضمان استقرار بيولوجي طويل المدى.",
    specs: {
      dimensions: "—",
      volumeLiters: "—",
      systemType: "Mixed Reef بحري (Soft Corals)",
    },
    equipment: {
      filter:
        "مرحلة تهدئة (Bubble Trap) + حجرة Filter Socks (4 جرابات) + حجرة الميديا الفلترية + حجرة بروتين سكيمر + حجرة مضخة العودة",
      skimmer: "بروتين سكيمر داخلي بالسمب",
      returnPump:
        "مضخة رجوع DC بتحكم WiFi + أنبوب تصريف أساسي (Drain) + أنبوب رجوع احتياطي (Emergency Overflow)",
      lighting: "وحدتا إضاءة Reef LED احترافية مع جدولة شروق وغروب",
      heatingCooling: "سخانات حرارية مع ثرموستات",
      waveMakers: "مضخة موجة لاسلكية بتحكم WiFi / Bluetooth",
      dosing: "موزع جرعات لإضافة Calcium / Alkalinity / Magnesium بنظام Balling",
    },
    waterSystem: [
      "وحدة RO/DI لتنقية المياه",
      "جهاز قياس (TDS / كثافة الملوحة)",
      "خزانات تحضير وخلط للمياه العذبة والمالحة",
    ],
    addOns: [
      "تعويض التبخر التلقائي (ATO)",
      "خزان سفلي إضافي",
      "ميديا فلترة + فحم كربوني",
      "وحدة تعقيم UV",
      "25 كجم ملح بحري إضافي",
      "صخور حية بتصميم Aquascape وتثبيت احترافي",
      "رمل بحري خاص (Aragonite)",
      "معدات صيانة وعناية يومية",
    ],
    servicePackages: [
      "باقة صيانة دورية كل أسبوعين (اختبارات كاملة + تنظيف + تبديل 10% ماء) — اختيارية",
      "باقة دعم فني واتساب على مدار الساعة + استجابة ميدانية خلال 24 ساعة — اختيارية",
    ],
    livestockWarranty: "ضمان شامل على المعدات لمدة 12 شهرًا",
    contents: {
      fish: [
        "سمك المهرج (Clownfish)",
        "أنثياس (Anthias)",
        "جوبي بحري (Goby)",
      ],
      plantsOrCorals: [
        "مرجان سوفتي متنوع",
        "شقائق النعمان (Anemones)",
        "زوانثيدز (Zoanthids)",
        "ماشروم كورال (Mushroom Corals)",
        "حلزونات تنظيف (Cleaner Snails)",
        "نجم البحر (Starfish)",
        "روبيان التنظيف (Cleaner Shrimp)",
        "سرطانات ناسك صغيرة (Hermit Crabs)",
      ],
    },
    priceRange: { min: 45000, max: 65000, currency: "SAR" },
  },
  {
    id: 1,
    slug: "villa-qairawan",
    title: "حوض بحري ",
    cat: "home",
    catLabel: "حوض منزلي",
    featured: true,
    location: "الرياض — حي القيروان",
    year: "2026",
    cover: qairawan3.url,
    images: [qairawan1.url, qairawan2.url, qairawan3.url, qairawan4.url, qairawan5.url],
    description:
      "حوض بحري فاخر مُنفّذ داخل فيلا بحي القيروان، يجمع بين خزانة سوداء أنيقة وإضاءة ريف احترافية تُبرز جمال الصخور الحية والمرجان. تم تجهيز الحوض بنظام دعم حياة بحري متكامل لضمان الاستقرار البيولوجي على المدى الطويل.",
    specs: {
      dimensions: "165 × 80 × 80 سم",
      volumeLiters: "1,056 لتر",
      systemType: "Mixed Reef بحري",
      totalSystemVolume: "1,276 لتر (حوض 1,056 + Sump 220)",
      parIntensity: "~180 PAR على عمق 40 سم",
      turnover: "~25× في الساعة",
    },
    equipment: {
      filter:
        "مرحلة تهدئة (Bubble Trap) + حجرة Filter Socks (4 جرابات) + حجرة الميديا الفلترية + حجرة بروتين سكيمر + حجرة مضخة العودة",
      skimmer: "BUBBLE-MAGUS Protein Skimmer Curve-9+",
      returnPump:
        "Jebao MDP DCS-20000 L/H DC Pump مع تحكم WiFi + أنبوب تصريف أساسي (Drain) + أنبوب رجوع احتياطي (Emergency Overflow)",
      lighting: "A8PRO II MAX × 2 + جدولة شروق وغروب",
      heatingCooling: "التدفئة",
      waveMakers: "Jebao DMP-40M Cordless WiFi / Bluetooth",
      dosing: "موزع جرعات لإضافة Calcium / Alkalinity / Magnesium بنظام Balling",
    },
    waterSystem: [
      "وحدة RO/DI لتنقية المياه",
      "جهاز قياس (TDS / كثافة الملوحة)",
      "خزانات تحضير وخلط للمياه العذبة والمالحة",
    ],
    addOns: [
      "تعويض التبخر التلقائي (ATO)",
      "خزان سفلي إضافي",
      "ميديا فلترة + فحم كربوني",
      "وحدة تعقيم UV",
      "25 كجم ملح بحري إضافي",
      "معدات صيانة وعناية يومية",
      "دعم فني واتساب على مدار الساعة + استجابة ميدانية خلال 24 ساعة",
    ],
    servicePackages: [
      "باقة صيانة دورية كل أسبوعين (اختبارات كاملة + تنظيف + تبديل 10% ماء)",
    ],
    livestockWarranty: "ضمان شامل على المعدات لمدة 12 شهرًا",
    contents: {
      fish: [],
    },
    priceRange: { min: 55000, max: 75000, currency: "SAR" },
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
