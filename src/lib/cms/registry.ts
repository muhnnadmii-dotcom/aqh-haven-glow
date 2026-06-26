// Registry of CMS-driven pages: page_key → metadata + default content.

import type { PageDoc } from "./types";
import { newId } from "./types";

export type CmsPageMeta = {
  key: string;          // site_pages.page_key
  label: string;        // sidebar label (Arabic)
  route: string;        // public URL
  defaults: PageDoc;
};

const maintenanceDefaults: PageDoc = {
  sections: [
    {
      id: newId(), type: "hero", enabled: true,
      kicker: "MAINTENANCE",
      title: "باقات الصيانة الدورية",
      description: "خطط صيانة منتظمة تحافظ على صحة حوضك وجمال مظهره. الأسعار أدناه تقريبية تبدأ منها، والسعر النهائي يحدد بعد المعاينة حسب موقع الحوض ومحتوياته.",
    },
    {
      id: newId(), type: "badge_grid", enabled: true,
      items: [
        { id: newId(), icon: "Calendar", title: "جدول مرن", desc: "زيارات أسبوعية أو شهرية حسب احتياجك" },
        { id: newId(), icon: "ShieldCheck", title: "فريق محترف", desc: "خبرة ميدانية بالأحواض الفاخرة" },
        { id: newId(), icon: "Wrench", title: "أدوات احترافية", desc: "نأتي بكل ما يلزم لكل زيارة" },
      ],
    },
    {
      id: newId(), type: "pricing_groups", enabled: true,
      whatsapp_template: "السلام عليكم، أرغب بباقة صيانة لحوض {group} — {tier}.",
      cta_label: "اطلب الباقة",
      items: [
        {
          id: newId(), heading: "أحواض نهري",
          desc: "أحواض المياه العذبة المزروعة وأحواض الأسماك الاستوائية.",
          tiers: [
            { id: newId(), size: "نانو — حتى ٦٠ لتر", price: "٢٥٠ ر.س / زيارة", freq: "زيارة كل أسبوعين" },
            { id: newId(), size: "متوسط — ٦٠ إلى ٢٠٠ لتر", price: "٤٥٠ ر.س / زيارة", freq: "زيارة شهرية أو نصف شهرية" },
            { id: newId(), size: "كبير — ٢٠٠ إلى ٥٠٠ لتر", price: "٧٥٠ ر.س / زيارة", freq: "زيارة شهرية" },
            { id: newId(), size: "ضخم — أكثر من ٥٠٠ لتر", price: "حسب المعاينة", freq: "خطة مخصصة" },
          ],
        },
        {
          id: newId(), heading: "أحواض بحري",
          desc: "أحواض الشعاب المرجانية والأنظمة البحرية الكاملة.",
          tiers: [
            { id: newId(), size: "نانو ريف — حتى ٨٠ لتر", price: "٤٥٠ ر.س / زيارة", freq: "زيارة كل أسبوعين" },
            { id: newId(), size: "متوسط — ٨٠ إلى ٣٠٠ لتر", price: "٧٥٠ ر.س / زيارة", freq: "زيارة كل أسبوعين" },
            { id: newId(), size: "كبير — ٣٠٠ إلى ٧٠٠ لتر", price: "١٢٠٠ ر.س / زيارة", freq: "زيارة أسبوعية" },
            { id: newId(), size: "ضخم — أكثر من ٧٠٠ لتر", price: "حسب المعاينة", freq: "خطة مخصصة" },
          ],
        },
      ],
    },
    {
      id: newId(), type: "checklist", enabled: true,
      heading: "ماذا تشمل كل زيارة صيانة؟",
      items: [
        { id: newId(), text: "فحص شامل لجودة المياه (pH, KH, NO₃, NH₃...)" },
        { id: newId(), text: "تغيير جزئي للمياه وتنظيف الأرضية" },
        { id: newId(), text: "تنظيف الزجاج من الداخل والخارج" },
        { id: newId(), text: "غسيل وفحص وسائط الفلتر" },
        { id: newId(), text: "فحص الإضاءة والمضخات والسخان" },
        { id: newId(), text: "تقرير دوري مكتوب عن حالة الحوض" },
      ],
    },
    {
      id: newId(), type: "cta_band", enabled: true,
      heading: "احصل على عرض دقيق بعد المعاينة",
      description: "تواصل معنا لتحديد موعد معاينة مجانية داخل الرياض، وسنقدّم لك خطة صيانة مفصّلة.",
      primary_label: "تواصل واتساب",
      primary_whatsapp_template: "السلام عليكم، أرغب بحجز معاينة لخطة صيانة.",
      secondary_label: "نموذج التواصل",
      secondary_href: "/contact",
    },
  ],
};

const blankPage: PageDoc = { sections: [] };

export const CMS_PAGES: CmsPageMeta[] = [
  { key: "maintenance",       label: "باقات الصيانة",      route: "/maintenance",                 defaults: maintenanceDefaults },
  { key: "consultation",      label: "الاستشارات",         route: "/consultation",                defaults: blankPage },
  { key: "services_index",    label: "صفحة الخدمات",       route: "/services",                    defaults: blankPage },
  { key: "service_custom",    label: "تصميم أحواض مخصصة",  route: "/services/custom-aquariums",   defaults: blankPage },
  { key: "business_solutions",label: "حلول الأعمال",       route: "/business-solutions",          defaults: blankPage },
  { key: "trust",             label: "الثقة والضمانات",    route: "/trust",                       defaults: blankPage },
  { key: "catalog_meta",      label: "المتجر — هيدر",      route: "/catalog",                     defaults: blankPage },
  { key: "portfolio_meta",    label: "أعمالنا — هيدر",     route: "/portfolio",                   defaults: blankPage },
  { key: "knowledge_meta",    label: "المعرفة — هيدر",     route: "/knowledge",                   defaults: blankPage },
];

export function getPageMeta(key: string): CmsPageMeta | undefined {
  return CMS_PAGES.find((p) => p.key === key);
}
