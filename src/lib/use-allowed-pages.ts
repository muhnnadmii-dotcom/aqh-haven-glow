// Hook: returns the set of admin page keys the current user is allowed to see.
// Logic:
//   - admin              -> all pages allowed
//   - has any custom role -> only pages granted by their custom roles
//   - otherwise           -> all pages allowed (legacy staff/finance behaviour;
//                            real data protection stays in RLS)
//
// This is a UI/route-gating layer only. Sensitive data is still protected
// by RLS on the underlying tables.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type State = {
  loading: boolean;
  unrestricted: boolean;       // true => can see everything (admin or no custom role)
  allowed: Set<string>;        // only meaningful when unrestricted === false
};

let cache: { uid: string; state: State } | null = null;
let inflight: Promise<State> | null = null;

async function load(uid: string): Promise<State> {
  if (cache?.uid === uid) return cache.state;
  if (inflight) return inflight;
  inflight = (async () => {
    // admin shortcut
    const { data: adminRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    if (adminRow) {
      const s: State = { loading: false, unrestricted: true, allowed: new Set() };
      cache = { uid, state: s };
      inflight = null;
      return s;
    }

    // Does this user have any custom-role assignment?
    const { data: anyCustom } = await supabase.rpc("i_have_any_custom_role");
    if (!anyCustom) {
      const s: State = { loading: false, unrestricted: true, allowed: new Set() };
      cache = { uid, state: s };
      inflight = null;
      return s;
    }

    const { data: pages } = await supabase.rpc("get_my_custom_allowed_pages");
    const allowed = new Set<string>((pages ?? []).map((r: any) => r.page_key));
    const s: State = { loading: false, unrestricted: false, allowed };
    cache = { uid, state: s };
    inflight = null;
    return s;
  })();
  return inflight;
}

export function clearAllowedPagesCache() {
  cache = null;
  inflight = null;
}

export function useAllowedPages() {
  const [state, setState] = useState<State>(
    cache?.state ?? { loading: true, unrestricted: true, allowed: new Set() },
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        if (mounted) setState({ loading: false, unrestricted: false, allowed: new Set() });
        return;
      }
      const s = await load(data.user.id);
      if (mounted) setState(s);
    })();
    return () => { mounted = false; };
  }, []);

  const canSee = (pageKey: string) => state.unrestricted || state.allowed.has(pageKey);

  return { ...state, canSee };
}
