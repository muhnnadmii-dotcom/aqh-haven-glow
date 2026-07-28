import { createFileRoute } from "@tanstack/react-router";
import { PageRenderer } from "@/lib/cms/PageRenderer";
import { usePageDoc } from "@/lib/cms/api";
import { getPageMeta } from "@/lib/cms/registry";
import { Bubbles } from "@/components/Bubbles";
import bannerTankAsset from "@/assets/aqh-banner-tank.png.asset.json";

export const Route = createFileRoute("/business-solutions")({
  head: () => ({
    meta: [
      { title: "حلول الشركات B2B — أكوا هيفن" },
      { name: "description", content: "شريك أكوا هيفن للشركات والجهات الحكومية والفنادق والمطاعم والمولات والمستشفيات: تصميم وتنفيذ وصيانة أنظمة الأحواض المائية بعقود SLA احترافية في جميع أنحاء المملكة." },
      { property: "og:title", content: "حلول الشركات B2B — أكوا هيفن" },
      { property: "og:description", content: "أنظمة أحواض مؤسسية، صيانة بعقود SLA، وإدارة مشاريع تسليم مفتاح للجهات الحكومية والقطاع الخاص." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: bannerTankAsset.url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: bannerTankAsset.url },
    ],
    links: [{ rel: "canonical", href: "/business-solutions" }],
  }),
  component: BusinessSolutionsPage,
});

function BusinessSolutionsPage() {
  const meta = getPageMeta("business_solutions");
  const { doc } = usePageDoc("business_solutions");
  const active = doc ?? meta?.defaults ?? { sections: [] };
  return (
    <main className="relative">
      <Bubbles />
      <PageRenderer doc={active} />
    </main>
  );
}
