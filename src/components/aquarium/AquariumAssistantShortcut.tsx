import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Sparkles, Zap, ArrowLeft, Plus, AlertTriangle, Clock, Loader2, MoreHorizontal } from "lucide-react";
import { Modal, QuickUpdateForm } from "./AquariumAssistant";

type TankLite = {
  id: string;
  name: string;
  tank_type: string | null;
};

type Status = "excellent" | "normal" | "needs_attention" | "problem";

const STATUS_OPTIONS: { v: Status; l: string; e: string }[] = [
  { v: "excellent", l: "ممتاز", e: "🌿" },
  { v: "normal", l: "طبيعي", e: "💧" },
  { v: "needs_attention", l: "متابعة", e: "⚠️" },
  { v: "problem", l: "مشكلة", e: "🚨" },
];

export function AquariumAssistantShortcut() {
  const { user, loading } = useAuth();
  const [tanks, setTanks] = useState<TankLite[]>([]);
  const [activeTankId, setActiveTankId] = useState<string | null>(null);
  const [hasOpenIssue, setHasOpenIssue] = useState(false);
  const [nextTask, setNextTask] = useState<{ title: string; due_date: string | null } | null>(null);
  const [savingStatus, setSavingStatus] = useState<Status | null>(null);
  const [justSaved, setJustSaved] = useState<Status | null>(null);
  const [advancedTank, setAdvancedTank] = useState<TankLite | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: t } = await supabase
        .from("customer_tanks")
        .select("id,name,tank_type")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const list = (t ?? []) as TankLite[];
      setTanks(list);
      if (list.length > 0) setActiveTankId(list[0].id);
      if (list.length === 0) return;
      const ids = list.map((x) => x.id);
      const [issues, tasks] = await Promise.all([
        supabase.from("aquarium_issues").select("id").in("tank_id", ids).eq("status", "open").limit(1),
        supabase.from("aquarium_tasks").select("title,due_date").in("tank_id", ids).eq("status", "pending").order("due_date", { ascending: true }).limit(1),
      ]);
      setHasOpenIssue((issues.data ?? []).length > 0);
      setNextTask((tasks.data?.[0] as any) ?? null);
    })();
  }, [user]);

  if (loading || !user) return null;

  const active = tanks.find((t) => t.id === activeTankId) ?? tanks[0] ?? null;

  const saveStatus = async (s: Status) => {
    if (!active || savingStatus) return;
    setSavingStatus(s);
    const { error } = await supabase.from("aquarium_care_logs").insert({
      tank_id: active.id, user_id: user.id, log_type: "status_update", status: s,
    });
    setSavingStatus(null);
    if (error) {
      toast.error(error.message || "تعذر الحفظ");
      return;
    }
    setJustSaved(s);
    toast.success(`تم تسجيل: ${STATUS_OPTIONS.find((o) => o.v === s)?.l}`);
    setTimeout(() => setJustSaved(null), 2000);
  };

  return (
    <>
      <div className="mt-4 rounded-2xl border border-[color:var(--gold)]/25 bg-gradient-to-br from-[color:var(--gold)]/10 to-white/5 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-bold text-sm sm:text-base">مساعد الحوض</h3>
              {hasOpenIssue && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-400/30 inline-flex items-center gap-1">
                  <AlertTriangle size={11} /> يحتاج متابعة
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              سجّل حالة الحوض بضغطة واحدة.
            </p>
            {nextTask?.due_date && !hasOpenIssue && (
              <div className="mt-2 text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <Clock size={11} /> القادم: {nextTask.title}
              </div>
            )}

            {tanks.length === 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground">أضف حوضك الأول لتفعيل المساعد.</span>
                <Link to="/account/tanks" className="btn-gold rounded-xl px-3 py-1.5 text-xs inline-flex items-center gap-1.5">
                  <Plus size={13} /> إضافة حوض
                </Link>
              </div>
            ) : (
              <>
                {tanks.length > 1 && (
                  <div className="mt-3 flex gap-1.5 flex-wrap">
                    {tanks.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setActiveTankId(t.id); setJustSaved(null); }}
                        className={`text-[11px] rounded-lg px-2.5 py-1 border transition ${
                          activeTankId === t.id
                            ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15 text-[color:var(--gold)]"
                            : "border-white/10 hover:bg-white/5 text-muted-foreground"
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {STATUS_OPTIONS.map((o) => {
                    const isSaving = savingStatus === o.v;
                    const isSaved = justSaved === o.v;
                    return (
                      <button
                        key={o.v}
                        type="button"
                        disabled={!!savingStatus}
                        onClick={() => saveStatus(o.v)}
                        className={`rounded-xl p-2 text-[11px] sm:text-xs border transition flex flex-col items-center gap-0.5 ${
                          isSaved
                            ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                            : "border-white/10 hover:bg-white/5 hover:border-[color:var(--gold)]/40"
                        } disabled:opacity-50`}
                      >
                        <span className="text-base leading-none">
                          {isSaving ? <Loader2 size={14} className="animate-spin" /> : o.e}
                        </span>
                        <span>{o.l}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => active && setAdvancedTank(active)}
                    className="rounded-xl px-3 py-1.5 text-xs inline-flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10"
                  >
                    <MoreHorizontal size={13} /> تحديث مع ملاحظة/صورة
                  </button>
                  <Link
                    to="/account/tanks"
                    className="rounded-xl px-3 py-1.5 text-xs inline-flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10"
                  >
                    <Zap size={12} /> أحواضي <ArrowLeft size={12} />
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {advancedTank && (
        <Modal title="كيف وضع الحوض اليوم؟" onClose={() => setAdvancedTank(null)}>
          <QuickUpdateForm
            tank={{ id: advancedTank.id, name: advancedTank.name, tank_type: advancedTank.tank_type }}
            onDone={() => setAdvancedTank(null)}
          />
        </Modal>
      )}
    </>
  );
}
