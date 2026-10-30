import { useEffect, useRef, useState } from "react";
import type { DB, Exercise } from "../../../shared/types.ts";
import { equipLabel, fmtDate, fmtSets, fmtTargets, fmtW, history, nextOf, programsWith, series, type Point } from "../../../shared/logic.ts";
import { COLOR_VAR, go, useSaveExercise } from "../lib.ts";
import { ExerciseForm } from "./Exercises.tsx";
import { pill, Toggle } from "./ui.tsx";

export function ExercisePage({ db, id }: { db: DB; id: string }) {
  const ex = db.exercises.find((e) => e.id === id);
  if (!ex) return <p className="py-16 text-center text-mute">No exercise with that name.</p>;
  const h = history(db, id);
  const p = series(db, id);
  return (
    <div className="pt-4 pb-10">
      <button onClick={() => history_back()} className={pill}>
        ‹ Back
      </button>
      <div className="mt-2 flex items-center gap-3">
        <span className="h-10 w-2 shrink-0 rounded-full" style={{ background: programsWith(db, ex.id)[0] ? COLOR_VAR[programsWith(db, ex.id)[0].color] : "var(--color-faint)" }} />
        <div>
          <h1 className="num text-4xl leading-none uppercase">{ex.name}</h1>
          <p className="text-mute">{equipLabel(ex)}</p>
        </div>
      </div>
      {ex.note && <p className="mt-4 rounded-xl border-l-4 border-chalk bg-mat px-3.5 py-3 text-[17px] whitespace-pre-line">{ex.note}</p>}
      {h[0] && (
        <p className="mt-4 text-mute">
          Next time <span className="num text-xl text-chalk">{fmtTargets(nextOf(h[0].entry, ex))}</span>
        </p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <section>
            <h2 className="mb-1 font-semibold">Heaviest set each session, kg</h2>
            <p className="mb-3 text-sm text-mute">Hollow dots come from the old notes and may be off.</p>
            <Chart points={p} />
          </section>
          <section>
            <h2 className="mb-2 font-semibold">Every time</h2>
            <div className="divide-y divide-rule/60 rounded-2xl bg-mat">
              {h.map(({ session, entry }) => (
                <button key={session.id} onClick={() => go(`/s/${session.id}`)} className="flex w-full items-baseline gap-3 px-4 py-2.5 text-left hover:bg-bench">
                  <span className="w-24 shrink-0 text-sm text-mute">{session.approx ? "old notes" : fmtDate(session.date)}</span>
                  <span className="num text-lg whitespace-nowrap">{fmtSets(entry.sets)}</span>
                  {entry.note && <span className="truncate text-sm text-faint">{entry.note}</span>}
                </button>
              ))}
              {!h.length && <p className="px-4 py-3 text-sm text-mute">Not logged yet.</p>}
            </div>
          </section>
        </div>
        <Settings key={ex.id} ex={ex} />
      </div>
    </div>
  );
}

const history_back = () => (window.history.length > 1 ? window.history.back() : go("/exercises"));

function Settings({ ex }: { ex: Exercise }) {
  const save = useSaveExercise();
  const [e, setE] = useState(ex);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const set = (next: Exercise) => {
    setE(next);
    clearTimeout(t.current);
    t.current = setTimeout(() => save(next), 400);
  };
  return (
    <section className="space-y-4 self-start rounded-2xl bg-mat p-4">
      <h2 className="font-semibold">Setup</h2>
      <ExerciseForm value={e} onChange={set} />
      <Toggle label="Hidden" sub="Leaves the lists. History stays." value={!!e.archived} onChange={(archived) => set({ ...e, archived: archived || undefined })} />
    </section>
  );
}

/** Single series: heaviest set per session. Crosshair + readout on hover or tap. */
function Chart({ points }: { points: Point[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hi, setHi] = useState<number | null>(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  if (points.length < 2) return <p className="rounded-2xl bg-mat p-4 text-sm text-mute">A line shows up after two sessions.</p>;

  const H = 200;
  const pad = { l: 34, r: 12, t: 12, b: 24 };
  const ys = points.map((p) => p.top.w);
  let lo = Math.min(...ys);
  let top = Math.max(...ys);
  const span = Math.max(top - lo, 4);
  lo = Math.max(0, Math.floor((lo - span * 0.2) / 2) * 2);
  top = Math.ceil((top + span * 0.15) / 2) * 2;
  const X = (i: number) => pad.l + (i / (points.length - 1)) * (w - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - (v - lo) / (top - lo)) * (H - pad.t - pad.b);
  const ticks = [lo, (lo + top) / 2, top].map((v) => Math.round(v));
  const sel = hi !== null ? points[hi] : points[points.length - 1];
  const si = hi ?? points.length - 1;

  const pick = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    const i = Math.round(((clientX - r.left - pad.l) / (w - pad.l - pad.r)) * (points.length - 1));
    setHi(Math.max(0, Math.min(points.length - 1, i)));
  };

  return (
    <div className="rounded-2xl bg-mat p-4">
      <div className="mb-2 flex items-baseline gap-2 text-sm">
        <span className="text-mute">{sel.approx ? "old notes" : fmtDate(sel.date)}</span>
        <span className="num text-xl">
          {fmtW(sel.top.w)}kg × {sel.top.r}
        </span>
        {sel.mode !== "normal" && <span className="text-mute">{sel.mode === "deload" ? "deload" : "lighter"}</span>}
      </div>
      <div ref={box} className="w-full touch-pan-y overflow-hidden" onPointerMove={(e) => pick(e.clientX)} onPointerDown={(e) => pick(e.clientX)} onPointerLeave={() => setHi(null)}>
        {w > 0 && <svg width={w} height={H} role="img" aria-label={`Heaviest set over ${points.length} sessions, from ${fmtW(ys[0])} to ${fmtW(ys[ys.length - 1])} kg`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={Y(t)} y2={Y(t)} stroke="var(--color-rule)" strokeWidth={1} />
              <text x={pad.l - 8} y={Y(t) + 4} textAnchor="end" fontSize={12} fill="var(--color-faint)">
                {t}
              </text>
            </g>
          ))}
          <line x1={X(si)} x2={X(si)} y1={pad.t} y2={H - pad.b} stroke="var(--color-faint)" strokeWidth={1} />
          <polyline points={points.map((p, i) => `${X(i)},${Y(p.top.w)}`).join(" ")} fill="none" stroke="var(--color-chalk)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <circle key={i} cx={X(i)} cy={Y(p.top.w)} r={i === si ? 5.5 : 4} fill={p.approx ? "var(--color-mat)" : "var(--color-chalk)"} stroke={p.approx ? "var(--color-chalk)" : "var(--color-mat)"} strokeWidth={2} />
          ))}
        </svg>}
      </div>
    </div>
  );
}
