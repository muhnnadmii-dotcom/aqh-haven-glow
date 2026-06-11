import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { projects, formatPriceFrom, formatPriceRange, type Project } from "../data/projects";

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
  component: PortfolioPage,
});

type Cat = "all" | Project["cat"];

const tabs: { id: Cat; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "home", label: "الأحواض المنزلية" },
  { id: "commercial", label: "مشاريع تجارية" },
  { id: "planted", label: "أحواض نباتية" },
];

function PortfolioPage() {
  const [cat, setCat] = useState<Cat>("all");
  const [open, setOpen] = useState<Project | null>(null);

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

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p, i) => (
          <Reveal key={p.id} delay={i * 80}>
            <button onClick={() => setOpen(p)} className="group block w-full text-right">
              <div className="relative overflow-hidden rounded-2xl glass">
                <img
                  src={p.cover}
                  alt={p.title}
                  width={1024}
                  height={768}
                  loading="lazy"
                  className="h-72 w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

                {p.featured && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold glass-gold text-[color:var(--gold)]">
                    <Sparkles size={12} /> مميّز
                  </div>
                )}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-background/70 backdrop-blur">
                  {formatPriceFrom(p.priceRange)}
                </div>

                <div className="absolute bottom-0 right-0 left-0 p-5">
                  <div className="text-xs text-gradient-gold mb-1">{p.catLabel}</div>
                  <div className="text-lg font-bold mb-1">{p.title}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin size={12} /> {p.location}
                  </div>
                  <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-[color:var(--gold)]">
                    شاهد التفاصيل ←
                  </div>
                </div>
              </div>
            </button>
          </Reveal>
        ))}
      </div>

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

          {/* Equipment */}
          <Section title="المعدات">
            <div className="grid gap-3 sm:grid-cols-2">
              <EquipmentCard icon={Filter} label="الفلتر / Sump" value={project.equipment.filter} />
              {project.equipment.skimmer && (
                <EquipmentCard icon={Wind} label="السكيمر" value={project.equipment.skimmer} />
              )}
              {project.equipment.returnPump && (
                <EquipmentCard icon={Waves} label="مضخة العودة" value={project.equipment.returnPump} />
              )}
              <EquipmentCard icon={Sun} label="الإضاءة" value={project.equipment.lighting} />
              {project.equipment.heatingCooling && (
                <EquipmentCard
                  icon={Thermometer}
                  label="التدفئة"
                  value={project.equipment.heatingCooling}
                />
              )}
              {project.equipment.waveMakers && (
                <EquipmentCard icon={Wind} label="مضخات الموجة" value={project.equipment.waveMakers} />
              )}
              {project.equipment.dosing && (
                <EquipmentCard icon={Droplet} label="موزع الجرعات (Dosing)" value={project.equipment.dosing} />
              )}
              {project.equipment.co2 && (
                <EquipmentCard icon={Leaf} label="نظام CO₂" value={project.equipment.co2} />
              )}
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

          {/* Service Packages + Livestock Warranty */}
          {(project.servicePackages?.length || project.livestockWarranty) && (
            <Section title="باقات الخدمة والضمان">
              <div className="space-y-4">
                {project.livestockWarranty && (
                  <div className="glass-gold rounded-2xl p-5 flex items-start gap-3">
                    <div className="h-11 w-11 grid place-items-center rounded-xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] shrink-0">
                      <Heart size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-[color:var(--gold)] mb-1">
                        ضمان الكائنات الحية (مشمول)
                      </div>
                      <div className="text-sm text-foreground/90 leading-relaxed">
                        {project.livestockWarranty}
                      </div>
                    </div>
                  </div>
                )}

                {project.servicePackages && project.servicePackages.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
                      <Sparkles size={14} className="text-[color:var(--gold)]" />
                      باقات اختيارية يمكن إضافتها للمشروع:
                    </div>
                    <div className="grid gap-2">
                      {project.servicePackages.map((pkg, i) => (
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
          )}


          {/* Contents */}
          <Section title="محتويات الحوض">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                  <Fish size={16} className="text-[color:var(--gold)]" /> الأسماك
                </div>
                <div className="flex flex-wrap gap-2">
                  {project.contents.fish.map((f) => (
                    <span
                      key={f}
                      className="glass px-3 py-1.5 rounded-full text-xs border border-white/10"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              {project.contents.plantsOrCorals && project.contents.plantsOrCorals.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Leaf size={16} className="text-[color:var(--gold)]" /> النباتات / المرجان
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {project.contents.plantsOrCorals.map((p) => (
                      <span
                        key={p}
                        className="glass px-3 py-1.5 rounded-full text-xs border border-white/10"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {project.contents.decor && (
                <div>
                  <div className="text-sm font-semibold mb-1">الديكور والركيزة</div>
                  <p className="text-sm text-muted-foreground">{project.contents.decor}</p>
                </div>
              )}
            </div>
          </Section>

          {/* Price */}
          <div className="relative overflow-hidden rounded-2xl glass-gold p-6">
            <div className="light-rays" aria-hidden />
            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">النطاق السعري التقريبي</div>
                <div className="text-2xl sm:text-3xl font-bold text-gradient-gold">
                  {formatPriceRange(project.priceRange)}
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
