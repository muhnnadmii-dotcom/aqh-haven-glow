export type TankTypeKey = "river" | "marine" | "planted" | "nano" | "aquascape" | "before_after";
export type SizeKey = "small" | "medium" | "large";
export type StyleKey = "natural" | "luxury" | "minimal" | "rocky" | "planted_dense" | "marine_colorful" | "modern";
export type CareKey = "easy" | "medium" | "advanced";
export type SuitableForKey = "home" | "office" | "majlis" | "cafe" | "restaurant" | "reception";

export const TANK_TYPE_LABELS: Record<TankTypeKey, string> = {
  river: "نهري",
  marine: "بحري",
  planted: "نباتي",
  nano: "نانو",
  aquascape: "أكواسكب",
  before_after: "قبل / بعد",
};
export const SIZE_LABELS: Record<SizeKey, string> = {
  small: "صغير",
  medium: "متوسط",
  large: "كبير",
};
export const STYLE_LABELS: Record<StyleKey, string> = {
  natural: "طبيعي",
  luxury: "فاخر",
  minimal: "بسيط",
  rocky: "صخري",
  planted_dense: "نباتي كثيف",
  marine_colorful: "بحري ملون",
  modern: "مودرن",
};
export const CARE_LABELS: Record<CareKey, string> = {
  easy: "سهل",
  medium: "متوسط",
  advanced: "متقدم",
};
export const SUITABLE_FOR_LABELS: Record<SuitableForKey, string> = {
  home: "منزل",
  office: "مكتب",
  majlis: "مجلس",
  cafe: "كافيه",
  restaurant: "مطعم",
  reception: "استقبال",
};

export const TANK_TYPE_OPTIONS = Object.entries(TANK_TYPE_LABELS) as [TankTypeKey, string][];
export const SIZE_OPTIONS = Object.entries(SIZE_LABELS) as [SizeKey, string][];
export const STYLE_OPTIONS = Object.entries(STYLE_LABELS) as [StyleKey, string][];
export const CARE_OPTIONS = Object.entries(CARE_LABELS) as [CareKey, string][];
export const SUITABLE_FOR_OPTIONS = Object.entries(SUITABLE_FOR_LABELS) as [SuitableForKey, string][];

export type WorkGalleryItem = {
  id: string;
  title: string | null;
  image_path: string;
  extra_images: string[];
  tank_type: string | null;
  size_category: string | null;
  style: string | null;
  care_level: string | null;
  suitable_for: string[];
  linked_project_id: string | null;
  is_published: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export function label<T extends string>(map: Record<string, string>, key: T | string | null | undefined): string | null {
  if (!key) return null;
  return map[key] ?? key;
}
