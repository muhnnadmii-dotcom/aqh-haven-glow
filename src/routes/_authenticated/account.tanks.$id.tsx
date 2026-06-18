import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl } from "@/lib/storage";
import { ArrowRight, FlaskConical, Wrench } from "lucide-react";
import AquariumAssistant from "@/components/aquarium/AquariumAssistant";

export const Route = createFileRoute("/_authenticated/account/tanks/$id")({
  component: TankDetail,
});

type Tank = {
  id: string; name: string; tank_type: string | null;
  width_cm: number | null; depth_cm: number | null; height_cm: number | null;
  volume_liters: number | null; install_date: string | null; notes: string | null;
  image_paths: string[] | null; primary_image: string | null;
  livestock_items: any; plants: any;
};
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
      setTank(t as any);
      const { data: r } = await supabase.from("maintenance_reports").select("*").eq("tank_id", id).order("visit_date", { ascending: false });
      setReports((r ?? []) as Report[]);
      const { data: w } = await supabase.from("water_tests").select("*").eq("tank_id", id).order("test_date", { ascending: false });
      setTests((w ?? []) as Test[]);
    })();
  }, [id]);

  if (!tank) return <div className="text-sm text-muted-foreground">جاري التحميل...</div>;

  const images = Array.isArray(tank.image_paths) ? tank.image_paths : [];
  const cover = tank.primary_image || images[0] || null;
  const others = images.filter((p) => p !== cover);
  const dims = [tank.width_cm, tank.depth_cm, tank.height_cm].filter(Boolean).join(" × ");
  const livestock = Array.isArray(tank.livestock_items) ? tank.livestock_items : [];
  const plants = Array.isArray(tank.plants) ? tank.plants : [];

  return (
    <div className="space-y-6">
      <Link to="/account/tanks" className="text-xs text-gold flex items-center gap-1 hover:underline">
        <ArrowRight size={14} /> رجوع لقائمة الأحواض
      </Link>

      <div className="glass rounded-2xl p-5 flex flex-col sm:flex-row gap-4">
        {cover ? (
          <a href={publicUrl(cover)} target="_blank" rel="noreferrer" className="shrink-0">
            <img src={publicUrl(cover)} alt={tank.name} className="h-40 w-40 rounded-xl object-cover border border-white/10" />
          </a>
        ) : (
          <div className="h-40 w-40 rounded-xl border border-dashed border-white/15 grid place-items-center text-xs text-muted-foreground shrink-0">لا توجد صورة</div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{tank.name}</h1>
          <div className="text-sm text-muted-foreground mt-1">
            {tank.tank_type ?? ""}{dims && ` · ${dims} سم`}{tank.volume_liters ? ` · ${tank.volume_liters}L` : ""}
          </div>
          {livestock.length > 0 && (
            <div className="text-sm mt-2"><b>الكائنات:</b> {livestock.map((x: any) => `${x.species ?? ""}${x.count ? ` (${x.count})` : ""}`).filter(Boolean).join("، ")}</div>
          )}
          {plants.length > 0 && (
            <div className="text-sm mt-1"><b>النباتات:</b> {plants.map((x: any) => `${x.name ?? ""}${x.count ? ` (${x.count})` : ""}`).filter(Boolean).join("، ")}</div>
          )}
          {tank.notes && <div className="text-sm mt-1 text-muted-foreground whitespace-pre-wrap">{tank.notes}</div>}
          <div className="flex flex-wrap gap-2 mt-4">
            <Link to="/account/tanks" className="glass rounded-xl px-3 py-1.5 text-xs hover:bg-white/10">تعديل الحوض</Link>
            <Link to="/account/requests/new" search={{ type: "consultation", tank: tank.id }}
              className="btn-gold rounded-xl px-3 py-1.5 text-xs">طلب استشارة لهذا الحوض</Link>
            <Link to="/account/requests/new" search={{ type: "maintenance", tank: tank.id }}
              className="glass rounded-xl px-3 py-1.5 text-xs hover:bg-white/10">طلب صيانة لهذا الحوض</Link>
          </div>
        </div>
      </div>

      <AquariumAssistant tank={{ id: tank.id, name: tank.name, tank_type: tank.tank_type }} />

      {others.length > 0 && (
        <section className="glass rounded-2xl p-5">
          <h2 className="font-bold mb-3 text-sm">معرض الصور</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {others.map((p) => (
              <a key={p} href={publicUrl(p)} target="_blank" rel="noreferrer" className="aspect-square rounded-xl overflow-hidden border border-white/10 block">
                <img src={publicUrl(p)} alt="" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        </section>
      )}

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
