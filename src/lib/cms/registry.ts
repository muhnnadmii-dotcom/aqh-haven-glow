// Registry of CMS-driven pages: page_key → metadata + default content.

import type { PageDoc } from "./types";
import { newId } from "./types";

export type CmsPageGroup = "full" | "hybrid";

export type CmsPageMeta = {
  key: string;          // site_pages.page_key
  label: string;        // sidebar label (Arabic)
  route: string;        // public URL
  group: CmsPageGroup;  // full = entire page is CMS, hybrid = injected sections
  hint?: string;        // short admin hint
  defaults: PageDoc;
};

// ─── MAINTENANCE (full CMS) ──────────────────────────────────────────────────
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

// ─── CONSULTATION (hybrid: hero+badges above form) ───────────────────────────
const consultationDefaults: PageDoc = {
  sections: [
    {
      id: newId(), type: "hero", enabled: true,
      kicker: "CONSULTATION",
      title: "احجز استشارتك",
      description: "عبئ الحقول التالية بتفاصيل حوضك وما تحتاجه، وسيتواصل معك متخصص من فريقنا عبر واتساب.",
    },
    {
      id: newId(), type: "badge_grid", enabled: true,
      items: [
        { id: newId(), icon: "MessagesSquare", title: "استشارة من خبير", desc: "متخصص يجاوبك حسب نوع حوضك وهدفك بسرية تامة." },
        { id: newId(), icon: "Clock", title: "رد سريع", desc: "نجاوبك خلال ساعات العمل." },
        { id: newId(), icon: "CheckCircle2", title: "متابعة بعد الاستشارة", desc: "ندعمك بعد الاستشارة عند الحاجة." },
      ],
    },
  ],
};

// ─── TRUST (full CMS, rich_text sections) ────────────────────────────────────
const trustDefaults: PageDoc = {
  sections: [
    {
      id: newId(), type: "hero", enabled: true,
      kicker: "الخصوصية والثقة",
      title: "كيف نتعامل مع بياناتك في أكوا هيفن",
      description: "هذه الصفحة يُحرِّرها ويُحدِّثها فريق أكوا هيفن للإجابة عن الأسئلة الشائعة حول الخصوصية والأمان. ليست شهادة موثَّقة من جهة خارجية، بل توضيح لممارساتنا الحالية.",
    },
    { id: newId(), type: "rich_text", enabled: true, heading: "البيانات التي نجمعها",
      body: "نجمع فقط البيانات التي تحتاجها خدماتنا للعمل: الاسم، رقم الجوال، المدينة، وتفاصيل الطلب (نوع الحوض، الصور المرفقة من قِبَلك، الملاحظات). لا نجمع بيانات بنكية ولا أرقام هويات." },
    { id: newId(), type: "rich_text", enabled: true, heading: "كيف نستخدم البيانات",
      body: "تُستخدم البيانات للتواصل معك، تجهيز عرض السعر، تنفيذ الزيارة أو التركيب، وإدارة عقود الصيانة. لا نبيع بياناتك ولا نشاركها مع جهات تسويقية." },
    { id: newId(), type: "rich_text", enabled: true, heading: "الحساب وتسجيل الدخول",
      body: "تسجيل الدخول يتم عبر بريدك الإلكتروني أو حساب Google. كلمة المرور لا تُخزَّن عندنا مباشرة، بل عبر مزوّد المصادقة المستضاف. الجلسات تنتهي تلقائيًا، ويمكنك تسجيل الخروج في أي وقت من صفحة حسابك." },
    { id: newId(), type: "rich_text", enabled: true, heading: "صلاحيات الوصول داخل الفريق",
      body: "الوصول إلى بيانات العملاء مقصور على فريق العمليات (الإدارة والموظفين) عبر لوحة الإدارة. العميل لا يرى إلا طلباته وأحواضه ومواعيده فقط. صلاحيات الإدارة محميّة بسياسات وصول على مستوى قاعدة البيانات." },
    { id: newId(), type: "rich_text", enabled: true, heading: "الصور والملفات",
      body: "الصور التي ترفعها مع طلبك (صور المكان أو الحوض الحالي) تُحفظ في تخزين خاص بالمشروع وتُستخدم فقط لخدمة طلبك. يمكنك طلب حذفها في أي وقت بالتواصل معنا." },
    { id: newId(), type: "rich_text", enabled: true, heading: "الاحتفاظ بالبيانات والحذف",
      body: "نحتفظ بسجلات الطلبات والصيانة لأغراض المتابعة والضمان. للحذف أو لتصدير نسخة من بياناتك، تواصل معنا عبر صفحة تواصل معنا وسنرد خلال أيام عمل قليلة." },
    { id: newId(), type: "rich_text", enabled: true, heading: "مزوّدو الخدمة",
      body: "نعتمد على مزوّدين موثوقين للاستضافة وقواعد البيانات والمصادقة وإرسال الإشعارات. هؤلاء المزوّدون مُلزَمون تعاقديًا بحماية البيانات ولا يستخدمونها لأغراض أخرى." },
    { id: newId(), type: "rich_text", enabled: true, heading: "التواصل والإبلاغ",
      body: "لأي سؤال يخص الخصوصية أو الأمان أو للإبلاغ عن مشكلة محتملة، يُرجى التواصل معنا عبر صفحة تواصل معنا. نأخذ كل بلاغ بجدّية ونرد في أسرع وقت ممكن." },
  ],
};

