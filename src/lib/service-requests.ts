export type RequestType = "design" | "visit" | "consultation" | "maintenance";
export type RequestStatus =
  | "new" | "in_review" | "contacted" | "awaiting_customer"
  | "scheduled" | "proposal_sent" | "approved" | "completed" | "cancelled";

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  design: "طلب تصميم",
  visit: "طلب معاينة",
  consultation: "طلب استشارة",
  maintenance: "طلب صيانة",
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  new: "جديد",
  in_review: "قيد المراجعة",
  contacted: "تم التواصل",
  awaiting_customer: "بانتظار معلومات",
  scheduled: "مجدول",
  proposal_sent: "تم إرسال عرض",
  approved: "تم الاعتماد",
  completed: "مكتمل",
  cancelled: "ملغي",
};

export const REQUEST_STATUS_COLOR: Record<RequestStatus, string> = {
  new: "bg-blue-500/20 text-blue-300",
  in_review: "bg-amber-500/20 text-amber-300",
  contacted: "bg-cyan-500/20 text-cyan-300",
  awaiting_customer: "bg-orange-500/20 text-orange-300",
  scheduled: "bg-purple-500/20 text-purple-300",
  proposal_sent: "bg-indigo-500/20 text-indigo-300",
  approved: "bg-teal-500/20 text-teal-300",
  completed: "bg-emerald-500/20 text-emerald-300",
  cancelled: "bg-rose-500/20 text-rose-300",
};

export const REQUIRES_TANK: Record<RequestType, boolean> = {
  design: false,
  visit: false,
  consultation: true,
  maintenance: true,
};

export const ALL_TYPES: RequestType[] = ["design", "visit", "consultation", "maintenance"];
export const ALL_STATUSES: RequestStatus[] = [
  "new", "in_review", "contacted", "awaiting_customer", "scheduled",
  "proposal_sent", "approved", "completed", "cancelled",
];

export const SUCCESS_MESSAGE = "تم استلام طلبك بنجاح، وسيتواصل معك فريق أكوا هيفن قريبًا.";

// Labels for known details keys — used by the admin panel to render a clean
// summary instead of raw JSON for custom aquarium design requests.
export const DETAILS_LABELS: Record<string, string> = {
  request_subtype: "نوع الطلب الفرعي",
  source: "مصدر الطلب",
  neighborhood: "الحي",
  preferred_contact: "طريقة التواصل المفضلة",
  place_type: "نوع المكان",
  place_type_other: "تفاصيل المكان",
  tank_type: "نوع الحوض",
  knows_dimensions: "يعرف المقاسات",
  length_cm: "الطول (سم)",
  width_cm: "العرض (سم)",
  height_cm: "الارتفاع (سم)",
  liters: "السعة التقريبية (لتر)",
  budget: "الميزانية",
  has_existing_tank: "يوجد حوض حالي",
  existing_tank_notes: "وصف الحوض الحالي",
  existing_tank_images: "صور الحوض الحالي",
  place_images: "صور المكان",
  idea_description: "وصف الفكرة",
  wants_maintenance: "خدمة الصيانة بعد التركيب",
  contact_time: "وقت التواصل المناسب",
  contact_time_custom: "وقت محدد",
  reference_project: "مرجع من الأعمال",
};
