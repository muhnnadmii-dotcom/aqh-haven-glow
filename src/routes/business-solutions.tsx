import { createFileRoute } from "@tanstack/react-router";
import { BusinessSolutions } from "../components/BusinessSolutions";
import { CmsSlot } from "@/lib/cms/PageRenderer";

export const Route = createFileRoute("/business-solutions")({
  head: () => ({
    meta: [
      { title: "حلول لأصحاب الأعمال — أكوا هيفن" },
      { name: "description", content: "حلول أكوا هيفن للكافيهات والمطاعم والفعاليات والمحلات: تصميم وتركيب وتوريد أحواض وأنظمة عرض احترافية." },
      { property: "og:title", content: "حلول لأصحاب الأعمال — أكوا هيفن" },
      { property: "og:description", content: "أحواض وأنظمة عرض للكافيهات، المطاعم، الفعاليات، والمحلات." },
      { property: "og:url", content: "/business-solutions" },
    ],
    links: [{ rel: "canonical", href: "/business-solutions" }],
  }),
  component: BusinessSolutionsPage,
});

function BusinessSolutionsPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <CmsSlot pageKey="business_solutions" />
      <BusinessSolutions />
    </div>
  );
}
