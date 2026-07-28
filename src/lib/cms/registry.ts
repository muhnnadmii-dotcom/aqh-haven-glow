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
  defaults_en?: PageDoc; // optional English default fallback
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

// ─── BUSINESS SOLUTIONS (café-first commercial aquatic experiences) ─────────

const WA_VISIT_AR = "السلام عليكم، أرغب بحجز زيارة موقعية لأكوا هيفن.";
const WA_VISIT_EN = "Hello Aqua Haven, I'd like to book a site visit.";
const WA_BUSINESS_AR = "السلام عليكم، أرغب بمناقشة تجربة مائية لمنشأتنا.";
const WA_BUSINESS_EN = "Hello Aqua Haven, I'd like to discuss a managed aquatic experience for our venue.";

const businessDefaults: PageDoc = {
  sections: [
    // 1) HERO — café-first
    {
      id: newId(), type: "media_hero", enabled: true,
      kicker: "COMMERCIAL AQUATIC EXPERIENCES",
      title: "حوّل مساحتك إلى",
      title_highlight: "تجربة لا تُنسى",
      description: "نصمم، ننفذ، وندير التجارب المائية للمنشآت بعقود مرنة تشمل التركيب والتشغيل والعناية المستمرة.",
      image_path: bannerTankAsset.url,
      primary_label: "احجز زيارة",
      primary_href: "#visit",
      secondary_label: "واتساب · 050 996 6234",
      secondary_whatsapp_template: WA_VISIT_AR,
      badges: [
        { id: newId(), text: "اتصل الآن: 050 996 6234" },
        { id: newId(), text: "تصميم · تنفيذ · إدارة" },
      ],
    },
    // 2) Short value strip (no numbers)
    {
      id: newId(), type: "badge_grid", enabled: true,
      items: [
        { id: newId(), icon: "PenTool",    title: "تصميم مخصص",           desc: "لكل مساحة وهوية." },
        { id: newId(), icon: "Handshake",  title: "إدارة كاملة",          desc: "بدون إشغال فريقك." },
        { id: newId(), icon: "Repeat",     title: "نماذج تعاقد مرنة",     desc: "شراء · اشتراك · تجربة." },
        { id: newId(), icon: "Sparkles",   title: "تركيب وتشغيل وعناية", desc: "دورة حياة كاملة." },
      ],
    },
    // 3) More than an aquarium
    {
      id: newId(), type: "feature_grid", enabled: true,
      kicker: "MORE THAN AN AQUARIUM",
      heading: "أكثر من مجرد حوض",
      subheading: "قيمة تُحس داخل المكان وخارجه.",
      columns: 4,
      items: [
        { id: newId(), icon: "Gem",        title: "أجواء أكثر فخامة",           desc: "حضور بصري يرفع مستوى المكان." },
        { id: newId(), icon: "Smile",      title: "تجربة يتذكرها العملاء",      desc: "لحظة مميزة تصنع انطباعًا يدوم." },
        { id: newId(), icon: "Camera",     title: "نقطة قابلة للتصوير والمشاركة", desc: "خلفية طبيعية تُشجع على النشر." },
        { id: newId(), icon: "Handshake",  title: "حل مُدار بالكامل",           desc: "دون تحميل فريق المنشأة أي مسؤولية." },
      ],
    },
    // 4) The problem
    {
      id: newId(), type: "rich_text", enabled: true,
      heading: "لماذا تتردد المنشآت؟",
      body:
        "• تكلفة البداية وحجم الاستثمار المطلوب.\n" +
        "• مسؤولية العناية المستمرة والوقت الذي تستهلكه.\n" +
        "• الأعطال والمظهر غير المناسب أمام العملاء.\n" +
        "• نقص الخبرة داخل فريق المنشأة.\n\n" +
        "نتولى المنظومة كاملة في أكوا هيفن، من التصميم والتنفيذ إلى الإدارة اليومية — وأنت تركّز على عملك.",
    },
    // 5) Cafés-first showcase section
    {
      id: newId(), type: "rich_text", enabled: true,
      heading: "تجربة مائية مصممة لهوية الكافيه",
      body:
        "الحوض ليس مجرد ديكور — يمكن أن يصبح عنصرًا بصريًا مميزًا يعبّر عن هوية الكافيه، وخلفية طبيعية تشجع الضيوف على التصوير والمشاركة، مع إدارة كاملة من أكوا هيفن حتى لا يُشغل فريقك بأي تفاصيل تقنية.",
    },
    // 6) Contract models — no prices
    {
      id: newId(), type: "sla_tiers", enabled: true,
      kicker: "CONTRACT MODELS",
      heading: "نماذج التعاقد",
      subheading: "اختر النموذج الذي يناسب طبيعة منشأتك — بدون التزام مالي معلن مسبقًا.",
      items: [
        {
          id: newId(), name: "الشراء المباشر",
          features: [
            { id: newId(), text: "مناسب للمنشأة التي ترغب بامتلاك التجربة بالكامل." },
            { id: newId(), text: "يشمل التصميم والتنفيذ والتشغيل الأولي والتسليم." },
            { id: newId(), text: "إمكانية إضافة عقد إدارة وعناية مستمرة لاحقًا." },
          ],
          cta_label: "ناقش مشروع الشراء",
          cta_whatsapp_template: "السلام عليكم، أرغب بمناقشة الشراء المباشر لتجربة مائية.",
        },
        {
          id: newId(), name: "التجربة المائية المُدارة", badge: "Managed Aquarium", highlighted: true,
          features: [
            { id: newId(), text: "اشتراك شهري أو سنوي مرن." },
            { id: newId(), text: "تصميم وتركيب وتشغيل وإدارة مستمرة." },
            { id: newId(), text: "زيارات دورية وتقارير ودعم." },
            { id: newId(), text: "مناسب لمن يريد التجربة دون إدارة التفاصيل اليومية." },
          ],
          cta_label: "استكشف الاشتراك المُدار",
          cta_whatsapp_template: "السلام عليكم، أرغب بمناقشة الاشتراك المُدار (Managed Aquarium).",
        },
        {
          id: newId(), name: "برنامج التجربة", badge: "Pilot Program",
          features: [
            { id: newId(), text: "تجربة لمدة محددة قبل الالتزام طويل المدى." },
            { id: newId(), text: "تركيب وإدارة كاملة خلال فترة التجربة." },
            { id: newId(), text: "مراجعة التجربة في نهاية المدة." },
            { id: newId(), text: "خيار الاستمرار أو الشراء أو الإنهاء حسب الاتفاق." },
          ],
          cta_label: "ابدأ تجربة مرنة",
          cta_whatsapp_template: "السلام عليكم، أرغب ببدء برنامج تجربة (Pilot).",
        },
      ],
    },
    // 7) Pilot Program deep dive
    {
      id: newId(), type: "step_list", enabled: true,
      heading: "ابدأ بتجربة مرنة (Pilot Program)",
      items: [
        { id: newId(), text: "تحديد الموقع والفكرة" },
        { id: newId(), text: "تجهيز وتركيب التجربة" },
        { id: newId(), text: "إدارة كاملة خلال المدة" },
        { id: newId(), text: "مراجعة وخيار الاستمرار أو الشراء" },
      ],
    },
    {
      id: newId(), type: "rich_text", enabled: true,
      heading: "لماذا نبدأ بتجربة؟",
      body: "اختبر أثر التجربة المائية على المكان قبل الالتزام طويل المدى، مع إدارة كاملة طوال فترة البرنامج. يتم تحديد المدة والشروط لكل حالة على حدة.",
    },
    // 8) BrandScape showcase
    {
      id: newId(), type: "feature_grid", enabled: true,
      kicker: "BRANDSCAPE",
      heading: "حوّل هوية علامتك إلى مشهد مائي",
      subheading: "عناصر إبداعية قابلة للتخصيص لكل هوية.",
      columns: 4,
      items: [
        { id: newId(), icon: "Sparkles",   title: "شعار ثلاثي الأبعاد داخل الحوض", desc: "شعار العلامة مطبوع 3D يُدمج بذكاء داخل التصميم." },
        { id: newId(), icon: "Building2",  title: "مجسم مصغر للمبنى أو الواجهة",  desc: "قطعة مركزية تحكي قصة المكان بصريًا." },
        { id: newId(), icon: "Fish",       title: "Signature Aquarium",             desc: "حوض مُصمم خصيصًا للعلامة، شكل وأسلوب فريد." },
        { id: newId(), icon: "PenTool",    title: "عناصر قصصية من العلامة",         desc: "مستوحاة من منتجاتك أو قصة براندك." },
      ],
    },
    {
      id: newId(), type: "case_studies", enabled: true,
      kicker: "CONCEPTS",
      heading: "تصورات مقترحة",
      subheading: "نماذج تجربة قابلة للتخصيص — ليست مشاريع منفذة بأسماء عملاء.",
      items: [
        { id: newId(), image_path: bannerTankAsset.url,      category: "كافيه",       title: "تجربة مائية في زاوية الكافيه" },
        { id: newId(), image_path: counterAquariumAsset.url, category: "مطعم",        title: "حوض عرض بجانب الكاونتر" },
        { id: newId(), image_path: livingRoomTankAsset.url,  category: "لوبي",        title: "قطعة مركزية للاستقبال" },
        { id: newId(), image_path: marineCubeAsset.url,      category: "Signature",    title: "مكعب Signature للعلامة" },
      ],
    },
    // 9) Events & pop-ups
    {
      id: newId(), type: "feature_grid", enabled: true,
      kicker: "EVENTS",
      heading: "الفعاليات والأحواض المؤقتة",
      subheading: "حلول قصيرة المدى تشمل التركيب والفك والتأجير المؤقت.",
      columns: 3,
      items: [
        { id: newId(), icon: "PartyPopper",    title: "الافتتاحات",            desc: "تجربة مائية لافتة في يوم الافتتاح." },
        { id: newId(), icon: "Presentation",   title: "المعارض والمؤتمرات",   desc: "جناح مميز بمشهد مائي حي." },
        { id: newId(), icon: "GraduationCap",  title: "المدارس والفعاليات",   desc: "تجربة تعليمية أو ترفيهية مؤقتة." },
        { id: newId(), icon: "Store",          title: "الأركان الموسمية",     desc: "أحواض مؤقتة داخل المولات والفعاليات." },
        { id: newId(), icon: "Truck",          title: "تركيب وفك وإدارة",     desc: "خدمة كاملة لفترة الفعالية." },
        { id: newId(), icon: "Sparkles",       title: "تصميم بحسب الحدث",     desc: "يتماشى مع هوية الفعالية." },
      ],
    },
    // 10) Target segments — cafés first
    {
      id: newId(), type: "feature_grid", enabled: true,
      kicker: "SEGMENTS",
      heading: "القطاعات المستهدفة",
      subheading: "الكافيهات هي الأولوية، مع خدمة قطاعات أخرى.",
      columns: 3,
      items: [
        { id: newId(), icon: "Coffee",          title: "الكافيهات",          desc: "تجربة تعكس هوية الكافيه وتصنع لحظة يتذكرها الضيف." },
        { id: newId(), icon: "UtensilsCrossed", title: "المطاعم",           desc: "حضور بصري يزيد جاذبية المكان." },
        { id: newId(), icon: "Hotel",           title: "الفنادق",           desc: "قطع مركزية لللوبي والصالات." },
        { id: newId(), icon: "Briefcase",       title: "المكاتب",           desc: "استقبال يعكس هوية الشركة." },
        { id: newId(), icon: "GraduationCap",   title: "المدارس",           desc: "تجارب تعليمية آمنة ومُدارة." },
        { id: newId(), icon: "PartyPopper",     title: "الفعاليات والمعارض", desc: "تركيب مؤقت لفترة الحدث." },
      ],
    },
    // 11) Timeline
    {
      id: newId(), type: "step_list", enabled: true,
      heading: "من الفكرة إلى الخدمة المُدارة",
      items: [
        { id: newId(), text: "زيارة الموقع" },
        { id: newId(), text: "تصميم الفكرة" },
        { id: newId(), text: "عرض واعتماد" },
        { id: newId(), text: "التنفيذ" },
        { id: newId(), text: "الإطلاق" },
        { id: newId(), text: "الخدمة المُدارة" },
      ],
    },
    // 12) Portal preview (mock dashboard)
    {
      id: newId(), type: "portal_mockup", enabled: true,
      kicker: "CLIENT PORTAL",
      heading: "كل تفاصيل تجربتك في مكان واحد",
      description: "يحصل كل عميل على بوابة مخصصة لمتابعة حالة الحوض والزيارات والتقارير والملفات. المحتوى المعروض تصوري لأغراض العرض.",
      status_label: "حالة الحوض",
      status_value: "ممتازة",
      score_label: "Health Score",
      score_value: "94",
      last_visit_label: "آخر زيارة",
      last_visit_value: "قبل 5 أيام",
      note: "تشمل البوابة العناصر الظاهرة أعلاه، وقد تختلف حسب نطاق العقد.",
      tiles: [
        { id: newId(), icon: "Camera",        label: "الصور",         value: "متوفرة" },
        { id: newId(), icon: "FileText",      label: "التقارير",      value: "تقارير دورية" },
        { id: newId(), icon: "Receipt",       label: "الفواتير",      value: "متوفرة" },
        { id: newId(), icon: "ClipboardList", label: "سجل الخدمة",    value: "محدث" },
        { id: newId(), icon: "FileCheck2",    label: "العقد",         value: "ساري" },
        { id: newId(), icon: "Wrench",        label: "طلبات الدعم",   value: "قناة مباشرة" },
      ],
    },
    // 13) (case studies already presented as concepts above)
    // 14) FAQ
    {
      id: newId(), type: "faq", enabled: true,
      heading: "أسئلة شائعة",
      items: [
        { id: newId(), q: "هل يمكن البدء بتجربة قبل التعاقد الطويل؟", a: "نعم، لدينا برنامج تجربة (Pilot) بتركيب وإدارة كاملة، ثم مراجعة وخيار الاستمرار أو الشراء أو الإنهاء بحسب الاتفاق." },
        { id: newId(), q: "هل تتولون الإدارة والعناية بالكامل؟", a: "نعم، الخدمة المُدارة تشمل التصميم والتركيب والتشغيل والزيارات الدورية والتقارير — دون تحميل فريق المنشأة أي مسؤولية تقنية." },
        { id: newId(), q: "هل يمكن تخصيص الحوض لهوية الكافيه؟", a: "نعم، نصمم عناصر التجربة (شعار داخل الحوض، مجسم، Signature Aquarium، عناصر قصصية) لتتناسب مع هوية علامتك." },
        { id: newId(), q: "هل يوجد شراء مباشر واشتراك؟", a: "نعم، ثلاثة نماذج للتعاقد: الشراء المباشر، التجربة المُدارة (اشتراك)، وبرنامج التجربة (Pilot)." },
        { id: newId(), q: "هل تقدمون حلولًا مؤقتة للفعاليات؟", a: "نعم، نوفّر أحواضًا مؤقتة للافتتاحات والمعارض والمؤتمرات مع خدمة تركيب وفك وإدارة." },
      ],
    },
    // 15) Lead form — site visit
    {
      id: newId(), type: "lead_form", enabled: true,
      kicker: "SITE VISIT",
      heading: "احجز زيارة لموقعك",
      description: "عبّئ التفاصيل التالية وسنتواصل معك لتحديد موعد الزيارة المناسب.",
      form_anchor: "visit",
      submit_label: "إرسال الطلب",
      success_message: "تم استلام طلبك — سنتواصل معك قريبًا لتأكيد موعد الزيارة.",
      whatsapp_fallback_label: "أو تواصل عبر واتساب",
      whatsapp_fallback_template: WA_VISIT_AR,
      contact_note: "بياناتك سرّية ولا تُشارك مع أي جهة خارجية.",
      fields_preset: "business_visit",
      industries: [], budgets: [], timelines: [],
      facility_types: [
        { id: newId(), label: "كافيه" },
        { id: newId(), label: "مطعم" },
        { id: newId(), label: "فندق" },
        { id: newId(), label: "مكتب / شركة" },
        { id: newId(), label: "مدرسة / جامعة" },
        { id: newId(), label: "فعالية / معرض" },
        { id: newId(), label: "أخرى" },
      ],
      need_types: [
        { id: newId(), label: "حوض جديد للمنشأة" },
        { id: newId(), label: "تجربة مائية مُدارة" },
        { id: newId(), label: "برنامج تجربة (Pilot)" },
        { id: newId(), label: "حوض مؤقت لفعالية" },
        { id: newId(), label: "أحتاج استشارة أولية" },
      ],
      preferred_times: [
        { id: newId(), label: "صباحًا (9 – 12)" },
        { id: newId(), label: "ظهرًا (12 – 3)" },
        { id: newId(), label: "عصرًا (3 – 6)" },
        { id: newId(), label: "مساءً (6 – 9)" },
        { id: newId(), label: "أي وقت" },
      ],
      lead_source: "business_lead",
    },
    // 16) Final CTA
    {
      id: newId(), type: "cta_band", enabled: true,
      heading: "لنصنع تجربة استثنائية لمكانك",
      description: "احجز زيارة لموقعك أو تواصل مباشرة مع فريق الأعمال.",
      primary_label: "احجز زيارة",
      primary_href: "#visit",
      secondary_label: "واتساب الأعمال",
      secondary_href: "https://wa.me/966509966234",
    },
  ],
};

