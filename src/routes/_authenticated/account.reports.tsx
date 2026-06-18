import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUser } from "@/lib/client-auth";
import { FileText, ChevronLeft } from "lucide-react";
import { REPORT_TYPE_LABEL } from "@/lib/request-attachments";
import { REQUEST_TYPE_LABEL, type RequestType } from "@/lib/service-requests";

export const Route = createFileRoute("/_authenticated/account/reports")({
  component: ReportsPage,
});

type Row = {
  id: string;
  title: string;
  report_type: string;
  body: string | null;
  created_at: string;
  request_id: string;
  service_requests: { id: string; type: RequestType; user_id: string | null } | null;
};

function ReportsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const user = await getSessionUser();
      if (!user) { setLoading(false); return; }
      const { data, error } = await supabase
        .from("request_reports")
        .select("id,title,report_type,body,created_at,request_id,service_requests!inner(id,type,user_id)")
        .eq("is_visible_to_customer", true)
        .eq("service_requests.user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) setError(error.message);
      setRows((data ?? []) as unknown as Row[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">تقاريري</h1>
        <p className="text-sm text-muted-foreground mt-1">جميع التقارير التي شاركها معك فريق Aqua Haven.</p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">جاري التحميل...</p>}
      {error && <p className="text-sm text-red-300">حدث خطأ: {error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="glass rounded-2xl p-6 text-center">
          <FileText className="mx-auto text-gold/70 mb-2" size={28} />
          <p className="text-sm font-bold">لا توجد تقارير منشورة بعد</p>
          <p className="text-xs text-muted-foreground mt-1">ستظهر هنا تقارير المعاينة والصيانة وأي توصيات نرسلها لك.</p>
        </div>
      )}

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              to="/account/requests/$id"
              params={{ id: r.request_id }}
              className="block glass rounded-2xl p-4 hover:bg-white/5 transition"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="text-sm font-bold flex-1 min-w-0">{r.title}</div>
                <span className="shrink-0 text-[10px] px-2 py-0.5 rounded bg-gold/15 text-gold">
                  {REPORT_TYPE_LABEL[r.report_type] || r.report_type}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString("ar-SA")}
                {r.service_requests && <> · {REQUEST_TYPE_LABEL[r.service_requests.type]}</>}
              </div>
              {r.body && (
                <p className="text-sm mt-2 line-clamp-2 text-muted-foreground whitespace-pre-wrap" dir="auto">{r.body}</p>
              )}
              <div className="text-[11px] text-gold mt-2 inline-flex items-center gap-1">
                فتح الطلب <ChevronLeft size={11} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
