import { createFileRoute } from "@tanstack/react-router";
import { usePageDoc } from "@/lib/cms/api";
import { PageRenderer } from "@/lib/cms/PageRenderer";
import { getPageMeta } from "@/lib/cms/registry";

export const Route = createFileRoute("/maintenance")({
  head: () => ({
    meta: [
      { title: "باقات الصيانة الدورية — أكوا هيفن" },
      { name: "description", content: "باقات صيانة شهرية للأحواض النهرية والبحرية بمختلف المقاسات في الرياض. أسعار شفافة وفريق محترف." },
      { property: "og:title", content: "باقات الصيانة الدورية — أكوا هيفن" },
      { property: "og:description", content: "خطط صيانة مرنة لكل نوع وحجم حوض." },
      { property: "og:url", content: "/maintenance" },
    ],
    links: [{ rel: "canonical", href: "/maintenance" }],
  }),
  component: MaintenancePage,
});

function MaintenancePage() {
  const { doc, loading } = usePageDoc("maintenance");
  if (loading || !doc) {
    // Render defaults instantly to avoid a blank flash; fetched doc replaces on hydrate
    const fallback = getPageMeta("maintenance")?.defaults ?? { sections: [] };
    return <PageRenderer doc={fallback} />;
  }
  return <PageRenderer doc={doc} />;
}
