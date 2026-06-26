import { createFileRoute, Link } from "@tanstack/react-router";
import { Reveal } from "../components/Reveal";
import { CmsSlot } from "@/lib/cms/PageRenderer";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "الخصوصية والثقة — أكوا هيفن" },
      { name: "description", content: "صفحة يحرّرها فريق أكوا هيفن لتوضيح ممارسات الخصوصية والأمان وكيفية التعامل مع بيانات العملاء." },
      { property: "og:title", content: "الخصوصية والثقة — أكوا هيفن" },
      { property: "og:description", content: "ممارسات الخصوصية والأمان في أكوا هيفن." },
      { property: "og:url", content: "/trust" },
    ],
    links: [{ rel: "canonical", href: "/trust" }],
  }),
  component: TrustPage,
});

function TrustPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <CmsSlot pageKey="trust" />
      <Reveal>
        <p className="text-xs text-muted-foreground/70 text-center pt-4">
          هذه الصفحة محتوى يديره فريق أكوا هيفن. تخضع للتحديث عند تغيّر ممارساتنا أو خدماتنا. للتواصل:{" "}
          <Link to="/contact" className="text-primary underline">صفحة تواصل معنا</Link>.
        </p>
      </Reveal>
    </main>
  );
}
