import { useEffect, useMemo, useRef, useState } from "react";
import type { DB, Entry, Exercise, Session, SetLog, Target } from "../../../shared/types.ts";
import {
  agoLabel,
  equipLabel,
  exMap,
  fmtDate,
  fmtSets,
  fmtTargets,
  fmtW,
  history,
  markStarted,
  newEntry,
  nextOf,
  nextOptions,
  noteFromLast,
  ordinal,
  programOf,
  prsIn,
  sameNext,
  sessionLabel,
  started,
  targetAt,
  verdict,
} from "../../../shared/logic.ts";
import { clock, cx, dayColor, useNow, useSync } from "../lib.ts";
import { ExercisePicker, ExerciseSheet } from "./Exercises.tsx";
import { AimPicker, Choice, input, Kg, pill, pillSm, Sheet, WeightStepper } from "./ui.tsx";

type Group = "done" | "next" | "off";
const groupOf = (e: Entry): Group => (started(e) ? "done" : e.skip ? "off" : "next");

/**
 * The logging surface, used live at the gym and for fixing past sessions.
 * Entries are kept in the order actually done: the first set on an exercise moves it up behind the finished ones,
 * so "Up next" below always stays in program order.
 */
export function SessionEditor({ db, session, onChange, live, editing }: { db: DB; session: Session; onChange: (s: Session) => void; live: boolean; editing: boolean }) {
  const m = useMemo(() => exMap(db), [db]);
  const firstUp = session.entries.find((e) => groupOf(e) === "next" || (started(e) && e.sets.length < (e.plan?.length ?? 1)));
  const [open, setOpen] = useState<string | null>(live ? (firstUp?.ex ?? null) : null);
  const [adding, setAdding] = useState(false);
  const [editingEx, setEditingEx] = useState<string | null>(null);
  const program = programOf(db, session.day);

  const setEntry = (i: number, e: Entry | null) => {
    let entries = [...session.entries];
    if (!e) entries.splice(i, 1);
    else {
      const was = entries[i];
      entries[i] = started(e) ? { ...e, skip: undefined } : e;
      if (!started(was) && started(e)) entries = markStarted(entries, i);
    }
    onChange({ ...session, entries });
  };
  /** Swap with the neighbour in the same group (done order, or today's up-next order). */
  const move = (i: number, d: -1 | 1) => {
    const g = groupOf(session.entries[i]);
    let j = i + d;
    while (j >= 0 && j < session.entries.length && groupOf(session.entries[j]) !== g) j += d;
    if (j < 0 || j >= session.entries.length) return;
    const entries = [...session.entries];
    [entries[i], entries[j]] = [entries[j], entries[i]];
    onChange({ ...session, entries });
  };
  const add = (ex: Exercise) => {
    onChange({ ...session, entries: [...session.entries, newEntry(db, ex, session.mode)] });
    setOpen(ex.id);
    setAdding(false);
  };

  const rows = session.entries.map((e, i) => ({ e, i, g: groupOf(e), ex: m.get(e.ex) })).filter((r) => !!r.ex);
  const sections: { g: Group; title: string; sub?: string }[] = [
    { g: "done", title: live ? "Done" : "Done, in this order" },
    { g: "next", title: live ? "Up next" : "Not done", sub: live ? (program ? "program order" : undefined) : "no reason given" },
    { g: "off", title: "Not done today" },
  ];
  const editEx = editingEx ? m.get(editingEx) : undefined;

  return (
    <div className="space-y-6">
      {sections.map(({ g, title, sub }) => {
        const rs = rows.filter((r) => r.g === g);
        if (!rs.length) return null;
        return (
          <section key={g} className="space-y-2.5">
            <h2 className="flex items-baseline gap-2 px-1 text-sm font-semibold text-mute">
              {title}
              {sub && <span className="font-normal text-faint">{sub}</span>}
            </h2>
            {rs.map(({ e, i, ex }, k) => (
              <ExerciseCard
                key={e.ex + i}
                db={db}
                session={session}
                ex={ex!}
                entry={e}
                order={g === "done" ? k + 1 : undefined}
                plannedAt={session.planned ? session.planned.indexOf(e.ex) : undefined}
                open={open === e.ex}
                live={live}
                editing={editing}
                canUp={k > 0}
                canDown={k < rs.length - 1}
                onToggle={() => setOpen(open === e.ex ? null : e.ex)}
                onChange={(x) => setEntry(i, x)}
                onDone={() => setOpen(session.entries.find((x) => x.ex !== e.ex && groupOf(x) === "next")?.ex ?? null)}
                onMove={(d) => move(i, d)}
                onEditExercise={() => setEditingEx(e.ex)}
              />
            ))}
          </section>
        );
      })}

      {!session.entries.length && <p className="px-1 py-6 text-center text-mute">Nothing planned. Add the first exercise when you're at the machine.</p>}

      <button onClick={() => setAdding(true)} className="flex h-14 w-full items-center justify-center rounded-2xl border-2 border-dashed border-rule text-lg font-medium text-chalk active:bg-mat hover:bg-mat">
        + Add exercise
      </button>

      <ExercisePicker
        db={db}
        open={adding}
        onClose={() => setAdding(false)}
        onPick={add}
        exclude={new Set(session.entries.map((e) => e.ex))}
        first={program ? { title: `In ${program.name}`, ids: program.items } : undefined}
        allowOneOff
      />
      {editEx && <ExerciseSheet db={db} ex={editEx} open onClose={() => setEditingEx(null)} />}
    </div>
  );
}

function ExerciseCard(props: {
  db: DB;
  session: Session;
  ex: Exercise;
  entry: Entry;
  order?: number;
  plannedAt?: number;
  open: boolean;
  live: boolean;
  editing: boolean;
  canUp: boolean;
  canDown: boolean;
  onToggle: () => void;
  onChange: (e: Entry | null) => void;
  onDone: () => void;
  onMove: (d: -1 | 1) => void;
  onEditExercise: () => void;
}) {
  const { db, session, ex, entry, open, onChange, live } = props;
  const plan = entry.plan ?? [];
  const prev = useMemo(() => history(db, ex.id, session.id).find((h) => h.session.date < session.date), [db, ex.id, session.id, session.date]);
  const left = useMemo(() => noteFromLast(db, ex.id, session), [db, ex.id, session.id, session.date]);
  const planned = Math.max(plan.length, 1);
  const finished = entry.sets.length >= planned;
  const pr = entry.sets.length ? prsIn(db, session, entry) : undefined;
  const moved = props.order !== undefined && props.plannedAt !== undefined && props.plannedAt !== props.order - 1;

  return (
    <section className={cx("rounded-2xl bg-mat", open && "ring-1 ring-rule")}>
      <button onClick={props.onToggle} className="flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left active:bg-bench/50" aria-expanded={open}>
        <Progress done={entry.sets.length} planned={planned} skip={entry.skip} />
        <div className="min-w-0 flex-1">
          <h3 className="num text-[1.6rem] leading-[1.1]">{ex.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-mute">
            <span className="rounded-md bg-floor px-1.5 py-px text-xs font-semibold text-mute">{ex.oneoff ? "One-off" : equipLabel(ex)}</span>
            {pr && <span className="rounded-md bg-green/15 px-1.5 py-px text-xs font-semibold text-green">Best ever</span>}
          </div>
          <p className="mt-1 text-[15px]">
            {entry.sets.length ? (
              <span className="text-chalk">{fmtSets(entry.sets)}</span>
            ) : entry.skip ? (
              <span className={entry.skip === "unavailable" ? "text-mute" : "text-faint"}>{entry.skip === "unavailable" ? "Not available (machine taken or broken)" : "Skipped"}</span>
            ) : live ? (
              <span className="text-mute">Today {fmtTargets(plan)}</span>
            ) : (
              <span className="text-faint">Not done</span>
            )}
          </p>
          {!open && !entry.sets.length && !entry.skip && left && <p className="mt-1.5 line-clamp-2 border-l-2 border-yellow pl-2 text-sm text-chalk">{left.entry.note}</p>}
        </div>
        {props.order !== undefined ? (
          <span className="mt-0.5 shrink-0 text-right leading-tight">
            <span className="num block text-xl text-chalk">{ordinal(props.order)}</span>
            {moved && <span className="block text-xs text-faint">{props.plannedAt! >= 0 ? `planned ${ordinal(props.plannedAt! + 1)}` : "added"}</span>}
          </span>
        ) : (
          <span className={cx("mt-1 text-xl text-faint transition-transform", open && "rotate-180")} aria-hidden>
            ⌄
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-4 px-3 pb-4 sm:px-4">
          {(ex.note || left) && (
            <div className="space-y-2">
              {ex.note && (
                <button onClick={props.onEditExercise} className="flex w-full items-start gap-3 rounded-xl border-l-4 border-chalk bg-floor/60 px-3.5 py-2.5 text-left active:bg-bench">
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-mute">Note that stays</span>
                    <span className="block leading-snug whitespace-pre-line">{ex.note}</span>
                  </span>
                  <span className="shrink-0 pt-0.5 text-sm text-faint">Edit</span>
                </button>
              )}
              {left && (
                <div className="rounded-xl border-l-4 border-yellow bg-floor/60 px-3.5 py-2.5">
                  <span className="block text-xs font-semibold text-mute">You left this for today</span>
                  <span className="block text-[17px] leading-snug">{left.entry.note}</span>
                </div>
              )}
            </div>
          )}
          <LastTime prev={prev} ex={ex} />
          <Sets ex={ex} entry={entry} onChange={onChange} />
          {entry.sets.length > 0 && <NextTime ex={ex} entry={entry} onChange={onChange} />}

          {props.editing ? (
            <div className="grid grid-cols-4 gap-2">
              <button disabled={!props.canUp} onClick={() => props.onMove(-1)} className={cx(pill, "px-0 text-xl disabled:opacity-30")} aria-label="Move up">
                ↑
              </button>
              <button disabled={!props.canDown} onClick={() => props.onMove(1)} className={cx(pill, "px-0 text-xl disabled:opacity-30")} aria-label="Move down">
                ↓
              </button>
              <button onClick={props.onEditExercise} className={cx(pill, "px-0")}>
                Edit
              </button>
              <RemoveButton onRemove={() => onChange(null)} />
            </div>
          ) : entry.sets.length > 0 ? (
            live && (
              <button onClick={props.onDone} className={cx("h-12 w-full rounded-xl font-semibold", finished ? "bg-chalk text-floor" : "bg-bench text-chalk")}>
                {finished ? "Next exercise" : "Done with this"}
              </button>
            )
          ) : entry.skip ? (
            <button onClick={() => onChange({ ...entry, skip: undefined })} className={cx(pill, "h-12 w-full")}>
              Undo: {entry.skip === "unavailable" ? "it's available" : "not skipping"}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => (onChange({ ...entry, skip: "skipped" }), props.onDone())} className={cx(pill, "h-12")}>
                Skip today
              </button>
              <button onClick={() => (onChange({ ...entry, skip: "unavailable" }), props.onDone())} className={cx(pill, "h-12")}>
                Machine not available
              </button>
            </div>
          )}
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
    <button onClick={() => (sure ? onRemove() : setSure(true))} className={cx(pill, "px-0", sure && "bg-red/20 text-red")}>
      {sure ? "Sure?" : "Remove"}
    </button>
  );
}

/** Sets done out of planned; a filled green plate when complete, a dash when not done today. */
function Progress({ done, planned, skip }: { done: number; planned: number; skip?: Entry["skip"] }) {
  const full = done >= planned;
  if (skip && !done)
    return (
      <div className="num mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl text-faint ring-2 ring-rule ring-inset" aria-label={skip === "unavailable" ? "Not available" : "Skipped"}>
        –
      </div>
    );
  return (
    <div
      className={cx("num mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-base", full ? "bg-green text-floor" : done ? "text-chalk ring-2 ring-green ring-inset" : "text-mute ring-2 ring-rule ring-inset")}
      aria-label={`${done} of ${planned} sets`}
    >
      {full ? "✓" : `${done}/${planned}`}
    </div>
  );
}

function LastTime({ prev, ex }: { prev?: { session: Session; entry: Entry }; ex: Exercise }) {
  if (!prev)
    return (
      <p className="rounded-xl bg-floor/60 px-3.5 py-3 text-sm text-mute">
        First time logging this. Pick a weight you could do about {ex.aim} times; the app takes it from there.
      </p>
    );
  return (
    <div className="rounded-xl bg-floor/60 px-3.5 py-3">
      <div className="text-sm text-mute">Last time, {prev.session.approx ? "from old notes" : agoLabel(prev.session.date)}</div>
      <div className="num mt-0.5 text-xl leading-snug">{fmtSets(prev.entry.sets)}</div>
      {prev.session.approx && <p className="mt-1 text-sm text-faint">Old notes can be off. Fix the weight if it looks wrong.</p>}
    </div>
  );
}

function Sets({ ex, entry, onChange }: { ex: Exercise; entry: Entry; onChange: (e: Entry | null) => void }) {
  const plan = entry.plan ?? [];
  const [editing, setEditing] = useState<number | null>(null);
  const [extra, setExtra] = useState(0);
  const rows = Math.max(plan.length, entry.sets.length + (entry.sets.length >= plan.length ? extra : 0), entry.sets.length + (plan.length ? 0 : 1));
  const active = entry.sets.length < rows ? entry.sets.length : null;

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
  /** Correcting the plan mid-session: changes today's goal for this set; next time starts from it. */
  const setAim = (i: number, r: number) => {
    const p = Array.from({ length: Math.max(plan.length, i + 1) }, (_, k) => plan[k] ?? targetAt(entry, ex, k));
    p[i] = { ...p[i], r };
    onChange({ ...entry, plan: p });
  };

  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => {
        const t = targetAt(entry, ex, i);
        const s = entry.sets[i];
        if (s && editing !== i)
          return (
            <button key={i} onClick={() => setEditing(i)} className="settle flex min-h-14 w-full items-center gap-3 rounded-xl bg-bench/70 px-3.5 py-2 text-left active:bg-rule" aria-label={`Set ${i + 1}: ${fmtW(s.w)} kilos, ${s.r} reps. Tap to change.`}>
              <span className="w-11 shrink-0 text-sm text-mute">Set {i + 1}</span>
              <span className="num text-2xl whitespace-nowrap">
                <Kg w={s.w} /> <span className="text-mute">×</span> {s.r}
              </span>
              <span className="flex-1" />
              <Verdict r={s.r} aim={t.r} />
              <span className="text-sm text-faint" aria-hidden>
                Edit
              </span>
            </button>
          );
        if (s || i === active)
          return <SetInput key={i} index={i} ex={ex} target={t} initial={s} onAim={(r) => setAim(i, r)} onLog={(x) => log(i, x)} onRemove={s ? () => remove(i) : undefined} onCancel={s ? () => setEditing(null) : undefined} />;
        return (
          <div key={i} className="flex min-h-11 items-center gap-3 rounded-xl border border-dashed border-rule px-3.5 text-faint">
            <span className="w-11 shrink-0 text-sm">Set {i + 1}</span>
            <span className="num text-xl whitespace-nowrap">
              {fmtW(t.w)}kg × {t.r}
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

function Verdict({ r, aim }: { r: number; aim: number }) {
  const v = verdict(r, aim);
  if (v === "hit") return <span className="text-sm font-medium text-green">Goal {aim} ✓</span>;
  if (v === "close") return <span className="text-sm text-mute">Close to {aim}</span>;
  return <span className="text-sm text-amber">Short of {aim}</span>;
}

/** Weight stepper plus a strip of rep numbers. Tapping a number logs the set: one tap when the weight is right. */
function SetInput({ index, ex, target, initial, onAim, onLog, onRemove, onCancel }: { index: number; ex: Exercise; target: Target; initial?: SetLog; onAim: (r: number) => void; onLog: (s: SetLog) => void; onRemove?: () => void; onCancel?: () => void }) {
  const [w, setW] = useState(initial?.w ?? target.w);
  const [aiming, setAiming] = useState(false);
  useEffect(() => setW(initial?.w ?? target.w), [target.w, initial?.w]);
  const lo = Math.max(1, target.r - 6);
  const reps = Array.from({ length: target.r + 5 - lo + 1 }, (_, k) => lo + k);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>(`[data-r="${Math.max(lo, target.r - 3)}"]`);
    if (el && strip.current) strip.current.scrollLeft = el.offsetLeft - 12;
  }, [target.r]);

  return (
    <div className="rounded-2xl bg-bench p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">Set {index + 1}</span>
        <button onClick={() => setAiming(!aiming)} className={cx(pillSm, "bg-floor")} aria-expanded={aiming}>
          Goal <span className="num ml-1.5 text-lg">{target.r}</span>
          <span className="ml-1 text-mute">{ex.side === "each" ? "reps each" : "reps"}</span>
          <span className="ml-2 text-faint">{aiming ? "Done" : "Change"}</span>
        </button>
      </div>
      {aiming && (
        <div className="mt-3">
          <AimPicker value={target.r} onChange={onAim} />
        </div>
      )}
      <div className="mt-3">
        <WeightStepper value={w} ex={ex} onChange={setW} />
      </div>
      <div className="mt-4 mb-1.5 text-sm text-mute">Tap the reps you did</div>
      <div ref={strip} className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 py-1">
        {reps.map((r) => {
          const v = verdict(r, target.r);
          return (
            <button
              key={r}
              data-r={r}
              onClick={() => onLog({ w, r })}
              className={cx(
                "num h-14 min-w-14 shrink-0 rounded-xl text-[1.7rem]",
                initial?.r === r ? "bg-chalk text-floor" : r === target.r ? "bg-floor text-chalk ring-2 ring-green ring-inset" : v === "short" ? "bg-floor/60 text-faint" : "bg-floor text-chalk",
              )}
              aria-label={`${r} reps${r === target.r ? ", the goal" : ""}`}
            >
              {r}
            </button>
          );
        })}
      </div>
      {(onRemove || onCancel) && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {onRemove && (
            <button onClick={onRemove} className={cx(pill, "bg-floor text-red")}>
              Delete set
            </button>
          )}
          {onCancel && (
            <button onClick={onCancel} className={cx(pill, "bg-floor")}>
              Keep as is
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The structured replacement for "(go up on first)". Same by default; the usual next steps are one tap. */
function NextTime({ ex, entry, onChange }: { ex: Exercise; entry: Entry; onChange: (e: Entry) => void }) {
  const options = nextOptions(entry, ex);
  const next = nextOf(entry, ex);
  const base = sameNext(entry, ex);
  const [edit, setEdit] = useState<number | null>(null);
  const eq = (a: Target[], b: Target[]) => JSON.stringify(a) === JSON.stringify(b);
  const picked = options.find((p) => eq(p.ts, next))?.key;
  const set = (ts: Target[]) => onChange({ ...entry, next: eq(ts, base) ? undefined : ts });
  const hit = entry.sets.map((s, i) => (s.r >= targetAt(entry, ex, i).r ? i + 1 : 0)).filter(Boolean);

  return (
    <div className="space-y-3 rounded-2xl border border-rule p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">Next time</span>
        {hit.length > 0 && <span className="text-sm text-green">{hit.length === entry.sets.length && hit.length >= (entry.plan?.length ?? 1) && hit.length > 1 ? "Goal hit on every set" : `Goal hit on set ${hit.join(" and ")}`}</span>}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => set(o.ts)}
            aria-pressed={picked === o.key}
            className={cx("min-h-12 rounded-xl px-2 py-1.5 text-[15px] leading-tight font-medium", picked === o.key ? "bg-chalk text-floor" : "bg-bench active:bg-rule hover:bg-rule")}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        {next.map((t, i) => {
          const was = base[i];
          const changed = !was || t.w !== was.w || t.r !== was.r;
          return (
            <div key={i}>
              <button onClick={() => setEdit(edit === i ? null : i)} className={cx("flex min-h-12 w-full items-center gap-3 rounded-xl bg-bench px-3.5 text-left active:bg-rule", edit === i && "ring-2 ring-chalk ring-inset")} aria-expanded={edit === i}>
                <span className="w-11 shrink-0 text-sm text-mute">Set {i + 1}</span>
                <span className={cx("num text-xl whitespace-nowrap", changed && "text-green")}>
                  <Kg w={t.w} /> × {t.r}
                </span>
                <span className="flex-1" />
                <span className="text-sm text-faint">{edit === i ? "Done" : "Change"}</span>
              </button>
              {edit === i && (
                <div className="mt-1.5 space-y-3 rounded-xl bg-floor/60 p-3">
                  <WeightStepper value={t.w} ex={ex} onChange={(w) => set(next.map((x, k) => (k === i ? { ...x, w } : x)))} />
                  <div>
                    <div className="mb-1.5 text-sm text-mute">Rep goal</div>
                    <AimPicker value={t.r} onChange={(r) => set(next.map((x, k) => (k === i ? { ...x, r } : x)))} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm text-mute">Note for next time only (gone after that)</span>
        <textarea rows={2} className={cx(input, "h-auto py-3")} placeholder="Felt heavy, try 12 on set 2…" value={entry.note ?? ""} onChange={(e) => onChange({ ...entry, note: e.target.value || undefined })} />
      </label>
    </div>
  );
}

export const lastSetAt = (s: Session) => Math.max(0, ...s.entries.flatMap((e) => e.sets.map((x) => x.t ?? 0)));

/** Sticky bar while training: what day, how long, rest since the last set, save state. */
export function SessionBar({ db, session, editing, onEdit, onFinish }: { db: DB; session: Session; editing: boolean; onEdit: () => void; onFinish: () => void }) {
  const now = useNow();
  const sync = useSync();
  const lastT = lastSetAt(session);
  return (
    <div className="safe-t sticky top-0 z-30 -mx-4 border-b border-rule bg-floor/95 px-4 backdrop-blur sm:mx-0 sm:rounded-b-2xl">
      <div className="flex items-center gap-2.5 py-2.5">
        <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: dayColor(db, session.day) }} />
        <div className="min-w-0 flex-1">
          <div className="num truncate text-xl leading-tight">
            {sessionLabel(db, session)}
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
        <button onClick={onEdit} aria-pressed={editing} className={cx(pill, "shrink-0 px-3.5", editing && "bg-chalk/15 ring-2 ring-chalk ring-inset")}>
          {editing ? "Done" : "Edit"}
        </button>
        {!editing && (
          <button onClick={onFinish} className="h-11 shrink-0 rounded-xl bg-chalk px-4 font-semibold text-floor">
            Finish
          </button>
        )}
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

export function FinishSheet({ db, session, open, onClose, onFinish, onDiscard }: { db: DB; session: Session; open: boolean; onClose: () => void; onFinish: (s: Pick<Session, "note" | "feel" | "end" | "entries">) => void; onDiscard: () => void }) {
  const [note, setNote] = useState(session.note ?? "");
  const [feel, setFeel] = useState(session.feel ?? {});
  const [skips, setSkips] = useState<Record<string, Entry["skip"]>>({});
  const [sure, setSure] = useState(false);
  const start = new Date(session.date).getTime();
  const lastT = lastSetAt(session);
  const clamp = (t: number) => Math.min(Date.now(), Math.max(start + 60_000, t));
  // Forgot to tap Finish? Then the default is a few minutes after the last set.
  const afterLast = lastT ? clamp(lastT + 5 * 60_000) : 0;
  const [end, setEnd] = useState(Date.now());
  useEffect(() => {
    if (!open) return;
    setEnd(afterLast && Date.now() - afterLast > 15 * 60_000 ? afterLast : Date.now());
    setSkips(Object.fromEntries(session.entries.filter((e) => !started(e)).map((e) => [e.ex, e.skip ?? "skipped"])));
  }, [open]);

  const m = exMap(db);
  const sets = session.entries.reduce((n, e) => n + e.sets.length, 0);
  const did = session.entries.filter(started);
  const notDone = session.entries.filter((e) => !started(e));
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

        {notDone.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm text-mute">Not done. Why?</div>
            {notDone.map((e) => (
              <div key={e.ex}>
                <div className="mb-1.5 font-medium">{m.get(e.ex)?.name}</div>
                <Choice
                  value={skips[e.ex]}
                  onChange={(v) => setSkips({ ...skips, [e.ex]: v })}
                  options={[
                    { value: "skipped", label: "Skipped" },
                    { value: "unavailable", label: "Not available" },
                  ]}
                />
              </div>
            ))}
          </div>
        )}

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
          <button
            onClick={() =>
              onFinish({
                note: note.trim() || undefined,
                feel: feel.body || feel.mind ? feel : undefined,
                end: new Date(end).toISOString(),
                entries: session.entries.map((e) => (started(e) ? e : { ...e, skip: skips[e.ex] ?? "skipped" })),
              })
            }
            className="h-14 w-full rounded-xl bg-chalk text-lg font-semibold text-floor"
          >
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

export const sessionTitle = (db: DB, s: Session) => `${sessionLabel(db, s)}, ${fmtDate(s.date)}`;
