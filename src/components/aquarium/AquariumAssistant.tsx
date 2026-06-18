import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { publicUrl, uploadMedia } from "@/lib/storage";
import { toast } from "sonner";
import {
  Droplets, FlaskConical, Camera, StickyNote, AlertTriangle, Wrench,
  Sparkles, Clock, Image as ImageIcon, X, Loader2, CheckCircle2,
} from "lucide-react";

type TankLite = { id: string; name: string; tank_type: string | null };

type CareLog = {
  id: string; created_at: string; log_type: string;
  status: string | null; water_change_percentage: number | null;
  note: string | null; note_category: string | null;
  image_paths: string[] | null; details: any;
};
type Reading = {
  id: string; reading_date: string; temperature: number | null; ph: number | null;
  ammonia: number | null; nitrite: number | null; nitrate: number | null;
  tds: number | null; salinity: number | null; kh: number | null;
  calcium: number | null; magnesium: number | null; phosphate: number | null;
  note: string | null;
};
type Issue = {
  id: string; created_at: string; issue_type: string;
  description: string | null; status: string; image_paths: string[] | null;
};
type Task = { id: string; task_type: string; title: string; due_date: string | null; status: string };

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function ago(iso: string | null | undefined): string {
  const d = daysSince(iso);
  if (d == null) return "—";
  if (d === 0) return "اليوم";
  if (d === 1) return "أمس";
  return `قبل ${d} يوم`;
}
function untilDays(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

const WC_DAYS_BY_TYPE: Record<string, number> = {
  freshwater: 7, planted: 7, marine: 10, betta: 7, shrimp: 7,
};

// Soft ranges for a gentle out-of-range hint.
const RANGES: Record<string, [number, number]> = {
  ph: [6.0, 8.6], ammonia: [0, 0.25], nitrite: [0, 0.25], nitrate: [0, 40],
  temperature: [22, 30], salinity: [1.020, 1.027], kh: [3, 14],
};

function readingOutOfRange(r: Reading): boolean {
  for (const k of Object.keys(RANGES) as (keyof typeof RANGES)[]) {
    const v = (r as any)[k];
    if (v == null) continue;
    const [lo, hi] = RANGES[k];
    if (Number(v) < lo || Number(v) > hi) return true;
  }
  return false;
}

type Status = "excellent" | "normal" | "needs_attention" | "problem";
const STATUS_META: Record<Status, { label: string; color: string; emoji: string }> = {
  excellent:       { label: "ممتاز", color: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30", emoji: "🌿" },
  normal:          { label: "مستقر", color: "bg-sky-500/15 text-sky-300 border-sky-400/30", emoji: "💧" },
  needs_attention: { label: "يحتاج متابعة", color: "bg-amber-500/15 text-amber-300 border-amber-400/30", emoji: "⚠️" },
  problem:         { label: "توجد مشكلة", color: "bg-rose-500/15 text-rose-300 border-rose-400/30", emoji: "🚨" },
};

type Modal =
  | null
  | "quick"
  | "water"
  | "reading"
  | "photo"
  | "note"
  | "issue";

export default function AquariumAssistant({ tank }: { tank: TankLite }) {
  const [logs, setLogs] = useState<CareLog[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    (async () => {
      const [l, r, i, t] = await Promise.all([
        supabase.from("aquarium_care_logs").select("*").eq("tank_id", tank.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("aquarium_readings").select("*").eq("tank_id", tank.id).order("reading_date", { ascending: false }).limit(20),
        supabase.from("aquarium_issues").select("*").eq("tank_id", tank.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("aquarium_tasks").select("*").eq("tank_id", tank.id).eq("status", "pending").order("due_date", { ascending: true }).limit(5),
      ]);
      setLogs((l.data ?? []) as CareLog[]);
      setReadings((r.data ?? []) as Reading[]);
      setIssues((i.data ?? []) as Issue[]);
      setTasks((t.data ?? []) as Task[]);
    })();
  }, [tank.id, reloadKey]);

  const lastWaterChange = logs.find((x) => x.log_type === "water_change");
  const lastReading = readings[0] ?? null;
  const lastPhoto = useMemo(() => {
    for (const l of logs) {
      if (l.image_paths && l.image_paths.length > 0) return { path: l.image_paths[0], created_at: l.created_at };
    }
    return null;
  }, [logs]);
  const lastStatusLog = logs.find((x) => x.log_type === "status_update" && x.status);
  const lastNote = logs.find((x) => x.log_type === "note" || x.note);
  const openIssue = issues.find((x) => x.status === "open");
  const nextTask = tasks[0] ?? null;

  const computedStatus: Status = useMemo(() => {
    if (openIssue) return "problem";
    const dWater = daysSince(lastWaterChange?.created_at);
    if (dWater != null && dWater > 14) return "needs_attention";
    if (lastReading && readingOutOfRange(lastReading)) return "needs_attention";
    if (lastStatusLog?.status === "excellent") return "excellent";
    if (lastStatusLog?.status === "problem") return "problem";
    if (lastStatusLog?.status === "needs_attention") return "needs_attention";
    if (logs.length > 0) return "normal";
    return "normal";
  }, [openIssue, lastWaterChange, lastReading, lastStatusLog, logs.length]);

  const meta = STATUS_META[computedStatus];
  const empty = logs.length === 0 && readings.length === 0 && issues.length === 0;

  return (
    <section className="glass rounded-2xl p-5 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="text-gold" size={18} />
          <h2 className="font-bold">مساعد الحوض</h2>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border ${meta.color}`}>
          {meta.emoji} حالة الحوض: {meta.label}
        </span>
      </header>

      {empty ? (
        <p className="text-sm text-muted-foreground">ابدأ بتسجيل أول تحديث لحوضك من الأزرار أدناه.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
          <SummaryCell icon={<Droplets size={14} />} label="آخر تغيير ماء"
            value={lastWaterChange ? `${ago(lastWaterChange.created_at)}${lastWaterChange.water_change_percentage ? ` · ${lastWaterChange.water_change_percentage}%` : ""}` : "—"} />
          <SummaryCell icon={<FlaskConical size={14} />} label="آخر قراءة" value={ago(lastReading?.reading_date)} />
          <SummaryCell icon={<Camera size={14} />} label="آخر صورة" value={ago(lastPhoto?.created_at)} />
          <SummaryCell icon={<Clock size={14} />} label="المهمة القادمة"
            value={nextTask?.due_date ? `${nextTask.title} · ${dueIn(nextTask.due_date)}` : "—"} />
          <SummaryCell icon={<StickyNote size={14} />} label="آخر ملاحظة"
            value={lastNote?.note ? truncate(lastNote.note, 40) : "—"} />
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        هذا مؤشر مبسط لمساعدتك على متابعة الحوض، ولا يغني عن فحص مختص عند وجود مشكلة.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        <Action onClick={() => setModal("quick")} icon={<Sparkles size={16} />} label="تحديث سريع" primary />
        <Action onClick={() => setModal("water")} icon={<Droplets size={16} />} label="سجل تغيير ماء" />
        <Action onClick={() => setModal("reading")} icon={<FlaskConical size={16} />} label="سجل قراءة" />
        <Action onClick={() => setModal("photo")} icon={<Camera size={16} />} label="أضف صورة" />
        <Action onClick={() => setModal("note")} icon={<StickyNote size={16} />} label="أضف ملاحظة" />
        <Action onClick={() => setModal("issue")} icon={<AlertTriangle size={16} />} label="عندي مشكلة" />
        <Link to="/account/requests/new" search={{ type: "maintenance", tank: tank.id }}
          className="glass rounded-xl px-3 py-2 text-xs flex items-center justify-center gap-1.5 hover:bg-white/10">
          <Wrench size={16} /> اطلب صيانة
        </Link>
      </div>

      <CareTimeline logs={logs} readings={readings} issues={issues} />

      {modal && (
        <Modal title={modalTitle(modal)} onClose={() => setModal(null)}>
          {modal === "quick" && <QuickUpdateForm tank={tank} onDone={() => { setModal(null); reload(); }} />}
          {modal === "water" && <WaterChangeForm tank={tank} onDone={() => { setModal(null); reload(); }} />}
          {modal === "reading" && <ReadingForm tank={tank} onDone={() => { setModal(null); reload(); }} />}
          {modal === "photo" && <PhotoForm tank={tank} onDone={() => { setModal(null); reload(); }} />}
          {modal === "note" && <NoteForm tank={tank} onDone={() => { setModal(null); reload(); }} />}
          {modal === "issue" && <IssueForm tank={tank} onDone={() => { setModal(null); reload(); }} />}
        </Modal>
      )}
    </section>
  );
}

function modalTitle(m: Exclude<Modal, null>): string {
  switch (m) {
    case "quick": return "كيف وضع الحوض اليوم؟";
    case "water": return "تسجيل تغيير ماء";
    case "reading": return "تسجيل قراءة";
    case "photo": return "إضافة صورة";
    case "note": return "إضافة ملاحظة";
    case "issue": return "تسجيل مشكلة";
  }
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n) + "…" : s; }
function dueIn(iso: string): string {
  const d = untilDays(iso);
  if (d == null) return "—";
  if (d < 0) return `متأخر ${-d} يوم`;
  if (d === 0) return "اليوم";
  if (d === 1) return "غدًا";
  return `بعد ${d} يوم`;
}

function SummaryCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span>{label}</span></div>
      <div className="mt-1 text-foreground font-medium truncate">{value}</div>
    </div>
  );
}

function Action({ icon, label, onClick, primary }: { icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`${primary ? "btn-gold" : "glass hover:bg-white/10"} rounded-xl px-3 py-2 text-xs flex items-center justify-center gap-1.5`}>
      {icon}{label}
    </button>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass w-full sm:max-w-[560px] sm:rounded-2xl rounded-t-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] shadow-2xl border border-white/10"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <h3 className="font-bold text-base">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/10" aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------- Forms ----------

async function uid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export function QuickUpdateForm({ tank, onDone }: { tank: TankLite; onDone: () => void }) {
  const [status, setStatus] = useState<Status>("normal");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const opts: { v: Status; l: string; e: string }[] = [
    { v: "excellent", l: "ممتاز", e: "🌿" },
    { v: "normal", l: "طبيعي", e: "💧" },
    { v: "needs_attention", l: "يحتاج متابعة", e: "⚠️" },
    { v: "problem", l: "فيه مشكلة", e: "🚨" },
  ];
  const tip: Record<Status, string> = {
    excellent: "ممتاز، استمر على نفس روتين العناية.",
    normal: "تم تسجيل الحالة، تابع الحوض خلال الأيام القادمة.",
    needs_attention: "تم تسجيل الحالة، يفضل إضافة صورة أو قراءة لمتابعة الوضع.",
    problem: "تم تسجيل المشكلة، يمكنك فتح طلب متابعة إذا احتجت مساعدة.",
  };
  const save = async () => {
    const u = await uid(); if (!u) { toast.error("يلزم تسجيل الدخول"); return; }
    setBusy(true);
    const { error } = await supabase.from("aquarium_care_logs").insert({
      tank_id: tank.id, user_id: u, log_type: "status_update", status, note: note || null,
    });
    setBusy(false);
    if (error) {
      console.error("[QuickUpdate] insert failed", error);
      toast.error(error.message || "تعذر الحفظ");
      return;
    }
    toast.success("تم حفظ تحديث الحوض ✅");
    toast(tip[status]);
    onDone();
  };
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-muted-foreground mb-2">اختر حالة الحوض</div>
        <div className="grid grid-cols-2 gap-2">
          {opts.map((o) => (
            <button key={o.v} type="button" onClick={() => setStatus(o.v)}
              className={`rounded-xl p-3 text-sm border transition ${status === o.v ? "border-gold bg-gold/10" : "border-white/10 hover:bg-white/5"}`}>
              <div className="text-xl leading-none mb-1">{o.e}</div>{o.l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-2">ملاحظة (اختياري)</div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="اكتب ملاحظة اختيارية…"
          className="w-full glass rounded-xl p-3 text-sm bg-transparent resize-none" rows={3} />
      </div>
      <div className="sticky bottom-0 -mx-5 -mb-4 px-5 pt-3 pb-4 bg-background/95 backdrop-blur border-t border-white/10">
        <button disabled={busy} onClick={save} className="btn-gold rounded-xl w-full py-3 text-sm flex items-center justify-center gap-2">
          {busy && <Loader2 size={16} className="animate-spin" />} حفظ التحديث
        </button>
      </div>
    </div>
  );
}

function WaterChangeForm({ tank, onDone }: { tank: TankLite; onDone: () => void }) {
  const [pct, setPct] = useState<number | "custom">(20);
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    const u = await uid(); if (!u) return;
    setBusy(true);
    try {
      const value = pct === "custom" ? Number(custom) : pct;
      const paths: string[] = [];
      for (const f of files) paths.push(await uploadMedia(f, `tank-${tank.id}/water`));
      const { error } = await supabase.from("aquarium_care_logs").insert({
        tank_id: tank.id, user_id: u, log_type: "water_change",
        water_change_percentage: isNaN(value) ? null : value,
        note: note || null, image_paths: paths.length ? paths : null,
      });
      if (error) throw error;
      const days = WC_DAYS_BY_TYPE[tank.tank_type ?? ""] ?? 7;
      const due = new Date(Date.now() + days * 86400000).toISOString();
      await supabase.from("aquarium_tasks").insert({
        tank_id: tank.id, user_id: u, task_type: "water_change",
        title: "تغيير ماء", due_date: due, status: "pending",
      });
      toast.success("تم تسجيل تغيير الماء ✅");
      toast(`الموعد المقترح للتغيير القادم بعد ${days} أيام.`);
      onDone();
    } catch (e: any) { toast.error(e?.message ?? "تعذر الحفظ"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm">كم غيرت من الماء؟</div>
      <div className="grid grid-cols-5 gap-2">
        {[10, 20, 30, 50].map((v) => (
          <button key={v} type="button" onClick={() => setPct(v)}
            className={`rounded-xl py-2 text-sm border ${pct === v ? "border-gold bg-gold/10" : "border-white/10 hover:bg-white/5"}`}>
            {v}%
          </button>
        ))}
        <button type="button" onClick={() => setPct("custom")}
          className={`rounded-xl py-2 text-sm border ${pct === "custom" ? "border-gold bg-gold/10" : "border-white/10 hover:bg-white/5"}`}>
          مخصص
        </button>
      </div>
      {pct === "custom" && (
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="النسبة (%)"
          className="w-full glass rounded-xl p-2.5 text-sm bg-transparent" inputMode="decimal" />
      )}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة اختيارية"
        className="w-full glass rounded-xl p-3 text-sm bg-transparent" rows={2} />
      <div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        <button type="button" onClick={() => fileRef.current?.click()}
          className="glass rounded-xl px-3 py-2 text-xs flex items-center gap-1.5">
          <ImageIcon size={14} /> إضافة صور {files.length > 0 && `(${files.length})`}
        </button>
      </div>
      <button disabled={busy} onClick={save} className="btn-gold rounded-xl w-full py-2.5 text-sm flex items-center justify-center gap-2">
        {busy && <Loader2 size={16} className="animate-spin" />} حفظ
      </button>
    </div>
  );
}

function ReadingForm({ tank, onDone }: { tank: TankLite; onDone: () => void }) {
  const isMarine = tank.tank_type === "marine";
  const fields: { k: string; l: string }[] = isMarine
    ? [
        { k: "temperature", l: "Temperature °C" },
        { k: "salinity", l: "Salinity (SG)" },
        { k: "kh", l: "KH" },
        { k: "calcium", l: "Calcium" },
        { k: "magnesium", l: "Magnesium" },
        { k: "nitrate", l: "Nitrate" },
        { k: "phosphate", l: "Phosphate" },
        { k: "ph", l: "pH" },
      ]
    : [
        { k: "temperature", l: "Temperature °C" },
        { k: "ph", l: "pH" },
        { k: "ammonia", l: "Ammonia" },
        { k: "nitrite", l: "Nitrite" },
        { k: "nitrate", l: "Nitrate" },
        { k: "tds", l: "TDS (اختياري)" },
      ];
  const [vals, setVals] = useState<Record<string, string>>({});
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setVals((s) => ({ ...s, [k]: v }));

  const save = async () => {
    const u = await uid(); if (!u) return;
    const filled = Object.values(vals).some((v) => v && v.trim() !== "");
    if (!filled) { toast.error("أدخل قراءة واحدة على الأقل"); return; }
    setBusy(true);
    const row: any = {
      tank_id: tank.id, user_id: u,
      reading_date: new Date(date).toISOString(), note: note || null,
    };
    for (const f of fields) {
      const v = vals[f.k];
      if (v && v.trim() !== "") row[f.k] = Number(v);
    }
    const { data, error } = await supabase.from("aquarium_readings").insert(row).select().single();
    setBusy(false);
    if (error) { toast.error("تعذر الحفظ"); return; }
    toast.success("تم حفظ القراءات ✅");
    if (data && readingOutOfRange(data as Reading)) {
      toast("بعض القراءات قد تحتاج متابعة. يمكنك طلب استشارة من Aqua Haven عند الحاجة.");
    }
    onDone();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f) => (
          <label key={f.k} className="text-xs">
            <div className="text-muted-foreground mb-1">{f.l}</div>
            <input value={vals[f.k] ?? ""} onChange={(e) => set(f.k, e.target.value)}
              inputMode="decimal" className="w-full glass rounded-xl p-2 text-sm bg-transparent" />
          </label>
        ))}
      </div>
      <label className="text-xs block">
        <div className="text-muted-foreground mb-1">تاريخ القراءة</div>
        <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full glass rounded-xl p-2 text-sm bg-transparent" />
      </label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة اختيارية"
        className="w-full glass rounded-xl p-3 text-sm bg-transparent" rows={2} />
      <button disabled={busy} onClick={save} className="btn-gold rounded-xl w-full py-2.5 text-sm flex items-center justify-center gap-2">
        {busy && <Loader2 size={16} className="animate-spin" />} حفظ القراءة
      </button>
    </div>
  );
}

function PhotoForm({ tank, onDone }: { tank: TankLite; onDone: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const save = async () => {
    const u = await uid(); if (!u) return;
    if (files.length === 0) { toast.error("اختر صورة"); return; }
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const f of files) paths.push(await uploadMedia(f, `tank-${tank.id}/photos`));
      const { error } = await supabase.from("aquarium_care_logs").insert({
        tank_id: tank.id, user_id: u, log_type: "photo",
        image_paths: paths, note: note || null,
      });
      if (error) throw error;
      toast.success("تم حفظ صورة الحوض ✅");
      onDone();
    } catch (e: any) { toast.error(e?.message ?? "تعذر الرفع"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <input ref={ref} type="file" accept="image/*" multiple hidden
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      <button type="button" onClick={() => ref.current?.click()}
        className="glass rounded-xl w-full py-6 text-sm flex flex-col items-center gap-2 hover:bg-white/5">
        <Camera size={22} className="text-gold" />
        {files.length === 0 ? "اضغط لاختيار صور" : `تم اختيار ${files.length} صورة`}
      </button>
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {files.map((f, i) => (
            <div key={i} className="aspect-square rounded-lg overflow-hidden border border-white/10">
              <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      )}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة اختيارية"
        className="w-full glass rounded-xl p-3 text-sm bg-transparent" rows={2} />
      <button disabled={busy} onClick={save} className="btn-gold rounded-xl w-full py-2.5 text-sm flex items-center justify-center gap-2">
        {busy && <Loader2 size={16} className="animate-spin" />} حفظ
      </button>
    </div>
  );
}

function NoteForm({ tank, onDone }: { tank: TankLite; onDone: () => void }) {
  const [category, setCategory] = useState("general");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const cats = [
    { v: "general", l: "عامة" }, { v: "fish", l: "السمك" },
    { v: "plants", l: "النبات" }, { v: "water", l: "الماء" },
    { v: "equipment", l: "الجهاز" }, { v: "other", l: "أخرى" },
  ];
  const save = async () => {
    const u = await uid(); if (!u) return;
    if (!text.trim()) { toast.error("اكتب نص الملاحظة"); return; }
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const f of files) paths.push(await uploadMedia(f, `tank-${tank.id}/notes`));
      const { error } = await supabase.from("aquarium_care_logs").insert({
        tank_id: tank.id, user_id: u, log_type: "note",
        note: text, note_category: category, image_paths: paths.length ? paths : null,
      });
      if (error) throw error;
      toast.success("تم حفظ الملاحظة.");
      onDone();
    } catch (e: any) { toast.error(e?.message ?? "تعذر الحفظ"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button key={c.v} type="button" onClick={() => setCategory(c.v)}
            className={`text-xs rounded-full px-3 py-1 border ${category === c.v ? "border-gold bg-gold/10" : "border-white/10 hover:bg-white/5"}`}>
            {c.l}
          </button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب ملاحظتك"
        className="w-full glass rounded-xl p-3 text-sm bg-transparent" rows={4} />
      <input ref={ref} type="file" accept="image/*" multiple hidden
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      <button type="button" onClick={() => ref.current?.click()}
        className="glass rounded-xl px-3 py-2 text-xs flex items-center gap-1.5">
        <ImageIcon size={14} /> إضافة صور {files.length > 0 && `(${files.length})`}
      </button>
      <button disabled={busy} onClick={save} className="btn-gold rounded-xl w-full py-2.5 text-sm flex items-center justify-center gap-2">
        {busy && <Loader2 size={16} className="animate-spin" />} حفظ الملاحظة
      </button>
    </div>
  );
}

function IssueForm({ tank, onDone }: { tank: TankLite; onDone: () => void }) {
  const [type, setType] = useState("water_clarity");
  const [desc, setDesc] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [followup, setFollowup] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const types = [
    { v: "water_clarity", l: "عكارة في الماء" },
    { v: "sick_fish", l: "سمكة تعبانة" },
    { v: "algae", l: "طحالب" },
    { v: "smell", l: "رائحة" },
    { v: "equipment", l: "فلتر / جهاز" },
    { v: "death", l: "موت كائنات" },
    { v: "other", l: "أخرى" },
  ];
  const save = async () => {
    const u = await uid(); if (!u) return;
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const f of files) paths.push(await uploadMedia(f, `tank-${tank.id}/issues`));
      const { error } = await supabase.from("aquarium_issues").insert({
        tank_id: tank.id, user_id: u, issue_type: type,
        description: desc || null, status: "open",
        wants_followup: followup, image_paths: paths.length ? paths : null,
      });
      if (error) throw error;
      toast.success("تم تسجيل المشكلة.");
      if (followup) toast("سيتم ربطها بطلب متابعة في المرحلة القادمة.");
      onDone();
    } catch (e: any) { toast.error(e?.message ?? "تعذر الحفظ"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div className="text-sm">ما نوع المشكلة؟</div>
      <div className="flex flex-wrap gap-1.5">
        {types.map((t) => (
          <button key={t.v} type="button" onClick={() => setType(t.v)}
            className={`text-xs rounded-full px-3 py-1 border ${type === t.v ? "border-gold bg-gold/10" : "border-white/10 hover:bg-white/5"}`}>
            {t.l}
          </button>
        ))}
      </div>
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="وصف المشكلة"
        className="w-full glass rounded-xl p-3 text-sm bg-transparent" rows={4} />
      <input ref={ref} type="file" accept="image/*,video/*" multiple hidden
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      <button type="button" onClick={() => ref.current?.click()}
        className="glass rounded-xl px-3 py-2 text-xs flex items-center gap-1.5">
        <ImageIcon size={14} /> إضافة صور {files.length > 0 && `(${files.length})`}
      </button>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={followup} onChange={(e) => setFollowup(e.target.checked)} />
        أرغب بطلب متابعة من Aqua Haven
      </label>
      <button disabled={busy} onClick={save} className="btn-gold rounded-xl w-full py-2.5 text-sm flex items-center justify-center gap-2">
        {busy && <Loader2 size={16} className="animate-spin" />} حفظ
      </button>
    </div>
  );
}

// ---------- Timeline ----------

type EventItem = {
  id: string; kind: string; date: string; title: string;
  detail?: string; image?: string | null;
};

function CareTimeline({ logs, readings, issues }: { logs: CareLog[]; readings: Reading[]; issues: Issue[] }) {
  const items = useMemo<EventItem[]>(() => {
    const a: EventItem[] = [];
    for (const l of logs) {
      const img = l.image_paths?.[0] ?? null;
      if (l.log_type === "water_change") {
        a.push({ id: l.id, kind: "water", date: l.created_at,
          title: `تم تسجيل تغيير ماء${l.water_change_percentage ? ` (${l.water_change_percentage}%)` : ""}`,
          detail: l.note ?? undefined, image: img });
      } else if (l.log_type === "photo") {
        a.push({ id: l.id, kind: "photo", date: l.created_at, title: "تم رفع صورة", detail: l.note ?? undefined, image: img });
      } else if (l.log_type === "note") {
        a.push({ id: l.id, kind: "note", date: l.created_at, title: "تم إضافة ملاحظة", detail: l.note ?? undefined, image: img });
      } else if (l.log_type === "status_update") {
        a.push({ id: l.id, kind: "status", date: l.created_at,
          title: `تم تحديث حالة الحوض: ${STATUS_META[(l.status as Status) ?? "normal"]?.label ?? l.status}`,
          detail: l.note ?? undefined });
      }
    }
    for (const r of readings) {
      const summary = [
        r.ph != null && `pH ${r.ph}`, r.nitrate != null && `NO3 ${r.nitrate}`,
        r.ammonia != null && `NH3 ${r.ammonia}`, r.temperature != null && `${r.temperature}°C`,
        r.salinity != null && `SG ${r.salinity}`,
      ].filter(Boolean).join(" · ");
      a.push({ id: "r-" + r.id, kind: "reading", date: r.reading_date, title: "تم تسجيل قراءة", detail: summary });
    }
    for (const i of issues) {
      a.push({ id: "i-" + i.id, kind: "issue", date: i.created_at, title: `تم تسجيل مشكلة: ${i.issue_type}`,
        detail: i.description ?? undefined, image: i.image_paths?.[0] ?? null });
    }
    return a.sort((x, y) => +new Date(y.date) - +new Date(x.date)).slice(0, 12);
  }, [logs, readings, issues]);

  const ICONS: Record<string, React.ReactNode> = {
    water: <Droplets size={14} />, reading: <FlaskConical size={14} />,
    photo: <Camera size={14} />, note: <StickyNote size={14} />,
    issue: <AlertTriangle size={14} />, status: <CheckCircle2 size={14} />,
  };

  if (items.length === 0) return null;

  return (
    <div className="pt-2">
      <h3 className="text-sm font-bold mb-2">سجل العناية</h3>
      <ul className="space-y-2">
        {items.map((e) => (
          <li key={e.id} className="glass rounded-xl p-3 flex gap-3 items-start">
            <div className="h-7 w-7 rounded-full bg-gold/10 text-gold grid place-items-center shrink-0">{ICONS[e.kind]}</div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-sm font-medium">{e.title}</div>
                <div className="text-[11px] text-muted-foreground">{ago(e.date)}</div>
              </div>
              {e.detail && <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{e.detail}</div>}
            </div>
            {e.image && (
              <a href={publicUrl(e.image)} target="_blank" rel="noreferrer" className="shrink-0">
                <img src={publicUrl(e.image)} alt="" className="h-12 w-12 rounded-lg object-cover border border-white/10" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
