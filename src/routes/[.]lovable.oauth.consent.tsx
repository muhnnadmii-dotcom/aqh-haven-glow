import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Beta namespace shim so TypeScript recognises supabase.auth.oauth.*
type OAuthResult = {
  data?: {
    client?: { name?: string; client_id?: string; redirect_uris?: string[] } | null;
    redirect_url?: string;
    redirect_to?: string;
    scope?: string;
    scopes?: string[];
  } | null;
  error?: { message?: string } | null;
};

function oauthApi() {
  const auth = supabase.auth as unknown as {
    oauth: {
      getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
      approveAuthorization: (id: string) => Promise<OAuthResult>;
      denyAuthorization: (id: string) => Promise<OAuthResult>;
    };
  };
  return auth.oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { redirect: next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message ?? "Authorization lookup failed");
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) {
      window.location.href = immediate;
      throw redirect({ to: "/" });
    }
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main dir="rtl" className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-xl font-bold mb-3">تعذّر تحميل طلب الوصول</h1>
      <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "تطبيق خارجي";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message ?? "حدث خطأ غير متوقع");
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("لم يتم إرجاع رابط إعادة توجيه من الخادم.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main dir="rtl" className="mx-auto max-w-md px-6 py-16">
      <div className="glass rounded-3xl p-8 space-y-5">
        <div className="text-center">
          <div className="text-xs tracking-widest text-gradient-gold mb-3">CONNECT</div>
          <h1 className="text-2xl font-bold mb-2">ربط {clientName} بحسابك</h1>
          <p className="text-sm text-muted-foreground">
            سيتمكن {clientName} من استخدام أدوات أكوا هيفن نيابةً عنك أثناء تسجيل دخولك.
          </p>
        </div>

        <ul className="text-sm text-muted-foreground space-y-2 list-disc pr-5">
          <li>قراءة بياناتك الخاصة فقط (طلباتك واستشاراتك) وفق سياسات الحماية.</li>
          <li>لن يتم تجاوز صلاحيات النظام أو الوصول إلى بيانات مستخدمين آخرين.</li>
          <li>يمكنك إلغاء الربط في أي وقت من إعدادات حسابك في Lovable.</li>
        </ul>

        {error && (
          <div role="alert" className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-xl p-3">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="btn-gold flex-1 rounded-xl px-6 py-3 text-sm"
          >
            {busy ? "..." : "موافقة"}
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition px-6 py-3 text-sm"
          >
            رفض
          </button>
        </div>
      </div>
    </main>
  );
}
