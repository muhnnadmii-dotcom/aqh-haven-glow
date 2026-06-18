import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { getSessionUser } from "@/lib/client-auth";
import {
  REQUEST_TYPE_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_COLOR, ALL_TYPES,
  type RequestType, type RequestStatus,
} from "@/lib/service-requests";

export const Route = createFileRoute("/_authenticated/account/requests/")({
  component: RequestsPage,
});

type Req = {
  id: string; type: RequestType; status: RequestStatus; name: string;
  phone: string; city: string | null; created_at: string;
  details: Record<string, string>; customer_notes: string | null;
};

function RequestsPage() {
  const [list, setList] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const user = await getSessionUser();
      if (!user) { setLoading(false); return; }
      const { data, error } = await supabase.from("service_requests")
        .select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) setError(error.message);
      setList((data ?? []) as unknown as Req[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold">طلباتي</h1>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {ALL_TYPES.map((t) => (
          <Link key={t} to="/account/requests/new" search={{ type: t, tank: "" }}
            className="glass-gold rounded-2xl p-4 text-center hover:bg-gold/10 transition">
            <Plus size={16} className="mx-auto text-gold mb-1" />
            <div className="text-sm font-bold">{REQUEST_TYPE_LABEL[t]}</div>
          </Link>
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground">جاري التحميل...</p>}
      {error && <p className="text-sm text-red-300">حدث خطأ: {error}</p>}
      {!loading && !error && list.length === 0 && (
        <p className="text-sm text-muted-foreground">لا توجد طلبات بعد.</p>
      )}

      <ul className="space-y-3">
        {list.map((r) => (
          <li key={r.id}>
            <Link to="/account/requests/$id" params={{ id: r.id }}
              className="block glass rounded-2xl p-4 hover:bg-white/5 transition">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="font-bold text-sm">{REQUEST_TYPE_LABEL[r.type]}</div>
                <span className={`px-2 py-0.5 rounded-md text-xs ${REQUEST_STATUS_COLOR[r.status]}`}>
                  {REQUEST_STATUS_LABEL[r.status]}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-SA")}</div>
              {r.customer_notes && <p className="text-sm mt-2 text-muted-foreground line-clamp-2">{r.customer_notes}</p>}
              <div className="text-[11px] text-gold mt-2">عرض التفاصيل ←</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}