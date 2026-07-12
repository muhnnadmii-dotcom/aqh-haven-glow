import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

const BASE_URL = "https://hub.aqh.sa";

interface SitemapEntry {
  path: string;
  changefreq?: "weekly" | "monthly" | "daily";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/portfolio", changefreq: "weekly", priority: "0.9" },
          { path: "/services", changefreq: "monthly", priority: "0.9" },
          { path: "/services/custom-aquariums", changefreq: "monthly", priority: "0.8" },
          { path: "/business-solutions", changefreq: "monthly", priority: "0.8" },
          { path: "/maintenance", changefreq: "monthly", priority: "0.8" },
          { path: "/consultation", changefreq: "monthly", priority: "0.7" },
          { path: "/catalog", changefreq: "weekly", priority: "0.8" },
          { path: "/knowledge", changefreq: "weekly", priority: "0.8" },
          { path: "/about", changefreq: "monthly", priority: "0.7" },
          { path: "/contact", changefreq: "monthly", priority: "0.7" },
          { path: "/trust", changefreq: "monthly", priority: "0.4" },
        ];

        // Dynamic: knowledge articles
        try {
          const { data } = await supabase
            .from("articles")
            .select("slug, published, visible")
            .eq("published", true)
            .eq("visible", true);
          for (const a of (data ?? []) as Array<{ slug: string }>) {
            if (a.slug) entries.push({ path: `/knowledge/${a.slug}`, changefreq: "monthly", priority: "0.6" });
          }
        } catch {
          // ignore — still emit static entries
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ].filter(Boolean).join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
