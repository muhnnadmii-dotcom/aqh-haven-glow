// Catalog of admin pages, used by the custom-roles permission UI.
// page_key = route path (matches sidebar `to`).

export type AdminPageDef = {
  key: string;       // route path, e.g. "/admin/finance/incomes"
  label: string;
  group: string;
  financeOnly?: boolean;
};

export type AdminGroupDef = { key: string; label: string };

export const ADMIN_GROUPS: AdminGroupDef[] = [
  { key: "ops",       label: "التشغيل" },
  { key: "content",   label: "محتوى الموقع" },
  { key: "finance",   label: "المالية" },
  { key: "inventory", label: "المخزون" },
  { key: "admin",     label: "الإدارة" },
];

export const ADMIN_PAGES: AdminPageDef[] = [
  // Ops
  { key: "/admin",               label: "نظرة عامة",       group: "ops" },
  { key: "/admin/requests",      label: "الطلبات",          group: "ops" },
  { key: "/admin/appointments",  label: "المواعيد",         group: "ops" },
  { key: "/admin/tanks",         label: "أحواض العملاء",    group: "ops" },
  { key: "/admin/users",         label: "العملاء",          group: "ops" },

  // Content
  { key: "/admin/design",              label: "الصفحة الرئيسية",   group: "content" },
  { key: "/admin/projects",            label: "أعمالنا / الأحواض", group: "content" },
  { key: "/admin/gallery",             label: "لقطات من أعمالنا",  group: "content" },
  { key: "/admin/project-categories",  label: "تصنيفات الأحواض",   group: "content" },
  { key: "/admin/services",            label: "خدماتنا",           group: "content" },
  { key: "/admin/articles",            label: "المقالات",          group: "content" },
  { key: "/admin/testimonials",        label: "التقييمات",          group: "content" },
  { key: "/admin/design/about",        label: "من نحن",             group: "content" },
  { key: "/admin/design/contact",      label: "تواصل معنا",         group: "content" },

  // Finance
  { key: "/admin/finance",                 label: "لوحة المالية",     group: "finance", financeOnly: true },
  { key: "/admin/finance/incomes",         label: "الدخل",            group: "finance", financeOnly: true },
  { key: "/admin/finance/expenses",        label: "المصروفات",        group: "finance", financeOnly: true },
  { key: "/admin/finance/suppliers",       label: "الموردين",         group: "finance", financeOnly: true },
  { key: "/admin/finance/categories",      label: "التصنيفات",         group: "finance", financeOnly: true },
  { key: "/admin/finance/attachments",     label: "المرفقات",          group: "finance", financeOnly: true },
  { key: "/admin/finance/export",          label: "التصدير",           group: "finance", financeOnly: true },
  { key: "/admin/finance/import",          label: "استيراد Excel",     group: "finance", financeOnly: true },
  { key: "/admin/finance/import-batches",  label: "دفعات الاستيراد",   group: "finance", financeOnly: true },
  { key: "/admin/finance/audit",           label: "سجل التعديلات",     group: "finance", financeOnly: true },
  { key: "/admin/finance/settings",        label: "الإعدادات المالية", group: "finance", financeOnly: true },

  // Inventory
  { key: "/admin/inventory", label: "المخزون وإعادة التوريد", group: "inventory" },

  // Admin
  { key: "/admin/staff", label: "الموظفين", group: "admin" },
  { key: "/admin/roles", label: "إدارة الصلاحيات", group: "admin" },
];

export const ADMIN_PAGE_LABELS: Record<string, string> =
  Object.fromEntries(ADMIN_PAGES.map((p) => [p.key, p.label]));
