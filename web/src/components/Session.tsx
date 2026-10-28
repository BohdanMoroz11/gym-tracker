import { useEffect, useMemo, useRef, useState } from "react";
import type { DB, Entry, Exercise, Session, SetLog, Target } from "../../../shared/types.ts";
import {
  agoLabel,
  DAYS,
  exMap,
  fmtDate,
  fmtRangeT,
  fmtSets,
  fmtTargets,
  fmtW,
  history,
  newEntry,
  nextOf,
  prsIn,
  setsByGroup,
  suggestNext,
} from "../../../shared/logic.ts";
import { clock, cx, dayColor, useNow, useSaveExercise, useSync } from "../lib.ts";
import { Sheet, WeightStepper, input } from "./ui.tsx";

const RANGES: [number, number][] = [
  [5, 8],
  [8, 10],
  [10, 12],
  [12, 15],
  [15, 20],
];

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
    <div className="space-y-2">
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

      <button onClick={() => setAdding(true)} className="w-full rounded-2xl border border-dashed border-rule px-4 py-4 text-left font-medium text-mute hover:text-chalk">
        + Add exercise
      </button>

      {legsQuiet && legPress && (
        <button onClick={() => add(legPress)} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-mute hover:bg-mat">
          <span className="h-6 w-1.5 rounded-full bg-yellow" />
          <span>
            <span className="text-chalk">Add leg press as a finisher?</span> No leg sets in a month. Two light sets count.
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

  return (
    <section className={cx("rounded-2xl bg-mat transition-colors", open && "ring-1 ring-rule")}>
      <button onClick={props.onToggle} className="flex w-full items-start gap-3 px-4 py-3.5 text-left" aria-expanded={open}>
        <Progress done={entry.sets.length} planned={planned} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="num truncate text-2xl leading-tight">{ex.short}</h3>
            {pr && <span className="rounded-md bg-green/15 px-1.5 py-0.5 text-xs font-semibold text-green">Best ever</span>}
          </div>
          <p className="truncate text-sm text-mute">
            {entry.sets.length ? (
              <>
                <span className="text-chalk">{fmtSets(entry.sets)}</span>
                {finished && <> · next {fmtTargets(nextOf(entry, ex))}</>}
              </>
            ) : plan.length ? (
              <>Today {fmtTargets(plan)}</>
            ) : (
              "No sets yet"
            )}
          </p>
        </div>
      </button>

      {open && (
        <div className="space-y-4 px-4 pb-4">
          <LastTime prev={prev} ex={ex} />
          <Sets {...props} plan={plan} />
          {entry.sets.length > 0 && (finished || !props.live) && <NextTime ex={ex} entry={entry} onChange={onChange} />}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {entry.sets.length > 0 && props.live && (
              <button onClick={props.onDone} className={cx("rounded-xl px-4 py-2.5 font-semibold", finished ? "bg-chalk text-floor" : "bg-bench text-chalk")}>
                Next exercise
              </button>
            )}
            <span className="flex-1" />
            <button disabled={props.first} onClick={() => props.onMove(-1)} className="rounded-lg px-3 py-2 text-mute hover:text-chalk disabled:opacity-30" aria-label="Move up">
              ↑
            </button>
            <button disabled={props.last} onClick={() => props.onMove(1)} className="rounded-lg px-3 py-2 text-mute hover:text-chalk disabled:opacity-30" aria-label="Move down">
              ↓
            </button>
            <button onClick={() => onChange(null)} className="rounded-lg px-3 py-2 text-sm text-mute hover:text-red">
              Remove
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Sets done out of planned, as a filled-in plate when complete. */
function Progress({ done, planned }: { done: number; planned: number }) {
  const full = done >= planned;
  return (
    <div
      className={cx("num mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-base", full ? "bg-green text-floor" : done ? "ring-2 ring-green text-chalk" : "ring-2 ring-rule text-mute")}
      aria-label={`${done} of ${planned} sets`}
    >
      {full ? "✓" : `${done}/${planned}`}
    </div>
  );
}

function LastTime({ prev, ex }: { prev?: { session: Session; entry: Entry }; ex: Exercise }) {
  if (!prev)
    return (
      <p className="rounded-xl bg-floor/60 px-3 py-2.5 text-sm text-mute">
        First time logging this. Pick a weight you could do about {ex.range[1]} times; the app takes it from there.
      </p>
    );
  return (
    <div className="rounded-xl bg-floor/60 px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-mute">Last time, {prev.session.approx ? "from old notes" : agoLabel(prev.session.date)}</span>
        <span className="num text-lg">{fmtSets(prev.entry.sets)}</span>
      </div>
      {prev.entry.note && <p className="mt-0.5 text-chalk">“{prev.entry.note}”</p>}
      {ex.note && <p className="mt-0.5 text-mute">{ex.note}</p>}
      {prev.session.approx && <p className="mt-0.5 text-faint">Old notes can be off. Adjust the weight if it looks wrong.</p>}
    </div>
  );
}

function Sets(props: { ex: Exercise; entry: Entry; plan: Target[]; live: boolean; onChange: (e: Entry | null) => void }) {
  const { ex, entry, plan, onChange } = props;
  const [editing, setEditing] = useState<number | null>(null);
  const [extra, setExtra] = useState(0);
  const rows = Math.max(plan.length, entry.sets.length + (entry.sets.length >= plan.length ? extra : 0), entry.sets.length + (plan.length ? 0 : 1));
  const active = entry.sets.length < rows ? entry.sets.length : null;
  const targetAt = (i: number): Target => {
    const t = plan[i] ?? plan[plan.length - 1];
    const lastW = entry.sets[entry.sets.length - 1]?.w;
    return { w: plan[i]?.w ?? lastW ?? t?.w ?? ex.inc * 2, lo: plan[i]?.lo ?? t?.lo ?? ex.range[0], hi: plan[i]?.hi ?? t?.hi ?? ex.range[1] };
  };

  const log = (i: number, s: SetLog) => {
    const sets = [...entry.sets];
    sets[i] = { ...s, t: sets[i]?.t ?? Date.now() };
    // A new set changes what "next time" should be, unless it was set by hand.
    onChange({ ...entry, sets });
    setEditing(null);
    if (i >= plan.length) setExtra(0);
  };
  const remove = (i: number) => {
    onChange({ ...entry, sets: entry.sets.filter((_, j) => j !== i) });
    setEditing(null);
  };

  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => {
        const t = targetAt(i);
        const s = entry.sets[i];
        if (s && editing !== i)
          return (
            <button key={i} onClick={() => setEditing(i)} className="settle flex w-full items-center gap-3 rounded-xl bg-bench/60 px-3 py-2 text-left" aria-label={`Set ${i + 1}: ${fmtW(s.w)} kilos, ${s.r} reps. Tap to change.`}>
              <span className="w-12 text-sm text-mute">Set {i + 1}</span>
              <span className="num text-2xl">
                {fmtW(s.w)} <span className="text-mute">×</span> {s.r}
              </span>
              <span className="flex-1" />
              <Verdict s={s} t={t} />
            </button>
          );
        if (s || i === active)
          return <SetInput key={i} index={i} ex={ex} target={t} initial={s} onLog={(x) => log(i, x)} onRemove={s ? () => remove(i) : undefined} onCancel={s ? () => setEditing(null) : undefined} />;
        return (
          <div key={i} className="flex items-center gap-3 px-3 py-1 text-faint">
            <span className="w-12 text-sm">Set {i + 1}</span>
            <span className="num text-xl">
              {fmtW(t.w)} × {fmtRangeT(t)}
            </span>
          </div>
        );
      })}
      {active === null && editing === null && (
        <button onClick={() => setExtra(extra + 1)} className="rounded-xl px-3 py-2 text-sm font-medium text-mute hover:text-chalk">
          + Another set
        </button>
      )}
    </div>
  );
}

function Verdict({ s, t }: { s: SetLog; t: Target }) {
  if (s.r >= t.hi) return <span className="text-sm font-medium text-green">Top of range</span>;
  if (s.r >= t.lo) return <span className="text-sm text-mute">In range</span>;
  return <span className="text-sm text-amber">Short of {t.lo}</span>;
}

/** Weight stepper plus a strip of rep numbers. Tapping a number logs the set: one tap when the weight is right. */
function SetInput({ index, ex, target, initial, onLog, onRemove, onCancel }: { index: number; ex: Exercise; target: Target; initial?: SetLog; onLog: (s: SetLog) => void; onRemove?: () => void; onCancel?: () => void }) {
  const [w, setW] = useState(initial?.w ?? target.w);
  useEffect(() => setW(initial?.w ?? target.w), [target.w, initial?.w]);
  const lo = Math.max(1, target.lo - 5);
  const hi = target.hi + 6;
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>(`[data-r="${target.lo}"]`);
    if (el && strip.current) strip.current.scrollLeft = el.offsetLeft - strip.current.clientWidth / 2 + el.offsetWidth;
  }, [target.lo]);

  return (
    <div className="rounded-xl bg-bench px-3 pt-3 pb-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm text-mute">Set {index + 1}</div>
          <div className="text-sm">
            aim <span className="num text-lg">{fmtRangeT(target)}</span>
          </div>
        </div>
        <WeightStepper value={w} step={ex.inc} onChange={setW} size="lg" />
      </div>
      <div className="mt-3 mb-1 text-xs text-mute">Reps done</div>
      <div ref={strip} className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-2">
        {Array.from({ length: hi - lo + 1 }, (_, k) => lo + k).map((r) => {
          const inRange = r >= target.lo && r <= target.hi;
          return (
            <button
              key={r}
              data-r={r}
              onClick={() => onLog({ w, r })}
              className={cx(
                "num h-12 min-w-12 shrink-0 rounded-xl text-2xl",
                initial?.r === r ? "bg-chalk text-floor" : inRange ? "bg-floor text-chalk ring-1 ring-mute/60" : "bg-floor/50 text-mute",
              )}
              aria-label={`${r} reps`}
            >
              {r}
            </button>
          );
        })}
      </div>
      {(onRemove || onCancel) && (
        <div className="flex justify-end gap-2 pb-1">
          {onRemove && (
            <button onClick={onRemove} className="rounded-lg px-3 py-1.5 text-sm text-mute hover:text-red">
              Delete set
            </button>
          )}
          {onCancel && (
            <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm text-mute hover:text-chalk">
              Keep
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The structured replacement for "(12 on the second, 12-15)". Pre-filled; change only what you disagree with. */
function NextTime({ ex, entry, onChange }: { ex: Exercise; entry: Entry; onChange: (e: Entry) => void }) {
  const auto = suggestNext(entry, ex);
  const next = entry.next ?? auto;
  const [edit, setEdit] = useState<number | null>(null);
  const set = (ts: Target[] | undefined) => onChange({ ...entry, next: ts });
  const custom = !!entry.next;

  return (
    <div className="rounded-xl border border-rule px-3 pt-2.5 pb-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-mute">Next time {custom ? "(your call)" : "(suggested)"}</span>
        <div className="flex gap-1">
          <Quick label="Same" onClick={() => set(entry.sets.map((s, i) => ({ w: s.w, lo: next[i]?.lo ?? ex.range[0], hi: next[i]?.hi ?? ex.range[1] })))} />
          <Quick label="All up" onClick={() => set(entry.sets.map((s, i) => ({ w: +(s.w + ex.inc).toFixed(2), lo: next[i]?.lo ?? ex.range[0], hi: next[i]?.hi ?? ex.range[1] })))} />
          {custom && <Quick label="Suggested" onClick={() => set(undefined)} />}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {next.map((t, i) => {
          const was = entry.sets[i]?.w ?? t.w;
          const dir = t.w > was ? "up" : t.w < was ? "down" : "same";
          return (
            <button
              key={i}
              onClick={() => setEdit(edit === i ? null : i)}
              className={cx("flex items-center gap-1.5 rounded-xl bg-bench px-3 py-2", edit === i && "ring-1 ring-chalk")}
              aria-label={`Set ${i + 1} next time: ${fmtW(t.w)} kilos for ${fmtRangeT(t)} reps`}
            >
              <span className={cx("text-sm", dir === "up" ? "text-green" : dir === "down" ? "text-amber" : "text-faint")} aria-hidden>
                {dir === "up" ? "▲" : dir === "down" ? "▼" : "="}
              </span>
              <span className="num text-xl">
                {fmtW(t.w)} × {fmtRangeT(t)}
              </span>
            </button>
          );
        })}
      </div>
      {edit !== null && next[edit] && (
        <div className="mt-3 space-y-3 rounded-xl bg-floor/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-mute">Set {edit + 1} weight</span>
            <WeightStepper value={next[edit].w} step={ex.inc} onChange={(w) => set(next.map((t, i) => (i === edit ? { ...t, w } : t)))} />
          </div>
          <div>
            <span className="text-sm text-mute">Rep range</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {RANGES.map(([lo, hi]) => {
                const on = next[edit].lo === lo && next[edit].hi === hi;
                return (
                  <button key={lo} onClick={() => set(next.map((t, i) => (i === edit ? { ...t, lo, hi } : t)))} className={cx("num rounded-lg px-3 py-1.5 text-lg", on ? "bg-chalk text-floor" : "bg-bench text-chalk")}>
                    {lo}–{hi}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <input
        className={cx(input, "mt-3 py-2 text-sm")}
        placeholder="Note for next time (seat 3, felt it in the shoulder…)"
        value={entry.note ?? ""}
        onChange={(e) => onChange({ ...entry, note: e.target.value || undefined })}
      />
    </div>
  );
}

const Quick = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick} className="rounded-lg px-2 py-1 text-sm font-medium text-mute hover:bg-bench hover:text-chalk">
    {label}
  </button>
);

function AddExerciseSheet({ db, session, open, onClose, onPick }: { db: DB; session: Session; open: boolean; onClose: () => void; onPick: (e: Exercise) => void }) {
  const [q, setQ] = useState("");
  const saveExercise = useSaveExercise();
  const inSession = new Set(session.entries.map((e) => e.ex));
  const list = db.exercises.filter((e) => !e.archived && !inSession.has(e.id) && (e.name + " " + e.short).toLowerCase().includes(q.toLowerCase()));
  const sameDay = list.filter((e) => session.day && e.day === session.day);
  const rest = list.filter((e) => !sameDay.includes(e)).sort((a, b) => a.group.localeCompare(b.group) || a.short.localeCompare(b.short));
  const save = (ex: Exercise) => {
    onPick(ex);
    setQ("");
  };
  const create = () => {
    const id = q.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36).slice(-3);
    const ex: Exercise = { id, name: q.trim(), short: q.trim(), group: "other", kind: "machine", inc: 5, range: [8, 12], day: session.day ?? undefined };
    void saveExercise(ex);
    save(ex);
  };
  const Row = ({ e }: { e: Exercise }) => {
    const h = history(db, e.id)[0];
    return (
      <button onClick={() => save(e)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-bench">
        <span className="h-6 w-1 rounded-full" style={{ background: dayColor(e.day) }} />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{e.short}</span>
          <span className="block truncate text-sm text-mute">
            {e.name}
            {h ? ` · ${fmtSets(h.entry.sets)}` : ""}
          </span>
        </span>
      </button>
    );
  };
  return (
    <Sheet open={open} onClose={onClose} title="Add exercise">
      <input autoFocus className={input} placeholder="Search or type a new name" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-3 space-y-0.5">
        {q.trim() && !list.some((e) => e.short.toLowerCase() === q.trim().toLowerCase()) && (
          <button onClick={create} className="w-full rounded-xl px-2 py-2.5 text-left font-medium hover:bg-bench">
            + New exercise “{q.trim()}”
          </button>
        )}
        {sameDay.length > 0 && <p className="px-2 pt-2 pb-1 text-sm text-mute">Usually on {DAYS[session.day!].label.toLowerCase()}</p>}
        {sameDay.map((e) => (
          <Row key={e.id} e={e} />
        ))}
        {rest.length > 0 && <p className="px-2 pt-3 pb-1 text-sm text-mute">Everything else</p>}
        {rest.map((e) => (
          <Row key={e.id} e={e} />
        ))}
      </div>
    </Sheet>
  );
}

/** Sticky bar while training: what day, how long, rest since the last set, save state. */
export function SessionBar({ session, onFinish }: { session: Session; onFinish: () => void }) {
  const now = useNow();
  const sync = useSync();
  const lastT = Math.max(0, ...session.entries.flatMap((e) => e.sets.map((s) => s.t ?? 0)));
  const label = session.day ? DAYS[session.day].label : "Session";
  return (
    <div className="safe-t sticky top-0 z-30 -mx-4 border-b border-rule bg-floor/95 px-4 backdrop-blur sm:mx-0 sm:rounded-b-2xl">
      <div className="flex items-center gap-3 py-2.5">
        <span className="h-8 w-1.5 rounded-full" style={{ background: dayColor(session.day) }} />
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
            <span className={cx(sync === "offline" ? "text-amber" : "text-faint")}>{sync === "offline" ? "saved on phone, will sync" : sync === "saving" ? "saving" : "saved"}</span>
          </div>
        </div>
        <button onClick={onFinish} className="rounded-xl bg-bench px-4 py-2 font-semibold">
          Finish
        </button>
      </div>
    </div>
  );
}

export function FinishSheet({ db, session, open, onClose, onFinish, onDiscard }: { db: DB; session: Session; open: boolean; onClose: () => void; onFinish: (note?: string) => void; onDiscard: () => void }) {
  const [note, setNote] = useState(session.note ?? "");
  const [sure, setSure] = useState(false);
  const m = exMap(db);
  const sets = session.entries.reduce((n, e) => n + e.sets.length, 0);
  const did = session.entries.filter((e) => e.sets.length);
  const prs = did.map((e) => ({ e, pr: prsIn(db, session, e) })).filter((x) => x.pr);
  const mins = Math.round((Date.now() - new Date(session.date).getTime()) / 60000);
  return (
    <Sheet open={open} onClose={onClose} title="Finish session">
      <p className="num text-3xl">
        {sets} sets, {did.length} exercises, {mins} min
      </p>
      {prs.length > 0 && (
        <div className="mt-3 rounded-xl bg-green/10 px-3 py-2.5">
          <p className="text-sm font-medium text-green">Best ever</p>
          {prs.map(({ e, pr }) => (
            <p key={e.ex}>
              {m.get(e.ex)?.short} <span className="num text-lg">{fmtW(pr!.w)} × {pr!.r}</span>
            </p>
          ))}
        </div>
      )}
      <div className="mt-3 space-y-1 text-sm">
        {did.map((e) => (
          <p key={e.ex}>
            <span className="text-mute">{m.get(e.ex)?.short}</span> {fmtSets(e.sets)} <span className="text-faint">→ {fmtTargets(nextOf(e, m.get(e.ex)!))}</span>
          </p>
        ))}
      </div>
      <textarea className={cx(input, "mt-4 min-h-20")} placeholder="Anything about today? (slept badly, gym was packed…)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button onClick={() => onFinish(note.trim() || undefined)} className="mt-4 w-full rounded-xl bg-chalk py-3.5 text-lg font-semibold text-floor">
        Finish session
      </button>
      <button onClick={() => (sure ? onDiscard() : setSure(true))} className="mt-2 w-full rounded-xl py-2.5 text-sm text-mute hover:text-red">
        {sure ? "Tap again to throw this session away" : "Discard session"}
      </button>
    </Sheet>
  );
}

export const sessionTitle = (s: Session) => `${s.day ? DAYS[s.day].label : "Session"}, ${fmtDate(s.date)}`;
