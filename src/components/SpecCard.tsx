import type { LucideIcon } from "lucide-react";

export function SpecCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-gold rounded-xl p-4 flex items-start gap-3">
      <div className="h-10 w-10 grid place-items-center rounded-lg bg-[color:var(--gold)]/15 text-[color:var(--gold)] shrink-0">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
        <div className="font-semibold text-sm leading-snug">{value}</div>
      </div>
    </div>
  );
}
