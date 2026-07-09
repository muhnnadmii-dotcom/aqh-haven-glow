import { useEffect, useState, type ReactNode } from "react";
import { Shield, ShieldCheck, Copy, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Status =
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "enroll" }
  | { kind: "challenge"; factorId: string };

/**
 * Enforces TOTP 2FA for admin users:
 * - No verified factor -> shows enrollment (QR + 6-digit verify).
 * - Verified factor but session is aal1 -> shows challenge (6-digit code).
 * - aal2 -> renders children.
 * For non-admin roles, always renders children (opt-in via /admin/security).
 */
export function AdminMfaGate({ isAdmin, children }: { isAdmin: boolean; children: ReactNode }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [enrollData, setEnrollData] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    if (!isAdmin) {
      setStatus({ kind: "ok" });
      return;
    }
    setStatus({ kind: "loading" });
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const verified = (factorsData?.totp ?? []).find((f) => f.status === "verified");

    if (!verified) {
      setStatus({ kind: "enroll" });
      return;
    }
    if (aalData?.currentLevel === "aal2") {
      setStatus({ kind: "ok" });
      return;
    }
    setStatus({ kind: "challenge", factorId: verified.id });
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [isAdmin]);

  const startEnroll = async () => {
    setBusy(true);
    try {
      // Clean any leftover unverified factors
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.totp ?? []) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `AQH Admin ${Date.now()}` });
      if (error) throw error;
      setEnrollData({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (e: any) {
      toast.error(e.message ?? "تعذّر بدء الإعداد");
    } finally { setBusy(false); }
  };

  const verifyEnroll = async () => {
    if (!enrollData || code.length !== 6) return;
    setBusy(true);
    try {
      const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId: enrollData.factorId });
      if (ce) throw ce;
      const { error } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId: ch.id,
        code,
      });
      if (error) throw error;
      toast.success("تم تفعيل التحقق الثنائي بنجاح");
      setEnrollData(null);
      setCode("");
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "رمز غير صحيح");
    } finally { setBusy(false); }
  };

  const verifyChallenge = async () => {
    if (status.kind !== "challenge" || code.length !== 6) return;
    setBusy(true);
    try {
      const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId: status.factorId });
      if (ce) throw ce;
      const { error } = await supabase.auth.mfa.verify({
        factorId: status.factorId,
        challengeId: ch.id,
        code,
      });
      if (error) throw error;
      setCode("");
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "رمز غير صحيح");
    } finally { setBusy(false); }
  };

  if (status.kind === "ok") return <>{children}</>;

  if (status.kind === "loading") {
    return <div className="py-16 text-center text-sm text-muted-foreground">جارٍ التحقق من الأمان…</div>;
  }

  return (
    <div className="max-w-xl mx-auto py-10">
      <div className="glass rounded-3xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-gold/15 border border-gold/30 text-gold flex items-center justify-center">
            {status.kind === "challenge" ? <ShieldCheck size={20} /> : <Shield size={20} />}
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {status.kind === "challenge" ? "أدخل رمز التحقق" : "تفعيل التحقق الثنائي (مطلوب)"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status.kind === "challenge"
                ? "افتح تطبيق المصادقة واكتب الرمز المكوّن من 6 أرقام."
                : "حسابك admin — يجب تفعيل 2FA قبل الوصول للوحة الإدارة."}
            </p>
          </div>
        </div>

        {status.kind === "enroll" && !enrollData && (
          <div className="space-y-4">
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal pr-5">
              <li>حمّل تطبيق مصادقة مثل Google Authenticator أو Authy أو 1Password.</li>
              <li>اضغط "ابدأ الإعداد" لعرض رمز QR.</li>
              <li>امسح الرمز بالتطبيق وأدخل الرمز الظاهر لتأكيد التفعيل.</li>
            </ol>
            <button
              onClick={startEnroll}
              disabled={busy}
              className="btn-gold inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              ابدأ الإعداد
            </button>
          </div>
        )}

        {status.kind === "enroll" && enrollData && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-4 flex items-center justify-center">
              <div
                className="w-52 h-52"
                dangerouslySetInnerHTML={{ __html: enrollData.qr }}
              />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">أو أدخل المفتاح يدوياً:</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-mono break-all">
                  {enrollData.secret}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(enrollData.secret); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
                  aria-label="نسخ"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <CodeInput value={code} onChange={setCode} />
            <div className="flex gap-2">
              <button
                onClick={verifyEnroll}
                disabled={busy || code.length !== 6}
                className="btn-gold inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                تأكيد وتفعيل
              </button>
              <button
                onClick={async () => { await supabase.auth.mfa.unenroll({ factorId: enrollData.factorId }); setEnrollData(null); setCode(""); }}
                className="btn-outline-gold rounded-xl px-4 py-2.5 text-sm"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {status.kind === "challenge" && (
          <div className="space-y-4">
            <CodeInput value={code} onChange={setCode} autoFocus />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={verifyChallenge}
                disabled={busy || code.length !== 6}
                className="btn-gold inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                تحقق ودخول
              </button>
              <button
                onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 px-2"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CodeInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={6}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      placeholder="000000"
      className="w-full text-center text-2xl tracking-[0.6em] font-mono bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-gold/60"
      dir="ltr"
    />
  );
}
