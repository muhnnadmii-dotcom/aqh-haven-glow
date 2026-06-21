import { Link } from "@tanstack/react-router";
import { ShieldOff } from "lucide-react";
import { useAllowedPages } from "@/lib/use-allowed-pages";

export function PageGuard({ pageKey, children }: { pageKey: string; children: React.ReactNode }) {
  const { loading, canSee } = useAllowedPages();
  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">جارٍ التحقق من الصلاحيات…</div>
    );
  }
  if (!canSee(pageKey)) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-500/10 text-red-300 flex items-center justify-center">
          <ShieldOff size={26} />
        </div>
        <h2 className="text-lg font-semibold">لا تملك صلاحية الدخول لهذه الصفحة</h2>
        <p className="text-sm text-muted-foreground">
          إذا كنت تحتاج الوصول، تواصل مع مدير النظام لإضافة هذه الصفحة إلى دورك الوظيفي.
        </p>
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/15 border border-gold/30 text-gold text-sm"
        >
          العودة للوحة الإدارة
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
