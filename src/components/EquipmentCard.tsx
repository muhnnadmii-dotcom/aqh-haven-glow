import type { LucideIcon } from "lucide-react";

export function EquipmentCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  const items = value.split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean);

  return (
    <div className="glass-gold rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 grid place-items-center rounded-xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] shrink-0">
          <Icon size={20} />
        </div>
        <div className="text-sm font-bold">{label}</div>
      </div>

      {items.length > 1 ? (
        <ul className="space-y-2 pr-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] shrink-0" />
              <span className="text-foreground/90">{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm leading-relaxed text-foreground/90 pr-1">{value}</div>
      )}
    </div>
  );
}
