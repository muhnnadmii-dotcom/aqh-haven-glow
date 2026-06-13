import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Module-level cache to avoid refetching role per-component mount
let cachedIsAdmin: boolean | null = null;
let inflight: Promise<boolean> | null = null;

async function fetchIsAdmin(userId: string): Promise<boolean> {
  if (inflight) return inflight;
  inflight = supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle()
    .then(({ data }) => {
      cachedIsAdmin = !!data;
      inflight = null;
      return cachedIsAdmin;
    });
  return inflight;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(cachedIsAdmin ?? false);

  useEffect(() => {
    let mounted = true;
    const apply = (s: Session | null) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      if (s?.user) {
        if (cachedIsAdmin !== null) {
          setIsAdmin(cachedIsAdmin);
        } else {
          fetchIsAdmin(s.user.id).then((v) => mounted && setIsAdmin(v)).catch(() => {});
        }
      } else {
        cachedIsAdmin = null;
        setIsAdmin(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // INITIAL_SESSION fires on subscribe so we don't need a separate getSession call
      if (event === "SIGNED_OUT") cachedIsAdmin = null;
      apply(s);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user, loading, isAdmin };
}
