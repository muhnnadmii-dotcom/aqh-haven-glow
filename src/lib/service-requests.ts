export type RequestType = "design" | "visit" | "consultation" | "maintenance";
export type RequestStatus =
  | "new" | "in_review" | "contacted" | "awaiting_customer" | "scheduled" | "completed" | "cancelled";

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
  awaiting_customer: "بانتظار العميل",
  scheduled: "مجدول",
  completed: "مكتمل",
  cancelled: "ملغي",
};

export const REQUEST_STATUS_COLOR: Record<RequestStatus, string> = {
  new: "bg-blue-500/20 text-blue-300",
  in_review: "bg-amber-500/20 text-amber-300",
  contacted: "bg-cyan-500/20 text-cyan-300",
  awaiting_customer: "bg-orange-500/20 text-orange-300",
  scheduled: "bg-purple-500/20 text-purple-300",
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
  "new", "in_review", "contacted", "awaiting_customer", "scheduled", "completed", "cancelled",
];

export const SUCCESS_MESSAGE = "تم استلام طلبك بنجاح، وسيتواصل معك فريق أكوا هيفن قريبًا.";
