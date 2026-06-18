// Helpers for the "Aquarium Assistant" feature on /account/tanks/:id

export type TankHealthStatus = "excellent" | "stable" | "needs_attention" | "problem" | "unknown";

export const HEALTH_LABEL: Record<TankHealthStatus, string> = {
  excellent: "ممتاز",
  stable: "مستقر",
  needs_attention: "يحتاج متابعة",
  problem: "توجد مشكلة",
  unknown: "لا توجد بيانات بعد",
};

export const HEALTH_COLOR: Record<TankHealthStatus, string> = {
  excellent: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  stable: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  needs_attention: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  problem: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  unknown: "bg-white/5 text-muted-foreground border-white/10",
};

export type WaterType = "freshwater" | "planted" | "marine" | "other";

export function detectWaterType(tankType: string | null | undefined): WaterType {
  const t = (tankType || "").toLowerCase();
  if (t.includes("بحر") || t.includes("marine") || t.includes("reef") || t.includes("salt")) return "marine";
  if (t.includes("نبات") || t.includes("plant")) return "planted";
  if (t.includes("نهر") || t.includes("fresh")) return "freshwater";
  return "other";
}

export function nextWaterChangeDays(tankType: string | null | undefined): number {
  return detectWaterType(tankType) === "marine" ? 14 : 7;
}

export function daysAgo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function relativeArabic(iso: string | null | undefined): string {
  const d = daysAgo(iso);
  if (d === null) return "—";
  if (d === 0) return "اليوم";
  if (d === 1) return "أمس";
  if (d < 7) return `قبل ${d} أيام`;
  if (d < 30) return `قبل ${Math.floor(d / 7)} أسابيع`;
  if (d < 365) return `قبل ${Math.floor(d / 30)} شهور`;
  return `قبل ${Math.floor(d / 365)} سنة`;
}

// Soft ranges (general guidance only)
export const FRESH_RANGES = {
  ph: [6.5, 7.8],
  ammonia: [0, 0.25],
  nitrite: [0, 0.25],
  nitrate: [0, 40],
  temperature: [22, 28],
};
export const MARINE_RANGES = {
  ph: [8.0, 8.4],
  salinity: [1.023, 1.026],
  kh: [7, 11],
  calcium: [380, 450],
  magnesium: [1250, 1400],
  nitrate: [0, 15],
  phosphate: [0, 0.05],
  temperature: [24, 27],
};

export function readingOutOfRange(reading: Record<string, number | null | undefined>, water: WaterType): boolean {
  const ranges: Record<string, [number, number]> = water === "marine" ? (MARINE_RANGES as any) : (FRESH_RANGES as any);
  for (const key of Object.keys(ranges)) {
    const v = reading[key];
    if (v === null || v === undefined) continue;
    const [lo, hi] = ranges[key];
    if (v < lo || v > hi) return true;
  }
  return false;
}

export type SummarySnapshot = {
  lastWaterChange: string | null;
  lastReading: { date: string | null; outOfRange: boolean };
  lastPhoto: string | null;
  lastNote: { date: string | null; text: string | null };
  lastStatus: { status: string | null; date: string | null };
  openIssue: boolean;
  nextTaskDue: string | null;
};

export function computeHealth(snap: SummarySnapshot, water: WaterType): TankHealthStatus {
  if (snap.openIssue) return "problem";
  const wcDays = daysAgo(snap.lastWaterChange);
  if (wcDays !== null && wcDays > 14) return "needs_attention";
  if (snap.lastReading.outOfRange) return "needs_attention";
  if (snap.lastStatus.status === "excellent") return "excellent";
  if (snap.lastWaterChange || snap.lastReading.date || snap.lastNote.date || snap.lastStatus.status) return "stable";
  return "unknown";
}

export const ISSUE_TYPES = [
  { value: "cloudy", label: "عكارة في الماء" },
  { value: "sick_fish", label: "سمكة تعبانة" },
  { value: "algae", label: "طحالب" },
  { value: "smell", label: "رائحة" },
  { value: "equipment", label: "فلتر / جهاز" },
  { value: "death", label: "موت كائنات" },
  { value: "other", label: "مشكلة أخرى" },
];

export const NOTE_CATEGORIES = [
  { value: "general", label: "ملاحظة عامة" },
  { value: "fish", label: "السمك" },
  { value: "plants", label: "النبات" },
  { value: "water", label: "الماء" },
  { value: "equipment", label: "الجهاز" },
  { value: "other", label: "أخرى" },
];
