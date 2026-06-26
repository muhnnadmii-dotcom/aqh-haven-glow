import { createFileRoute, Link } from "@tanstack/react-router";
import { Reveal } from "../components/Reveal";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl } from "@/lib/storage";
import { CmsSlot } from "@/lib/cms/PageRenderer";
import styledAquariumAsset from "../assets/aqh-styled-aquarium.png.asset.json";

const fallbackImg = styledAquariumAsset.url;

type ArticleRow = {
  slug: string;
  title: string;
  excerpt: string | null;
  cover_path: string | null;
  category: string | null;
  tags: string[];
  published_at: string | null;
};

export const Route = createFileRoute("/knowledge/")({
  head: () => ({
    meta: [
      { title: "مركز المعرفة — أكوا هيفن" },
      { name: "description", content: "أدلة احترافية للعناية بالأسماك والنباتات وكيمياء المياه من خبراء أكوا هيفن." },
      { property: "og:title", content: "مركز المعرفة — أكوا هيفن" },
      { property: "og:description", content: "أدلة العناية بعالمك المائي." },
      { property: "og:url", content: "/knowledge" },
    ],
    links: [{ rel: "canonical", href: "/knowledge" }],
  }),
  loader: async () => {
    const { data } = await supabase.from("articles")
      .select("slug, title, excerpt, cover_path, category, tags, published_at")
      .eq("published", true).eq("visible", true)
      .order("published_at", { ascending: false });
    return { list: ((data ?? []) as unknown as ArticleRow[]) };
  },
  component: KnowledgePage,
});

function KnowledgePage() {
  const data = Route.useLoaderData();
  const list = data.list as ArticleRow[];
  const loading = false;
  const error: string | null = null;

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <CmsSlot pageKey="knowledge_meta" />


      {loading && <div className="flex items-center justify-center py-12" />}
      {error && <div className="text-center text-red-400 py-8">حدث خطأ: {error}</div>}
      {!loading && !error && list.length === 0 && (
        <div className="text-center text-muted-foreground py-12">لا توجد مقالات حالياً.</div>
      )}

      {!loading && !error && list.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {list.map((a, i) => {
            const img = a.cover_path ? publicUrl(a.cover_path) : fallbackImg;
            return (
              <Reveal key={a.slug} delay={i * 60}>
                <Link to="/knowledge/$slug" params={{ slug: a.slug }} className="block h-full">
                  <article className="glass rounded-2xl overflow-hidden group h-full flex flex-col hover:glass-gold transition-all">
                    <div className="overflow-hidden">
                      <img src={img} alt={a.title} width={1024} height={768} loading="lazy"
                        className="h-56 w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      {a.category && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                          <span className="text-gradient-gold">{a.category}</span>
                        </div>
                      )}
                      <h2 className="text-lg font-bold mb-2">{a.title}</h2>
                      {a.excerpt && <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">{a.excerpt}</p>}
                      <span className="inline-flex items-center gap-2 text-sm text-gradient-gold">
                        اقرأ المقال <ArrowLeft size={14} aria-hidden />
                      </span>
                    </div>
                  </article>
                </Link>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
