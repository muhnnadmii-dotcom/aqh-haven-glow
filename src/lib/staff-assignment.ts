import { supabase } from "@/integrations/supabase/client";

export type AssignmentStatus = "unassigned" | "assigned" | "accepted" | "transferred";

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  unassigned: "غير مسند",
  assigned: "مسند",
  accepted: "تم الاستلام",
  transferred: "تم التحويل",
};

export const ASSIGNMENT_STATUS_COLOR: Record<AssignmentStatus, string> = {
  unassigned: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
  assigned: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  accepted: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  transferred: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
};

export const DEPARTMENTS = ["تصميم", "صيانة", "استشارة", "مبيعات", "دعم"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export type StaffMember = {
  id: string;
  full_name: string | null;
  display_name_for_customer: string | null;
  role: "admin" | "staff";
};

export type AssignmentEvent = {
  id: string;
  request_id: string;
  event_type: "assigned" | "accepted" | "transferred" | "unassigned";
  from_staff_id: string | null;
  to_staff_id: string | null;
  actor_id: string | null;
  department: string | null;
  note: string | null;
  visible_to_customer: boolean;
  created_at: string;
};

export async function fetchStaffMembers(): Promise<StaffMember[]> {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["admin", "staff"]);
  if (!roles || roles.length === 0) return [];
  const ids = Array.from(new Set(roles.map((r: any) => r.user_id)));
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, full_name, display_name_for_customer")
    .in("id", ids);
  const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
  // dedupe by user_id, prefer 'admin' role label
  const seen = new Map<string, StaffMember>();
  for (const r of roles as any[]) {
    const prof = map.get(r.user_id);
    const existing = seen.get(r.user_id);
    const role = r.role === "admin" ? "admin" : "staff";
    if (!existing || (role === "admin" && existing.role !== "admin")) {
      seen.set(r.user_id, {
        id: r.user_id,
        full_name: prof?.full_name ?? null,
        display_name_for_customer: prof?.display_name_for_customer ?? null,
        role,
      });
    }
  }
  return Array.from(seen.values()).sort((a, b) =>
    (a.full_name || "").localeCompare(b.full_name || "", "ar"),
  );
}

export function staffLabel(s: StaffMember | null | undefined): string {
  if (!s) return "—";
  return s.full_name || s.display_name_for_customer || "موظف";
}
