import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Reveal } from "../components/Reveal";
import { ProjectGallery } from "../components/ProjectGallery";
import { SpecCard } from "../components/SpecCard";
import { TankDimensions } from "../components/TankDimensions";
import { EquipmentCard } from "../components/EquipmentCard";
import { whatsappLink } from "../components/WhatsAppButton";
import {
  X,
  Box,
  Waves,
  Filter,
  Sun,
  Thermometer,
  Wind,
  Fish,
  Leaf,
  MapPin,
  Calendar,
  Sparkles,
  MessageCircle,
  Droplet,
  Cpu,
  Activity,
  Bell,
  ShieldCheck,
  Gauge,
  Layers,
  Zap,
  Wrench,
  CalendarCheck,
  Heart,
  Headphones,
} from "lucide-react";
import { formatPriceFrom, formatPriceRange, type Project } from "../data/projects";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl } from "@/lib/storage";
import { Briefcase, ArrowLeft as ArrowLeftIcon, Images, Grid3x3 } from "lucide-react";
import { GalleryTab } from "../components/portfolio/GalleryTab";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "أعمالنا — أكوا هيفن" },
      {
        name: "description",
        content:
          "مجموعة مختارة من مشاريع أكوا هيفن: أحواض منزلية ومشاريع تجارية وأحواض نباتية بمواصفات ومعدات وأسعار تفصيلية.",
      },
      { property: "og:title", content: "أعمالنا — أكوا هيفن" },
      {
        property: "og:description",
        content: "مشاريع مختارة من أحواض منزلية وتجارية ونباتية.",
      },
      { property: "og:url", content: "/portfolio" },
    ],
    links: [{ rel: "canonical", href: "/portfolio" }],
  }),
  loader: async () => {
    const [{ data: projects }, { data: cats }] = await Promise.all([
      supabase.from("projects").select("*").eq("published", true)
        .order("sort_order").order("created_at", { ascending: false }),
      (supabase as any).from("project_categories").select("slug,label,sort_order,published")
        .eq("published", true).order("sort_order").order("label"),
    ]);
    return {
      projects: ((projects ?? []) as any[]).map(adapt),
      categories: ((cats ?? []) as { slug: string; label: string }[]),
    };
  },
  component: PortfolioPage,
});


type Cat = string;

const DEFAULT_TABS: { id: Cat; label: string }[] = [
  { id: "all", label: "الكل" },
];

function adapt(r: any): Project {
  const paths: string[] = (r.image_paths ?? []) as string[];
  const urls: string[] = (r.images ?? []) as string[];
  const order: string[] = (r.media_order ?? []) as string[];
  const seen = new Set<string>();
  const imgs: string[] = [];
  const pushPath = (p: string) => { const u = publicUrl(p); if (u && !seen.has(u)) { seen.add(u); imgs.push(u); } };
  const pushUrl = (u: string) => { if (u && !seen.has(u)) { seen.add(u); imgs.push(u); } };
  for (const t of order) {
    if (t.startsWith("p:") && paths.includes(t.slice(2))) pushPath(t.slice(2));
    else if (t.startsWith("u:") && urls.includes(t.slice(2))) pushUrl(t.slice(2));
  }
  for (const p of paths) pushPath(p);
  for (const u of urls) pushUrl(u);
  const cover = publicUrl(r.cover_path) || r.cover || imgs[0] || "";
  if (cover) {
    if (!seen.has(cover)) imgs.unshift(cover);
    else {
      const idx = imgs.indexOf(cover);
      if (idx > 0) { imgs.splice(idx, 1); imgs.unshift(cover); }
    }
  }
  // Prefer new structured columns, fall back to legacy specs jsonb
  const specs = { ...(r.specs ?? {}) };
  if (r.length_cm && r.width_cm && r.height_cm) {
    specs.dimensions = `${r.length_cm} × ${r.width_cm} × ${r.height_cm} سم`;
  }
  if (r.volume_liters != null) {
    specs.volumeLiters = `${r.volume_liters} لتر`;
  }
  return {
    id: r.sort_order ?? 0,
    slug: r.slug,
    title: r.title,
    cat: r.category,
    catLabel: r.category_label ?? r.category,
    featured: !!r.featured,
    location: r.location ?? "",
    year: r.year ?? "",
    cover,
    images: imgs,
    description: r.description ?? "",
    specs,
    equipment: r.equipment ?? {},
    waterSystem: r.water_system ?? undefined,
    addOns: r.add_ons ?? undefined,
    servicePackages: r.service_packages ?? undefined,
    livestockWarranty: r.livestock_warranty ?? undefined,
    equipmentWarrantyEnabled: !!r.equipment_warranty_enabled,
    equipmentWarrantyText: r.equipment_warranty_text ?? undefined,
    livestockWarrantyEnabled: !!r.livestock_warranty_enabled,
    livestockWarrantyText: r.livestock_warranty_text ?? undefined,
    contents: { fish: [], plantsOrCorals: [], decor: "", ...(r.contents ?? {}) },
    priceRange: { min: r.price_min ?? 0, max: r.price_max ?? 0, currency: "SAR" },
    priceType: (r.price_type ?? undefined) as Project["priceType"],
  } as Project;
}

