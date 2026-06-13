import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export async function getSessionUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}