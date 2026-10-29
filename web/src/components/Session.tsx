import { useEffect, useMemo, useRef, useState } from "react";
import type { DB, Entry, Exercise, Group, Kind, Session, SetLog, Target } from "../../../shared/types.ts";
import { agoLabel, DAYS, exMap, fmtDate, fmtRangeT, fmtSets, fmtTargets, fmtW, GROUP_LABEL, history, isFree, KIND_LABEL, newEntry, nextOf, nextPresets, prsIn, setsByGroup, suggestNext } from "../../../shared/logic.ts";
import { clock, cx, dayColor, useNow, useSaveExercise, useSync } from "../lib.ts";
import { Choice, input, Kg, pill, pillSm, RangePicker, Sheet, WeightStepper } from "./ui.tsx";

/** The logging surface. Used live at the gym and for fixing past sessions. */
export function SessionEditor({ db, session, onChange, live }: { db: DB; session: Session; onChange: (s: Session) => void; live: boolean }) {
  const m = useMemo(() => exMap(db), [db]);
  const firstOpen = session.entries.findIndex((e) => e.sets.length < Math.max(1, e.plan?.length ?? 0));
  const [open, setOpen] = useState<number | null>(live ? Math.max(0, firstOpen) : null);
  const [adding, setAdding] = useState(false);

  const setEntry = (i: number, e: Entry | null) => {
    const entries = [...session.entries];
    if (e) entries[i] = e;
    else entries.splice(i, 1);
    onChange({ ...session, entries });
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= session.entries.length) return;
    const entries = [...session.entries];
    [entries[i], entries[j]] = [entries[j], entries[i]];
    onChange({ ...session, entries });
    setOpen(j);
  };
  const add = (ex: Exercise) => {
    onChange({ ...session, entries: [...session.entries, newEntry(db, ex, session.mode)] });
    setOpen(session.entries.length);
    setAdding(false);
  };

  const legsQuiet = live && session.day !== "legs" && setsByGroup(db, 30).legs === 0 && !session.entries.some((e) => m.get(e.ex)?.group === "legs");
  const legPress = m.get("leg-press");

  return (
    <div className="space-y-2.5">
      {session.entries.map((e, i) => {
        const ex = m.get(e.ex);
        if (!ex) return null;
        return (
          <ExerciseCard
            key={e.ex + i}
            db={db}
            session={session}
            ex={ex}
            entry={e}
            open={open === i}
            live={live}
            onToggle={() => setOpen(open === i ? null : i)}
            onChange={(x) => setEntry(i, x)}
            onDone={() => {
              const next = session.entries.findIndex((x, j) => j > i && x.sets.length === 0);
              setOpen(next >= 0 ? next : null);
            }}
            onMove={(d) => move(i, d)}
            first={i === 0}
            last={i === session.entries.length - 1}
          />
        );
      })}

      {!session.entries.length && <p className="px-1 py-6 text-center text-mute">Nothing planned. Add the first exercise when you're at the machine.</p>}

      <button onClick={() => setAdding(true)} className="flex h-14 w-full items-center justify-center rounded-2xl border-2 border-dashed border-rule text-lg font-medium text-chalk active:bg-mat hover:bg-mat">
        + Add exercise
      </button>

      {legsQuiet && legPress && (
        <button onClick={() => add(legPress)} className="flex w-full items-center gap-3 rounded-2xl bg-mat/60 px-4 py-3.5 text-left text-sm text-mute active:bg-bench">
          <span className="h-8 w-1.5 shrink-0 rounded-full bg-yellow" />
          <span>
            <span className="font-medium text-chalk">Add leg press as a finisher?</span> No leg sets in a month. Two light sets count.
          </span>
        </button>
      )}

      <AddExerciseSheet db={db} session={session} open={adding} onClose={() => setAdding(false)} onPick={add} />
    </div>
  );
}

