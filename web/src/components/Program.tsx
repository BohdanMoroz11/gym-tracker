import { useEffect, useState } from "react";
import type { Color, DB, Program } from "../../../shared/types.ts";
import { COLORS, exMap, fmtTargets, newId, targetsFor } from "../../../shared/logic.ts";
import { COLOR_VAR, cx, useDeleteProgram, useSaveProgram } from "../lib.ts";
import { ExercisePicker } from "./Exercises.tsx";
import { input, pill, Sheet } from "./ui.tsx";

/** Programs = day types: which exercises, in which order. Weights and reps come from the last session, not from here. */
export function ProgramPage({ db }: { db: DB }) {
  const save = useSaveProgram();
  const [editing, setEditing] = useState<string | null>(null);
  const create = () => {
    const used = new Set(db.programs.map((p) => p.color));
    const p: Program = { id: newId(), name: "New day", color: COLORS.find((c) => !used.has(c)) ?? "chalk", items: [] };
    void save(p);
    setEditing(p.id);
  };
  return (
    <div className="mx-auto max-w-2xl pt-4 pb-10">
      <h1 className="num text-5xl uppercase">Program</h1>
      <p className="mt-1 text-mute">Which exercises each day has, in order. Weights and reps carry over from the last session.</p>
      <div className="mt-5 space-y-4">
        {db.programs.map((p) => (
          <section key={p.id} className="rounded-2xl bg-mat p-4">
            {editing === p.id ? (
              <ProgramEditor db={db} program={p} onDone={() => setEditing(null)} />
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="h-8 w-2 shrink-0 rounded-full" style={{ background: COLOR_VAR[p.color] }} />
                  <h2 className="num min-w-0 flex-1 truncate text-3xl uppercase">{p.name}</h2>
                  <button onClick={() => setEditing(p.id)} className={cx(pill, "shrink-0")}>
                    Edit
                  </button>
                </div>
                <ProgramList db={db} program={p} />
              </>
            )}
          </section>
        ))}
        <button onClick={create} className="flex h-14 w-full items-center justify-center rounded-2xl border-2 border-dashed border-rule text-lg font-medium active:bg-mat hover:bg-mat">
          + New day type
        </button>
      </div>
    </div>
  );
}

export function ProgramList({ db, program }: { db: DB; program: Program }) {
  const m = exMap(db);
  const items = program.items.map((id) => m.get(id)).filter((x) => !!x);
  if (!items.length) return <p className="mt-3 text-mute">No exercises yet.</p>;
  return (
    <ol className="mt-3 divide-y divide-rule/60">
      {items.map((ex, i) => {
        const ts = targetsFor(db, ex);
        return (
          <li key={ex.id} className="flex items-baseline gap-3 py-2.5">
            <span className="num w-5 shrink-0 text-lg text-faint">{i + 1}</span>
            <span className="min-w-0 flex-1 font-medium">{ex.name}</span>
            <span className="num shrink-0 text-right text-lg text-mute">{ts.length ? fmtTargets(ts) : "new"}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Rename, reorder, add and remove. Every change saves right away. */
export function ProgramEditor({ db, program, onDone, onChange }: { db: DB; program: Program; onDone: () => void; onChange?: (p: Program) => void }) {
  const save = useSaveProgram();
  const del = useDeleteProgram();
  const m = exMap(db);
  const [p, setP] = useState(program);
  const [adding, setAdding] = useState(false);
  const [sure, setSure] = useState(false);
  useEffect(() => setP(program), [program.id]);
  const set = (next: Program) => {
    setP(next);
    void save(next);
    onChange?.(next);
  };
  const move = (i: number, d: -1 | 1) => {
    const items = [...p.items];
    [items[i], items[i + d]] = [items[i + d], items[i]];
    set({ ...p, items });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input className={cx(input, "num text-2xl uppercase")} value={p.name} onChange={(e) => set({ ...p, name: e.target.value })} aria-label="Name" />
        <button onClick={onDone} className="h-12 rounded-xl bg-chalk px-5 font-semibold text-floor">
          Done
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-mute">Color</span>
        {COLORS.map((c: Color) => (
          <button key={c} onClick={() => set({ ...p, color: c })} aria-pressed={c === p.color} aria-label={c} className={cx("grid h-11 w-11 place-items-center rounded-xl", c === p.color ? "bg-bench ring-2 ring-chalk ring-inset" : "bg-bench")}>
            <span className="h-5 w-5 rounded-full" style={{ background: COLOR_VAR[c] }} />
          </button>
        ))}
      </div>
      <ol className="space-y-1.5">
        {p.items.map((id, i) => (
          <li key={id} className="flex items-center gap-2 rounded-xl bg-bench py-1.5 pr-1.5 pl-3">
            <span className="num w-5 shrink-0 text-lg text-faint">{i + 1}</span>
            <span className="min-w-0 flex-1 font-medium">{m.get(id)?.name ?? id}</span>
            <button disabled={i === 0} onClick={() => move(i, -1)} className={cx(pill, "w-11 shrink-0 bg-rule px-0 text-xl disabled:opacity-30")} aria-label={`Move ${m.get(id)?.name} up`}>
              ↑
            </button>
            <button disabled={i === p.items.length - 1} onClick={() => move(i, 1)} className={cx(pill, "w-11 shrink-0 bg-rule px-0 text-xl disabled:opacity-30")} aria-label={`Move ${m.get(id)?.name} down`}>
              ↓
            </button>
            <button onClick={() => set({ ...p, items: p.items.filter((x) => x !== id) })} className={cx(pill, "w-11 shrink-0 bg-rule px-0 text-xl")} aria-label={`Remove ${m.get(id)?.name}`}>
              ×
            </button>
          </li>
        ))}
      </ol>
      <button onClick={() => setAdding(true)} className="flex h-12 w-full items-center justify-center rounded-xl border-2 border-dashed border-rule font-medium active:bg-bench">
        + Add exercise
      </button>
      <button
        onClick={() => {
          if (!sure) return setSure(true);
          void del(p.id);
          onDone();
        }}
        className={cx(pill, "w-full bg-transparent", sure ? "text-red" : "text-mute")}
      >
        {sure ? `Tap again to delete ${p.name}` : "Delete this day type"}
      </button>
      <ExercisePicker
        db={db}
        open={adding}
        onClose={() => setAdding(false)}
        exclude={new Set(p.items)}
        onPick={(ex) => {
          set({ ...p, items: [...p.items, ex.id] });
          setAdding(false);
        }}
      />
    </div>
  );
}

/** The same editor during a session, in a sheet. */
export function ProgramSheet({ db, program, open, onClose, onChange }: { db: DB; program: Program; open: boolean; onClose: () => void; onChange: (p: Program) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Edit program">
      <p className="mb-4 text-sm text-mute">Changes the program for good. What you haven't started today follows it; done exercises stay as they are.</p>
      <ProgramEditor db={db} program={program} onDone={onClose} onChange={onChange} />
    </Sheet>
  );
}
