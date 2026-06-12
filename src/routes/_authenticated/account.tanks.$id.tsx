import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl } from "@/lib/storage";
import { ArrowRight, FlaskConical, Wrench } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account/tanks/$id")({
  component: TankDetail,
});

type Tank = { id: string; name: string; tank_type: string | null; dimensions: string | null; volume_liters: number | null; install_date: string | null; image_path: string | null; notes: string | null; livestock: string | null };
type Report = { id: string; visit_date: string; technician: string | null; actions: string | null; notes: string | null; overall_status: string | null };
type Test = { id: string; test_date: string; ph: number | null; ammonia: number | null; nitrite: number | null; nitrate: number | null; kh: number | null; gh: number | null; tds: number | null; temperature: number | null; salinity: number | null; notes: string | null };

function TankDetail() {
  const { id } = Route.useParams();
  const [tank, setTank] = useState<Tank | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [tests, setTests] = useState<Test[]>([]);

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from("customer_tanks").select("*").eq("id", id).maybeSingle();
      setTank(t as Tank);
      const { data: r } = await supabase.from("maintenance_reports").select("*").eq("tank_id", id).order("visit_date", { ascending: false });
      setReports((r ?? []) as Report[]);
      const { data: w } = await supabase.from("water_tests").select("*").eq("tank_id", id).order("test_date", { ascending: false });
      setTests((w ?? []) as Test[]);
    })();
  }, [id]);

  if (!tank) return <div className="text-sm text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <Link to="/account/tanks" className="text-xs text-gold flex items-center gap-1 hover:underline">
        <ArrowRight size={14} /> رجوع لقائمة الأحواض
      </Link>

      <div className="glass rounded-2xl p-5 flex gap-4">
        {tank.image_path && <img src={publicUrl(tank.image_path)} alt="" className="h-32 w-32 rounded-xl object-cover" />}
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{tank.name}</h1>
          <div className="text-sm text-muted-foreground mt-1">{tank.tank_type ?? ""} · {tank.dimensions ?? ""} · {tank.volume_liters ? `${tank.volume_liters}L` : ""}</div>
          {tank.livestock && <div className="text-sm mt-2"><b>المحتويات:</b> {tank.livestock}</div>}
          {tank.notes && <div className="text-sm mt-1 text-muted-foreground">{tank.notes}</div>}
          <div className="flex flex-wrap gap-2 mt-4">
            <Link to="/account/requests/new" search={{ type: "consultation", tank: tank.id }}
              className="btn-gold rounded-xl px-3 py-1.5 text-xs">طلب استشارة لهذا الحوض</Link>
            <Link to="/account/requests/new" search={{ type: "maintenance", tank: tank.id }}
              className="glass rounded-xl px-3 py-1.5 text-xs hover:bg-white/10">طلب صيانة لهذا الحوض</Link>
          </div>
        </div>
      </div>

      <section className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="text-gold" size={18} />
          <h2 className="font-bold">تقارير الصيانة ({reports.length})</h2>
        </div>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد تقارير بعد. سيقوم الفني بإضافتها بعد كل زيارة.</p>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="glass rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-sm">{new Date(r.visit_date).toLocaleDateString("ar-SA")}</div>
                  {r.overall_status && <span className="text-xs px-2 py-0.5 rounded-md bg-gold/10 text-gold">{r.overall_status}</span>}
                </div>
                {r.technician && <div className="text-xs text-muted-foreground mt-1">الفني: {r.technician}</div>}
                {r.actions && <div className="text-sm mt-2"><b>الإجراءات:</b> {r.actions}</div>}
                {r.notes && <div className="text-sm mt-1 text-muted-foreground">{r.notes}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical className="text-gold" size={18} />
          <h2 className="font-bold">تحاليل الماء ({tests.length})</h2>
        </div>
        {tests.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد قراءات بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="text-muted-foreground">
                <tr><th className="p-2">التاريخ</th><th>pH</th><th>NH3</th><th>NO2</th><th>NO3</th><th>KH</th><th>GH</th><th>TDS</th><th>°C</th></tr>
              </thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id} className="border-t border-white/5">
                    <td className="p-2">{new Date(t.test_date).toLocaleDateString("ar-SA")}</td>
                    <td>{t.ph ?? "—"}</td><td>{t.ammonia ?? "—"}</td><td>{t.nitrite ?? "—"}</td><td>{t.nitrate ?? "—"}</td>
                    <td>{t.kh ?? "—"}</td><td>{t.gh ?? "—"}</td><td>{t.tds ?? "—"}</td><td>{t.temperature ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