function ExerciseCard(props: {
  db: DB;
  session: Session;
  ex: Exercise;
  entry: Entry;
  open: boolean;
  live: boolean;
  first: boolean;
  last: boolean;
  onToggle: () => void;
  onChange: (e: Entry | null) => void;
  onDone: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  const { db, session, ex, entry, open, onChange } = props;
  const plan = entry.plan ?? [];
  const prev = useMemo(() => history(db, ex.id, session.id).find((h) => h.session.date < session.date), [db, ex.id, session.id, session.date]);
  const planned = Math.max(plan.length, 1);
  const finished = entry.sets.length >= planned;
  const pr = entry.sets.length ? prsIn(db, session, entry) : undefined;
  const canMoveOn = entry.sets.length > 0 && props.live;

  return (
    <section className={cx("rounded-2xl bg-mat", open && "ring-1 ring-rule")}>
      <button onClick={props.onToggle} className="flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left active:bg-bench/50" aria-expanded={open}>
        <Progress done={entry.sets.length} planned={planned} />
        <div className="min-w-0 flex-1">
          <h3 className="num text-[1.6rem] leading-[1.1]">{ex.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-mute">
            <span className={cx("rounded-md px-1.5 py-px text-xs font-semibold", isFree(ex) ? "bg-chalk/10 text-chalk" : "bg-floor text-mute")}>{ex.oneoff ? "One-off" : KIND_LABEL[ex.kind]}</span>
            {pr && <span className="rounded-md bg-green/15 px-1.5 py-px text-xs font-semibold text-green">Best ever</span>}
            <span>{entry.sets.length ? <span className="text-chalk">{fmtSets(entry.sets)}</span> : !props.live ? "Skipped" : plan.length ? <>Today {fmtTargets(plan)}</> : "No sets yet"}</span>
          </div>
          {ex.note && !open && <p className="mt-1.5 line-clamp-2 border-l-2 border-chalk/60 pl-2 text-sm whitespace-pre-line text-chalk">{ex.note}</p>}
        </div>
        <span className={cx("mt-1 text-xl text-faint transition-transform", open && "rotate-180")} aria-hidden>
          ⌄
        </span>
      </button>

      {open && (
        <div className="space-y-4 px-3 pb-4 sm:px-4">
          <StandingNote ex={ex} />
          <LastTime prev={prev} ex={ex} />
          <Sets {...props} plan={plan} />
          {entry.sets.length > 0 && <NextTime ex={ex} entry={entry} onChange={onChange} />}
          <div className="flex items-center gap-2">
            {canMoveOn ? (
              <button onClick={props.onDone} className={cx("h-12 min-w-0 flex-1 rounded-xl font-semibold", finished ? "bg-chalk text-floor" : "bg-bench text-chalk")}>
                {finished ? "Next exercise" : "Done with this"}
              </button>
            ) : (
              <span className="flex-1" />
            )}
            <button disabled={props.first} onClick={() => props.onMove(-1)} className={cx(pill, "w-12 shrink-0 px-0 text-xl disabled:opacity-30")} aria-label="Move up">
              ↑
            </button>
            <button disabled={props.last} onClick={() => props.onMove(1)} className={cx(pill, "w-12 shrink-0 px-0 text-xl disabled:opacity-30")} aria-label="Move down">
              ↓
            </button>
            <RemoveButton onRemove={() => onChange(null)} />
          </div>
        </div>
      )}
    </section>
  );
}

function RemoveButton({ onRemove }: { onRemove: () => void }) {
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!sure) return;
    const t = setTimeout(() => setSure(false), 3000);
    return () => clearTimeout(t);
  }, [sure]);
  return (
    <button onClick={() => (sure ? onRemove() : setSure(true))} className={cx(pill, "shrink-0", sure && "bg-red/20 text-red")}>
      {sure ? "Sure?" : "Remove"}
    </button>
  );
}

/** Sets done out of planned; a filled green plate when complete. */
function Progress({ done, planned }: { done: number; planned: number }) {
  const full = done >= planned;
  return (
    <div
      className={cx("num mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-base", full ? "bg-green text-floor" : done ? "text-chalk ring-2 ring-green ring-inset" : "text-mute ring-2 ring-rule ring-inset")}
      aria-label={`${done} of ${planned} sets`}
    >
      {full ? "✓" : `${done}/${planned}`}
    </div>
  );
}

