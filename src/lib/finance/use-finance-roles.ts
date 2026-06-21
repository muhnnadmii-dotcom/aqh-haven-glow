import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FinanceRole =
  | "admin"
  | "finance_view"
  | "finance_manage"
  | "finance_accountant"
  | "finance_export"
  | "finance_settings";

const FINANCE_ROLES: FinanceRole[] = [
  "admin",
  "finance_view",
  "finance_manage",
  "finance_accountant",
  "finance_export",
  "finance_settings",
];

let cache: { uid: string; roles: FinanceRole[] } | null = null;
let inflight: Promise<FinanceRole[]> | null = null;

async function fetchRoles(uid: string): Promise<FinanceRole[]> {
  if (cache?.uid === uid) return cache.roles;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .in("role", FINANCE_ROLES as unknown as string[]);
    const roles = ((data ?? []).map((r) => r.role) as FinanceRole[]) ?? [];
    cache = { uid, roles };
    inflight = null;
    return roles;
  })();
  return inflight;
}

export function useFinanceRoles() {
  const [roles, setRoles] = useState<FinanceRole[]>(cache?.roles ?? []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        if (mounted) { setRoles([]); setLoading(false); }
        return;
      }
      const r = await fetchRoles(data.user.id);
      if (mounted) { setRoles(r); setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const has = (role: FinanceRole) => roles.includes(role);
  const isAdmin = has("admin");
  return {
    roles,
    loading,
    isAdmin,
    canView: isAdmin || roles.length > 0,
    canManage: isAdmin || has("finance_manage"),
    canAccountant: isAdmin || has("finance_accountant"),
    canExport: isAdmin || has("finance_export"),
    canSettings: isAdmin || has("finance_settings"),
  };
}

export function clearFinanceRolesCache() {
  cache = null;
  inflight = null;
}
