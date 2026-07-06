import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  texts: z.array(z.string()).min(1).max(80),
  from: z.enum(["ar", "en"]).default("ar"),
  to: z.enum(["ar", "en"]).default("en"),
  tone: z.string().optional(),
});

export const translateBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    // Authorization: admin or staff only
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["admin", "staff"])
      .maybeSingle();
    if (!roleRow) throw new Error("forbidden");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const src = data.from === "ar" ? "Arabic" : "English";
    const dst = data.to === "en" ? "English" : "Arabic";
    const tone =
      data.tone ||
      "Luxury, professional brand voice for Aqua Haven — a premium aquarium design & maintenance company based in Riyadh, Saudi Arabia.";

    const system = `You are a professional translator. Translate each item from ${src} to ${dst}. Preserve meaning, tone, brand names, numbers, currency (SAR/ر.س), phone numbers, URLs, HTML/markdown structure, and placeholders like {name} exactly. Keep line breaks. Do not add commentary. ${tone}
Return ONLY a JSON object of shape: { "translations": string[] } with the same length and order as the input.`;

    const userMsg = JSON.stringify({ texts: data.texts });

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "manual",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
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

    const json = (await resp.json()) as any;
    const raw: string = json?.choices?.[0]?.message?.content ?? "";
    let parsed: { translations?: string[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // salvage: try to find JSON block
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
    // Pad / trim to match input length as a safety net
    const result: string[] = data.texts.map((src, i) => out[i] ?? src);
    return { translations: result };
  });