/** A note that belongs to the exercise, not the session: seat position, form cues. Shown every time. */
function StandingNote({ ex }: { ex: Exercise }) {
  const save = useSaveExercise();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(ex.note ?? "");
  useEffect(() => setText(ex.note ?? ""), [ex.note]);
  const commit = () => {
    const note = text.trim() || undefined;
    if (note !== ex.note) void save({ ...ex, note });
    setEditing(false);
  };

  if (editing)
    return (
      <div className="space-y-2 rounded-xl border-l-4 border-chalk bg-floor/60 p-3">
        <div className="text-sm text-mute">Shown every time you do {ex.name.toLowerCase()}</div>
        <textarea autoFocus rows={3} className={cx(input, "h-auto py-3")} placeholder="Seat on 4, keep elbows down…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setText(ex.note ?? "");
              setEditing(false);
            }}
            className={cx(pill, "h-12")}
          >
            Cancel
          </button>
          <button onClick={commit} className="h-12 rounded-xl bg-chalk font-semibold text-floor">
            Save note
          </button>
        </div>
      </div>
    );
  if (!ex.note)
    return (
      <button onClick={() => setEditing(true)} className="flex h-12 w-full items-center gap-2 rounded-xl border-2 border-dashed border-rule px-3.5 text-left text-mute active:bg-bench">
        <span className="text-lg text-chalk">+</span> Note that stays (seat position, form cue)
      </button>
    );
  return (
    <button onClick={() => setEditing(true)} className="flex w-full items-start gap-3 rounded-xl border-l-4 border-chalk bg-floor/60 px-3.5 py-3 text-left active:bg-bench" aria-label={`Exercise note: ${ex.note}. Tap to edit.`}>
      <span className="min-w-0 flex-1 text-[17px] leading-snug whitespace-pre-line text-chalk">{ex.note}</span>
      <span className="shrink-0 pt-0.5 text-sm text-faint">Edit</span>
    </button>
  );
}

function LastTime({ prev, ex }: { prev?: { session: Session; entry: Entry }; ex: Exercise }) {
  if (!prev)
    return (
      <p className="rounded-xl bg-floor/60 px-3.5 py-3 text-sm text-mute">
        First time logging this. Pick a weight you could do about {ex.range[1]} times; the app takes it from there.
      </p>
    );
  return (
    <div className="rounded-xl bg-floor/60 px-3.5 py-3">
      <div className="text-sm text-mute">Last time, {prev.session.approx ? "from old notes" : agoLabel(prev.session.date)}</div>
      <div className="num mt-0.5 text-xl leading-snug">{fmtSets(prev.entry.sets)}</div>
      {prev.entry.note && <p className="mt-1 text-chalk">“{prev.entry.note}”</p>}
      {prev.session.approx && <p className="mt-1 text-sm text-faint">Old notes can be off. Fix the weight if it looks wrong.</p>}
    </div>
  );
}

