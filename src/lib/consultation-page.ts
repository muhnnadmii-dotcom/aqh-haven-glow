import { supabase } from "@/integrations/supabase/client";

export const CONSULTATION_PAGE_KEY = "services/aquarium-consultation";

export type CVisibleItem = { id: string; visible: boolean };

export type ConsultationContent = {
  hero: {
    kicker: string;
    title_line1: string;
    title_highlight: string;
    title_line2: string;
    description: string;
    image_path: string;
    primary_button_label: string;
    primary_button_whatsapp: string;
    secondary_button_label: string;
    trust_chips: { id: string; icon: string; text: string; visible: boolean }[];
  };
  trust: {
    visible: boolean;
    kicker: string;
    heading_line1: string;
    heading_highlight: string;
    body: string;
    disclaimer: string;
    stats: { id: string; big: string; label: string; visible: boolean }[];
  };
  includes: {
    visible: boolean;
    kicker: string;
    heading: string;
    items: { id: string; icon: string; title: string; desc: string; visible: boolean }[];
  };
  suitable: {
    visible: boolean;
    kicker: string;
    heading: string;
    items: { id: string; icon: string; label: string; visible: boolean }[];
  };
  pricing: {
    visible: boolean;
    kicker: string;
    heading: string;
    highlight: {
      visible: boolean;
      badge: string;
      pill: string;
      title: string;
      description: string;
      price: string;
      price_suffix: string;
      features: { id: string; text: string }[];
      button_label: string;
      button_whatsapp: string;
      footnote: string;
    };
    standard: {
      visible: boolean;
      pill: string;
      title: string;
      description: string;
      price: string;
      price_suffix: string;
      features: { id: string; text: string }[];
      button_label: string;
      button_whatsapp: string;
    };
  };
  final_cta: {
    visible: boolean;
    heading_line1: string;
    heading_highlight: string;
    heading_line2: string;
    description: string;
    primary_label: string;
    primary_whatsapp: string;
    secondary_label: string;
    secondary_whatsapp: string;
  };
  show_related: boolean;
};

const nid = () => Math.random().toString(36).slice(2, 10);

