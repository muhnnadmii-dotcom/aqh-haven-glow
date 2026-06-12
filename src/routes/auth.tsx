import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Reveal } from "@/components/Reveal";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — أكوا هيفن" },
      { name: "description", content: "سجّل الدخول إلى حسابك في أكوا هيفن لمتابعة طلباتك والاستشارات." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/account" });
    });
  }, [navigate]);

  const onGoogle = async () => {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/account" });
    if (res.error) {
      toast.error("تعذر تسجيل الدخول عبر Google");
      setBusy(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin + "/account" },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب! تحقق من بريدك للتأكيد ثم سجل الدخول.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("تم تسجيل الدخول");
        navigate({ to: "/account" });
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <Reveal>
        <div className="text-center mb-8">
          <div className="text-xs tracking-widest text-gradient-gold mb-3">ACCOUNT</div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب"}</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signin" ? "ادخل بياناتك للوصول إلى حسابك" : "أنشئ حساباً لمتابعة طلباتك واستشاراتك"}
          </p>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <div className="glass rounded-3xl p-8 space-y-5">
          <button
            type="button"
            onClick={onGoogle}
            disabled={busy}
            className="w-full rounded-xl bg-white text-black font-medium py-3 hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.9c-.3 1.4-1 2.5-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.7 3.2-7.8z"/><path fill="#34A853" d="M12 23c2.9 0 5.4-1 7.2-2.6l-3.6-2.7c-1 .7-2.2 1.1-3.6 1.1-2.8 0-5.1-1.9-6-4.4H2.3v2.8C4.1 20.6 7.8 23 12 23z"/><path fill="#FBBC05" d="M6 14.4c-.2-.7-.4-1.4-.4-2.4s.1-1.6.4-2.4V6.8H2.3C1.5 8.4 1 10.1 1 12s.5 3.6 1.3 5.2L6 14.4z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1C17.4 2.1 14.9 1 12 1 7.8 1 4.1 3.4 2.3 6.8L6 9.6c.9-2.5 3.2-4.2 6-4.2z"/></svg>
            متابعة عبر Google
          </button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex-1 h-px bg-white/10" />
            <span>أو بالبريد</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-sm mb-2">الاسم الكامل</label>
                <input required value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60" />
              </div>
            )}
            <div>
              <label className="block text-sm mb-2">البريد الإلكتروني</label>
              <input required type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60 text-right" />
            </div>
            <div>
              <label className="block text-sm mb-2">كلمة المرور</label>
              <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60" />
            </div>
            <button disabled={busy} className="btn-gold w-full rounded-xl px-6 py-3 text-sm">
              {busy ? "..." : mode === "signin" ? "دخول" : "إنشاء حساب"}
            </button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <button type="button" onClick={() => setMode("signup")} className="text-gold hover:underline">ما عندك حساب؟ سجل الآن</button>
            ) : (
              <button type="button" onClick={() => setMode("signin")} className="text-gold hover:underline">عندك حساب؟ سجل دخول</button>
            )}
          </div>
        </div>
      </Reveal>

      <div className="text-center mt-6">
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← العودة للرئيسية</Link>
      </div>
    </div>
  );
}