function Sets(props: { ex: Exercise; entry: Entry; plan: Target[]; onChange: (e: Entry | null) => void }) {
  const { ex, entry, plan, onChange } = props;
  const [editing, setEditing] = useState<number | null>(null);
  const [extra, setExtra] = useState(0);
  const rows = Math.max(plan.length, entry.sets.length + (entry.sets.length >= plan.length ? extra : 0), entry.sets.length + (plan.length ? 0 : 1));
  const active = entry.sets.length < rows ? entry.sets.length : null;
  const targetAt = (i: number): Target => {
    const t = plan[i] ?? plan[plan.length - 1];
    const lastW = entry.sets[entry.sets.length - 1]?.w;
    return { w: plan[i]?.w ?? lastW ?? t?.w ?? ex.inc * 2, lo: t?.lo ?? ex.range[0], hi: t?.hi ?? ex.range[1] };
  };

  const log = (i: number, s: SetLog) => {
    const sets = [...entry.sets];
    sets[i] = { ...s, t: sets[i]?.t ?? Date.now() };
    onChange({ ...entry, sets });
    setEditing(null);
    if (i >= plan.length) setExtra(0);
  };
  const remove = (i: number) => {
    onChange({ ...entry, sets: entry.sets.filter((_, j) => j !== i) });
    setEditing(null);
  };
  /** Correcting the program mid-session: changes this set's aim, and next time's (which starts from it). */
  const setAim = (i: number, lo: number, hi: number) => {
    const p = Array.from({ length: Math.max(plan.length, i + 1) }, (_, k) => plan[k] ?? targetAt(k));
    p[i] = { ...p[i], lo, hi };
    const next = entry.next?.map((t, k) => (k === i ? { ...t, lo, hi } : t));
    onChange({ ...entry, plan: p, next });
  };

  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => {
        const t = targetAt(i);
        const s = entry.sets[i];
        if (s && editing !== i)
          return (
            <button key={i} onClick={() => setEditing(i)} className="settle flex min-h-14 w-full items-center gap-3 rounded-xl bg-bench/70 px-3.5 py-2 text-left active:bg-rule" aria-label={`Set ${i + 1}: ${fmtW(s.w)} kilos, ${s.r} reps. Tap to change.`}>
              <span className="w-11 shrink-0 text-sm text-mute">Set {i + 1}</span>
              <span className="num text-2xl whitespace-nowrap">
                <Kg w={s.w} /> <span className="text-mute">×</span> {s.r}
              </span>
              <span className="flex-1" />
              <Verdict s={s} t={t} />
              <span className="text-sm text-faint" aria-hidden>
                Edit
              </span>
            </button>
          );
        if (s || i === active)
          return <SetInput key={i} index={i} ex={ex} target={t} initial={s} onAim={(lo, hi) => setAim(i, lo, hi)} onLog={(x) => log(i, x)} onRemove={s ? () => remove(i) : undefined} onCancel={s ? () => setEditing(null) : undefined} />;
        return (
          <div key={i} className="flex min-h-11 items-center gap-3 rounded-xl border border-dashed border-rule px-3.5 text-faint">
            <span className="w-11 shrink-0 text-sm">Set {i + 1}</span>
            <span className="num text-xl whitespace-nowrap">
              {fmtW(t.w)}kg × {fmtRangeT(t)}
            </span>
          </div>
        );
      })}
      {active === null && editing === null && (
        <button onClick={() => setExtra(extra + 1)} className="flex h-12 w-full items-center justify-center rounded-xl border-2 border-dashed border-rule font-medium text-chalk active:bg-bench">
          + Another set
        </button>
      )}
    </div>
  );
}

function Verdict({ s, t }: { s: SetLog; t: Target }) {
  if (s.r >= t.hi) return <span className="text-sm font-medium text-green">Top</span>;
  if (s.r >= t.lo) return <span className="text-sm text-mute">In range</span>;
  return <span className="text-sm text-amber">Under {t.lo}</span>;
}

