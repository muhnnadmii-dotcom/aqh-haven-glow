import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import { Bell, CheckCheck, MessageSquare, FileText, Calendar, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account/notifications")({
  component: NotificationsPage,
});

type Notif = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  related_url: string | null;
  is_read: boolean;
  created_at: string;
};

const ICONS: Record<string, any> = {
  comment: MessageSquare,
  report: FileText,
  status: RefreshCw,
  appointment: Calendar,
  general: Bell,
};

function NotificationsPage() {
  const [rows, setRows] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const user = await getSessionUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("notifications" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data ?? []) as unknown as Notif[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    const user = await getSessionUser();
    if (!user) return;
    await supabase.from("notifications" as any).update({ is_read: true })
      .eq("user_id", user.id).eq("is_read", false);
    load();
  };

  const openOne = async (n: Notif) => {
    if (!n.is_read) {
      await supabase.from("notifications" as any).update({ is_read: true }).eq("id", n.id);
    }
    if (n.related_url) navigate({ to: n.related_url });
  };

  const unread = rows.filter((r) => !r.is_read).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">الإشعارات</h1>
          <p className="text-sm text-muted-foreground mt-1">آخر التحديثات المتعلقة بطلباتك ومواعيدك.</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead}
            className="text-xs px-3 py-1.5 rounded-lg bg-gold/15 text-gold hover:bg-gold/25 inline-flex items-center gap-1">
            <CheckCheck size={13} /> تعليم الكل كمقروء
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">جاري التحميل...</p>}
      {!loading && rows.length === 0 && (
        <div className="glass rounded-2xl p-6 text-center">
          <Bell className="mx-auto text-gold/70 mb-2" size={28} />
          <p className="text-sm font-bold">لا توجد إشعارات</p>
          <p className="text-xs text-muted-foreground mt-1">ستصلك تنبيهات عند أي تحديث جديد على طلباتك.</p>
        </div>
      )}

      <ul className="space-y-2">
        {rows.map((n) => {
          const Icon = ICONS[n.type] ?? Bell;
          return (
            <li key={n.id}>
              <button
                onClick={() => openOne(n)}
                className={`w-full text-right glass rounded-xl p-3 flex items-start gap-3 hover:bg-white/5 transition ${
                  !n.is_read ? "border border-gold/30" : ""
                }`}
              >
                <div className={`h-9 w-9 shrink-0 rounded-lg grid place-items-center ${
                  !n.is_read ? "bg-gold/20 text-gold" : "bg-white/5 text-muted-foreground"
                }`}>
                  <Icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    {n.title}
                    {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-gold inline-block" />}
                  </div>
                  {n.body && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5" dir="auto">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("ar-SA")}</div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