const businessDefaultsEn: PageDoc = {
  sections: [
    {
      id: newId(), type: "media_hero", enabled: true,
      kicker: "COMMERCIAL AQUATIC EXPERIENCES",
      title: "Turn your space into",
      title_highlight: "an unforgettable experience",
      description: "We design, install, and manage aquatic experiences for venues — flexible contracts covering installation, operation, and ongoing care.",
      image_path: bannerTankAsset.url,
      primary_label: "Book a Site Visit",
      primary_href: "#visit",
      secondary_label: "WhatsApp · 050 996 6234",
      secondary_whatsapp_template: WA_VISIT_EN,
      badges: [
        { id: newId(), text: "Call now: 050 996 6234" },
        { id: newId(), text: "Design · Install · Manage" },
      ],
    },
    {
      id: newId(), type: "badge_grid", enabled: true,
      items: [
        { id: newId(), icon: "PenTool",   title: "Custom Design",       desc: "Shaped to your space and brand." },
        { id: newId(), icon: "Handshake", title: "Fully Managed",       desc: "Zero load on your team." },
        { id: newId(), icon: "Repeat",    title: "Flexible Contracts",  desc: "Buy · Subscribe · Pilot." },
        { id: newId(), icon: "Sparkles",  title: "Install & Ongoing Care", desc: "End-to-end lifecycle." },
      ],
    },
    {
      id: newId(), type: "feature_grid", enabled: true,
      kicker: "MORE THAN AN AQUARIUM",
      heading: "More Than an Aquarium",
      subheading: "Value that shows up inside — and beyond — your venue.",
      columns: 4,
      items: [
        { id: newId(), icon: "Gem",       title: "A More Premium Atmosphere", desc: "A visual anchor that lifts the room." },
        { id: newId(), icon: "Smile",     title: "A Memorable Experience",    desc: "A moment guests actually remember." },
        { id: newId(), icon: "Camera",    title: "A Shareable Focal Point",   desc: "A natural backdrop for photos." },
        { id: newId(), icon: "Handshake", title: "A Fully Managed Solution",  desc: "Without burdening your staff." },
      ],
    },
    {
      id: newId(), type: "rich_text", enabled: true,
      heading: "Why do venues hesitate?",
      body:
        "• Upfront cost and investment.\n" +
        "• The burden of ongoing care and time.\n" +
        "• Malfunctions and inconsistent appearance.\n" +
        "• Lack of expertise inside the venue's team.\n\n" +
        "Aqua Haven owns the entire system — from design and installation to daily management — so you can focus on your business.",
    },
    {
      id: newId(), type: "rich_text", enabled: true,
      heading: "An aquatic experience designed for your café's identity",
      body: "The aquarium isn't just décor — it becomes a distinctive visual element that expresses the café's identity, a natural backdrop that invites guests to photograph and share, all under Aqua Haven's full management so your team is never distracted by technical detail.",
    },
    {
      id: newId(), type: "sla_tiers", enabled: true,
      kicker: "CONTRACT MODELS",
      heading: "Contract Models",
      subheading: "Pick the model that fits your venue — with no fixed public pricing.",
      items: [
        {
          id: newId(), name: "Direct Purchase",
          features: [
            { id: newId(), text: "For venues that want to fully own the experience." },
            { id: newId(), text: "Design, installation, initial operation and handover." },
            { id: newId(), text: "Option to add an ongoing care contract later." },
          ],
          cta_label: "Discuss a Purchase",
          cta_whatsapp_template: "Hello Aqua Haven, I'd like to discuss a direct purchase of an aquatic experience.",
        },
        {
          id: newId(), name: "Managed Aquarium", badge: "Subscription", highlighted: true,
          features: [
            { id: newId(), text: "Flexible monthly or annual subscription." },
            { id: newId(), text: "Design, installation, operation and ongoing management." },
            { id: newId(), text: "Scheduled visits, reports and support." },
            { id: newId(), text: "For venues that want the experience without daily details." },
          ],
          cta_label: "Explore the Managed Plan",
          cta_whatsapp_template: "Hello Aqua Haven, I'd like to discuss the Managed Aquarium subscription.",
        },
        {
          id: newId(), name: "Pilot Program", badge: "Trial",
          features: [
            { id: newId(), text: "A defined trial before any long-term commitment." },
            { id: newId(), text: "Full installation and management during the pilot." },
            { id: newId(), text: "Review at the end of the trial period." },
            { id: newId(), text: "Continue, purchase, or end — by agreement." },
          ],
          cta_label: "Start a Flexible Pilot",
          cta_whatsapp_template: "Hello Aqua Haven, I'd like to start a Pilot Program.",
        },
      ],
    },
    {
      id: newId(), type: "step_list", enabled: true,
      heading: "Start with a Flexible Pilot",
      items: [
        { id: newId(), text: "Site & concept scoping" },
        { id: newId(), text: "Preparation & installation" },
        { id: newId(), text: "Full management during the pilot" },
        { id: newId(), text: "Review & option to continue or purchase" },
      ],
    },
    {
      id: newId(), type: "rich_text", enabled: true,
      heading: "Why start with a pilot?",
      body: "Test the impact of an aquatic experience on your space before any long-term commitment, with full management throughout the program. Duration and terms are agreed case by case.",
    },
    {
      id: newId(), type: "feature_grid", enabled: true,
      kicker: "BRANDSCAPE",
      heading: "Turn your brand into an aquatic scene",
      subheading: "Creative elements customized to each identity.",
      columns: 4,
      items: [
        { id: newId(), icon: "Sparkles",  title: "3D Brand Logo Inside the Tank", desc: "Your logo, 3D-printed and integrated into the design." },
        { id: newId(), icon: "Building2", title: "Miniature of Your Building",     desc: "A signature piece that tells your story visually." },
        { id: newId(), icon: "Fish",      title: "Signature Aquarium",             desc: "A tank shaped uniquely for your brand." },
        { id: newId(), icon: "PenTool",   title: "Story Elements from Your Brand", desc: "Inspired by your products or brand narrative." },
      ],
    },
    {
      id: newId(), type: "case_studies", enabled: true,
      kicker: "CONCEPTS",
      heading: "Concept Visualizations",
      subheading: "Customizable experience concepts — not client projects.",
      items: [
        { id: newId(), image_path: bannerTankAsset.url,      category: "Café",       title: "Aquatic corner in a café" },
        { id: newId(), image_path: counterAquariumAsset.url, category: "Restaurant", title: "Counter-side display tank" },
        { id: newId(), image_path: livingRoomTankAsset.url,  category: "Lobby",      title: "Reception focal piece" },
        { id: newId(), image_path: marineCubeAsset.url,      category: "Signature",  title: "Signature brand cube" },
      ],
    },
    {
      id: newId(), type: "feature_grid", enabled: true,
      kicker: "EVENTS",
      heading: "Events & Pop-up Aquariums",
      subheading: "Short-term solutions including install, teardown, and temporary rental.",
      columns: 3,
      items: [
        { id: newId(), icon: "PartyPopper",   title: "Openings",           desc: "A standout aquatic experience on launch day." },
        { id: newId(), icon: "Presentation",  title: "Expos & Conferences", desc: "A distinctive booth with a live aquatic scene." },
        { id: newId(), icon: "GraduationCap", title: "Schools & Events",    desc: "Educational or entertainment installations." },
        { id: newId(), icon: "Store",         title: "Seasonal Corners",    desc: "Pop-up tanks inside malls and events." },
        { id: newId(), icon: "Truck",         title: "Install, Teardown & Ops", desc: "Full service across the event window." },
        { id: newId(), icon: "Sparkles",      title: "Event-Tuned Design",  desc: "Aligned with the event identity." },
      ],
    },
    {
      id: newId(), type: "feature_grid", enabled: true,
      kicker: "SEGMENTS",
      heading: "Target Segments",
      subheading: "Cafés first, with additional segments supported.",
      columns: 3,
      items: [
        { id: newId(), icon: "Coffee",          title: "Cafés",            desc: "An experience that reflects your identity and creates a memorable guest moment." },
        { id: newId(), icon: "UtensilsCrossed", title: "Restaurants",      desc: "A visual presence that lifts the room." },
        { id: newId(), icon: "Hotel",           title: "Hotels",           desc: "Focal pieces for lobbies and lounges." },
        { id: newId(), icon: "Briefcase",       title: "Offices",          desc: "Reception areas that reflect your identity." },
        { id: newId(), icon: "GraduationCap",   title: "Schools",          desc: "Safe, managed educational experiences." },
        { id: newId(), icon: "PartyPopper",     title: "Events & Expos",   desc: "Temporary installations for the event window." },
      ],
    },
    {
      id: newId(), type: "step_list", enabled: true,
      heading: "From concept to managed service",
      items: [
        { id: newId(), text: "Site Visit" },
        { id: newId(), text: "Concept Design" },
        { id: newId(), text: "Proposal & Approval" },
        { id: newId(), text: "Installation" },
        { id: newId(), text: "Launch" },
        { id: newId(), text: "Managed Service" },
      ],
    },
    {
      id: newId(), type: "portal_mockup", enabled: true,
      kicker: "CLIENT PORTAL",
      heading: "Every detail of your experience — in one place",
      description: "Each client gets a dedicated portal to track tank status, visits, reports, and files. The layout shown is illustrative.",
      status_label: "Tank Status",
      status_value: "Excellent",
      score_label: "Health Score",
      score_value: "94",
      last_visit_label: "Last Visit",
      last_visit_value: "5 days ago",
      note: "The portal includes the elements shown above; scope may vary by contract.",
      tiles: [
        { id: newId(), icon: "Camera",        label: "Photos",       value: "Available" },
        { id: newId(), icon: "FileText",      label: "Reports",      value: "Scheduled" },
        { id: newId(), icon: "Receipt",       label: "Invoices",     value: "Available" },
        { id: newId(), icon: "ClipboardList", label: "Service Log",  value: "Up to date" },
        { id: newId(), icon: "FileCheck2",    label: "Contract",     value: "Active" },
        { id: newId(), icon: "Wrench",        label: "Support",      value: "Direct channel" },
      ],
    },
    {
      id: newId(), type: "faq", enabled: true,
      heading: "FAQ",
      items: [
        { id: newId(), q: "Can we start with a trial before any long-term commitment?", a: "Yes — the Pilot Program includes full installation and management, then a review with the option to continue, purchase, or end by agreement." },
        { id: newId(), q: "Do you fully handle management and care?", a: "Yes — the Managed Aquarium plan covers design, installation, operation, scheduled visits, and reports, with no technical burden on your team." },
        { id: newId(), q: "Can the aquarium be customized to our café's identity?", a: "Yes — logo elements, signature shapes, and story-driven pieces can all be tailored to your brand." },
        { id: newId(), q: "Do you offer both direct purchase and subscription?", a: "Yes — three contract models: Direct Purchase, Managed Aquarium (subscription), and Pilot Program." },
        { id: newId(), q: "Do you provide temporary solutions for events?", a: "Yes — pop-up aquariums for openings, expos, and conferences, with install, teardown, and management included." },
      ],
    },
    {
      id: newId(), type: "lead_form", enabled: true,
      kicker: "SITE VISIT",
      heading: "Book a Site Visit",
      description: "Share the details below and we'll reach out to schedule the visit.",
      form_anchor: "visit",
      submit_label: "Send Request",
      success_message: "Request received — we'll reach out shortly to confirm the visit.",
      whatsapp_fallback_label: "Or reach us on WhatsApp",
      whatsapp_fallback_template: WA_VISIT_EN,
      contact_note: "Your information is confidential and never shared with third parties.",
      fields_preset: "business_visit",
      industries: [], budgets: [], timelines: [],
      facility_types: [
        { id: newId(), label: "Café" },
        { id: newId(), label: "Restaurant" },
        { id: newId(), label: "Hotel" },
        { id: newId(), label: "Office / Company" },
        { id: newId(), label: "School / University" },
        { id: newId(), label: "Event / Expo" },
        { id: newId(), label: "Other" },
      ],
      need_types: [
        { id: newId(), label: "A new aquarium for our venue" },
        { id: newId(), label: "Managed aquatic experience" },
        { id: newId(), label: "Pilot Program" },
        { id: newId(), label: "Temporary aquarium for an event" },
        { id: newId(), label: "Initial consultation" },
      ],
      preferred_times: [
        { id: newId(), label: "Morning (9 – 12)" },
        { id: newId(), label: "Midday (12 – 3)" },
        { id: newId(), label: "Afternoon (3 – 6)" },
        { id: newId(), label: "Evening (6 – 9)" },
        { id: newId(), label: "Anytime" },
      ],
      lead_source: "business_lead",
    },
    {
      id: newId(), type: "cta_band", enabled: true,
      heading: "Let's Create Something Extraordinary",
      description: "Book a site visit, or reach the business team directly.",
      primary_label: "Book a Site Visit",
      primary_href: "#visit",
      secondary_label: "WhatsApp Business",
      secondary_href: "https://wa.me/966509966234",
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
