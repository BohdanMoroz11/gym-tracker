import { useEffect, useRef, useState } from "react";
import type { DB, Exercise, Group, Kind } from "../../../shared/types.ts";
import { equipLabel, fmtSets, fmtW, GROUP_LABEL, history, isFree, isStack, KINDS, programsWith, slug } from "../../../shared/logic.ts";
import { COLOR_VAR, cx, go, useSaveExercise } from "../lib.ts";
import { AimPicker, Field, input, pill, Sheet, Toggle } from "./ui.tsx";

const GROUPS: Group[] = ["chest", "back", "shoulders", "biceps", "triceps", "traps", "core", "legs", "other"];

/** The exercise database: every exercise, grouped by equipment, tap to edit. */
export function ExercisesPage({ db }: { db: DB }) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const all = db.exercises.filter((e) => !e.oneoff && e.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  const shown = all.filter((e) => !e.archived);
  const hidden = all.filter((e) => e.archived);
  const ex = editing ? db.exercises.find((e) => e.id === editing) : undefined;

  return (
    <div className="mx-auto max-w-2xl pt-4 pb-10">
      <h1 className="num text-5xl uppercase">Exercises</h1>
      <p className="mt-1 text-mute">Tap one to change its name, equipment, weight step or the note that stays.</p>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input className={cx(input, "bg-mat")} placeholder="Filter" value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={() => setCreating(true)} className="h-12 rounded-xl bg-chalk px-4 font-semibold text-floor">
          + New
        </button>
      </div>
      <ExerciseSection db={db} title="Machines and cables" items={shown.filter((e) => !isFree(e))} onPick={setEditing} />
      <ExerciseSection db={db} title="Free weights" items={shown.filter(isFree)} onPick={setEditing} />
      {!all.length && <p className="pt-6 text-mute">Nothing matches.</p>}
      {hidden.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowHidden(!showHidden)} className={cx(pill, "w-full")}>
            {showHidden ? "Hide" : "Show"} {hidden.length} hidden
          </button>
          {showHidden && <ExerciseSection db={db} title="Hidden" items={hidden} onPick={setEditing} />}
        </div>
      )}
      {ex && <ExerciseSheet db={db} ex={ex} open onClose={() => setEditing(null)} />}
      <Sheet open={creating} onClose={() => setCreating(false)} title="New exercise">
        <NewExercise initial={q} action="Add exercise" onCancel={() => setCreating(false)} onCreate={() => setCreating(false)} />
      </Sheet>
    </div>
  );
}

