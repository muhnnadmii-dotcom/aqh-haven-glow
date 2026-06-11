import { Droplets } from "lucide-react";

function parseDims(dimensions: string): { l?: string; w?: string; h?: string; unit?: string } {
  // expects "L × W × H سم" or similar
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
    <div className="glass rounded-2xl p-5 sm:p-6 border border-white/10">
      <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-center">
        {/* Labels side */}
        <div className="space-y-3 order-2 md:order-1">
          <DimRow color="var(--gold)" label="الطول" value={l} unit={unit} />
          <DimRow color="#7cc4ff" label="العرض" value={w} unit={unit} />
          <DimRow color="#c9a9ff" label="الارتفاع" value={h} unit={unit} />
        </div>

        {/* Isometric tank illustration */}
        <div className="order-1 md:order-2 flex justify-center">
          <IsoTank lLabel={l} wLabel={w} hLabel={h} unit={unit} />
        </div>

        {/* Capacity */}
        <div className="order-3 relative overflow-hidden rounded-xl glass-gold p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-2">
            <Droplets size={14} className="text-[color:var(--gold)]" />
            السعة الإجمالية
          </div>
          <div className="text-3xl sm:text-4xl font-bold text-gradient-gold leading-none">
            {volumeLiters}
          </div>
          <div className="text-[11px] text-muted-foreground mt-2">حجم الماء المعتمد</div>
        </div>
      </div>
    </div>
  );
}

function DimRow({
  color,
  label,
  value,
  unit,
}: {
  color: string;
  label: string;
  value?: string;
  unit: string;
}) {
  return (
    <div className="flex items-center gap-3 glass rounded-xl px-4 py-3 border border-white/5">
      <span className="h-8 w-1.5 rounded-full" style={{ background: color }} />
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

function IsoTank({
  lLabel,
  wLabel,
  hLabel,
  unit,
}: {
  lLabel?: string;
  wLabel?: string;
  hLabel?: string;
  unit: string;
}) {
  const gold = "var(--gold)";
  const blue = "#7cc4ff";
  const purple = "#c9a9ff";
  return (
    <svg
      viewBox="0 0 260 220"
      width="220"
      height="186"
      className="drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      aria-hidden
    >
      <defs>
        <linearGradient id="tankFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b3a5c" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#06203a" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="tankTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b6aa3" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0a3c66" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="tankSide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#072a48" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#04162a" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7cc4ff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#1b6aa3" stopOpacity="0.25" />
        </linearGradient>
      </defs>

      {/* Iso box: front (0,60)-(160,60)-(160,180)-(0,180); top skews to right by (60,-40) */}
      {/* Top face */}
      <polygon
        points="0,60 160,60 220,20 60,20"
        fill="url(#tankTop)"
        stroke="rgba(212,175,95,0.5)"
        strokeWidth="1"
      />
      {/* Side face (right) */}
      <polygon
        points="160,60 220,20 220,140 160,180"
        fill="url(#tankSide)"
        stroke="rgba(212,175,95,0.5)"
        strokeWidth="1"
      />
      {/* Front face */}
      <polygon
        points="0,60 160,60 160,180 0,180"
        fill="url(#tankFront)"
        stroke="rgba(212,175,95,0.7)"
        strokeWidth="1.2"
      />
      {/* Water inside front */}
      <polygon points="4,82 156,82 156,176 4,176" fill="url(#water)" opacity="0.85" />
      {/* Subtle water surface line */}
      <line x1="4" y1="82" x2="156" y2="82" stroke="#7cc4ff" strokeOpacity="0.6" strokeWidth="0.8" />

      {/* Dimension indicators */}
      {/* Length (front bottom edge) - gold */}
      <line x1="0" y1="196" x2="160" y2="196" stroke={gold} strokeWidth="1.2" />
      <line x1="0" y1="192" x2="0" y2="200" stroke={gold} strokeWidth="1.2" />
      <line x1="160" y1="192" x2="160" y2="200" stroke={gold} strokeWidth="1.2" />
      <text
        x="80"
        y="212"
        fill={gold}
        fontSize="11"
        fontWeight="700"
        textAnchor="middle"
        fontFamily="inherit"
      >
        {lLabel ? `${lLabel} ${unit}` : "الطول"}
      </text>

      {/* Width (top diagonal edge) - blue */}
      <line x1="166" y1="56" x2="226" y2="16" stroke={blue} strokeWidth="1.2" />
      <line x1="163" y1="60" x2="169" y2="52" stroke={blue} strokeWidth="1.2" />
      <line x1="223" y1="20" x2="229" y2="12" stroke={blue} strokeWidth="1.2" />
      <text
        x="200"
        y="8"
        fill={blue}
        fontSize="11"
        fontWeight="700"
        textAnchor="middle"
        fontFamily="inherit"
      >
        {wLabel ? `${wLabel} ${unit}` : "العرض"}
      </text>

      {/* Height (front right edge inward) - purple */}
      <line x1="-10" y1="60" x2="-10" y2="180" stroke={purple} strokeWidth="1.2" />
      <line x1="-14" y1="60" x2="-6" y2="60" stroke={purple} strokeWidth="1.2" />
      <line x1="-14" y1="180" x2="-6" y2="180" stroke={purple} strokeWidth="1.2" />
      <text
        x="-18"
        y="124"
        fill={purple}
        fontSize="11"
        fontWeight="700"
        textAnchor="middle"
        fontFamily="inherit"
        transform="rotate(-90 -18 124)"
      >
        {hLabel ? `${hLabel} ${unit}` : "الارتفاع"}
      </text>
    </svg>
  );
}
