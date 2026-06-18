import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ImageUploader, MultiImageUploader } from "@/components/ImageUploader";
import { publicUrl, onImageError } from "@/lib/storage";
import { toast } from "sonner";
import {
  Droplets, FlaskConical, Camera, StickyNote, AlertTriangle, Wrench,
  Sparkles, Activity, CalendarClock, Image as ImageIcon, ClipboardList,
} from "lucide-react";
import {
  HEALTH_LABEL, HEALTH_COLOR, type TankHealthStatus, type SummarySnapshot,
  detectWaterType, nextWaterChangeDays, relativeArabic, readingOutOfRange,
  computeHealth, ISSUE_TYPES, NOTE_CATEGORIES,
} from "@/lib/aquarium-assistant";

// Use loose typing for newly added tables (regenerated types not in graph yet for this turn).
const db = supabase as any;

type Props = { tankId: string; userId: string; tankType: string | null };

type Reading = {
  id: string; reading_date: string;
  temperature: number | null; ph: number | null; ammonia: number | null;
  nitrite: number | null; nitrate: number | null; tds: number | null;
  salinity: number | null; kh: number | null; calcium: number | null;
  magnesium: number | null; phosphate: number | null; note: string | null;
};
type CareLog = {
  id: string; log_type: string; status: string | null;
  water_change_percentage: number | null; note: string | null; note_category: string | null;
  image_paths: string[] | null; details: any; created_at: string;
};
type Issue = {
  id: string; issue_type: string; description: string | null; status: string;
  image_paths: string[] | null; created_at: string;
};

type Sheet = null | "quick" | "water" | "reading" | "photo" | "note" | "issue";

