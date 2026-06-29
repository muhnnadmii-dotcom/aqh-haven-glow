import { createFileRoute, Link } from "@tanstack/react-router";
import { FileEdit, ExternalLink, Palette, Image as ImageIcon, Wrench, BookOpen, MessageSquareQuote, Fish, Tags, Layers, ScrollText } from "lucide-react";
import { CMS_PAGES } from "@/lib/cms/registry";

export const Route = createFileRoute("/_authenticated/admin/content/")({
  component: ContentIndex,
});

type DedicatedItem = {
  to: string;
  label: string;
  hint: string;
  icon: any;
  params?: Record<string, string>;
};

const HOME_EDITORS: DedicatedItem[] = [
  { to: "/admin/design",         label: "الصفحة الرئيسية", hint: "محرر مخصص للأقسام، البطل، والإحصائيات.", icon: Palette },
  { to: "/admin/design/about",   label: "من نحن",          hint: "محرر مخصص لقصتنا، رؤيتنا، وقيمنا.",     icon: ScrollText },
  { to: "/admin/design/contact", label: "تواصل معنا",      hint: "محرر معلومات الاتصال والشبكات الاجتماعية.", icon: ScrollText },
  { to: "/admin/site/navigation", label: "روابط القائمة والفوتر", hint: "إدارة روابط الهيدر وقسم «روابط سريعة» بالفوتر — إضافة/ترتيب/إخفاء.", icon: FileEdit },
];

const DYNAMIC_CONTENT: DedicatedItem[] = [
  { to: "/admin/services",            label: "الخدمات",         hint: "أضف/عدّل/أخفِ خدمات تظهر في /services.", icon: Wrench },
  { to: "/admin/projects",            label: "المشاريع/الأحواض",hint: "إدارة مشاريع تظهر في /portfolio.",     icon: Fish },
  { to: "/admin/gallery",             label: "لقطات من أعمالنا",hint: "صور سريعة في تبويب «اللقطات».",         icon: ImageIcon },
  { to: "/admin/project-categories",  label: "تصنيفات الأحواض", hint: "تصنيفات تظهر فوق شبكة المشاريع.",       icon: Tags },
  { to: "/admin/articles",            label: "المقالات",        hint: "إدارة مقالات /knowledge.",              icon: BookOpen },
  { to: "/admin/testimonials",        label: "التقييمات",       hint: "إدارة آراء العملاء.",                   icon: MessageSquareQuote },
];

function ContentIndex() {
  const fullPages = CMS_PAGES.filter((p) => p.group === "full");
  const hybridPages = CMS_PAGES.filter((p) => p.group === "hybrid");

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold mb-1">محتوى الموقع</h1>
        <p className="text-sm text-muted-foreground">مركز موحّد لإدارة محتوى صفحات الموقع: نصوص، صور، إظهار/إخفاء، ومحررات مخصصة.</p>
      </div>

      <Group
        title="الصفحات الرئيسية"
        subtitle="محررات مخصصة بواجهات مفصّلة"
        icon={Palette}
      >
        {HOME_EDITORS.map((item) => (
          <DedicatedCard key={item.to} item={item} />
        ))}
      </Group>

      <Group
        title="صفحات قابلة للتحرير الكامل (CMS)"
        subtitle="الصفحة بالكامل مبنية من أقسام تظهر/تختفي وتعدّلها هنا"
        icon={Layers}
      >
        {fullPages.map((p) => <CmsCard key={p.key} page={p} />)}
      </Group>

      <Group
        title="صفحات هجينة (هيدر/CTA قابل للتعديل)"
        subtitle="الهيدر العلوي من هنا، باقي الصفحة بيانات حية أو محرر آخر"
        icon={FileEdit}
      >
        {hybridPages.map((p) => <CmsCard key={p.key} page={p} />)}
      </Group>

      <Group
        title="المحتوى الديناميكي (سجلّات منفصلة)"
        subtitle="قوائم تُدار من صفحاتها الخاصة"
        icon={Wrench}
      >
        {DYNAMIC_CONTENT.map((item) => (
          <DedicatedCard key={item.to} item={item} />
        ))}
      </Group>
    </div>
  );
}

function Group({ title, subtitle, icon: Icon, children }: { title: string; subtitle?: string; icon: any; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="grid h-9 w-9 place-items-center rounded-xl glass-gold">
          <Icon size={16} className="text-gold" />
        </div>
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

function DedicatedCard({ item }: { item: DedicatedItem }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to as any}
      className="glass rounded-2xl p-4 flex flex-col hover:glass-gold transition group"
    >
      <div className="flex items-start gap-3 mb-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gold/10 text-gold shrink-0">
          <Icon size={14} />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-sm">{item.label}</div>
          <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{item.hint}</div>
        </div>
      </div>
      <div className="mt-auto text-[11px] text-gradient-gold inline-flex items-center gap-1 pt-2">
        افتح المحرر <FileEdit size={11} />
      </div>
    </Link>
  );
}

function CmsCard({ page }: { page: (typeof CMS_PAGES)[number] }) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-bold text-sm">{page.label}</div>
        <code className="text-[10px] text-muted-foreground bg-white/5 rounded px-1.5 py-0.5">{page.route}</code>
      </div>
      {page.hint && <div className="text-[11px] text-muted-foreground line-clamp-2 mb-3">{page.hint}</div>}
      <div className="mt-auto flex items-center gap-2 pt-2">
        <Link to="/admin/content/$page" params={{ page: page.key }}
          className="btn-gold rounded-xl px-3 py-2 text-xs inline-flex items-center gap-1 flex-1 justify-center">
          <FileEdit size={12} /> تعديل الأقسام
        </Link>
        <a href={page.route} target="_blank" rel="noopener noreferrer"
          className="btn-outline-gold rounded-xl px-3 py-2 text-xs inline-flex items-center gap-1"
          title="معاينة الصفحة">
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}
