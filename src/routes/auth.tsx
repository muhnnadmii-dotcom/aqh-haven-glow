import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Reveal } from "@/components/Reveal";
import { toast } from "sonner";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";

const authSearch = z.object({
  redirect: fallback(z.string(), "/account").default("/account"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: zodValidator(authSearch),
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — أكوا هيفن" },
      { name: "description", content: "سجّل الدخول إلى حسابك في أكوا هيفن لمتابعة طلباتك والاستشارات." },
    ],
  }),
  component: AuthPage,
});

const SA_CITIES = [
  "الرياض", "جدة", "مكة", "المدينة", "الدمام", "الخبر", "الطائف", "تبوك",
  "أبها", "القصيم", "حائل", "نجران", "جازان", "الأحساء", "الجبيل", "ينبع",
  "عرعر", "سكاكا", "أخرى",
];

// Accept: 05XXXXXXXX (10 digits) or +9665XXXXXXXX
function isValidSaudiPhone(raw: string): boolean {
  const v = raw.replace(/\s|-/g, "");
  if (/^05\d{8}$/.test(v)) return true;
  if (/^\+9665\d{8}$/.test(v)) return true;
  return false;
}

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const safeRedirect = redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/account";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sallaOrderNo, setSallaOrderNo] = useState("");
  const [showOrderField, setShowOrderField] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("aqh_remember_me");
      if (saved !== null) setRememberMe(saved === "1");
    } catch {}
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: safeRedirect as any, replace: true });
    });
  }, [navigate, safeRedirect]);


  const validateSignup = (): boolean => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = "الاسم مطلوب";
    if (!email.trim()) e.email = "البريد مطلوب";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = "بريد غير صالح";
    if (!phone.trim()) e.phone = "رقم الجوال مطلوب";
    else if (!isValidSaudiPhone(phone.trim())) e.phone = "صيغة الجوال غير صحيحة (05xxxxxxxx أو +9665xxxxxxxx)";
    if (!city) e.city = "اختر المدينة";
    if (password.length < 6) e.password = "كلمة المرور 6 أحرف على الأقل";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && !validateSignup()) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone: phone.trim(),
              email: email.trim(),
              city,
              birth_date: birthDate || null,
              salla_order_no: sallaOrderNo.trim() || null,
            },
            emailRedirectTo: window.location.origin + safeRedirect,
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب! تحقق من بريدك للتأكيد ثم سجل الدخول.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        try {
          localStorage.setItem("aqh_remember_me", rememberMe ? "1" : "0");
          if (!rememberMe) {
            const signOutOnExit = () => { supabase.auth.signOut(); };
            window.addEventListener("pagehide", signOutOnExit, { once: true });
          }
        } catch {}
        toast.success("تم تسجيل الدخول");
        navigate({ to: safeRedirect as any, replace: true });
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  const fieldCls = "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-gold/60";
  const errCls = "text-xs text-red-400 mt-1";

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

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {mode === "signup" && (
              <div>
                <label className="block text-sm mb-2">الاسم الكامل</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={fieldCls} />
                {errors.fullName && <div className={errCls}>{errors.fullName}</div>}
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-sm mb-2">رقم الجوال</label>
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="05XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`${fieldCls} text-right`}
                />
                {errors.phone && <div className={errCls}>{errors.phone}</div>}
              </div>
            )}

            <div>
              <label className="block text-sm mb-2">البريد الإلكتروني</label>
              <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)}
                className={`${fieldCls} text-right`} />
              {errors.email && <div className={errCls}>{errors.email}</div>}
            </div>

            {mode === "signup" && (
              <div>
                <label className="block text-sm mb-2">المدينة</label>
                <div className="relative">
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={`${fieldCls} appearance-none pe-10 bg-[#0b1424]`}
                  >
                    <option value="">اختر المدينة...</option>
                    {SA_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute inset-y-0 start-3 my-auto text-muted-foreground pointer-events-none" />
                </div>
                {errors.city && <div className={errCls}>{errors.city}</div>}
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-sm mb-2">تاريخ الميلاد <span className="text-muted-foreground text-xs">(اختياري)</span></label>
                <input
                  type="date"
                  dir="ltr"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className={`${fieldCls} text-right`}
                />
                <div className="text-[11px] text-muted-foreground mt-1">اختياري — نستخدمه لعروض وتجربة أفضل</div>
              </div>
            )}

            <div>
              <label className="block text-sm mb-2">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${fieldCls} ps-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="absolute inset-y-0 start-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <div className={errCls}>{errors.password}</div>}
            </div>

            {mode === "signup" && (
              <div className="rounded-xl border border-[color:var(--gold)]/25 bg-[color:var(--gold)]/5 p-3">
                <button
                  type="button"
                  onClick={() => setShowOrderField((v) => !v)}
                  className="w-full text-right text-sm font-medium text-[color:var(--gold)] flex items-center justify-between gap-2"
                >
                  <span>شريت حوض جاهز من Aqua Haven؟ أضف رقم طلبك واحصل على استشارتين مجانية</span>
                  <ChevronDown size={16} className={`transition ${showOrderField ? "rotate-180" : ""}`} />
                </button>
                {showOrderField && (
                  <div className="mt-3">
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="رقم الطلب من سلة"
                      value={sallaOrderNo}
                      onChange={(e) => setSallaOrderNo(e.target.value)}
                      className={`${fieldCls} text-right`}
                    />
                    <div className="text-[11px] text-muted-foreground mt-1">سيتم التحقق منه يدويًا وتفعيل استشاراتك المجانية.</div>
                  </div>
                )}
              </div>
            )}

            {mode === "signin" && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/5 accent-[hsl(var(--gold,45_70%_55%))]"
                />
                <span>تذكرني وابقني مسجلاً</span>
              </label>
            )}

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
