import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { WhatsAppFloating } from "../components/WhatsAppButton";
import { ScrollProgress } from "../components/ScrollProgress";
import { Toaster } from "../components/ui/sonner";
import { supabase } from "../integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center glass rounded-3xl p-10">
        <h1 className="text-7xl font-bold text-gradient-gold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
        <div className="mt-6">
          <Link to="/" className="btn-gold inline-flex items-center rounded-xl px-5 py-2.5 text-sm">
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center glass rounded-3xl p-10">
        <h1 className="text-xl font-semibold">حدث خطأ ما</h1>
        <p className="mt-2 text-sm text-muted-foreground">يمكنك المحاولة مرة أخرى أو العودة للرئيسية.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="btn-gold inline-flex items-center rounded-xl px-5 py-2.5 text-sm"
          >
            حاول مرة أخرى
          </button>
          <a href="/" className="btn-outline-gold inline-flex items-center rounded-xl px-5 py-2.5 text-sm">
            العودة للرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "أكوا هيفن — عالمك المائي يبدأ من هنا" },
      { name: "description", content: "أكوا هيفن (AQH) — تصميم وتركيب وصيانة الأحواض المائية الفاخرة في الرياض، المملكة العربية السعودية." },
      { name: "author", content: "Aqua Haven" },
      { property: "og:site_name", content: "أكوا هيفن" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "أكوا هيفن — عالمك المائي يبدأ من هنا" },
      { property: "og:description", content: "أكوا هيفن (AQH) — تصميم وتركيب وصيانة الأحواض المائية الفاخرة في الرياض، المملكة العربية السعودية." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "أكوا هيفن — عالمك المائي يبدأ من هنا" },
      { name: "twitter:description", content: "أكوا هيفن (AQH) — تصميم وتركيب وصيانة الأحواض المائية الفاخرة في الرياض، المملكة العربية السعودية." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/0f2f523e-6f01-4f73-9519-5b38614fabc6" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/0f2f523e-6f01-4f73-9519-5b38614fabc6" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "أكوا هيفن",
          alternateName: "Aqua Haven",
          url: "/",
          description: "تصميم وتركيب وصيانة الأحواض المائية الفاخرة في الرياض، المملكة العربية السعودية.",
          areaServed: "SA",
          address: {
            "@type": "PostalAddress",
            addressLocality: "الرياض",
            addressCountry: "SA",
          },
          contactPoint: {
            "@type": "ContactPoint",
            telephone: "+966527044200",
            contactType: "customer service",
            availableLanguage: ["Arabic", "English"],
          },
          sameAs: ["https://aqh.sa", "https://instagram.com", "https://tiktok.com"],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ScrollProgress />
      <Navbar />
      <main id="main" className="pt-24">
        <Outlet />
      </main>
      <Footer />
      <WhatsAppFloating />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
