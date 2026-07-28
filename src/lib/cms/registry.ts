// Registry of CMS-driven pages: page_key → metadata + default content.

import type { PageDoc } from "./types";
import { newId } from "./types";
import marineCubeAsset from "@/assets/aqh-marine-cube.png.asset.json";
import counterAquariumAsset from "@/assets/aqh-counter-aquarium.png.asset.json";
import livingRoomTankAsset from "@/assets/aqh-living-room-tank.png.asset.json";
import bannerTankAsset from "@/assets/aqh-banner-tank.png.asset.json";


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

// ─── BUSINESS SOLUTIONS (full CMS: enterprise B2B landing) ───────────────────

const businessDefaults: PageDoc = {
  sections: [
    {
      id: newId(), type: "media_hero", enabled: true,
      kicker: "ENTERPRISE · حلول مؤسسية",
      title: "شريكك الموثوق في",
      title_highlight: "أنظمة الأحواض المؤسسية",
      description: "نصمم وننفذ ونصون أنظمة أحواض مائية بمعايير عالمية للجهات الحكومية، الفنادق، الشركات، المطاعم، المولات، والمستشفيات — بعقود SLA ملزمة وفريق متخصص.",
      image_path: bannerTankAsset.url,
      primary_label: "اطلب عرض سعر مؤسسي",
      primary_href: "#quote",
      secondary_label: "احجز استشارة مجانية",
      secondary_whatsapp_template: "السلام عليكم، أرغب بحجز استشارة B2B مع أكوا هيفن.",
      badges: [
        { id: newId(), text: "مورد معتمد للجهات الحكومية" },
        { id: newId(), text: "فواتير ضريبية مطابقة" },
        { id: newId(), text: "ضمان تشغيلي حتى 3 سنوات" },
      ],
    },
    {
      id: newId(), type: "stat_bar", enabled: true,
      items: [
        { id: newId(), icon: "Award", value: "+9", label: "سنوات خبرة مؤسسية" },
        { id: newId(), icon: "Building2", value: "+240", label: "مشروع منفذ" },
        { id: newId(), icon: "Clock", value: "24/7", label: "دعم فني للعقود" },
        { id: newId(), icon: "MapPin", value: "13", label: "منطقة تغطية بالمملكة" },
      ],
    },
    {
      id: newId(), type: "feature_grid", enabled: true,
      kicker: "SOLUTIONS",
      heading: "حلولنا للشركات",
      subheading: "منظومة متكاملة تغطي دورة حياة المشروع بالكامل من التصميم حتى الصيانة.",
      columns: 3,
      items: [
        { id: newId(), icon: "Layers", title: "حلول الشركات المتكاملة", desc: "تصميم وتنفيذ أنظمة أحواض تعزز الهوية البصرية لمقر الشركة وتصنع تجربة زوار استثنائية." },
        { id: newId(), icon: "Waves", title: "الأحواض التجارية", desc: "أحواض عرض للمولات والمعارض ونقاط البيع بمقاسات وأشكال مخصصة تدعم البراند." },
        { id: newId(), icon: "Cpu", title: "أنظمة الأحواض المركزية", desc: "أنظمة فلترة وتشغيل مركزية لعدة أحواض من غرفة تقنية واحدة." },
        { id: newId(), icon: "Wrench", title: "الصيانة الدورية بعقود SLA", desc: "زيارات مجدولة وتدخل طارئ خلال 24 ساعة كحد أقصى." },
        { id: newId(), icon: "PenTool", title: "التصميم والتنفيذ", desc: "مخططات 3D ومحاكاة واقعية قبل التنفيذ، ثم تنفيذ بمعايير هندسية دقيقة." },
        { id: newId(), icon: "ClipboardCheck", title: "إدارة المشاريع", desc: "مدير مشروع مخصص، جداول زمنية معتمدة، وتقارير تقدم أسبوعية." },
      ],
    },
    {
      id: newId(), type: "feature_grid", enabled: true,
      kicker: "INDUSTRIES",
      heading: "الجهات المستفيدة",
      subheading: "نخدم قطاعات متنوعة بحلول مخصصة لكل بيئة عمل.",
      columns: 4,
      items: [
        { id: newId(), icon: "Landmark", title: "الجهات الحكومية", desc: "بمواصفات المشتريات الحكومية وشهادات الجودة." },
        { id: newId(), icon: "Hotel", title: "الفنادق والمنتجعات", desc: "لوبيات وأجنحة بمعايير الضيافة الفاخرة." },
        { id: newId(), icon: "UtensilsCrossed", title: "المطاعم والكافيهات", desc: "أحواض ديكور وأنظمة مأكولات بحرية حية." },
        { id: newId(), icon: "Briefcase", title: "المكاتب والشركات", desc: "استقبال وقاعات اجتماعات تعكس هوية الشركة." },
        { id: newId(), icon: "ShoppingBag", title: "المولات ومراكز التسوق", desc: "منحوتات مائية مركزية تصنع نقاط جذب." },
        { id: newId(), icon: "HeartPulse", title: "المستشفيات والعيادات", desc: "أحواض علاجية بمعايير سلامة صارمة." },
        { id: newId(), icon: "GraduationCap", title: "المدارس والجامعات", desc: "أحواض تعليمية وأنظمة أكواسكب." },
        { id: newId(), icon: "Building2", title: "المجمعات السكنية", desc: "أحواض بانورامية للمساحات الفاخرة." },
      ],
    },
    {
      id: newId(), type: "step_list", enabled: true,
      heading: "مراحل التنفيذ",
      items: [
        { id: newId(), text: "الاستشارة والمعاينة الموقعية" },
        { id: newId(), text: "التصميم والمحاكاة 3D" },
        { id: newId(), text: "عرض السعر والعقد" },
        { id: newId(), text: "التصنيع والتجهيز" },
        { id: newId(), text: "التركيب والتشغيل التجريبي" },
        { id: newId(), text: "الصيانة والدعم المستمر" },
      ],
    },
    {
      id: newId(), type: "feature_grid", enabled: true,
      kicker: "WHY AQUA HAVEN",
      heading: "لماذا أكوا هيفن",
      subheading: "ما يميزنا كشريك مؤسسي طويل الأمد.",
      columns: 3,
      items: [
        { id: newId(), icon: "ShieldCheck", title: "امتثال ومعايير", desc: "توافق مع اشتراطات الدفاع المدني ومواصفات المشتريات الحكومية." },
        { id: newId(), icon: "Award", title: "خبرة موثقة", desc: "أكثر من 9 سنوات في تنفيذ مشاريع مؤسسية معقدة داخل المملكة." },
        { id: newId(), icon: "Gauge", title: "SLA ملزم", desc: "استجابة مضمونة، زيارات موثقة، وتقارير أداء قابلة للتدقيق." },
        { id: newId(), icon: "Users", title: "فريق متخصص", desc: "مهندسون، أخصائيو أحياء مائية، وفنيون معتمدون." },
        { id: newId(), icon: "FileCheck2", title: "توثيق كامل", desc: "مخططات، أدلة تشغيل، وشهادات ضمان لكل مشروع." },
        { id: newId(), icon: "TrendingUp", title: "ROI حقيقي", desc: "زيادة موثقة في وقت بقاء العملاء والتفاعل مع نقاط البيع." },
      ],
    },
    {
      id: newId(), type: "case_studies", enabled: true,
      kicker: "PORTFOLIO",
      heading: "معرض مشاريع B2B",
      subheading: "نماذج من تنفيذنا للقطاعات المؤسسية.",
      items: [
        { id: newId(), image_path: bannerTankAsset.url, category: "فندق", title: "لوبي فندق فاخر", location: "الرياض" },
        { id: newId(), image_path: livingRoomTankAsset.url, category: "مجمع سكني", title: "حوض استقبال بانورامي", location: "الرياض" },
        { id: newId(), image_path: marineCubeAsset.url, category: "مقر شركة", title: "مكعب مرجاني مركزي", location: "جدة" },
        { id: newId(), image_path: counterAquariumAsset.url, category: "مطعم", title: "نظام عرض مأكولات بحرية", location: "الخبر" },
        { id: newId(), image_path: bannerTankAsset.url, category: "مول", title: "منحوتة مائية", location: "الرياض" },
        { id: newId(), image_path: marineCubeAsset.url, category: "جهة حكومية", title: "قاعة استقبال رسمية", location: "الرياض" },
      ],
    },
    {
      id: newId(), type: "sla_tiers", enabled: true,
      kicker: "SLA",
      heading: "باقات الصيانة المؤسسية",
      subheading: "ثلاث مستويات خدمة موثقة تناسب حجم أسطولك وحساسية موقعك.",
      items: [
        {
          id: newId(), name: "أساسي", features: [
            { id: newId(), text: "زيارة صيانة شهرية" },
            { id: newId(), text: "استجابة طارئة خلال 72 ساعة" },
            { id: newId(), text: "تقرير حالة شهري" },
          ],
          cta_label: "اطلب عرض سعر", price: "يبدأ من", price_note: "حسب حجم النظام",
        },
        {
          id: newId(), name: "احترافي", badge: "الأكثر شيوعًا", highlighted: true, features: [
            { id: newId(), text: "زيارة كل أسبوعين" },
            { id: newId(), text: "استجابة طارئة خلال 48 ساعة" },
            { id: newId(), text: "تقارير أسبوعية مفصلة" },
            { id: newId(), text: "استبدال معدات مشمول" },
          ],
          cta_label: "اطلب عرض سعر", price: "الأنسب", price_note: "لمعظم الفنادق والشركات",
        },
        {
          id: newId(), name: "مؤسسي", features: [
            { id: newId(), text: "زيارة أسبوعية" },
            { id: newId(), text: "استجابة طارئة خلال 24 ساعة" },
            { id: newId(), text: "مراقبة عن بعد + تنبيهات فورية" },
            { id: newId(), text: "مدير حساب مخصص" },
            { id: newId(), text: "تدريب دوري للكادر" },
          ],
          cta_label: "اطلب عرض سعر", price: "مخصص", price_note: "بحسب متطلبات الجهة",
        },
      ],
    },
    {
      id: newId(), type: "faq", enabled: true,
      heading: "الأسئلة الشائعة للجهات المؤسسية",
      items: [
        { id: newId(), q: "ما مدة تنفيذ المشروع المؤسسي؟", a: "من 3 إلى 10 أسابيع حسب حجم وتعقيد المشروع، ونلتزم بجدول زمني موثق ضمن العقد." },
        { id: newId(), q: "هل تقدمون فواتير ضريبية معتمدة؟", a: "نعم، جميع فواتيرنا ضريبية مطابقة لهيئة الزكاة والضريبة، ونتعامل مع أنظمة اعتماد الموردين الحكومية." },
        { id: newId(), q: "ما مستويات عقود SLA المتاحة؟", a: "ثلاث باقات: أساسي (شهري)، احترافي (نصف شهري + استجابة 48 ساعة)، ومؤسسي (أسبوعي + استجابة 24 ساعة + مراقبة عن بعد)." },
        { id: newId(), q: "هل تغطون خارج الرياض؟", a: "نعم، نغطي 13 منطقة داخل المملكة عبر شبكة فنيين معتمدين." },
        { id: newId(), q: "هل يمكن ربط الحوض بأنظمة المبنى الذكي؟", a: "نعم، ندعم التكامل مع أنظمة BMS للتحكم بالإضاءة ودرجة الحرارة والتنبيهات." },
      ],
    },
    {
      id: newId(), type: "lead_form", enabled: true,
      kicker: "REQUEST QUOTE",
      heading: "اطلب عرض سعر مؤسسي",
      description: "عبّئ التفاصيل التالية وسيتواصل معك مدير حسابات خلال يوم عمل واحد.",
      form_anchor: "quote",
      submit_label: "إرسال الطلب",
      success_message: "تم استلام طلبك — سيتواصل معك فريقنا خلال يوم عمل.",
      whatsapp_fallback_label: "أو تواصل عبر واتساب",
      whatsapp_fallback_template: "السلام عليكم، أرغب بمناقشة حل مؤسسي مع أكوا هيفن.",
      contact_note: "بياناتك سرّية ولا تُشارك مع أي جهة خارجية.",
      industries: [
        { id: newId(), label: "جهة حكومية" },
        { id: newId(), label: "فندق / منتجع" },
        { id: newId(), label: "مطعم / كافيه" },
        { id: newId(), label: "مكتب / شركة" },
        { id: newId(), label: "مول / مركز تسوق" },
        { id: newId(), label: "مستشفى / عيادة" },
        { id: newId(), label: "مدرسة / جامعة" },
        { id: newId(), label: "مجمع سكني / فيلا خاصة" },
        { id: newId(), label: "أخرى" },
      ],
      budgets: [
        { id: newId(), label: "أقل من 25,000 ر.س" },
        { id: newId(), label: "25,000 – 75,000 ر.س" },
        { id: newId(), label: "75,000 – 200,000 ر.س" },
        { id: newId(), label: "أكثر من 200,000 ر.س" },
      ],
      timelines: [
        { id: newId(), label: "خلال شهر" },
        { id: newId(), label: "خلال 1–3 أشهر" },
        { id: newId(), label: "خلال 3–6 أشهر" },
        { id: newId(), label: "غير محدد" },
      ],
      lead_source: "business_lead",
    },
    {
      id: newId(), type: "cta_band", enabled: true,
      heading: "هل تحتاج تصميمًا ومقابلة؟",
      description: "زيارة موقعية مجانية داخل الرياض، أو مقابلة أونلاين للجهات خارجها.",
      primary_label: "تواصل واتساب",
      primary_whatsapp_template: "السلام عليكم، أرغب بحجز زيارة موقعية / مقابلة أونلاين مع أكوا هيفن للحلول المؤسسية.",
      secondary_label: "صفحة تواصل",
      secondary_href: "/contact",
    },
  ],
};



