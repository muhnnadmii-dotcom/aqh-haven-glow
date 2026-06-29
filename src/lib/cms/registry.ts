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

// ─── BUSINESS SOLUTIONS (full CMS via business_tabs) ─────────────────────────

const businessDefaults: PageDoc = {
  sections: [
    {
      id: newId(), type: "hero", enabled: true,
      kicker: "BUSINESS SOLUTIONS",
      title: "حلول لأصحاب الأعمال",
      description: "صفحة مخصصة لأصحاب الكافيهات والمطاعم والفعاليات والمحلات — حلول تصميم وتركيب وتوريد أحواض وأنظمة عرض احترافية.",
    },
    {
      id: newId(), type: "business_tabs", enabled: true,
      kicker: "BUSINESS",
      heading: "حلول لأصحاب الأعمال",
      description: "قسم مخصص لأصحاب الكافيهات، المطاعم، الفعاليات، والمحلات — كل ما تحتاج معرفته قبل اتخاذ قرار الشراكة معنا.",
      items: [
        {
          id: newId(), icon: "Coffee", title: "كافيهات",
          tagline: "حوض مرجاني أو نباتي يحوّل مقهاك إلى تجربة بصرية لا تُنسى.",
          idea: "نصمم لكافيهك حوضاً يصبح نقطة الجذب الأولى لزوارك — جدارية مائية، طاولة مدخل، أو جزيرة بحرية وسط القاعة. حوض هادئ، صحي، يثري الديكور ويصنع محتوى ينشره الزوار.",
          concerns: [
            { id: newId(), q: "هل يصدر الحوض رائحة؟", a: "أبداً. أنظمتنا المغلقة والفلترة المتقدمة (بروتين سكيمر للبحري + كاربون مفعّل) تحافظ على المياه شفافة والهواء حول الحوض نظيف." },
            { id: newId(), q: "هل يحتاج صيانة يومية من فريقك؟", a: "لا. التشغيل اليومي تلقائي بالكامل (إضاءة + تغذية أوتوماتيكية)، ونحن نتولى الصيانة الدورية ضمن اشتراك شهري مرن." },
            { id: newId(), q: "هل يزعج العملاء بالضوضاء؟", a: "كل المضخات هادئة (تقنية DC) ومخفية داخل الكابينة السفلية. الصوت لا يتجاوز همس خفيف لا يلاحظه أحد." },
            { id: newId(), q: "هل يستهلك كهرباء عالية؟", a: "الاستهلاك معقول ومحسوب مسبقاً (LED موفّر، مضخات DC). نقدّم لك توقعاً دقيقاً للاستهلاك قبل التنفيذ." },
            { id: newId(), q: "ماذا يحدث إذا انقطعت الكهرباء؟", a: "نوفر بطاريات احتياطية للمضخة الأساسية + تنبيهات على جوالك، وندعم تركيب UPS عند الحاجة." },
          ],
          features: [
            { id: newId(), text: "تصميم يتناسب مع هوية المكان وألوان البراند" },
            { id: newId(), text: "إضاءة قابلة للبرمجة (سحر بصري وقت الذروة)" },
            { id: newId(), text: "صور وفيديوهات احترافية بعد التسليم لاستخدامها في تسويقك" },
            { id: newId(), text: "صيانة دورية بعقد سنوي يضمن جمال الحوض دائماً" },
          ],
          payment: [
            { id: newId(), text: "دفعة أولى 50٪ عند توقيع العقد" },
            { id: newId(), text: "الدفعة الثانية 40٪ عند التسليم" },
            { id: newId(), text: "10٪ بعد فترة التشغيل التجريبي (٧ أيام)" },
            { id: newId(), text: "تقسيط متاح عبر تمارا / تابي للمشاريع المؤهلة" },
            { id: newId(), text: "اشتراك صيانة شهري ثابت يضمن استقرار الحوض" },
          ],
          images: [
            { id: newId(), path: marineCubeAsset.url },
            { id: newId(), path: counterAquariumAsset.url },
          ],
          cta: "السلام عليكم، أرغب بحوض مخصص لكافيه. أتمنى التواصل لمناقشة التفاصيل.",
        },
        {
          id: newId(), icon: "UtensilsCrossed", title: "مطاعم",
          tagline: "أنظمة عرض راقية، وأحواض مأكولات بحرية حية للمطاعم الفاخرة.",
          idea: "للمطاعم: نقدم خيارين — حوض ديكور (مرجاني أو نباتي) يرفع مستوى تجربة الضيوف، أو نظام عرض مأكولات بحرية حية (Live Seafood) للمطاعم البحرية، يعرض جمبري، لوبستر، أسماك حية بأنظمة تبريد وفلترة احترافية.",
          concerns: [
            { id: newId(), q: "هل أنظمة المأكولات الحية موثوقة؟", a: "نعم. نستخدم تشيلر تبريد دقيق + فلترة بيولوجية تحافظ على حياة الكائنات لفترة طويلة بصحة ممتازة." },
            { id: newId(), q: "هل يؤثر الحوض على رائحة الطعام؟", a: "لا. الأنظمة المغلقة ومعالجة المياه تضمن عدم وجود أي رائحة بحرية في القاعة." },
            { id: newId(), q: "كم يستهلك من الفضاء؟", a: "نصمم وفق مساحتك المتاحة — من ٨٠ سم حتى جدار كامل، مع إخفاء المعدات في كابينة سفلية أو غرفة خلفية." },
            { id: newId(), q: "هل تدربون الكادر على التشغيل اليومي؟", a: "نعم. تدريب كامل للكادر على التغذية، النظافة السطحية، وقراءة المؤشرات. الصيانة العميقة من فريقنا." },
          ],
          features: [
            { id: newId(), text: "نظام Live Seafood بمعايير صحية معتمدة" },
            { id: newId(), text: "إضاءة عرض احترافية تبرز جمال الكائنات" },
            { id: newId(), text: "إمدادات مستمرة للكائنات الحية حسب الطلب" },
            { id: newId(), text: "صيانة شهرية شاملة + تدخل طارئ خلال ٢٤ ساعة" },
          ],
          payment: [
            { id: newId(), text: "عرض سعر مفصل بعد المعاينة المجانية" },
            { id: newId(), text: "دفعة أولى 40-50٪ — مرونة في الدفعات الوسطى" },
            { id: newId(), text: "عقد صيانة سنوي مع تخفيض على الزيارات" },
            { id: newId(), text: "إمكانية الإيجار التشغيلي للأنظمة الكبيرة" },
          ],
          images: [
            { id: newId(), path: counterAquariumAsset.url },
            { id: newId(), path: bannerTankAsset.url },
          ],
          cta: "السلام عليكم، أرغب بمناقشة حوض/نظام مأكولات بحرية لمطعمنا.",
        },
        {
          id: newId(), icon: "PartyPopper", title: "فعاليات ومعارض",
          tagline: "أحواض مؤقتة لافتتاحيات، أعراس، فعاليات أطفال، ومعارض تجارية.",
          idea: "نوفّر أحواضاً جاهزة للتركيب المؤقت في فعاليتك — لمسة فاخرة تثير إعجاب الحضور. مناسبة للأعراس، الافتتاحيات، فعاليات الأطفال (تجربة تفاعلية مع كائنات بحرية بسيطة)، ومعارض البراندات.",
          concerns: [
            { id: newId(), q: "كم تستغرق عملية التركيب؟", a: "نُجهّز الحوض قبل الفعالية بـ ٢٤-٤٨ ساعة لضمان استقرار البيئة، والإزالة في نفس اليوم بعد الفعالية." },
            { id: newId(), q: "ماذا عن سلامة الأطفال؟", a: "كل الأحواض مؤمّنة بحواجز شفافة وأنظمة كهربائية معزولة، ونوفر مشرفاً مع أي تجربة تفاعلية." },
            { id: newId(), q: "هل الكائنات بأمان أثناء النقل؟", a: "نستخدم بروتوكولات نقل احترافية بدرجة حرارة وأكسجين مضبوطين، وتعود الكائنات بصحة كاملة لمرافقنا بعد الفعالية." },
          ],
          features: [
            { id: newId(), text: "أحواض مؤقتة من ٥٠ لتر حتى ١٠٠٠ لتر" },
            { id: newId(), text: "تركيب وفك في نفس اليوم" },
            { id: newId(), text: "خيار إضافة كائنات حية للعرض" },
            { id: newId(), text: "تجارب تفاعلية للأطفال (touch pool) عند الطلب" },
          ],
          payment: [
            { id: newId(), text: "تسعير يومي شامل التركيب والكائنات" },
            { id: newId(), text: "خصومات للفعاليات متعددة الأيام" },
            { id: newId(), text: "دفعة تأمين قابلة للاسترداد" },
          ],
          images: [
            { id: newId(), path: livingRoomTankAsset.url },
            { id: newId(), path: marineCubeAsset.url },
          ],
          cta: "السلام عليكم، أرغب بحوض لفعالية. أتمنى مناقشة التفاصيل والتاريخ.",
        },
        {
          id: newId(), icon: "Fish", title: "بيع الأسماك الحية للأكل",
          tagline: "إمداد محلات السوبرماركت والمطاعم البحرية بأسماك وقشريات حية.",
          idea: "للمحلات والمطاعم البحرية: نوفّر إمدادات منتظمة من الأسماك والقشريات الحية للأكل، مع أنظمة عرض احترافية في موقعك تضمن جودة وحياة المنتج حتى لحظة الطلب.",
          concerns: [
            { id: newId(), q: "ما هي الكائنات المتاحة؟", a: "جمبري، لوبستر، سرطان البحر، وأنواع مختلفة من الأسماك الطازجة حسب الموسم والطلب." },
            { id: newId(), q: "ما مدى انتظام التوريد؟", a: "نوفر جدول توريد أسبوعي ثابت، مع توريد طارئ خلال ٢٤ ساعة حسب الحاجة." },
            { id: newId(), q: "هل تشمل الخدمة تأسيس نظام العرض؟", a: "نعم — نصمم وننفذ نظام العرض في محلك أو مطبخ المطعم، ونتولى صيانته." },
          ],
          features: [
            { id: newId(), text: "توريد منتظم من مصادر موثوقة" },
            { id: newId(), text: "نظام عرض احترافي بمواصفات معتمدة" },
            { id: newId(), text: "ضمان حياة الكائنات حتى التسليم" },
            { id: newId(), text: "أسعار جملة تنافسية للعملاء الدائمين" },
          ],
          payment: [
            { id: newId(), text: "عقد توريد شهري بأسعار ثابتة" },
            { id: newId(), text: "دفعات أسبوعية أو شهرية حسب اتفاقك" },
            { id: newId(), text: "خصم على نظام العرض عند توقيع عقد توريد" },
          ],
          images: [
            { id: newId(), path: counterAquariumAsset.url },
            { id: newId(), path: bannerTankAsset.url },
          ],
          cta: "السلام عليكم، أرغب بالاستفسار عن توريد أسماك حية للأكل.",
        },
      ],
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
  { key: "services_index",    label: "صفحة الخدمات",       route: "/services",                    group: "full",   hint: "صفحة كاملة قابلة للتعديل: هيرو، شبكة الخدمات، بطاقات إرشاد، خطوات، أسئلة شائعة، CTA.", defaults: servicesIndexDefaults },
  { key: "service_custom",    label: "تصميم أحواض مخصصة",  route: "/services/custom-aquariums",   group: "hybrid", hint: "هيدر يظهر فوق محتوى صفحة التصميم المخصص.",                    defaults: serviceCustomDefaults },
  { key: "catalog_meta",      label: "صفحة المتجر",        route: "/catalog",                     group: "hybrid", hint: "هيدر صفحة الكاتلوج.",                                          defaults: catalogDefaults },
  { key: "portfolio_meta",    label: "صفحة أعمالنا",       route: "/portfolio",                   group: "hybrid", hint: "هيدر صفحة المشاريع (تُدار من «أعمالنا/الأحواض»).",            defaults: portfolioDefaults },
  { key: "knowledge_meta",    label: "صفحة المعرفة",       route: "/knowledge",                   group: "hybrid", hint: "هيدر صفحة المقالات (تُدار من «المقالات»).",                    defaults: knowledgeDefaults },
];

export function getPageMeta(key: string): CmsPageMeta | undefined {
  return CMS_PAGES.find((p) => p.key === key);
}