// ─── BUSINESS SOLUTIONS (hybrid: hero above component) ───────────────────────
const businessDefaults: PageDoc = {
  sections: [
    {
      id: newId(), type: "hero", enabled: true,
      kicker: "BUSINESS SOLUTIONS",
      title: "حلول لأصحاب الأعمال",
      description: "صفحة مخصصة لأصحاب الكافيهات والمطاعم والفعاليات والمحلات — حلول تصميم وتركيب وتوريد أحواض وأنظمة عرض احترافية.",
    },
  ],
};

// ─── SERVICES INDEX (hybrid: hero above the dynamic services grid) ───────────
const servicesIndexDefaults: PageDoc = {
  sections: [
    {
      id: newId(), type: "hero", enabled: true,
      kicker: "SERVICES",
      title: "خدماتنا",
      description: "من التصميم الأولي وحتى الصيانة المستمرة — حلول متكاملة لعالمك المائي.",
    },
  ],
};

// ─── SERVICE CUSTOM (hybrid: hero above the dynamic content) ─────────────────
const serviceCustomDefaults: PageDoc = {
  sections: [
    {
      id: newId(), type: "hero", enabled: true,
      kicker: "SERVICE",
      title: "تصميم وتركيب أحواض مخصصة",
      description: "نصمم وننفذ أحواضًا مائية تناسب مساحتك وذوقك، من دراسة الفكرة واختيار المقاس إلى التركيب والتشغيل والتسليم النهائي.",
    },
  ],
};

// ─── CATALOG (hybrid hero) ───────────────────────────────────────────────────
const catalogDefaults: PageDoc = {
  sections: [
    {
      id: newId(), type: "hero", enabled: true,
      kicker: "CATALOG",
      title: "الكاتلوج",
      description: "استعرض مجموعتنا. الطلب يتم مباشرة من المتجر الإلكتروني.",
    },
  ],
};

// ─── PORTFOLIO (hybrid hero) ─────────────────────────────────────────────────
const portfolioDefaults: PageDoc = {
  sections: [
    {
      id: newId(), type: "hero", enabled: true,
      kicker: "PORTFOLIO",
      title: "أعمالنا",
      description: "مجموعة من مشاريعنا المختارة التي تجسد فلسفتنا في الجمع بين التصميم الفاخر والهندسة الدقيقة. اضغط على أي مشروع لعرض المواصفات والمعدات والأسعار.",
    },
  ],
};

// ─── KNOWLEDGE (hybrid hero) ─────────────────────────────────────────────────
const knowledgeDefaults: PageDoc = {
  sections: [
    {
      id: newId(), type: "hero", enabled: true,
      kicker: "KNOWLEDGE",
      title: "مركز المعرفة",
      description: "أدلة عملية مكتوبة بخبرة لمساعدتك على بناء عالم مائي مزدهر.",
    },
  ],
};

export const CMS_PAGES: CmsPageMeta[] = [
  // Full CMS pages
  { key: "maintenance",       label: "باقات الصيانة",      route: "/maintenance",                 group: "full",   hint: "صفحة كاملة قابلة للتعديل: أبطال، شارات، باقات، قائمة، CTA.", defaults: maintenanceDefaults },
  { key: "trust",             label: "الخصوصية والثقة",    route: "/trust",                       group: "full",   hint: "صفحة كاملة من أقسام نصية حرة.",                                defaults: trustDefaults },
  // Hybrid pages
  { key: "consultation",      label: "صفحة الاستشارات",    route: "/consultation",                group: "hybrid", hint: "هيدر + شارات تظهر فوق نموذج الاستشارة.",                       defaults: consultationDefaults },
  { key: "business_solutions",label: "حلول الأعمال",       route: "/business-solutions",          group: "hybrid", hint: "هيدر يظهر فوق محتوى صفحة الأعمال.",                            defaults: businessDefaults },
  { key: "services_index",    label: "صفحة الخدمات",       route: "/services",                    group: "hybrid", hint: "هيدر يظهر فوق قائمة الخدمات (تُدار من «خدماتنا»).",            defaults: servicesIndexDefaults },
  { key: "service_custom",    label: "تصميم أحواض مخصصة",  route: "/services/custom-aquariums",   group: "hybrid", hint: "هيدر يظهر فوق محتوى صفحة التصميم المخصص.",                    defaults: serviceCustomDefaults },
  { key: "catalog_meta",      label: "صفحة المتجر",        route: "/catalog",                     group: "hybrid", hint: "هيدر صفحة الكاتلوج.",                                          defaults: catalogDefaults },
  { key: "portfolio_meta",    label: "صفحة أعمالنا",       route: "/portfolio",                   group: "hybrid", hint: "هيدر صفحة المشاريع (تُدار من «أعمالنا/الأحواض»).",            defaults: portfolioDefaults },
  { key: "knowledge_meta",    label: "صفحة المعرفة",       route: "/knowledge",                   group: "hybrid", hint: "هيدر صفحة المقالات (تُدار من «المقالات»).",                    defaults: knowledgeDefaults },
];

export function getPageMeta(key: string): CmsPageMeta | undefined {
  return CMS_PAGES.find((p) => p.key === key);
}
