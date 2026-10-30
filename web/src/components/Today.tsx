import { useEffect, useMemo, useState } from "react";
import type { DB, Mode, Session } from "../../../shared/types.ts";
import { active, agoLabel, applyMode, COMEBACK_DAYS, daysBetween, done, exMap, fmtSets, fmtTargets, followProgram, programOf, sessionLabel, startSession, suggestDay, targetsFor, tips } from "../../../shared/logic.ts";
import { cx, dayColor, go, useDeleteSession, useSaveSession } from "../lib.ts";
import { FinishSheet, SessionBar, SessionEditor } from "./Session.tsx";
import { ProgramSheet } from "./Program.tsx";
import { pill, Segmented } from "./ui.tsx";
import { TipList } from "./Progress.tsx";

const STALE_MS = 4 * 3_600_000;

export function TodayPage({ db }: { db: DB }) {
  const save = useSaveSession();
  const del = useDeleteSession();
  const live = active(db);

  // A session left open (forgot to tap Finish) closes itself at its last set.
  useEffect(() => {
    if (!live) return;
    const lastT = Math.max(new Date(live.date).getTime(), ...live.entries.flatMap((e) => e.sets.map((s) => s.t ?? 0)));
    if (Date.now() - lastT > STALE_MS) {
      if (live.entries.some((e) => e.sets.length)) save({ ...live, end: new Date(lastT).toISOString() });
      else del(live.id);
    }
  }, [live?.id]);

  if (live) return <Live db={db} live={live} />;
  return <Start db={db} onStart={(s) => save(s)} />;
}

function Live({ db, live }: { db: DB; live: Session }) {
  const save = useSaveSession();
  const del = useDeleteSession();
  const [finishing, setFinishing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);
  const program = programOf(db, live.day);

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <SessionBar db={db} session={live} editing={editing} onEdit={() => setEditing(!editing)} onFinish={() => setFinishing(true)} />
      {editing && (
        <div className="mt-3 space-y-2 rounded-2xl border-2 border-dashed border-rule p-3">
          <p className="text-sm text-mute">Open an exercise to move it, remove it or change its setup.</p>
          {program && (
            <button onClick={() => setProgramOpen(true)} className={cx(pill, "h-12 w-full")}>
              Edit the {program.name.toLowerCase()} program
            </button>
          )}
        </div>
      )}
      <div className="mt-4">
        <SessionEditor db={db} session={live} onChange={save} live editing={editing} />
      </div>
      {program && <ProgramSheet db={db} program={program} open={programOpen} onClose={() => setProgramOpen(false)} onChange={(p) => save(followProgram(db, live, p))} />}
      <FinishSheet
        db={db}
        session={live}
        open={finishing}
        onClose={() => setFinishing(false)}
        onFinish={(fin) => {
          save({ ...live, ...fin });
          setFinishing(false);
        }}
        onDiscard={() => {
          del(live.id);
          setFinishing(false);
        }}
      />
    </div>
  );
}

function Start({ db, onStart }: { db: DB; onStart: (s: Session) => void }) {
  const [day, setDay] = useState<string | null>(() => suggestDay(db));
  const last = done(db)[0];
  const gap = last ? daysBetween(last.date) : 0;
  const [mode, setMode] = useState<Mode>(gap >= COMEBACK_DAYS ? "comeback" : "normal");
  const m = exMap(db);
  const t = useMemo(() => tips(db), [db]);

  const program = programOf(db, day);
  const plan = (program?.items ?? []).map((id) => m.get(id)).filter((x) => !!x);
  const lastOfDay = day && done(db).find((s) => s.day === day);
  const label = program?.name ?? "Empty session";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const color = program ? dayColor(db, day) : "var(--color-chalk)";

  return (
    <div className="grid gap-8 pt-4 pb-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:pt-8">
      <div>
        <p className="text-mute">{today}</p>
        <h1 className="num mt-1 text-[clamp(3.5rem,14vw,6.5rem)] leading-[0.9] uppercase">{label}</h1>
        <div className="mt-3 h-2 w-24 rounded-full" style={{ background: color }} />
        <p className="mt-4 text-mute">
          {!program ? "Pick exercises as you go." : lastOfDay ? <>Last one {lastOfDay.approx ? "is in your old notes" : agoLabel(lastOfDay.date)}.</> : <>Never logged yet.</>}
        </p>

        {program && (
          <>
            <ol className="mt-6 divide-y divide-rule/60 rounded-2xl bg-mat px-4">
              {plan.map((ex, i) => {
                const ts = applyMode(targetsFor(db, ex), mode, ex);
                return (
                  <li key={ex.id} className="flex items-baseline gap-3 py-3">
                    <span className="num w-5 shrink-0 text-lg text-faint">{i + 1}</span>
                    <span className="min-w-0 flex-1 font-medium">{ex.name}</span>
                    <span className="num shrink-0 text-right text-lg text-mute">{ts.length ? fmtTargets(ts) : "new"}</span>
                  </li>
                );
              })}
              {!plan.length && <li className="py-4 text-mute">No exercises in this program yet.</li>}
            </ol>
            <button onClick={() => go("/program")} className={cx(pill, "mt-2")}>
              Edit program
            </button>
          </>
        )}

        <div className="mt-6 space-y-2">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "normal", label: "Normal" },
              { value: "comeback", label: "Lighter" },
              { value: "deload", label: "Deload" },
            ]}
          />
          <p className="text-sm text-mute">
            {mode === "comeback" ? "About 15% off every weight." : mode === "deload" ? "About 40% off. Doesn't change next time's weights." : gap >= COMEBACK_DAYS ? `${gap} days off. Lighter is an option.` : ""}
          </p>
        </div>

        <button onClick={() => onStart(startSession(db, day, mode))} className="mt-4 w-full rounded-2xl py-4 text-xl font-semibold text-floor sm:w-auto sm:px-10" style={{ background: color }}>
          Start {label.toLowerCase()}
        </button>

        <div className="mt-4 flex flex-wrap gap-2">
          {[...db.programs.map((p) => p.id), null]
            .filter((d) => d !== day)
            .map((d) => (
              <button key={d ?? "free"} onClick={() => setDay(d)} className="flex h-11 items-center gap-2 rounded-xl bg-mat px-4 font-medium active:bg-bench hover:bg-bench">
                <span className="h-3 w-3 rounded-full" style={{ background: dayColor(db, d) }} />
                {programOf(db, d)?.name ?? "Empty session"}
              </button>
            ))}
        </div>
      </div>

      <aside className="space-y-6">
        {t.length > 0 && <TipList tips={t.slice(0, 3)} db={db} />}
        {last && (
          <div>
            <h2 className="mb-2 text-sm text-mute">Last session</h2>
            <button onClick={() => go(`/s/${last.id}`)} className="w-full rounded-2xl bg-mat p-4 text-left hover:bg-bench">
              <div className="flex items-center gap-2">
                <span className="h-4 w-1.5 rounded-full" style={{ background: dayColor(db, last.day) }} />
                <span className="font-semibold">{sessionLabel(db, last)}</span>
                <span className="text-sm text-mute">{last.approx ? "from old notes" : agoLabel(last.date)}</span>
              </div>
              <div className="mt-2 space-y-0.5 text-sm">
                {last.entries
                  .filter((e) => e.sets.length)
                  .map((e) => (
                    <p key={e.ex} className="truncate">
                      <span className="text-mute">{m.get(e.ex)?.name}</span> {fmtSets(e.sets)}
                      {e.note && <span className="text-faint"> ({e.note})</span>}
                    </p>
                  ))}
              </div>
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
