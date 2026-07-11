import { Link, Outlet, useRouterState, createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, TrendingUp, ShoppingCart, Ban, CalendarRange, FileEdit, FolderCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/finance/vat")({
  ssr: false,
  component: VatLayout,
});

const tabs = [
  { to: "/admin/finance/vat", label: "لوحة الضريبة", icon: LayoutDashboard, exact: true },
  { to: "/admin/finance/vat/sales", label: "ضريبة المبيعات", icon: TrendingUp },
  { to: "/admin/finance/vat/purchases", label: "ضريبة المشتريات", icon: ShoppingCart },
  { to: "/admin/finance/vat/excluded", label: "الفواتير المستبعدة", icon: Ban },
  { to: "/admin/finance/vat/periods", label: "الفترات الضريبية", icon: CalendarRange },
  { to: "/admin/finance/vat/draft", label: "مسودة الإقرار", icon: FileEdit },
  { to: "/admin/finance/vat/filed", label: "الإقرارات السابقة", icon: FolderCheck },
];

function VatLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] tracking-[0.3em] text-gold/80 uppercase">Aqua Haven · VAT</div>
        <h2 className="text-base font-semibold mt-1">ضريبة القيمة المضافة</h2>
        <p className="text-[11px] text-muted-foreground mt-1">
          وحدة ضريبية داخلية معتمدة على الفواتير المعتمدة فقط، لا ترتبط بزاتكا ولا ترسل الإقرار.
        </p>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div className="inline-flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 min-w-max">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] whitespace-nowrap transition ${
                  active ? "bg-gold/15 text-gold border border-gold/30" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <t.icon size={13} />
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="pt-2">
        <Outlet />
      </div>
    </div>
  );
}