// ─── SERVICES INDEX (full CMS) ───────────────────────────────────────────────
const servicesIndexDefaults: PageDoc = {
  sections: [
    {
      id: newId(), type: "hero", enabled: true,
      kicker: "SERVICES",
      title: "خدماتنا",
      description: "من التصميم الأولي وحتى الصيانة المستمرة — حلول متكاملة لعالمك المائي.",
    },
    {
      id: newId(), type: "dynamic_slot", enabled: true,
      slot: "services_grid",
      note: "شبكة الخدمات (تُدار من «الخدمات» بالقائمة الجانبية).",
    },
    {
      id: newId(), type: "link_cards", enabled: true,
      heading: "اختر الخدمة المناسبة لك",
      subheading: "دلّنا على احتياجك ونوصلك للحل المباشر.",
      columns: 5,
      items: [
        { id: newId(), title: "أريد حوضًا جديدًا", desc: "تصميم وتركيب أحواض مخصصة", href: "/services/custom-aquariums" },
        { id: newId(), title: "حوضي يحتاج تنظيف", desc: "صيانة دورية وطارئة", href: "/maintenance" },
        { id: newId(), title: "عندي مشكلة سمك أو ماء", desc: "استشارة مشاكل الأحواض", href: "/services/aquarium-consultation" },
        { id: newId(), title: "عندي كافيه أو مشروع", desc: "حلول الأعمال والمشاريع", href: "/business-solutions" },
        { id: newId(), title: "أريد منتجات ومستلزمات", desc: "الكاتلوج والمتجر", href: "/catalog" },
      ],
    },
    {
      id: newId(), type: "step_list", enabled: true,
      heading: "طريقة العمل",
      items: [
        { id: newId(), text: "نسمع احتياجك" },
        { id: newId(), text: "نعاين أو نراجع الصور" },
        { id: newId(), text: "نقترح الحل المناسب" },
        { id: newId(), text: "نجهز وننفذ" },
        { id: newId(), text: "نتابع بعد التسليم" },
      ],
    },
    {
      id: newId(), type: "faq", enabled: true,
      heading: "الأسئلة الشائعة",
      items: [
        { id: newId(), q: "كم تكلفة الحوض؟", a: "تختلف حسب الحجم، النوع (نهري/بحري)، والديكور. نقدّم عرضًا دقيقًا بعد فهم احتياجك أو معاينة المكان." },
        { id: newId(), q: "هل توفرون صيانة؟", a: "نعم، لدينا باقات صيانة منتظمة شهرية أو نصف شهرية للأحواض النهرية والبحرية." },
        { id: newId(), q: "هل أحتاج خبرة قبل أن أطلب حوضًا؟", a: "لا. نتولى كل شيء من التصميم حتى التشغيل، ونمنحك إرشادات بسيطة للعناية." },
        { id: newId(), q: "هل يمكن تصميم الحوض حسب المساحة؟", a: "نعم، نصمم وننفذ أحواضًا مخصصة بمقاسات وأشكال تناسب مكانك وذوقك." },
        { id: newId(), q: "هل تقدمون حلولًا للمشاريع التجارية؟", a: "نعم، لدينا حلول مخصصة للكافيهات والمطاعم والمكاتب والمعارض." },
        { id: newId(), q: "هل أقدر أرسل صورة المكان فقط؟", a: "بالتأكيد. أرسلها عبر واتساب وسنرشدك بأنسب الخيارات." },
      ],
    },
    {
      id: newId(), type: "cta_band", enabled: true,
      heading: "جاهز نبدأ معك؟",
      description: "تواصل معنا الآن واطلب استشارتك أو حدد موعد معاينة.",
      primary_label: "تواصل واتساب",
      primary_whatsapp_template: "السلام عليكم، أرغب بالاستفسار عن خدماتكم.",
      secondary_label: "نموذج التواصل",
      secondary_href: "/contact",
    },
  ],
};