/** Weight stepper plus a strip of rep numbers. Tapping a number logs the set: one tap when the weight is right. */
function SetInput({ index, ex, target, initial, onAim, onLog, onRemove, onCancel }: { index: number; ex: Exercise; target: Target; initial?: SetLog; onAim: (lo: number, hi: number) => void; onLog: (s: SetLog) => void; onRemove?: () => void; onCancel?: () => void }) {
  const [w, setW] = useState(initial?.w ?? target.w);
  const [aiming, setAiming] = useState(false);
  useEffect(() => setW(initial?.w ?? target.w), [target.w, initial?.w]);
  const lo = Math.max(1, target.lo - 4);
  const reps = Array.from({ length: target.hi + 4 - lo + 1 }, (_, k) => lo + k);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>(`[data-r="${Math.max(lo, target.lo - 2)}"]`);
    if (el && strip.current) strip.current.scrollLeft = el.offsetLeft - 12;
  }, [target.lo]);

  return (
    <div className="rounded-2xl bg-bench p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">Set {index + 1}</span>
        <button onClick={() => setAiming(!aiming)} className={cx(pillSm, "bg-floor")} aria-expanded={aiming}>
          Aim <span className="num ml-1.5 text-lg">{fmtRangeT(target)}</span>
          <span className="ml-2 text-mute">{aiming ? "Done" : "Change"}</span>
        </button>
      </div>
      {aiming && (
        <div className="mt-3">
          <RangePicker
            lo={target.lo}
            hi={target.hi}
            onChange={(a, b) => {
              onAim(a, b);
              setAiming(false);
            }}
          />
        </div>
      )}
      <div className="mt-3">
        <WeightStepper value={w} ex={ex} onChange={setW} />
      </div>
      <div className="mt-4 mb-1.5 text-sm text-mute">Tap the reps you did</div>
      <div ref={strip} className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 py-1">
        {reps.map((r) => {
          const inRange = r >= target.lo && r <= target.hi;
          return (
            <button
              key={r}
              data-r={r}
              onClick={() => onLog({ w, r })}
              className={cx(
                "num h-14 min-w-14 shrink-0 rounded-xl text-[1.7rem]",
                initial?.r === r ? "bg-chalk text-floor" : inRange ? "bg-floor text-chalk ring-2 ring-mute/70 ring-inset" : "bg-floor/60 text-mute",
              )}
              aria-label={`${r} reps`}
            >
              {r}
            </button>
          );
        })}
      </div>
      {(onRemove || onCancel) && (
        <div className="mt-2 flex gap-2">
          {onRemove && (
            <button onClick={onRemove} className={cx(pill, "flex-1 bg-floor text-red")}>
              Delete set
            </button>
          )}
          {onCancel && (
            <button onClick={onCancel} className={cx(pill, "flex-1 bg-floor")}>
              Keep as is
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The structured replacement for "(12 on the second, 12-15)". Defaults to the same; one tap to bump. */
function NextTime({ ex, entry, onChange }: { ex: Exercise; entry: Entry; onChange: (e: Entry) => void }) {
  const presets = nextPresets(entry, ex);
  const next = nextOf(entry, ex);
  const [edit, setEdit] = useState<number | null>(null);
  const same = (a: Target[], b: Target[]) => JSON.stringify(a) === JSON.stringify(b);
  const picked = presets.find((p) => same(p.ts, next))?.key;
  const set = (ts: Target[]) => onChange({ ...entry, next: same(ts, presets[0].ts) ? undefined : ts });
  const topped = suggestNext(entry, ex)
    .map((t, i) => (t.w > entry.sets[i].w ? i + 1 : 0))
    .filter(Boolean);

  return (
    <div className="space-y-3 rounded-2xl border border-rule p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">Next time</span>
        {!picked && <span className="text-sm text-mute">Custom</span>}
      </div>
      <Choice value={picked} options={presets.map((p) => ({ value: p.key, label: p.label }))} onChange={(k) => set(presets.find((p) => p.key === k)!.ts)} />
      {topped.length > 0 && <p className="text-sm text-green">Hit the top of the range on set {topped.join(" and ")}.</p>}

      <div className="space-y-1.5">
        {next.map((t, i) => {
          const was = entry.sets[i]?.w ?? t.w;
          const dir = t.w > was ? "up" : t.w < was ? "down" : "same";
          return (
            <div key={i}>
              <button onClick={() => setEdit(edit === i ? null : i)} className={cx("flex min-h-12 w-full items-center gap-3 rounded-xl bg-bench px-3.5 text-left active:bg-rule", edit === i && "ring-2 ring-chalk ring-inset")} aria-expanded={edit === i}>
                <span className="w-11 shrink-0 text-sm text-mute">Set {i + 1}</span>
                <span className="num text-xl whitespace-nowrap">
                  <Kg w={t.w} /> × {fmtRangeT(t)}
                </span>
                <span className={cx("text-sm whitespace-nowrap", dir === "up" ? "text-green" : dir === "down" ? "text-amber" : "text-faint")}>{dir === "up" ? "▲ up" : dir === "down" ? "▼ down" : ""}</span>
                <span className="flex-1" />
                <span className="text-sm text-faint">{edit === i ? "Done" : "Change"}</span>
              </button>
              {edit === i && (
                <div className="mt-1.5 space-y-3 rounded-xl bg-floor/60 p-3">
                  <WeightStepper value={t.w} ex={ex} onChange={(w) => set(next.map((x, k) => (k === i ? { ...x, w } : x)))} />
                  <div>
                    <div className="mb-1.5 text-sm text-mute">Aim</div>
                    <RangePicker lo={t.lo} hi={t.hi} onChange={(lo, hi) => set(next.map((x, k) => (k === i ? { ...x, lo, hi } : x)))} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <textarea
        rows={2}
        className={cx(input, "h-auto py-3")}
        placeholder="Note for next time (seat 3, felt it in the shoulder…)"
        value={entry.note ?? ""}
        onChange={(e) => onChange({ ...entry, note: e.target.value || undefined })}
      />
    </div>
  );
}

const GROUPS: Group[] = ["chest", "back", "shoulders", "biceps", "triceps", "traps", "core", "legs", "other"];
const KINDS: { value: Kind; label: string }[] = [
  { value: "machine", label: "Machine" },
  { value: "cable", label: "Cable" },
  { value: "dumbbell", label: "Dumbbells" },
  { value: "barbell", label: "Barbell" },
];

function AddExerciseSheet({ db, session, open, onClose, onPick }: { db: DB; session: Session; open: boolean; onClose: () => void; onPick: (e: Exercise) => void }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"list" | "new" | "oneoff">("list");
  const saveExercise = useSaveExercise();
  const inSession = new Set(session.entries.map((e) => e.ex));
  const list = db.exercises.filter((e) => !e.archived && !e.oneoff && !inSession.has(e.id) && e.name.toLowerCase().includes(q.toLowerCase()));
  const sameDay = list.filter((e) => session.day && e.day === session.day);
  const rest = list.filter((e) => !sameDay.includes(e)).sort((a, b) => a.name.localeCompare(b.name));
  const reset = () => {
    setQ("");
    setMode("list");
  };
  const pick = (ex: Exercise) => {
    onPick(ex);
    reset();
  };
  const create = (ex: Omit<Exercise, "id">) => {
    const id = ex.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36).slice(-4);
    const full = { ...ex, id };
    void saveExercise(full);
    pick(full);
  };

  const Row = ({ e }: { e: Exercise }) => {
    const h = history(db, e.id)[0];
    return (
      <button onClick={() => pick(e)} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left active:bg-bench hover:bg-bench">
        <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: dayColor(e.day) }} />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{e.name}</span>
          <span className="block truncate text-sm text-mute">{h ? fmtSets(h.entry.sets) : GROUP_LABEL[e.group]}</span>
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bench text-xl text-chalk" aria-hidden>
          +
        </span>
      </button>
    );
  };
  const Section = ({ title, items }: { title: string; items: Exercise[] }) =>
    items.length ? (
      <div>
        <h3 className="px-3 pt-4 pb-1 text-sm font-semibold text-mute">{title}</h3>
        {items.map((e) => (
          <Row key={e.id} e={e} />
        ))}
      </div>
    ) : null;

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={mode === "new" ? "New exercise" : mode === "oneoff" ? "One-off" : "Add exercise"}
    >
      {mode === "list" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode("new")} className={cx(pill, "h-12")}>
              + New exercise
            </button>
            <button onClick={() => setMode("oneoff")} className={cx(pill, "h-12")}>
              + One-off
            </button>
          </div>
          <input className={cx(input, "mt-3")} placeholder="Filter the list" value={q} onChange={(e) => setQ(e.target.value)} />
          {session.day && <Section title={`Usually on ${DAYS[session.day].label.toLowerCase()}`} items={sameDay} />}
          <Section title="Machines and cables" items={rest.filter((e) => !isFree(e))} />
          <Section title="Free weights" items={rest.filter(isFree)} />
          {!list.length && <p className="px-3 pt-4 text-mute">Nothing matches. Add it as a new exercise or a one-off.</p>}
        </>
      )}
      {mode === "new" && <NewExercise initial={q} day={session.day ?? undefined} onCancel={() => setMode("list")} onCreate={create} />}
      {mode === "oneoff" && <OneOff onCancel={() => setMode("list")} onCreate={(name) => create({ name, group: "other", kind: "machine", inc: 5, range: [8, 12], oneoff: true })} />}
    </Sheet>
  );
}

function NewExercise({ initial, day, onCancel, onCreate }: { initial: string; day?: Exercise["day"]; onCancel: () => void; onCreate: (e: Omit<Exercise, "id">) => void }) {
  const [name, setName] = useState(initial);
  const [kind, setKind] = useState<Kind>("machine");
  const [group, setGroup] = useState<Group>("chest");
  const free = kind === "dumbbell" || kind === "barbell";
  return (
    <div className="space-y-4">
      <input autoFocus className={input} placeholder="Name, e.g. Pec deck" value={name} onChange={(e) => setName(e.target.value)} />
      <div>
        <div className="mb-1.5 text-sm text-mute">Equipment</div>
        <div className="grid grid-cols-2 gap-1.5">
          {KINDS.map((k) => (
            <button key={k.value} onClick={() => setKind(k.value)} className={cx("h-12 rounded-xl font-medium", k.value === kind ? "bg-chalk text-floor" : "bg-bench active:bg-rule")}>
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-sm text-mute">Muscle</div>
        <div className="grid grid-cols-3 gap-1.5">
          {GROUPS.map((g) => (
            <button key={g} onClick={() => setGroup(g)} className={cx("h-11 rounded-xl text-[15px] font-medium", g === group ? "bg-chalk text-floor" : "bg-bench active:bg-rule")}>
              {GROUP_LABEL[g]}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-mute">{free ? "Free weights move in 0.5 kg steps, with ±2.5 and ±5 jumps." : "Machines move 6 kg per step. You can change it later on the exercise page."}</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className={cx(pill, "h-12")}>
          Back to list
        </button>
        <button disabled={!name.trim()} onClick={() => onCreate({ name: name.trim(), kind, group, inc: free ? 2.5 : 6, range: [8, 10], day })} className="h-12 rounded-xl bg-chalk font-semibold text-floor disabled:opacity-40">
          Add to session
        </button>
      </div>
    </div>
  );
}

function OneOff({ onCancel, onCreate }: { onCancel: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="space-y-4">
      <p className="text-sm text-mute">For something you're trying once. It's logged with this session but stays out of lists and stats.</p>
      <input autoFocus className={input} placeholder="What is it?" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && onCreate(name.trim())} />
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className={cx(pill, "h-12")}>
          Back to list
        </button>
        <button disabled={!name.trim()} onClick={() => onCreate(name.trim())} className="h-12 rounded-xl bg-chalk font-semibold text-floor disabled:opacity-40">
          Add to session
        </button>
      </div>
    </div>
  );
}

export const lastSetAt = (s: Session) => Math.max(0, ...s.entries.flatMap((e) => e.sets.map((x) => x.t ?? 0)));

/** Sticky bar while training: what day, how long, rest since the last set, save state. */
export function SessionBar({ session, onFinish }: { session: Session; onFinish: () => void }) {
  const now = useNow();
  const sync = useSync();
  const lastT = lastSetAt(session);
  const label = session.day ? DAYS[session.day].label : "Session";
  return (
    <div className="safe-t sticky top-0 z-30 -mx-4 border-b border-rule bg-floor/95 px-4 backdrop-blur sm:mx-0 sm:rounded-b-2xl">
      <div className="flex items-center gap-3 py-2.5">
        <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: dayColor(session.day) }} />
        <div className="min-w-0 flex-1">
          <div className="num truncate text-xl leading-tight">
            {label}
            {session.mode !== "normal" && <span className="ml-2 font-sans text-sm font-medium text-mute">{session.mode === "deload" ? "deload" : "lighter"}</span>}
          </div>
          <div className="flex gap-3 text-sm text-mute">
            <span className="tabular-nums">{clock(now - new Date(session.date).getTime())}</span>
            {lastT > 0 && (
              <span className="tabular-nums">
                rest <span className="text-chalk">{clock(now - lastT)}</span>
              </span>
            )}
            <span className={cx("truncate", sync === "offline" ? "text-amber" : "text-faint")}>{sync === "offline" ? "on phone, will sync" : sync === "saving" ? "saving" : "saved"}</span>
          </div>
        </div>
        <button onClick={onFinish} className="h-11 shrink-0 rounded-xl bg-chalk px-5 font-semibold text-floor">
          Finish
        </button>
      </div>
    </div>
  );
}

export const FEEL = {
  body: ["Wrecked", "Tired", "OK", "Good", "Strong"],
  mind: ["Drained", "Meh", "OK", "Good", "Sharp"],
};

export function Rating({ label, words, value, onChange }: { label: string; words: string[]; value?: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-sm text-mute">{label}</div>
      <Choice size="lg" value={value} onChange={onChange} options={words.map((w, i) => ({ value: i + 1, label: <span className="num text-2xl leading-none">{i + 1}</span>, sub: w }))} />
    </div>
  );
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const hhmm = (t: number) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function FinishSheet({ db, session, open, onClose, onFinish, onDiscard }: { db: DB; session: Session; open: boolean; onClose: () => void; onFinish: (s: Pick<Session, "note" | "feel" | "end">) => void; onDiscard: () => void }) {
  const [note, setNote] = useState(session.note ?? "");
  const [feel, setFeel] = useState(session.feel ?? {});
  const [sure, setSure] = useState(false);
  const start = new Date(session.date).getTime();
  const lastT = lastSetAt(session);
  const clamp = (t: number) => Math.min(Date.now(), Math.max(start + 60_000, t));
  // Forgot to tap Finish? Then the default is a few minutes after the last set.
  const afterLast = lastT ? clamp(lastT + 5 * 60_000) : 0;
  const [end, setEnd] = useState(Date.now());
  useEffect(() => {
    if (open) setEnd(afterLast && Date.now() - afterLast > 15 * 60_000 ? afterLast : Date.now());
  }, [open]);

  const m = exMap(db);
  const sets = session.entries.reduce((n, e) => n + e.sets.length, 0);
  const did = session.entries.filter((e) => e.sets.length);
  const prs = did.map((e) => ({ e, pr: prsIn(db, session, e) })).filter((x) => x.pr);
  const mins = Math.round((end - start) / 60000);
  const isNow = Math.abs(end - Date.now()) < 60_000;

  return (
    <Sheet open={open} onClose={onClose} title="Finish session">
      <div className="space-y-6">
        <p className="num text-3xl leading-tight">
          {plural(sets, "set")}, {plural(did.length, "exercise")}, {mins} min
        </p>

        <div>
          <div className="mb-1.5 text-sm text-mute">Finished at</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setEnd(Date.now())} className={cx("h-12 rounded-xl font-medium", isNow ? "bg-chalk text-floor" : "bg-bench")}>
              Now
            </button>
            <button disabled={!afterLast} onClick={() => setEnd(afterLast)} className={cx("h-12 rounded-xl font-medium disabled:opacity-40", afterLast && end === afterLast && !isNow ? "bg-chalk text-floor" : "bg-bench")}>
              After last set
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button onClick={() => setEnd(clamp(end - 5 * 60_000))} className={cx(pill, "h-14 w-16 shrink-0 px-0 text-lg")} aria-label="5 minutes earlier">
              −5
            </button>
            <div className="num flex h-14 min-w-0 flex-1 items-center justify-center rounded-xl bg-floor text-4xl tabular-nums">{hhmm(end)}</div>
            <button onClick={() => setEnd(clamp(end + 5 * 60_000))} className={cx(pill, "h-14 w-16 shrink-0 px-0 text-lg")} aria-label="5 minutes later">
              +5
            </button>
          </div>
        </div>

        <Rating label="How did your body feel?" words={FEEL.body} value={feel.body} onChange={(body) => setFeel({ ...feel, body })} />
        <Rating label="And your head?" words={FEEL.mind} value={feel.mind} onChange={(mind) => setFeel({ ...feel, mind })} />

        {prs.length > 0 && (
          <div className="rounded-xl bg-green/10 px-3.5 py-3">
            <p className="text-sm font-semibold text-green">Best ever</p>
            {prs.map(({ e, pr }) => (
              <p key={e.ex}>
                {m.get(e.ex)?.name}{" "}
                <span className="num text-lg">
                  {fmtW(pr!.w)}kg × {pr!.r}
                </span>
              </p>
            ))}
          </div>
        )}

        <div className="space-y-2 text-sm">
          {did.map((e) => (
            <p key={e.ex}>
              <span className="text-chalk">{m.get(e.ex)?.name}</span> <span className="text-mute">{fmtSets(e.sets)}</span>
              <br />
              <span className="text-faint">next: {fmtTargets(nextOf(e, m.get(e.ex)!))}</span>
            </p>
          ))}
        </div>

        <textarea rows={2} className={cx(input, "h-auto py-3")} placeholder="Anything about today? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

        <div>
          <button onClick={() => onFinish({ note: note.trim() || undefined, feel: feel.body || feel.mind ? feel : undefined, end: new Date(end).toISOString() })} className="h-14 w-full rounded-xl bg-chalk text-lg font-semibold text-floor">
            Finish session
          </button>
          <button onClick={() => (sure ? onDiscard() : setSure(true))} className={cx(pill, "mt-2 w-full bg-transparent", sure ? "text-red" : "text-mute")}>
            {sure ? "Tap again to throw this session away" : "Discard session"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export const sessionTitle = (s: Session) => `${s.day ? DAYS[s.day].label : "Session"}, ${fmtDate(s.date)}`;
