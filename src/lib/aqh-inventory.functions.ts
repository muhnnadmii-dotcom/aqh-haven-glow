import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SeedRow = {
  sku: string;
  name_ar: string;
  category: string | null;
  image_url: string | null;
  current_qty: number;
  cost: number;
  restock_type: string;
};

export const seedAqhProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Admin-only
    const { data: roleRow, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw roleErr;
    if (!roleRow) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const seedModule = await import("./seed/aqh-products-seed.json");
    const rows = (seedModule.default ?? seedModule) as SeedRow[];
    // Insert in chunks of 200 to be safe
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await supabaseAdmin
        .from("aqh_products")
        .upsert(chunk, { onConflict: "sku", ignoreDuplicates: false });
      if (error) throw error;
      inserted += chunk.length;
    }
    return { inserted };
  });