function ExerciseSection({ db, title, items, onPick }: { db: DB; title: string; items: Exercise[]; onPick: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-mute">{title}</h2>
      <div className="divide-y divide-rule/60 rounded-2xl bg-mat">
        {items.map((e) => {
          const h = history(db, e.id)[0];
          const ps = programsWith(db, e.id);
          return (
            <button key={e.id} onClick={() => onPick(e.id)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left active:bg-bench hover:bg-bench">
              <span className="flex w-1.5 shrink-0 flex-col gap-1 self-stretch">
                {ps.map((p) => (
                  <span key={p.id} className="min-h-3 flex-1 rounded-full" style={{ background: COLOR_VAR[p.color] }} />
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{e.name}</span>
                <span className="block text-sm text-mute">{equipLabel(e)}</span>
                {(h || ps.length > 0) && (
                  <span className="block truncate text-sm text-faint">
                    {ps.map((p) => p.name).join(", ")}
                    {ps.length > 0 && h && " · "}
                    {h && fmtSets(h.entry.sets)}
                  </span>
                )}
              </span>
              <span className={cx(pill, "pointer-events-none h-9 shrink-0 bg-bench px-3 text-sm")}>Edit</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Editing an exercise. Saves as you go. */
export function ExerciseSheet({ db, ex, open, onClose }: { db: DB; ex: Exercise; open: boolean; onClose: () => void }) {
  const save = useSaveExercise();
  const [e, setE] = useState(ex);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => setE(ex), [ex.id]);
  const set = (next: Exercise) => {
    setE(next);
    clearTimeout(t.current);
    t.current = setTimeout(() => save(next), 400);
  };
  const close = () => {
    clearTimeout(t.current);
    if (JSON.stringify(e) !== JSON.stringify(ex)) void save(e);
    onClose();
  };
  const ps = programsWith(db, ex.id);
  return (
    <Sheet open={open} onClose={close} title="Edit exercise">
      <ExerciseForm value={e} onChange={set} />
      <div className="mt-5 space-y-2">
        <p className="text-sm text-mute">{ps.length ? `In ${ps.map((p) => p.name).join(" and ")}. Change that on the Program tab.` : "Not in any program."}</p>
        <Toggle label="Hidden" sub="Leaves the lists. History stays." value={!!e.archived} onChange={(archived) => set({ ...e, archived: archived || undefined })} />
        <button
          onClick={() => {
            close();
            go(`/ex/${ex.id}`);
          }}
          className={cx(pill, "h-12 w-full")}
        >
          History and chart
        </button>
      </div>
    </Sheet>
  );
}

export function ExerciseForm({ value: e, onChange }: { value: Exercise; onChange: (e: Exercise) => void }) {
  const set = (patch: Partial<Exercise>) => onChange({ ...e, ...patch });
  const kind = KINDS.find((k) => k.value === e.kind)!;
  return (
    <div className="space-y-5">
      <Field label="Name">
        <input className={input} placeholder="e.g. Pec deck" value={e.name} onChange={(x) => set({ name: x.target.value })} />
      </Field>
      <div>
        <div className="mb-1.5 text-sm text-mute">Equipment</div>
        <div className="grid grid-cols-2 gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.value}
              onClick={() => set({ kind: k.value, inc: defaultInc(k.value, e) })}
              aria-pressed={k.value === e.kind}
              className={cx("min-h-12 rounded-xl px-2 py-2 text-[15px] leading-tight font-medium", k.value === e.kind ? "bg-chalk text-floor" : "bg-bench active:bg-rule")}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-sm text-mute">{kind.hint}.</p>
      </div>
      <Toggle
        label={e.kind === "dumbbell" ? "One arm at a time" : "One side at a time"}
        sub={e.kind === "dumbbell" ? "Off = both arms together. Weight is per dumbbell either way." : "Same weight and reps for each side, logged once."}
        value={e.side === "each"}
        onChange={(v) => set({ side: v ? "each" : undefined })}
      />
      <Field label={isStack(e) ? "Stack step, kg (the − + buttons and “+weight”)" : "Usual jump, kg (what “+weight” adds)"}>
        <div className="grid grid-cols-5 gap-1.5">
          {(isStack(e) ? [2.5, 5, 6, 7, 10] : [0.5, 1, 1.25, 2.5, 5]).map((v) => (
            <button key={v} onClick={() => set({ inc: v })} aria-pressed={v === e.inc} className={cx("num h-12 min-w-0 rounded-xl text-xl", v === e.inc ? "bg-chalk text-floor" : "bg-bench active:bg-rule")}>
              {fmtW(v)}
            </button>
          ))}
        </div>
      </Field>
      <div>
        <div className="mb-1.5 text-sm text-mute">Usual rep goal for a new set</div>
        <AimPicker value={e.aim} onChange={(aim) => set({ aim })} />
      </div>
      <div>
        <div className="mb-1.5 text-sm text-mute">Muscle</div>
        <div className="grid grid-cols-3 gap-1.5">
          {GROUPS.map((g) => (
            <button key={g} onClick={() => set({ group: g })} aria-pressed={g === e.group} className={cx("h-11 rounded-xl text-[15px] font-medium", g === e.group ? "bg-chalk text-floor" : "bg-bench active:bg-rule")}>
              {GROUP_LABEL[g]}
            </button>
          ))}
        </div>
      </div>
      <Field label="Note that stays (shown every time)">
        <textarea rows={3} className={cx(input, "h-auto py-3")} value={e.note ?? ""} placeholder="Seat on 4, keep elbows down…" onChange={(x) => set({ note: x.target.value || undefined })} />
      </Field>
    </div>
  );
}

const defaultInc = (k: Kind, e: Exercise) => {
  const stack = k === "stack" || k === "cable";
  if (stack === isStack(e)) return e.inc;
  return stack ? 6 : 2.5;
};

export function NewExercise({ initial, action, onCancel, onCreate }: { initial: string; action: string; onCancel: () => void; onCreate: (e: Exercise) => void }) {
  const saveExercise = useSaveExercise();
  const [e, setE] = useState<Exercise>({ id: "", name: initial, kind: "stack", group: "back", inc: 6, aim: 10 });
  return (
    <div className="space-y-5">
      <ExerciseForm value={e} onChange={setE} />
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onCancel} className={cx(pill, "h-12")}>
          Cancel
        </button>
        <button
          disabled={!e.name.trim()}
          onClick={() => {
            const full = { ...e, name: e.name.trim(), id: slug(e.name) };
            void saveExercise(full);
            onCreate(full);
          }}
          className="h-12 rounded-xl bg-chalk font-semibold text-floor disabled:opacity-40"
        >
          {action}
        </button>
      </div>
    </div>
  );
}

/** Pick an exercise for a session or a program. Opens on the list; new and one-off are a tap away. */
export function ExercisePicker({
  db,
  open,
  onClose,
  onPick,
  exclude,
  first,
  allowOneOff,
}: {
  db: DB;
  open: boolean;
  onClose: () => void;
  onPick: (e: Exercise) => void;
  exclude: Set<string>;
  first?: { title: string; ids: string[] };
  allowOneOff?: boolean;
}) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"list" | "new" | "oneoff">("list");
  const saveExercise = useSaveExercise();
  const list = db.exercises.filter((e) => !e.archived && !e.oneoff && !exclude.has(e.id) && e.name.toLowerCase().includes(q.toLowerCase()));
  const top = first ? list.filter((e) => first.ids.includes(e.id)) : [];
  const rest = list.filter((e) => !top.includes(e)).sort((a, b) => a.name.localeCompare(b.name));
  const reset = () => {
    setQ("");
    setMode("list");
  };
  const pick = (ex: Exercise) => {
    onPick(ex);
    reset();
  };

  const Section = ({ title, items }: { title: string; items: Exercise[] }) =>
    items.length ? (
      <div>
        <h3 className="px-3 pt-4 pb-1 text-sm font-semibold text-mute">{title}</h3>
        {items.map((e) => {
          const h = history(db, e.id)[0];
          return (
            <button key={e.id} onClick={() => pick(e)} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left active:bg-bench hover:bg-bench">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{e.name}</span>
                <span className="block truncate text-sm text-mute">{h ? fmtSets(h.entry.sets) : equipLabel(e)}</span>
              </span>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bench text-xl text-chalk" aria-hidden>
                +
              </span>
            </button>
          );
        })}
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
          <div className={cx("grid gap-2", allowOneOff ? "grid-cols-2" : "grid-cols-1")}>
            <button onClick={() => setMode("new")} className={cx(pill, "h-12")}>
              + New exercise
            </button>
            {allowOneOff && (
              <button onClick={() => setMode("oneoff")} className={cx(pill, "h-12")}>
                + One-off
              </button>
            )}
          </div>
          <input className={cx(input, "mt-3")} placeholder="Filter the list" value={q} onChange={(e) => setQ(e.target.value)} />
          {first && <Section title={first.title} items={top} />}
          <Section title="Machines and cables" items={rest.filter((e) => !isFree(e))} />
          <Section title="Free weights" items={rest.filter(isFree)} />
          {!list.length && <p className="px-3 pt-4 text-mute">Nothing matches. Add it as a new exercise{allowOneOff && " or a one-off"}.</p>}
        </>
      )}
      {mode === "new" && <NewExercise initial={q} action="Add" onCancel={() => setMode("list")} onCreate={pick} />}
      {mode === "oneoff" && (
        <OneOff
          onCancel={() => setMode("list")}
          onCreate={(name) => {
            const full: Exercise = { id: slug(name), name, group: "other", kind: "stack", inc: 5, aim: 10, oneoff: true };
            void saveExercise(full);
            pick(full);
          }}
        />
      )}
    </Sheet>
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