// ─── SERVICE CUSTOM (full CMS: hero + all marketing sections) ────────────────
const serviceCustomDefaults: PageDoc = {
  sections: [
    {
      id: newId(), type: "hero", enabled: true,
      kicker: "SERVICE",
      title: "تصميم وتركيب أحواض مخصصة",
      description: "نصمم وننفذ أحواضًا مائية تناسب مساحتك وذوقك، من دراسة الفكرة واختيار المقاس إلى التركيب والتشغيل والتسليم النهائي.",
    },
    {
      id: newId(), type: "badge_grid", enabled: true,
      items: [
        { id: newId(), icon: "Ruler",        title: "تصميم حسب المساحة", desc: "نختار المقاس المناسب لمكانك بدقة." },
        { id: newId(), icon: "Wrench",       title: "اختيار معدات مناسبة", desc: "فلتر، إضاءة، سخان، ومستلزمات أساسية." },
        { id: newId(), icon: "CheckCircle2", title: "تركيب وتشغيل كامل", desc: "ننفذ ونسلمك الحوض جاهزًا للعمل." },
      ],
    },
    {
      id: newId(), type: "step_list", enabled: true,
      heading: "كيف نعمل؟",
      items: [
        { id: newId(), text: "ندرس المساحة — نراجع الصور والمقاسات وطبيعة المكان." },
        { id: newId(), text: "نقترح النظام المناسب — نوع الحوض، المقاس، المعدات، والكائنات." },
        { id: newId(), text: "ننفذ ونسلم الحوض جاهزًا — تركيب وتشغيل، ثم شرح طريقة العناية." },
      ],
    },
    {
      id: newId(), type: "checklist", enabled: true,
      heading: "لمن هذه الخدمة؟",
      items: [
        { id: newId(), text: "من يريد حوضًا جديدًا بدون تعقيد." },
        { id: newId(), text: "من لا يعرف المقاس أو المعدات المناسبة." },
        { id: newId(), text: "من يريد حوضًا يناسب ديكور البيت أو المكتب." },
        { id: newId(), text: "من يريد حوضًا نباتيًا أو نهريًا أو بحريًا أو نانو." },
        { id: newId(), text: "من يريد تنفيذًا كاملًا من الفكرة إلى التشغيل." },
        { id: newId(), text: "من يريد حوضًا لمشروع تجاري أو مساحة استقبال." },
      ],
    },
    {
      id: newId(), type: "checklist", enabled: true,
      heading: "ماذا تشمل الخدمة؟",
      items: [
        { id: newId(), text: "استشارة مبدئية لفهم المساحة والاحتياج" },
        { id: newId(), text: "اقتراح نوع الحوض المناسب" },
        { id: newId(), text: "تحديد المقاس المناسب حسب المكان" },
        { id: newId(), text: "اختيار نوع النظام: نهري / نباتي / بحري / نانو" },
        { id: newId(), text: "اختيار الفلتر، الإضاءة، السخان، والمعدات الأساسية" },
        { id: newId(), text: "تصميم الديكور الداخلي" },
        { id: newId(), text: "اختيار الأسماك أو النباتات أو الكائنات المناسبة" },
        { id: newId(), text: "التركيب والتشغيل" },
        { id: newId(), text: "شرح طريقة العناية بعد التسليم" },
        { id: newId(), text: "متابعة مبدئية بعد التنفيذ" },
      ],
    },
    {
      id: newId(), type: "link_cards", enabled: true,
      heading: "أنواع الأحواض التي ننفذها",
      columns: 3,
      items: [
        { id: newId(), title: "أحواض نباتية",      desc: "تصاميم طبيعية بالنباتات الحية، مناسبة للمنازل والمكاتب.", href: "?tank_type=planted#request-form" },
        { id: newId(), title: "أحواض نهريّة",      desc: "أحواض أسماك نهريّة بتجهيزات عملية ومناسبة للمبتدئين.", href: "?tank_type=river#request-form" },
        { id: newId(), title: "أحواض بحرية",       desc: "أنظمة بحرية بتصميم فاخر واختيار دقيق للمعدات والكائنات.", href: "?tank_type=marine#request-form" },
        { id: newId(), title: "نانو ريف",         desc: "أحواض بحرية صغيرة بمظهر فخم للمساحات المحدودة.", href: "?tank_type=nano_reef#request-form" },
        { id: newId(), title: "أحواض مكاتب ومجالس", desc: "تصاميم تناسب الديكور وتضيف حضورًا بصريًا للمكان.", href: "?tank_type=decor#request-form" },
        { id: newId(), title: "أحواض مشاريع تجارية", desc: "حلول للكافيهات، المطاعم، العيادات، المعارض، وصالات الانتظار.", href: "?tank_type=decor#request-form" },
      ],
    },
    {
      id: newId(), type: "step_list", enabled: true,
      heading: "طريقة العمل",
      items: [
        { id: newId(), text: "ترسل لنا صورة المكان أو الفكرة." },
        { id: newId(), text: "نراجع المساحة والاحتياج." },
        { id: newId(), text: "نقترح نوع النظام والمقاس المناسب." },
        { id: newId(), text: "نعطيك تصورًا مبدئيًا وتكلفة تقريبية." },
        { id: newId(), text: "نجهز المعدات والمواد." },
        { id: newId(), text: "ننفذ التركيب والتشغيل." },
        { id: newId(), text: "نسلمك تعليمات العناية والمتابعة." },
      ],
    },
    {
      id: newId(), type: "checklist", enabled: true,
      heading: "ماذا نحتاج منك؟",
      items: [
        { id: newId(), text: "صورة للمكان." },
        { id: newId(), text: "المقاس التقريبي للمساحة." },
        { id: newId(), text: "المدينة والحي." },
        { id: newId(), text: "نوع الحوض المطلوب إن وجد." },
        { id: newId(), text: "الميزانية التقريبية." },
        { id: newId(), text: "هل يوجد حوض حالي؟" },
        { id: newId(), text: "هل تريد صيانة بعد التركيب؟" },
        { id: newId(), text: "أي صورة إلهام أو تصميم أعجبك." },
      ],
    },
    {
      id: newId(), type: "dynamic_slot", enabled: true,
      slot: "custom_aquariums_similar_work",
      note: "أعمال مشابهة (تُسحب تلقائيًا من «أعمالنا/المشاريع»).",
    },
    {
      id: newId(), type: "faq", enabled: true,
      heading: "أسئلة شائعة",
      items: [
        { id: newId(), q: "كم يستغرق تنفيذ الحوض؟", a: "يختلف حسب حجم الحوض ونوع النظام. غالبًا من أيام إلى أسابيع، ونحدد جدولًا واضحًا بعد الاتفاق." },
        { id: newId(), q: "هل أحتاج خبرة للعناية بالحوض؟", a: "لا. نُسلّمك الحوض جاهزًا للتشغيل ونشرح لك خطوات العناية الأساسية بطريقة بسيطة." },
        { id: newId(), q: "هل توفرون الصيانة بعد التركيب؟", a: "نعم، نقدّم باقات صيانة دورية اختيارية بعد التسليم." },
        { id: newId(), q: "هل أقدر أختار شكل التصميم؟", a: "بالتأكيد. نأخذ ذوقك ومرجعك البصري بعين الاعتبار قبل اقتراح التصميم." },
        { id: newId(), q: "وش الأفضل لي: نهري أو بحري؟", a: "يعتمد على مستوى العناية المطلوب والميزانية. نقترح لك الأنسب بعد فهم احتياجك." },
        { id: newId(), q: "هل الحوض يحتاج عناية يومية؟", a: "أغلب الأنظمة تحتاج إجراءات بسيطة جدًا يوميًا، وصيانة دورية كل فترة." },
        { id: newId(), q: "هل توفرون الأسماك والنباتات؟", a: "نعم، نختار الكائنات المناسبة لنظام الحوض ونرتب تجهيزها." },
        { id: newId(), q: "هل يمكن تنفيذ الحوض حسب مساحة معينة؟", a: "نعم، نصمم الحوض بمقاسات وأشكال تناسب مكانك بدقة." },
        { id: newId(), q: "هل أقدر أرسل صورة فقط وتحددون المناسب؟", a: "نعم، أرسل صورة المكان وسنقترح الحل المناسب." },
        { id: newId(), q: "هل السعر ثابت؟", a: "السعر يختلف حسب الحجم، النظام، المعدات، والكائنات. نقدم تقديرًا واضحًا بعد فهم التفاصيل." },
      ],
    },
    {
      id: newId(), type: "cta_band", enabled: true,
      heading: "جاهز تبدأ تصميم حوضك؟",
      description: "عبّئ الطلب التالي، وسنراجع التفاصيل ونقترح لك الحل المناسب حسب المساحة والميزانية ونوع الحوض.",
      primary_label: "ابدأ الطلب الآن",
      primary_href: "#request-form",
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
  { key: "business_solutions",label: "حلول الأعمال",       route: "/business-solutions",          group: "full",   hint: "صفحة كاملة قابلة للتعديل: هيرو + تبويبات (كافيهات/مطاعم/فعاليات/...) بكل المحتوى.", defaults: businessDefaults },
  { key: "services_index",    label: "صفحة الخدمات",       route: "/services",                    group: "full",   hint: "صفحة كاملة قابلة للتعديل: هيرو، شبكة الخدمات، بطاقات إرشاد، خطوات، أسئلة شائعة، CTA.", defaults: servicesIndexDefaults },
  { key: "service_custom",    label: "تصميم أحواض مخصصة",  route: "/services/custom-aquariums",   group: "full",   hint: "صفحة كاملة قابلة للتعديل: هيرو، شارات، خطوات، قوائم، أنواع الأحواض، أعمال مشابهة، أسئلة شائعة، CTA.", defaults: serviceCustomDefaults },
  { key: "catalog_meta",      label: "صفحة المتجر",        route: "/catalog",                     group: "hybrid", hint: "هيدر صفحة الكاتلوج.",                                          defaults: catalogDefaults },
  { key: "portfolio_meta",    label: "صفحة أعمالنا",       route: "/portfolio",                   group: "hybrid", hint: "هيدر صفحة المشاريع (تُدار من «أعمالنا/الأحواض»).",            defaults: portfolioDefaults },
  { key: "knowledge_meta",    label: "صفحة المعرفة",       route: "/knowledge",                   group: "hybrid", hint: "هيدر صفحة المقالات (تُدار من «المقالات»).",                    defaults: knowledgeDefaults },
];

export function getPageMeta(key: string): CmsPageMeta | undefined {
  return CMS_PAGES.find((p) => p.key === key);
}
