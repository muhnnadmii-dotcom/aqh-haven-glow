import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Reveal } from "../components/Reveal";
import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl } from "@/lib/storage";
import livingRoomTankAsset from "../assets/aqh-living-room-tank.png.asset.json";

const fallbackImg = livingRoomTankAsset.url;

type Article = {
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  cover_path: string | null;
  category: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

export const Route = createFileRoute("/knowledge/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("articles")
      .select("slug, title, excerpt, body, cover_path, category, seo_title, seo_description, published, visible")
      .eq("slug", params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.published || !data.visible) throw notFound();
    return data as unknown as Article;
  },
  head: ({ loaderData }) => {
    const title = loaderData?.seo_title || loaderData?.title || "مقال";
    const desc = loaderData?.seo_description || loaderData?.excerpt || "";
    return {
      meta: [
        { title: `${title} — أكوا هيفن` },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-2xl font-bold mb-3">المقال غير موجود</h1>
      <Link to="/knowledge" className="text-gold hover:underline">العودة لمركز المعرفة</Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center text-red-400">حدث خطأ: {String(error)}</div>
  ),
  pendingComponent: () => <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-gold" /></div>,
  component: ArticlePage,
});

function renderBody(body: string) {
  // Lightweight markdown: ##/### headings + paragraphs separated by blank lines.
  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block, i) => {
    if (block.startsWith("### ")) return <h3 key={i} className="text-xl font-bold mt-8 mb-3">{block.slice(4)}</h3>;
    if (block.startsWith("## ")) return <h2 key={i} className="text-2xl font-bold mt-10 mb-4">{block.slice(3)}</h2>;
    if (block.startsWith("# ")) return <h1 key={i} className="text-3xl font-bold mt-10 mb-4">{block.slice(2)}</h1>;
    return <p key={i} className="text-muted-foreground leading-relaxed mb-4 whitespace-pre-line">{block}</p>;
  });
}

function ArticlePage() {
  const a = Route.useLoaderData();
  // Suppress unused import — keep state hook unused but ensure no warning
  useEffect(() => { void 0; }, []);
  const [hydrated] = useState(true); void hydrated;
  const img = a.cover_path ? publicUrl(a.cover_path) : fallbackImg;
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <Reveal>
        <Link to="/knowledge" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold mb-6">
          <ArrowRight size={14} /> كل المقالات
        </Link>
        {a.category && <div className="text-xs tracking-widest text-gradient-gold mb-3">{a.category}</div>}
        <h1 className="text-3xl md:text-5xl font-bold mb-5 leading-tight">{a.title}</h1>
        {a.excerpt && <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{a.excerpt}</p>}
        <div className="rounded-2xl overflow-hidden mb-8">
          <img src={img} alt={a.title} className="w-full object-cover" />
        </div>
        <div className="text-base">
          {a.body ? renderBody(a.body) : <p className="text-muted-foreground">لا يوجد محتوى.</p>}
        </div>
      </Reveal>
    </article>
  );
}
