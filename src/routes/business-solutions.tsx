import { createFileRoute } from "@tanstack/react-router";
import { BusinessSolutions } from "../components/BusinessSolutions";

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
      <div className="text-center mb-6">
        <div className="text-xs tracking-widest text-gradient-gold mb-3">BUSINESS SOLUTIONS</div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">حلول لأصحاب الأعمال</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          صفحة مخصصة لأصحاب الكافيهات والمطاعم والفعاليات والمحلات — سنضيف هنا قريبًا تفاصيل أوسع ودراسات حالة.
        </p>
      </div>
      <BusinessSolutions />
    </div>
  );
}