export function AquariumAssistant({ tankId, userId, tankType }: Props) {
  const water = detectWaterType(tankType);
  const [logs, setLogs] = useState<CareLog[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    (async () => {
      const [a, b, c] = await Promise.all([
        db.from("aquarium_care_logs").select("*").eq("tank_id", tankId).order("created_at", { ascending: false }).limit(50),
        db.from("aquarium_readings").select("*").eq("tank_id", tankId).order("reading_date", { ascending: false }).limit(50),
        db.from("aquarium_issues").select("*").eq("tank_id", tankId).order("created_at", { ascending: false }).limit(50),
      ]);
      setLogs((a.data ?? []) as CareLog[]);
      setReadings((b.data ?? []) as Reading[]);
      setIssues((c.data ?? []) as Issue[]);
    })();
  }, [tankId, tick]);

  const snap: SummarySnapshot = useMemo(() => {
    const lastWater = logs.find((l) => l.log_type === "water_change");
    const lastReading = readings[0];
    const lastPhotoLog = logs.find((l) => (l.image_paths?.length ?? 0) > 0);
    const lastNoteLog = logs.find((l) => l.log_type === "note");
    const lastStatusLog = logs.find((l) => l.log_type === "status_update" && l.status);
    const openIssue = issues.some((i) => i.status === "open");
    return {
      lastWaterChange: lastWater?.created_at ?? null,
      lastReading: {
        date: lastReading?.reading_date ?? null,
        outOfRange: lastReading ? readingOutOfRange(lastReading as any, water) : false,
      },
      lastPhoto: lastPhotoLog?.image_paths?.[0] ?? null,
      lastNote: { date: lastNoteLog?.created_at ?? null, text: lastNoteLog?.note ?? null },
      lastStatus: { status: lastStatusLog?.status ?? null, date: lastStatusLog?.created_at ?? null },
      openIssue,
      nextTaskDue: null,
    };
  }, [logs, readings, issues, water]);

  const health: TankHealthStatus = computeHealth(snap, water);

  const nextWcText = (() => {
    if (!snap.lastWaterChange) return null;
    const days = nextWaterChangeDays(tankType);
    const due = new Date(new Date(snap.lastWaterChange).getTime() + days * 86400000);
    const left = Math.ceil((due.getTime() - Date.now()) / 86400000);
    if (left <= 0) return "حان موعد تغيير الماء";
    return `تغيير ماء بعد ${left} يوم`;
  })();

  const hasAny = logs.length > 0 || readings.length > 0 || issues.length > 0;

  return (
    <>
      {/* PANEL */}
      <section className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="text-gold" size={18} />
            <h2 className="font-bold">مساعد الحوض</h2>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full border ${HEALTH_COLOR[health]}`}>
            {HEALTH_LABEL[health]}
          </span>
        </div>

        {!hasAny ? (
          <p className="text-sm text-muted-foreground">ابدأ بتسجيل أول تحديث لحوضك من الأزرار في الأسفل.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Stat icon={<Droplets size={14} />} title="آخر تغيير ماء" value={relativeArabic(snap.lastWaterChange)} />
            <Stat icon={<FlaskConical size={14} />} title="آخر قراءة" value={relativeArabic(snap.lastReading.date)} />
            <Stat icon={<ImageIcon size={14} />} title="آخر صورة" value={relativeArabic(snap.lastPhoto ? logs.find(l=>l.image_paths?.length)?.created_at ?? null : null)} />
            <Stat icon={<CalendarClock size={14} />} title="المهمة القادمة" value={nextWcText ?? "—"} />
            <Stat icon={<StickyNote size={14} />} title="آخر ملاحظة" value={snap.lastNote.text ? snap.lastNote.text.slice(0, 24) : "—"} />
          </div>
        )}

        <p className="text-[11px] text-muted-foreground mt-3">
          هذا مؤشر مبسط لمساعدتك على متابعة الحوض، ولا يغني عن فحص مختص عند وجود مشكلة.
        </p>

        {/* QUICK ACTIONS */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ActionBtn onClick={() => setSheet("quick")} icon={<Activity size={16} />} label="تحديث سريع" primary />
          <ActionBtn onClick={() => setSheet("water")} icon={<Droplets size={16} />} label="تغيير ماء" />
          <ActionBtn onClick={() => setSheet("reading")} icon={<FlaskConical size={16} />} label="قراءة" />
          <ActionBtn onClick={() => setSheet("photo")} icon={<Camera size={16} />} label="صورة" />
          <ActionBtn onClick={() => setSheet("note")} icon={<StickyNote size={16} />} label="ملاحظة" />
          <ActionBtn onClick={() => setSheet("issue")} icon={<AlertTriangle size={16} />} label="عندي مشكلة" />
          <Link to="/account/requests/new" search={{ type: "maintenance", tank: tankId } as any}
            className="glass rounded-xl px-3 py-3 text-xs flex items-center justify-center gap-1.5 hover:bg-white/10 min-h-12">
            <Wrench size={16} /> اطلب صيانة
          </Link>
        </div>
      </section>

      {/* TIMELINE */}
      <CareTimeline logs={logs} readings={readings} issues={issues} />

      {/* SHEETS */}
      {sheet === "quick" && (
        <QuickUpdateSheet tankId={tankId} userId={userId} onClose={() => setSheet(null)} onDone={refresh} />
      )}
      {sheet === "water" && (
        <WaterChangeSheet tankId={tankId} userId={userId} tankType={tankType} onClose={() => setSheet(null)} onDone={refresh} />
      )}
      {sheet === "reading" && (
        <ReadingSheet tankId={tankId} userId={userId} water={water} onClose={() => setSheet(null)} onDone={refresh} />
      )}
      {sheet === "photo" && (
        <PhotoSheet tankId={tankId} userId={userId} onClose={() => setSheet(null)} onDone={refresh} />
      )}
      {sheet === "note" && (
        <NoteSheet tankId={tankId} userId={userId} onClose={() => setSheet(null)} onDone={refresh} />
      )}
      {sheet === "issue" && (
        <IssueSheet tankId={tankId} userId={userId} onClose={() => setSheet(null)} onDone={refresh} />
      )}
    </>
  );
}

function Stat({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon}<span>{title}</span></div>
      <div className="text-sm font-semibold mt-1 truncate" title={value}>{value}</div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, primary }: { icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} type="button"
      className={`${primary ? "btn-gold" : "glass hover:bg-white/10"} rounded-xl px-3 py-3 text-xs flex items-center justify-center gap-1.5 min-h-12`}>
      {icon} {label}
    </button>
  );
}

/* -------------- SHEET CHROME -------------- */

function SheetShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  // Simple modal/bottom-sheet hybrid: full-width bottom on mobile, centered card on desktop
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-lg glass rounded-t-2xl sm:rounded-2xl border border-white/10 p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">{title}</h3>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-white">إغلاق</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* -------------- QUICK UPDATE -------------- */

function QuickUpdateSheet({ tankId, userId, onClose, onDone }: { tankId: string; userId: string; onClose: () => void; onDone: () => void }) {
  const opts = [
    { v: "excellent", l: "ممتاز", msg: "ممتاز، استمر على نفس روتين العناية." },
    { v: "normal", l: "طبيعي", msg: "تم تسجيل الحالة، تابع الحوض خلال الأيام القادمة." },
    { v: "needs_attention", l: "يحتاج متابعة", msg: "تم تسجيل الحالة، يفضل إضافة صورة أو قراءة لمتابعة الوضع." },
    { v: "problem", l: "فيه مشكلة", msg: "تم تسجيل المشكلة، ويمكنك فتح طلب متابعة إذا احتجت مساعدة." },
  ];
  const [status, setStatus] = useState<string>("normal");
  const [note, setNote] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await db.from("aquarium_care_logs").insert({
      tank_id: tankId, user_id: userId, log_type: "status_update", status,
      note: note || null, image_paths: image ? [image] : [],
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حفظ تحديث الحوض ✅");
    const msg = opts.find(o => o.v === status)?.msg;
    if (msg) toast(msg);
    onDone(); onClose();
  };

  return (
    <SheetShell title="كيف وضع الحوض اليوم؟" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {opts.map(o => (
          <button key={o.v} onClick={() => setStatus(o.v)}
            className={`rounded-xl px-3 py-3 text-sm border ${status === o.v ? "border-gold bg-gold/10 text-gold" : "border-white/10 hover:bg-white/5"}`}>
            {o.l}
          </button>
        ))}
      </div>
      <label className="text-xs text-muted-foreground">ملاحظة (اختياري)</label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
        className="w-full glass rounded-xl p-2 text-sm mb-3" placeholder="مثال: غيرت الإضاءة..." />
      <label className="text-xs text-muted-foreground mb-1 block">صورة (اختياري)</label>
      <div className="mb-4"><ImageUploader value={image} onChange={setImage} folder="aquarium-assistant" enableCrop={false} /></div>
      <button onClick={save} disabled={busy} className="btn-gold w-full rounded-xl py-2.5 text-sm">
        {busy ? "جاري الحفظ..." : "حفظ التحديث"}
      </button>
    </SheetShell>
  );
}

/* -------------- WATER CHANGE -------------- */

function WaterChangeSheet({ tankId, userId, tankType, onClose, onDone }: { tankId: string; userId: string; tankType: string | null; onClose: () => void; onDone: () => void }) {
  const [pct, setPct] = useState<number | "custom">(20);
  const [custom, setCustom] = useState<string>("");
  const [note, setNote] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const value = pct === "custom" ? Number(custom) : pct;
    if (!value || isNaN(value)) { toast.error("أدخل نسبة صحيحة"); return; }
    setBusy(true);
    const { error } = await db.from("aquarium_care_logs").insert({
      tank_id: tankId, user_id: userId, log_type: "water_change",
      water_change_percentage: value, note: note || null,
      image_paths: image ? [image] : [],
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const next = nextWaterChangeDays(tankType);
    toast.success("تم تسجيل تغيير الماء ✅");
    toast(`الموعد المقترح للتغيير القادم بعد ${next} أيام.`);
    onDone(); onClose();
  };

  return (
    <SheetShell title="كم غيرت من الماء؟" onClose={onClose}>
      <div className="grid grid-cols-5 gap-2 mb-3">
        {[10, 20, 30, 50].map(v => (
          <button key={v} onClick={() => setPct(v)}
            className={`rounded-xl py-3 text-sm border ${pct === v ? "border-gold bg-gold/10 text-gold" : "border-white/10 hover:bg-white/5"}`}>
            {v}%
          </button>
        ))}
        <button onClick={() => setPct("custom")}
          className={`rounded-xl py-3 text-sm border ${pct === "custom" ? "border-gold bg-gold/10 text-gold" : "border-white/10 hover:bg-white/5"}`}>
          مخصص
        </button>
      </div>
      {pct === "custom" && (
        <input type="number" inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value)}
          placeholder="نسبة %" className="w-full glass rounded-xl p-2 text-sm mb-3" />
      )}
      <label className="text-xs text-muted-foreground">ملاحظة (اختياري)</label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
        className="w-full glass rounded-xl p-2 text-sm mb-3" />
      <label className="text-xs text-muted-foreground mb-1 block">صورة بعد التغيير (اختياري)</label>
      <div className="mb-4"><ImageUploader value={image} onChange={setImage} folder="aquarium-assistant" enableCrop={false} /></div>
      <button onClick={save} disabled={busy} className="btn-gold w-full rounded-xl py-2.5 text-sm">
        {busy ? "جاري الحفظ..." : "حفظ"}
      </button>
    </SheetShell>
  );
}

/* -------------- READING -------------- */

function ReadingSheet({ tankId, userId, water, onClose, onDone }: { tankId: string; userId: string; water: ReturnType<typeof detectWaterType>; onClose: () => void; onDone: () => void }) {
  const fields = water === "marine"
    ? [["temperature", "درجة الحرارة °C"], ["salinity", "Salinity"], ["kh", "KH"], ["calcium", "Calcium"], ["magnesium", "Magnesium"], ["nitrate", "Nitrate"], ["phosphate", "Phosphate"], ["ph", "pH"]] as const
    : [["temperature", "درجة الحرارة °C"], ["ph", "pH"], ["ammonia", "Ammonia"], ["nitrite", "Nitrite"], ["nitrate", "Nitrate"], ["tds", "TDS (اختياري)"]] as const;

  const [vals, setVals] = useState<Record<string, string>>({});
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 16));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const numeric: Record<string, number | null> = {};
    for (const k of Object.keys(vals)) {
      const v = vals[k].trim();
      numeric[k] = v === "" ? null : Number(v);
    }
    if (Object.values(numeric).every(v => v === null)) {
      toast.error("سجل قراءة واحدة على الأقل");
      return;
    }
    setBusy(true);
    const payload = { tank_id: tankId, user_id: userId, reading_date: new Date(date).toISOString(), note: note || null, ...numeric };
    const { error } = await db.from("aquarium_readings").insert(payload);
    if (!error) {
      await db.from("aquarium_care_logs").insert({
        tank_id: tankId, user_id: userId, log_type: "reading",
        note: note || null, details: numeric,
      });
    }
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حفظ القراءات ✅");
    if (readingOutOfRange(numeric, water)) {
      toast("بعض القراءات قد تحتاج متابعة. يمكنك طلب استشارة إذا احتجت مساعدة.");
    }
    onDone(); onClose();
  };

  return (
    <SheetShell title="سجل قراءة" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {fields.map(([k, label]) => (
          <div key={k}>
            <label className="text-[11px] text-muted-foreground">{label}</label>
            <input type="number" inputMode="decimal" step="any"
              value={vals[k] ?? ""} onChange={(e) => setVals({ ...vals, [k]: e.target.value })}
              className="w-full glass rounded-xl p-2 text-sm" />
          </div>
        ))}
      </div>
      <label className="text-xs text-muted-foreground">تاريخ القراءة</label>
      <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)}
        className="w-full glass rounded-xl p-2 text-sm mb-3" />
      <label className="text-xs text-muted-foreground">ملاحظة (اختياري)</label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
        className="w-full glass rounded-xl p-2 text-sm mb-4" />
      <button onClick={save} disabled={busy} className="btn-gold w-full rounded-xl py-2.5 text-sm">
        {busy ? "جاري الحفظ..." : "حفظ القراءة"}
      </button>
    </SheetShell>
  );
}

/* -------------- PHOTO -------------- */

function PhotoSheet({ tankId, userId, onClose, onDone }: { tankId: string; userId: string; onClose: () => void; onDone: () => void }) {
  const [images, setImages] = useState<string[]>([]);
  const [cover, setCover] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (images.length === 0) { toast.error("ارفع صورة على الأقل"); return; }
    setBusy(true);
    const { error } = await db.from("aquarium_care_logs").insert({
      tank_id: tankId, user_id: userId, log_type: "photo",
      note: note || null, image_paths: images,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حفظ صورة الحوض ✅");
    onDone(); onClose();
  };

  return (
    <SheetShell title="أضف صورة" onClose={onClose}>
      <div className="mb-3">
        <MultiImageUploader values={images} cover={cover} onChange={(v, c) => { setImages(v); setCover(c); }} folder="aquarium-assistant" cropAspect={"free"} />
      </div>
      <label className="text-xs text-muted-foreground">ملاحظة (اختياري)</label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
        className="w-full glass rounded-xl p-2 text-sm mb-4" />
      <button onClick={save} disabled={busy} className="btn-gold w-full rounded-xl py-2.5 text-sm">
        {busy ? "جاري الحفظ..." : "حفظ"}
      </button>
    </SheetShell>
  );
}

/* -------------- NOTE -------------- */

function NoteSheet({ tankId, userId, onClose, onDone }: { tankId: string; userId: string; onClose: () => void; onDone: () => void }) {
  const [cat, setCat] = useState("general");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!text.trim()) { toast.error("اكتب الملاحظة"); return; }
    setBusy(true);
    const { error } = await db.from("aquarium_care_logs").insert({
      tank_id: tankId, user_id: userId, log_type: "note",
      note: text, note_category: cat, image_paths: image ? [image] : [],
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حفظ الملاحظة.");
    onDone(); onClose();
  };

  return (
    <SheetShell title="أضف ملاحظة" onClose={onClose}>
      <label className="text-xs text-muted-foreground">نوع الملاحظة</label>
      <select value={cat} onChange={(e) => setCat(e.target.value)} className="w-full glass rounded-xl p-2 text-sm mb-3 bg-transparent">
        {NOTE_CATEGORIES.map(o => <option key={o.value} value={o.value} className="bg-background">{o.label}</option>)}
      </select>
      <label className="text-xs text-muted-foreground">نص الملاحظة</label>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
        className="w-full glass rounded-xl p-2 text-sm mb-3" />
      <label className="text-xs text-muted-foreground mb-1 block">صورة (اختياري)</label>
      <div className="mb-4"><ImageUploader value={image} onChange={setImage} folder="aquarium-assistant" enableCrop={false} /></div>
      <button onClick={save} disabled={busy} className="btn-gold w-full rounded-xl py-2.5 text-sm">
        {busy ? "جاري الحفظ..." : "حفظ"}
      </button>
    </SheetShell>
  );
}

/* -------------- ISSUE -------------- */

function IssueSheet({ tankId, userId, onClose, onDone }: { tankId: string; userId: string; onClose: () => void; onDone: () => void }) {
  const [issueType, setIssueType] = useState(ISSUE_TYPES[0].value);
  const [desc, setDesc] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [wantsFollowup, setWants] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await db.from("aquarium_issues").insert({
      tank_id: tankId, user_id: userId, issue_type: issueType,
      description: desc || null, wants_followup: wantsFollowup,
      image_paths: image ? [image] : [],
    });
    if (!error) {
      await db.from("aquarium_care_logs").insert({
        tank_id: tankId, user_id: userId, log_type: "issue",
        note: desc || null, details: { issue_type: issueType, wants_followup: wantsFollowup },
        image_paths: image ? [image] : [],
      });
    }
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تسجيل المشكلة.");
    if (wantsFollowup) toast("سيتم ربطها بطلب متابعة في المرحلة القادمة.");
    onDone(); onClose();
  };

  return (
    <SheetShell title="ما نوع المشكلة؟" onClose={onClose}>
      <select value={issueType} onChange={(e) => setIssueType(e.target.value)}
        className="w-full glass rounded-xl p-2 text-sm mb-3 bg-transparent">
        {ISSUE_TYPES.map(o => <option key={o.value} value={o.value} className="bg-background">{o.label}</option>)}
      </select>
      <label className="text-xs text-muted-foreground">وصف المشكلة</label>
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3}
        className="w-full glass rounded-xl p-2 text-sm mb-3" />
      <label className="text-xs text-muted-foreground mb-1 block">صورة (اختياري)</label>
      <div className="mb-3"><ImageUploader value={image} onChange={setImage} folder="aquarium-assistant" enableCrop={false} /></div>
      <label className="flex items-center gap-2 text-sm mb-4">
        <input type="checkbox" checked={wantsFollowup} onChange={(e) => setWants(e.target.checked)} />
        أرغب بمتابعة من Aqua Haven
      </label>
      <button onClick={save} disabled={busy} className="btn-gold w-full rounded-xl py-2.5 text-sm">
        {busy ? "جاري الحفظ..." : "حفظ المشكلة"}
      </button>
    </SheetShell>
  );
}

/* -------------- TIMELINE -------------- */

type TLItem = { id: string; type: string; date: string; title: string; subtitle?: string; image?: string | null };

function CareTimeline({ logs, readings, issues }: { logs: CareLog[]; readings: Reading[]; issues: Issue[] }) {
  const items: TLItem[] = useMemo(() => {
    const arr: TLItem[] = [];
    for (const l of logs) {
      const titles: Record<string, string> = {
        status_update: "تحديث الحالة",
        water_change: "تغيير ماء",
        note: "ملاحظة",
        issue: "مشكلة",
        photo: "صورة جديدة",
        reading: "قراءة ماء",
      };
      let sub: string | undefined;
      if (l.log_type === "water_change" && l.water_change_percentage) sub = `${l.water_change_percentage}%`;
      else if (l.log_type === "status_update" && l.status) sub = ({ excellent: "ممتاز", normal: "طبيعي", needs_attention: "يحتاج متابعة", problem: "فيه مشكلة" } as any)[l.status] ?? l.status;
      else if (l.note) sub = l.note;
      arr.push({ id: `l_${l.id}`, type: l.log_type, date: l.created_at, title: titles[l.log_type] ?? l.log_type, subtitle: sub, image: l.image_paths?.[0] ?? null });
    }
    for (const r of readings) {
      const parts: string[] = [];
      if (r.ph !== null) parts.push(`pH ${r.ph}`);
      if (r.nitrate !== null) parts.push(`NO3 ${r.nitrate}`);
      if (r.temperature !== null) parts.push(`${r.temperature}°C`);
      arr.push({ id: `r_${r.id}`, type: "reading_detail", date: r.reading_date, title: "قراءة ماء", subtitle: parts.join(" · ") || r.note || undefined });
    }
    for (const i of issues) {
      arr.push({ id: `i_${i.id}`, type: "issue_detail", date: i.created_at, title: `مشكلة: ${ISSUE_TYPES.find(x => x.value === i.issue_type)?.label ?? i.issue_type}`, subtitle: i.description ?? undefined, image: i.image_paths?.[0] ?? null });
    }
    return arr.sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 40);
  }, [logs, readings, issues]);

  if (items.length === 0) return null;

  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="text-gold" size={18} />
        <h2 className="font-bold">سجل العناية</h2>
      </div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="glass rounded-xl p-3 flex items-start gap-3">
            {it.image && (
              <a href={publicUrl(it.image)} target="_blank" rel="noreferrer" className="shrink-0">
                <img src={publicUrl(it.image)} onError={onImageError} alt="" className="h-12 w-12 rounded-lg object-cover border border-white/10" />
              </a>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{it.title}</span>
                <span className="text-[11px] text-muted-foreground">{relativeArabic(it.date)}</span>
              </div>
              {it.subtitle && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{it.subtitle}</div>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
