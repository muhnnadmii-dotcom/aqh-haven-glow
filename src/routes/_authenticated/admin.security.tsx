import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminMfaGate } from "@/components/admin/AdminMfaGate";

export const Route = createFileRoute("/_authenticated/admin/security")({
  component: SecurityPage,
});

type Factor = { id: string; friendly_name?: string | null; status: string; created_at: string };

function SecurityPage() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [aal, setAal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: list } = await supabase.auth.mfa.listFactors();
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setFactors((list?.totp ?? []) as Factor[]);
    setAal(aalData?.currentLevel ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const unenroll = async (id: string) => {
    if (!confirm("هل أنت متأكد من إزالة هذا الجهاز؟ سيتم طلب إعادة الإعداد في الدخول التالي.")) return;
    setBusy(id);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
      toast.success("تم حذف الجهاز");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "تعذّر الحذف");
    } finally { setBusy(null); }
  };

  const verified = factors.filter((f) => f.status === "verified");

  return (
    <AdminMfaGate isAdmin={false}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold mb-1">الأمان والتحقق الثنائي</h1>
          <p className="text-sm text-muted-foreground">إدارة أجهزة التحقق الثنائي (TOTP) لحسابك.</p>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            {verified.length > 0 ? (
              <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
                <ShieldCheck size={18} />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-red-500/15 text-red-300 flex items-center justify-center">
                <ShieldOff size={18} />
              </div>
            )}
            <div className="flex-1">
              <div className="font-semibold">
                {verified.length > 0 ? "التحقق الثنائي مفعّل" : "التحقق الثنائي غير مفعّل"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                مستوى الجلسة الحالي: <span className="font-mono">{aal ?? "—"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold mb-3">الأجهزة المسجلة</h2>
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <Loader2 size={16} className="inline animate-spin ml-2" /> جارٍ التحميل…
            </div>
          ) : verified.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">لا توجد أجهزة مسجلة بعد.</div>
          ) : (
            <ul className="space-y-2">
              {verified.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
                  <ShieldCheck size={16} className="text-emerald-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{f.friendly_name || "جهاز TOTP"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      أُضيف في {new Date(f.created_at).toLocaleDateString("en-US")}
                    </div>
                  </div>
                  <button
                    onClick={() => unenroll(f.id)}
                    disabled={busy === f.id}
                    className="p-2 rounded-lg text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    aria-label="حذف"
                  >
                    {busy === f.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="text-xs text-muted-foreground bg-white/5 border border-white/10 rounded-xl p-4">
          <strong className="text-foreground">ملاحظة:</strong> إذا فقدت وصولك لتطبيق المصادقة، لن تستطيع الدخول إلى لوحة الإدارة.
          احتفظ بنسخة احتياطية من مفتاح TOTP في مكان آمن (مثل مدير كلمات المرور).
        </div>
      </div>
    </AdminMfaGate>
  );
}
