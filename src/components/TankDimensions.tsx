import { Droplets, MoveHorizontal, MoveVertical, Move3d } from "lucide-react";

function parseDims(dimensions: string): { l?: string; w?: string; h?: string; unit?: string } {
  const cleaned = dimensions.replace(/[×xX*]/g, "×");
  const parts = cleaned.split("×").map((p) => p.trim());
  if (parts.length < 3) return {};
  const last = parts[2].split(/\s+/);
  const h = last[0];
  const unit = last.slice(1).join(" ") || "سم";
  return { l: parts[0], w: parts[1], h, unit };
}

export function TankDimensions({
  dimensions,
  volumeLiters,
}: {
  dimensions: string;
  volumeLiters: string;
}) {
  const { l, w, h, unit = "سم" } = parseDims(dimensions);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <DimCard
        icon={MoveHorizontal}
        color="var(--gold)"
        label="الطول"
        value={l}
        unit={unit}
      />
      <DimCard icon={Move3d} color="#7cc4ff" label="العرض" value={w} unit={unit} />
      <DimCard
        icon={MoveVertical}
        color="#c9a9ff"
        label="الارتفاع"
        value={h}
        unit={unit}
      />
      <div className="relative overflow-hidden rounded-xl glass-gold p-4 text-center flex flex-col items-center justify-center">
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground mb-1">
          <Droplets size={14} className="text-[color:var(--gold)]" />
          السعة الإجمالية
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-gradient-gold leading-none">
          {volumeLiters}
        </div>
      </div>
    </div>
  );
}

function DimCard({
  icon: Icon,
  color,
  label,
  value,
  unit,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  label: string;
  value?: string;
  unit: string;
}) {
  return (
    <div className="glass rounded-xl p-4 border border-white/10 flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-lg grid place-items-center shrink-0"
        style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
      >
        <Icon size={18} />
      </div>
      <div className="flex-1">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-lg font-bold tabular-nums">
          {value ?? "—"}{" "}
          <span className="text-xs font-normal text-muted-foreground">{unit}</span>
        </div>
      </div>
    </div>
  );
}
