import {
  REQUEST_TYPE_LABEL, REQUEST_STATUS_LABEL, DETAILS_LABELS,
  type RequestType, type RequestStatus,
} from "@/lib/service-requests";

export const NA = "غير محدد";

export function display<T>(v: T | null | undefined | "" | 0): string {
  if (v === null || v === undefined) return NA;
  if (typeof v === "string" && v.trim() === "") return NA;
  if (Array.isArray(v) && v.length === 0) return NA;
  return String(v);
}

/** Returns digits-only phone if usable, else null. */
export function normalizePhone(p?: string | null): string | null {
  if (!p) return null;
  const d = p.replace(/\D/g, "");
  return d.length >= 7 ? d : null;
}

export function waLink(phone?: string | null, message?: string): string | null {
  const n = normalizePhone(phone);
  if (!n) return null;
  const q = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${n}${q}`;
}

export function waGreeting(name: string | null | undefined, type: RequestType): string {
  return `مرحبًا ${name || ""}, معك Aqua Haven. وصلنا طلبك بخصوص ${REQUEST_TYPE_LABEL[type]} ونحتاج نراجع معك بعض التفاصيل.`;
}

const FORMATTED_KEYS_ORDER = [
  "request_subtype", "source", "neighborhood", "preferred_contact",
  "place_type", "place_type_other", "tank_type",
  "length_cm", "width_cm", "height_cm", "liters", "budget",
  "has_existing_tank", "existing_tank_notes",
  "wants_maintenance", "contact_time", "contact_time_custom",
  "idea_description", "reference_project",
];

export function detailValueText(value: any): string {
  if (value === null || value === undefined || value === "") return NA;
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (Array.isArray(value)) return value.length ? value.join("، ") : NA;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function buildRequestSummary(r: {
  name: string | null; phone: string | null; city: string | null;
  type: RequestType; details?: Record<string, any> | null;
  customer_notes?: string | null;
}): string {
  const d = r.details ?? {};
  const lines = [
    `طلب جديد من Aqua Haven:`,
    `العميل: ${display(r.name)}`,
    `الجوال: ${display(r.phone)}`,
    `المدينة: ${display(r.city)}`,
    `الحي: ${display(d.neighborhood)}`,
    `نوع الطلب: ${REQUEST_TYPE_LABEL[r.type]}`,
    `نوع الحوض: ${display(d.tank_type)}`,
    `المقاسات: ${d.length_cm || d.width_cm || d.height_cm
      ? `${display(d.length_cm)} × ${display(d.width_cm)} × ${display(d.height_cm)} سم`
      : NA}`,
    `اللترات: ${display(d.liters)}`,
    `الميزانية: ${display(d.budget)}`,
    `الوصف: ${display(d.idea_description || r.customer_notes)}`,
  ];
  return lines.join("\n");
}

export function orderedDetails(details: Record<string, any> | null | undefined) {
  if (!details) return [] as { key: string; label: string; value: string }[];
  const keys = new Set(Object.keys(details));
  const ordered: string[] = [];
  for (const k of FORMATTED_KEYS_ORDER) if (keys.has(k)) { ordered.push(k); keys.delete(k); }
  for (const k of keys) ordered.push(k);
  return ordered
    .filter((k) => !["existing_tank_images", "place_images"].includes(k))
    .map((k) => ({
      key: k,
      label: DETAILS_LABELS[k] || k,
      value: detailValueText(details[k]),
    }))
    .filter((r) => r.value !== NA);
}

export { REQUEST_TYPE_LABEL, REQUEST_STATUS_LABEL };
export type { RequestType, RequestStatus };
