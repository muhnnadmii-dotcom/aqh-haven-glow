import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl } from "@/lib/storage";
import { useAuth } from "@/hooks/use-auth";
import { Sparkles, Zap, ArrowLeft, Plus, AlertTriangle, Clock } from "lucide-react";
import { Modal, QuickUpdateForm } from "./AquariumAssistant";

type TankLite = {
  id: string;
  name: string;
  tank_type: string | null;
  primary_image: string | null;
  image_paths: string[] | null;
};

export function AquariumAssistantShortcut() {
  const { user, loading } = useAuth();
  const [tanks, setTanks] = useState<TankLite[]>([]);
  const [hasOpenIssue, setHasOpenIssue] = useState(false);
  const [nextTask, setNextTask] = useState<{ title: string; due_date: string | null } | null>(null);
  const [picking, setPicking] = useState(false);
  const [activeTank, setActiveTank] = useState<TankLite | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: t } = await supabase
        .from("customer_tanks")
        .select("id,name,tank_type,primary_image,image_paths")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const list = (t ?? []) as TankLite[];
      setTanks(list);
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

  const onQuick = () => {
    if (tanks.length === 0) return;
    if (tanks.length === 1) setActiveTank(tanks[0]);
    else setPicking(true);
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
                  <AlertTriangle size={11} /> يوجد حوض يحتاج متابعة
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              سجّل حالة حوضك، تغيير الماء، القراءات، أو ارفع صورة خلال ثوانٍ.
            </p>
            {nextTask?.due_date && !hasOpenIssue && (
              <div className="mt-2 text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <Clock size={11} /> المهمة القادمة: {nextTask.title}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {tanks.length === 0 ? (
                <>
                  <span className="text-xs text-muted-foreground">أضف حوضك الأول لتفعيل مساعد الحوض.</span>
                  <Link to="/account/tanks" className="btn-gold rounded-xl px-3 py-1.5 text-xs inline-flex items-center gap-1.5">
                    <Plus size={13} /> إضافة حوض
                  </Link>
                </>
              ) : (
                <>
                  <button type="button" onClick={onQuick}
                    className="btn-gold rounded-xl px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5">
                    <Zap size={13} /> تحديث سريع للحوض
                  </button>
                  <Link to="/account/tanks"
                    className="rounded-xl px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10">
                    فتح أحواضي <ArrowLeft size={12} />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {picking && (
        <Modal title="اختر الحوض" onClose={() => setPicking(false)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tanks.map((t) => {
              const cover = t.primary_image || (Array.isArray(t.image_paths) ? t.image_paths[0] : null);
              return (
                <button key={t.id} type="button"
                  onClick={() => { setPicking(false); setActiveTank(t); }}
                  className="glass rounded-xl p-3 text-right hover:bg-white/5 flex items-center gap-3 border border-white/10">
                  {cover ? (
                    <img src={publicUrl(cover)} alt="" className="h-12 w-12 rounded-lg object-cover border border-white/10 shrink-0" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-white/5 border border-white/10 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    {t.tank_type && <div className="text-[11px] text-muted-foreground">{t.tank_type}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {activeTank && (
        <Modal title="كيف وضع الحوض اليوم؟" onClose={() => setActiveTank(null)}>
          <QuickUpdateForm
            tank={{ id: activeTank.id, name: activeTank.name, tank_type: activeTank.tank_type }}
            onDone={() => setActiveTank(null)}
          />
        </Modal>
      )}
    </>
  );
}
