import { createFileRoute, Link } from "@tanstack/react-router";
import { FileEdit, ExternalLink } from "lucide-react";
import { CMS_PAGES } from "@/lib/cms/registry";

export const Route = createFileRoute("/_authenticated/admin/content/")({
  component: ContentIndex,
});

function ContentIndex() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">محتوى الصفحات</h1>
        <p className="text-sm text-muted-foreground">عدّل نصوص الصفحات العامة وصورها وأخفِ أو أظهر الأقسام.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CMS_PAGES.map((p) => (
          <div key={p.key} className="glass rounded-2xl p-5 flex flex-col">
            <div className="text-xs text-gradient-gold mb-2">{p.route}</div>
            <h3 className="font-bold mb-2">{p.label}</h3>
            <div className="text-xs text-muted-foreground mb-4">page_key: <code>{p.key}</code></div>
            <div className="mt-auto flex items-center gap-2">
              <Link to="/admin/content/$page" params={{ page: p.key }}
                className="btn-gold rounded-xl px-3 py-2 text-xs inline-flex items-center gap-1 flex-1 justify-center">
                <FileEdit size={14} /> تعديل
              </Link>
              <a href={p.route} target="_blank" rel="noopener noreferrer"
                className="btn-outline-gold rounded-xl px-3 py-2 text-xs inline-flex items-center gap-1">
                <ExternalLink size={14} /> معاينة
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