export const CONSULTATION_DEFAULTS: ConsultationContent = {
  hero: {
    kicker: "استشارة متخصصة لأحواض الزينة",
    title_line1: "حوضك يرجع",
    title_highlight: "صافي وهادي",
    title_line2: "بدون لفّ ودوران",
    description:
      "خبير يفحص حوضك من الصور والفيديو، يعطيك السبب الحقيقي وخطوات عملية تنفّذها بنفسك — مع متابعة معاك ثلاثة أيام.",
    image_path: "",
    primary_button_label: "احجز استشارتك",
    primary_button_whatsapp: "السلام عليكم، أبغى أحجز استشارة لحوضي مع Aqua Haven.",
    secondary_button_label: "تواصل عبر واتساب",
    trust_chips: [
      { id: nid(), icon: "Award", text: "+29 استشارة منفذة", visible: true },
      { id: nid(), icon: "Clock", text: "متابعة 3 أيام", visible: true },
      { id: nid(), icon: "ShieldCheck", text: "خبرة ميدانية", visible: true },
    ],
  },
  trust: {
    visible: true,
    kicker: "لماذا تثق فينا",
    heading_line1: "خبرة ميدانية،",
    heading_highlight: "مو شهادة على ورق",
    body: "استشارتنا مبنية على سنوات من العمل المباشر مع آلاف الأحواض — ريفية، نهرية، مزروعة، ومجتمعية. شفنا الحالات الصعبة، عالجناها، وتعلّمنا منها. نعطيك تشخيص واقعي وحلول مجرّبة، مو نظريات من كتاب.",
    disclaimer:
      "ملاحظة بصراحة: استشارتنا لا تغني عن مراجعة طبيب بيطري متخصص بالأسماك في الحالات الطبية الدقيقة.",
    stats: [
      { id: nid(), big: "+29", label: "استشارة منفذة", visible: true },
      { id: nid(), big: "آلاف", label: "الحالات الميدانية", visible: true },
      { id: nid(), big: "3", label: "أيام متابعة", visible: true },
      { id: nid(), big: "100%", label: "تشخيص واقعي", visible: true },
    ],
  },
  includes: {
    visible: true,
    kicker: "ماذا تشمل الاستشارة؟",
    heading: "كل اللي تحتاجه عشان حوضك يستقر",
    items: [
      { id: nid(), icon: "Camera", title: "تحليل دقيق لحالتك", desc: "ترسل وصف المشكلة مع صور أو فيديو، ونقرأ الحوض من جذور المشكلة مو من السطح.", visible: true },
      { id: nid(), icon: "Lightbulb", title: "أسباب وحلول عملية", desc: "نشرح لك ليش صار اللي صار، ونعطيك خطوات تنفّذها أنت بيدك خطوة خطوة.", visible: true },
      { id: nid(), icon: "Waves", title: "استقرار الحوض", desc: "نصائح لتثبيت الماء والإضاءة والدورة البيولوجية حتى الحوض يهدأ ويرجع طبيعي.", visible: true },
      { id: nid(), icon: "Clock", title: "متابعة 3 أيام واتساب", desc: "نضل معاك ثلاثة أيام نتابع التحسّن ونعدّل الخطة لو احتاجت تعديل.", visible: true },
      { id: nid(), icon: "Sparkles", title: "ترشيح علاجات ومنتجات", desc: "نرشّح لك الحل الصح عند الحاجة فقط — بدون مبالغة ولا منتجات ما تنفع.", visible: true },
    ],
  },
  suitable: {
    visible: true,
    kicker: "مناسبة لمن؟",
    heading: "لو تواجه أيًا من هذي — احنا لك",
    items: [
      { id: nid(), icon: "Droplets", label: "ماء عكر", visible: true },
      { id: nid(), icon: "Fish", label: "موت أسماك متكرر", visible: true },
      { id: nid(), icon: "Leaf", label: "طحالب منتشرة", visible: true },
      { id: nid(), icon: "Wind", label: "رائحة غير طبيعية", visible: true },
      { id: nid(), icon: "Stethoscope", label: "سمكة مريضة", visible: true },
      { id: nid(), icon: "AlertCircle", label: "حوض جديد غير مستقر", visible: true },
      { id: nid(), icon: "Filter", label: "اختيار فلتر مناسب", visible: true },
      { id: nid(), icon: "Sun", label: "اختيار إضاءة", visible: true },
    ],
  },
  pricing: {
    visible: true,
    kicker: "الأسعار",
    heading: "اختر الباقة اللي تناسبك",
    highlight: {
      visible: true,
      badge: "الأكثر قيمة",
      pill: "لعملاء أحواض Aqua Haven الجاهزة",
      title: "5 استشارات مجانية",
      description: "إذا شريت حوض جاهز (مو فاضي) من Aqua Haven، خمس استشارات كاملة هدية مع حوضك.",
      price: "مجانًا",
      price_suffix: "× 5 استشارات",
      features: [
        { id: nid(), text: "تشخيص كامل + حلول عملية" },
        { id: nid(), text: "متابعة 3 أيام لكل استشارة" },
        { id: nid(), text: "أولوية في الرد" },
        { id: nid(), text: "خبير يعرف حوضك من اليوم الأول" },
      ],
      button_label: "تواصل واستفد من الباقة",
      button_whatsapp: "السلام عليكم، أبغى أستفيد من باقة 5 استشارات المجانية لعملاء Aqua Haven.",
      footnote: "أشتري حوض جاهز وآخذ 5 استشارات ببلاش 🤝",
    },
    standard: {
      visible: true,
      pill: "للجميع",
      title: "استشارة فردية",
      description: "حل مشكلة واحدة بشكل كامل، مع متابعة ثلاثة أيام بعد الجلسة.",
      price: "49",
      price_suffix: "ريال / استشارة",
      features: [
        { id: nid(), text: "تحليل المشكلة من الصور أو الفيديو" },
        { id: nid(), text: "حلول عملية تنفّذها بنفسك" },
        { id: nid(), text: "متابعة 3 أيام عبر واتساب" },
        { id: nid(), text: "ترشيح علاج أو منتج عند الحاجة" },
      ],
      button_label: "احجز استشارتك الآن",
      button_whatsapp: "السلام عليكم، أبغى أحجز استشارة فردية لحوضي.",
    },
  },
  final_cta: {
    visible: true,
    heading_line1: "حوضك",
    heading_highlight: "يستاهل",
    heading_line2: "يكون بأحسن حال",
    description: "لا تضل تجرّب لحالك. خطوة وحدة وتلقى خبير يمسك معاك الحوض من البداية للنهاية.",
    primary_label: "احجز استشارتك",
    primary_whatsapp: "السلام عليكم، أبغى أحجز استشارة لحوضي مع Aqua Haven.",
    secondary_label: "واتساب مباشر",
    secondary_whatsapp: "",
  },
  show_related: true,
};

export function mergeConsultation(partial: any): ConsultationContent {
  const d = CONSULTATION_DEFAULTS;
  if (!partial || typeof partial !== "object") return d;
  return {
    hero: { ...d.hero, ...(partial.hero ?? {}), trust_chips: partial.hero?.trust_chips ?? d.hero.trust_chips },
    trust: { ...d.trust, ...(partial.trust ?? {}), stats: partial.trust?.stats ?? d.trust.stats },
    includes: { ...d.includes, ...(partial.includes ?? {}), items: partial.includes?.items ?? d.includes.items },
    suitable: { ...d.suitable, ...(partial.suitable ?? {}), items: partial.suitable?.items ?? d.suitable.items },
    pricing: {
      ...d.pricing,
      ...(partial.pricing ?? {}),
      highlight: { ...d.pricing.highlight, ...(partial.pricing?.highlight ?? {}), features: partial.pricing?.highlight?.features ?? d.pricing.highlight.features },
      standard: { ...d.pricing.standard, ...(partial.pricing?.standard ?? {}), features: partial.pricing?.standard?.features ?? d.pricing.standard.features },
    },
    final_cta: { ...d.final_cta, ...(partial.final_cta ?? {}) },
    show_related: partial.show_related ?? d.show_related,
  };
}

export async function fetchConsultationContent(): Promise<ConsultationContent> {
  const { data, error } = await supabase
    .from("site_pages")
    .select("content")
    .eq("page_key", CONSULTATION_PAGE_KEY)
    .maybeSingle();
  if (error) throw error;
  return mergeConsultation(data?.content);
}

export async function saveConsultationContent(content: ConsultationContent) {
  const { error } = await supabase
    .from("site_pages")
    .upsert({ page_key: CONSULTATION_PAGE_KEY, content: content as any, title: "استشارة الأحواض" }, { onConflict: "page_key" });
  if (error) throw error;
}

export const newCId = nid;