function PortfolioPage() {
  const initial = Route.useLoaderData();
  const [view, setView] = useState<"projects" | "gallery">("projects");
  const [cat, setCat] = useState<Cat>("all");
  const [open, setOpen] = useState<Project | null>(null);
  const projects = initial.projects as Project[];
  const adminCats = (initial as any).categories as { slug: string; label: string }[];
  const loading = false;
  const error: string | null = null;

  const tabs = useMemo(() => {
    const used = new Set<string>(projects.map((p) => p.cat as unknown as string));
    const ordered: { id: Cat; label: string }[] = [];
    const seen = new Set<string>();
    // First, admin-defined order for categories that actually have projects
    for (const c of adminCats ?? []) {
      if (used.has(c.slug) && !seen.has(c.slug)) {
        ordered.push({ id: c.slug, label: c.label });
        seen.add(c.slug);
      }
    }
    // Then any leftover legacy categories present on projects but not in admin list
    projects.forEach((p) => {
      const slug = p.cat as unknown as string;
      if (!seen.has(slug)) { ordered.push({ id: slug, label: p.catLabel }); seen.add(slug); }
    });

    return [{ id: "all" as Cat, label: "الكل" }, ...ordered];
  }, [projects, adminCats]);


  const filtered = cat === "all" ? projects : projects.filter((p) => p.cat === cat);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <Reveal>
        <div className="text-center mb-12">
          <div className="text-xs tracking-widest text-gradient-gold mb-3">PORTFOLIO</div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">أعمالنا</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            مجموعة من مشاريعنا المختارة التي تجسد فلسفتنا في الجمع بين التصميم الفاخر والهندسة
            الدقيقة. اضغط على أي مشروع لعرض المواصفات والمعدات والأسعار.
          </p>
        </div>
      </Reveal>

      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setCat(t.id)}
            className={`px-5 py-2.5 rounded-xl text-sm transition-all ${
              cat === t.id ? "btn-gold" : "glass hover:glass-gold"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center text-muted-foreground py-12">جاري تحميل المشاريع...</div>
      )}
      {error && (
        <div className="text-center text-red-400 py-12">تعذر تحميل المشاريع: {error}</div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          لا توجد أعمال {cat !== "all" ? "في هذا التصنيف" : "حالياً"}.
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p, i) => (
          <Reveal key={p.slug} delay={i * 80}>
            <button onClick={() => setOpen(p)} className="group block w-full text-right">
              <div className="relative overflow-hidden rounded-2xl glass aspect-square">
                <img
                  src={p.cover}
                  alt={p.title}
                  width={1024}
                  height={1024}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

                {p.featured && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold glass-gold text-[color:var(--gold)]">
                    <Sparkles size={12} /> مميّز
                  </div>
                )}
                {(() => {
                  const label = formatPriceFrom(p.priceRange, p.priceType);
                  return label ? (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-background/70 backdrop-blur">
                      {label}
                    </div>
                  ) : null;
                })()}

                <div className="absolute bottom-0 right-0 left-0 p-5">
                  <div className="text-xs text-gradient-gold mb-1">{p.catLabel}</div>
                  <div className="text-lg font-bold mb-1">{p.title}</div>
                  {p.location && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin size={12} /> {p.location}
                    </div>
                  )}
                  <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-[color:var(--gold)]">
                    شاهد التفاصيل ←
                  </div>
                </div>
              </div>
            </button>
          </Reveal>
        ))}
      </div>

      {/* BUSINESS subsection */}
      <section className="mt-20 pt-12 border-t border-white/10">
        <Reveal>
          <div className="text-center mb-8">
            <div className="text-xs tracking-widest text-gradient-gold mb-3">BUSINESS</div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">قسم الأعمال التجارية</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              مشاريع وحلول مخصصة للكافيهات، المطاعم، الفعاليات، والمحلات — اطلع على الصفحة المخصصة للتفاصيل الكاملة.
            </p>
          </div>
          <div className="flex justify-center">
            <Link
              to="/business-solutions"
              className="btn-gold rounded-xl px-6 py-3 text-sm inline-flex items-center gap-2"
            >
              <Briefcase size={16} /> استعرض حلول الأعمال
              <ArrowLeftIcon size={14} />
            </Link>
          </div>
        </Reveal>
      </section>

      {open && <ProjectModal project={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const waMsg = `السلام عليكم، مهتم بتنفيذ مشروع مماثل لـ «${project.title}» (${project.specs.dimensions} — ${project.specs.systemType}). أرغب بعرض سعر.`;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-label={project.title}
    >
      <div className="min-h-full w-full flex justify-center items-start p-3 sm:p-6">
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass rounded-3xl max-w-5xl w-full overflow-hidden relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-10 grid place-items-center h-10 w-10 rounded-full glass-gold"
          aria-label="إغلاق"
        >
          <X size={18} />
        </button>

        <div className="p-5 sm:p-8 space-y-8">
          {/* Gallery */}
          <ProjectGallery images={project.images} alt={project.title} />

          {/* Header */}
          <div>
            <div className="text-xs text-gradient-gold mb-2">{project.catLabel}</div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">{project.title}</h2>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="glass-gold px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
                <MapPin size={12} /> {project.location}
              </span>
              <span className="glass-gold px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
                <Calendar size={12} /> {project.year}
              </span>
            </div>
            <p className="text-muted-foreground mt-4 leading-relaxed">{project.description}</p>
          </div>

          {/* Dimensions & Capacity */}
          <Section title="الأبعاد والسعة">
            <TankDimensions
              dimensions={project.specs.dimensions}
              volumeLiters={project.specs.volumeLiters}
            />
          </Section>

          {/* Specs */}
          <Section title="المواصفات التقنية">
            <div className="grid gap-3 sm:grid-cols-2">
              {project.specs.glassType && (
                <SpecCard icon={Box} label="نوع الزجاج" value={project.specs.glassType} />
              )}
              <SpecCard icon={Waves} label="النظام" value={project.specs.systemType} />
              {project.specs.totalSystemVolume && (
                <SpecCard icon={Layers} label="السعة الإجمالية للنظام" value={project.specs.totalSystemVolume} />
              )}
              {project.specs.glassBonding && (
                <SpecCard icon={Zap} label="نوع اللصق" value={project.specs.glassBonding} />
              )}
              {project.specs.parIntensity && (
                <SpecCard icon={Gauge} label="كثافة الإضاءة (PAR)" value={project.specs.parIntensity} />
              )}
              {project.specs.turnover && (
                <SpecCard icon={Activity} label="معدل التدوير" value={project.specs.turnover} />
              )}
            </div>
          </Section>

          {/* Filtration — standalone box */}
          <Section title="الفلترة">
            <div dir="rtl" className="glass-gold rounded-2xl p-6">
              <ul className="space-y-3">
                {project.equipment.filter
                  .split(/\s*\+\s*/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((stage, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
                      <div className="h-8 w-8 grid place-items-center rounded-lg bg-[color:var(--gold)]/15 text-[color:var(--gold)] shrink-0">
                        <Filter size={14} />
                      </div>
                      <span className="text-foreground/90 pt-1.5">{stage}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </Section>

          {/* Devices — standalone box */}
          <Section title="الأجهزة">
            <div dir="rtl" className="glass-gold rounded-2xl p-6">
              <ul className="space-y-3">
                {([
                  project.equipment.skimmer && { icon: Wind, label: "بروتين سكيمر", value: project.equipment.skimmer },
                  project.equipment.returnPump && { icon: Waves, label: "مضخة العودة", value: project.equipment.returnPump },
                  project.equipment.waveMakers && { icon: Wind, label: "مضخات الموجة (Wave Makers)", value: project.equipment.waveMakers },
                  { icon: Sun, label: "الإضاءة", value: project.equipment.lighting },
                  project.equipment.heatingCooling && { icon: Thermometer, label: "التدفئة", value: project.equipment.heatingCooling },
                  project.equipment.dosing && { icon: Droplet, label: "موزع الجرعات (Dosing)", value: project.equipment.dosing },
                  project.equipment.co2 && { icon: Leaf, label: "نظام CO₂", value: project.equipment.co2 },
                ].filter(Boolean) as { icon: typeof Filter; label: string; value: string }[]).map((d, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
                    <div className="h-8 w-8 grid place-items-center rounded-lg bg-[color:var(--gold)]/15 text-[color:var(--gold)] shrink-0">
                      <d.icon size={14} />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <div className="text-xs font-bold text-[color:var(--gold)] mb-0.5">{d.label}</div>
                      <div className="text-foreground/90">{d.value}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Section>


          {/* Water System — bullets */}
          {project.waterSystem && project.waterSystem.length > 0 && (
            <Section title="نظام المياه">
              <div className="glass-gold rounded-2xl p-6">
                <ul className="space-y-3">
                  {project.waterSystem.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
                      <div className="h-8 w-8 grid place-items-center rounded-lg bg-[color:var(--gold)]/15 text-[color:var(--gold)] shrink-0">
                        <Droplet size={14} />
                      </div>
                      <span className="text-foreground/90 pt-1.5">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Section>
          )}

          {/* Add-ons / extra equipment */}
          {project.addOns && project.addOns.length > 0 && (
            <Section title="تجهيزات إضافية مشمولة">
              <div className="grid gap-2 sm:grid-cols-2">
                {project.addOns.map((item, i) => (
                  <div
                    key={i}
                    className="glass rounded-xl px-4 py-3 border border-white/10 flex items-start gap-2.5 text-sm"
                  >
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] shrink-0" />
                    <span className="text-foreground/90 leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Service Packages + Warranties */}
          {(() => {
            const showEquipWarranty = !!(project.equipmentWarrantyEnabled && (project.equipmentWarrantyText ?? "").trim());
            const showLiveWarranty = !!(project.livestockWarrantyEnabled && (project.livestockWarrantyText ?? "").trim());
            const hasPackages = !!(project.servicePackages && project.servicePackages.length > 0);
            if (!showEquipWarranty && !showLiveWarranty && !hasPackages) return null;
            return (
              <Section title="باقات الخدمة والضمان">
                <div className="space-y-4">
                  {showEquipWarranty && (
                    <div className="glass-gold rounded-2xl p-5 flex items-start gap-3">
                      <div className="h-11 w-11 grid place-items-center rounded-xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] shrink-0">
                        <ShieldCheck size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-[color:var(--gold)] mb-1">
                          ضمان المعدات (مشمول)
                        </div>
                        <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                          {project.equipmentWarrantyText}
                        </div>
                      </div>
                    </div>
                  )}

                  {showLiveWarranty && (
                    <div className="glass-gold rounded-2xl p-5 flex items-start gap-3">
                      <div className="h-11 w-11 grid place-items-center rounded-xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] shrink-0">
                        <Heart size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-[color:var(--gold)] mb-1">
                          ضمان الكائنات الحية (مشمول)
                        </div>
                        <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                          {project.livestockWarrantyText}
                        </div>
                      </div>
                    </div>
                  )}

                  {hasPackages && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
                        <Sparkles size={14} className="text-[color:var(--gold)]" />
                        باقات اختيارية يمكن إضافتها للمشروع:
                      </div>
                      <div className="grid gap-2">
                        {project.servicePackages!.map((pkg, i) => (
                          <div
                            key={i}
                            className="glass rounded-xl px-4 py-3 border border-white/10 flex items-start gap-3 text-sm"
                          >
                            <ShieldCheck size={16} className="text-[color:var(--gold)] mt-0.5 shrink-0" />
                            <span className="text-foreground/90 leading-relaxed">{pkg}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            );
          })()}


          {/* Suggested Fish */}
          {project.contents.fish.length > 0 && (
            <Section title="الأسماك المقترحة">
              <div className="flex flex-wrap gap-2">
                {project.contents.fish.map((f) => (
                  <span key={f} className="glass px-3 py-1.5 rounded-full text-xs border border-white/10 inline-flex items-center gap-1.5">
                    <Fish size={12} className="text-[color:var(--gold)]" /> {f}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Plants or Corals — dynamic label */}
          {project.contents.plantsOrCorals && project.contents.plantsOrCorals.length > 0 && (
            <Section
              title={
                /بحري|Reef|مرجاني/i.test(project.specs.systemType)
                  ? "المرجان والشقائق المقترحة"
                  : "النباتات المقترحة"
              }
            >
              <div className="flex flex-wrap gap-2">
                {project.contents.plantsOrCorals.map((p) => (
                  <span key={p} className="glass px-3 py-1.5 rounded-full text-xs border border-white/10 inline-flex items-center gap-1.5">
                    <Leaf size={12} className="text-[color:var(--gold)]" /> {p}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Decor */}
          {project.contents.decor && (
            <Section title="الديكور والركيزة">
              <p className="text-sm text-muted-foreground leading-relaxed glass rounded-xl px-4 py-3 border border-white/10">
                {project.contents.decor}
              </p>
            </Section>
          )}


          {/* Price */}
          {(() => {
            const priceLabel = formatPriceRange(project.priceRange, project.priceType);
            if (project.priceType === "hidden" || !priceLabel) {
              // Hidden price: only show CTA, no price text
              return (
                <div className="relative overflow-hidden rounded-2xl glass-gold p-6">
                  <div className="light-rays" aria-hidden />
                  <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="text-sm text-muted-foreground">
                      لطلب عرض سعر، تواصل معنا مباشرة عبر واتساب.
                    </div>
                    <a
                      href={whatsappLink(waMsg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-gold px-6 py-3 rounded-xl text-sm inline-flex items-center gap-2 justify-center whitespace-nowrap"
                    >
                      <MessageCircle size={16} /> اطلب عرض سعر
                    </a>
                  </div>
                </div>
              );
            }
            const heading = project.priceType === "on_request"
              ? "السعر"
              : project.priceType === "fixed"
                ? "السعر"
                : "النطاق السعري التقريبي";
            return (
              <div className="relative overflow-hidden rounded-2xl glass-gold p-6">
                <div className="light-rays" aria-hidden />
                <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">{heading}</div>
                    <div className="text-2xl sm:text-3xl font-bold text-gradient-gold">
                      {priceLabel}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      يشمل التصميم والتنفيذ والتركيب — السعر النهائي يتحدد بعد المعاينة.
                    </div>
                  </div>
                  <a
                    href={whatsappLink(waMsg)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-gold px-6 py-3 rounded-xl text-sm inline-flex items-center gap-2 justify-center whitespace-nowrap"
                  >
                    <MessageCircle size={16} /> اطلب عرض سعر مماثل
                  </a>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
        <span className="h-1 w-6 rounded-full bg-[color:var(--gold)]" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function WarrantyItem({
  icon: Icon,
  label,
  value,
}: {
  icon: import("lucide-react").LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 grid place-items-center rounded-lg bg-[color:var(--gold)]/15 text-[color:var(--gold)] shrink-0">
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-[color:var(--gold)] mb-1">{label}</div>
        <p className="text-sm text-foreground/90 leading-relaxed">{value}</p>
      </div>
    </div>
  );
}
