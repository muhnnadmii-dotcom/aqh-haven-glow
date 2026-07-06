import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Public auto-translation endpoint.
// - No auth: any visitor can trigger translations while browsing.
// - Cache: results are persisted in public.ui_translations under key = 'auto:<sha1>'
//   so subsequent visitors read the cached value via the existing public SELECT policy.
// - AI: Lovable AI Gateway (free tier during promo). Batched to reduce cost.

const Input = z.object({
  texts: z.array(z.string()).min(1).max(60),
  to: z.enum(["ar", "en"]).default("en"),
});

function hashKey(text: string): string {
  const h = createHash("sha1").update(text).digest("hex").slice(0, 24);
  return `auto:${h}`;
}

export const autoTranslate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    // Normalize + de-duplicate input, cap size to avoid abuse.
    const uniq = Array.from(
      new Set(
        data.texts
          .map((t) => t.replace(/\s+/g, " ").trim())
          .filter((t) => t.length > 0 && t.length <= 800),
      ),
    ).slice(0, 60);
    if (uniq.length === 0) return { translations: {} as Record<string, string> };

    const keys = uniq.map(hashKey);
    const keyToText = new Map<string, string>();
    uniq.forEach((t, i) => keyToText.set(keys[i], t));

    // Public read via publishable key (respects "Anyone can read ui translations" policy).
    const supaPublic = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: existing } = await supaPublic
      .from("ui_translations")
      .select("key, ar, en")
      .in("key", keys);

    const cache: Record<string, string> = {};
    const cachedKeys = new Set<string>();
    for (const row of existing ?? []) {
      const val = data.to === "en" ? row.en : row.ar;
      if (val && val.trim()) {
        const src = keyToText.get(row.key);
        if (src) {
          cache[src] = val;
          cachedKeys.add(row.key);
        }
      }
    }

    // Missing translations
    const missing = uniq.filter((t) => !cache[t]);
    if (missing.length > 0) {
      const key = process.env.LOVABLE_API_KEY;
      if (!key) throw new Error("Missing LOVABLE_API_KEY");
      const src = data.to === "en" ? "Arabic" : "English";
      const dst = data.to === "en" ? "English" : "Arabic";
      const system = `You are a professional translator for Aqua Haven — a premium aquarium design & maintenance brand in Riyadh, Saudi Arabia. Translate each item from ${src} to ${dst} with a luxury, professional voice.
Rules:
- Preserve brand names (Aqua Haven / أكوا هيفن), numbers, currency (SAR/ر.س), phone numbers, URLs, emojis, HTML tags, and placeholders like {name} exactly.
- Keep line breaks and punctuation.
- Do NOT translate items that are already in the target language — return them unchanged.
- Return ONLY a JSON object: { "translations": string[] } with the same length and order.`;

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
          "X-Lovable-AIG-SDK": "manual",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: JSON.stringify({ texts: missing }) },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!resp.ok) {
        const bodyText = await resp.text();
        if (resp.status === 429) throw new Error("rate_limited");
        if (resp.status === 402) throw new Error("credits_exhausted");
        throw new Error(`AI gateway error ${resp.status}: ${bodyText.slice(0, 200)}`);
      }
      const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = json?.choices?.[0]?.message?.content ?? "";
      let parsed: { translations?: string[] } = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            parsed = JSON.parse(m[0]);
          } catch {
            /* ignore */
          }
        }
      }
      const out = Array.isArray(parsed.translations) ? parsed.translations : [];
      const rows: Array<{ key: string; ar: string; en: string; context: string }> = [];
      missing.forEach((srcText, i) => {
        const translated = (out[i] ?? "").toString().trim();
        if (!translated) return;
        cache[srcText] = translated;
        rows.push({
          key: hashKey(srcText),
          ar: data.to === "en" ? srcText : translated,
          en: data.to === "en" ? translated : srcText,
          context: "auto",
        });
      });

      if (rows.length > 0) {
        // Persist using admin client (bypasses RLS) — safe because we only touch
        // rows whose key is prefixed with 'auto:' and we merge sensibly.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("ui_translations").upsert(rows, { onConflict: "key" });
      }
    }

    return { translations: cache };
  });
