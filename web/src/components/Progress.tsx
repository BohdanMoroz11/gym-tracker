import { useEffect, useMemo, useRef, useState } from "react";
import type { DayId, DB, Group } from "../../../shared/types.ts";
import { DAYS, daysBetween, fmtDate, fmtW, GROUP_LABEL, KIND_LABEL, logged, series, setsByGroup, stalledFor, tips, trend, weekStart, weekStreak, type Point, type Tip, type Trend } from "../../../shared/logic.ts";
import { cx, dayColor, go } from "../lib.ts";

export function ProgressPage({ db }: { db: DB }) {
  const real = logged(db);
  const now = new Date();
  const thisMonth = real.filter((s) => new Date(s.date).getMonth() === now.getMonth() && new Date(s.date).getFullYear() === now.getFullYear()).length;
  const streak = weekStreak(db);
  const t = useMemo(() => tips(db), [db]);
  const monthName = now.toLocaleDateString("en-GB", { month: "long" });

  return (
    <div className="pt-4 pb-10">
      <h1 className="num text-5xl uppercase">Progress</h1>
      <p className="num mt-3 max-w-2xl text-3xl leading-tight text-mute">
        <span className="text-chalk">{thisMonth}</span> {thisMonth === 1 ? "session" : "sessions"} in {monthName}.{" "}
        {streak > 1 ? (
          <>
            <span className="text-chalk">{streak}</span> weeks in a row.
          </>
        ) : real.length ? (
          <>Every week with one session keeps the chain going.</>
        ) : (
          <>Stats start with the first session you log here.</>
        )}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-semibold">When you trained</h2>
          <Calendar db={db} />
        </section>
        <section>
          <h2 className="mb-1 font-semibold">Sets per muscle, last 4 weeks</h2>
          <p className="mb-3 text-sm text-mute">Roughly 10 or more a week per muscle is where growth usually happens. Anything near zero is a gap.</p>
          <Balance db={db} />
        </section>
      </div>

      {t.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Worth knowing</h2>
          <TipList tips={t} db={db} />
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-semibold">Exercises</h2>
        <ExerciseList db={db} />
      </section>
    </div>
  );
}

export function TipList({ tips, db }: { tips: Tip[]; db: DB }) {
  const color = { good: "var(--color-green)", info: "var(--color-blue)", nudge: "var(--color-amber)" };
  const icon = { good: "▲", info: "i", nudge: "!" };
  return (
    <ul className="space-y-2">
      {tips.map((t) => (
        <li key={t.id}>
          <button disabled={!t.ex} onClick={() => t.ex && go(`/ex/${t.ex}`)} className="flex w-full gap-3 rounded-2xl bg-mat p-4 text-left enabled:hover:bg-bench">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-floor" style={{ background: color[t.tone] }} aria-hidden>
              {icon[t.tone]}
            </span>
            <span className="text-sm leading-relaxed">{t.text}</span>
          </button>
        </li>
      ))}
      {!tips.length && db.sessions.length > 0 && <li className="text-sm text-mute">Nothing to flag.</li>}
    </ul>
  );
}

/** Week columns (Mon at the top), newest on the right. Imported sessions are left out: their dates are guesses. */
function Calendar({ db }: { db: DB }) {
  const WEEKS = 26;
  const byDay = new Map<string, { day: DayId | null; id: string }>();
  for (const s of logged(db)) byDay.set(new Date(s.date).toDateString(), { day: s.day, id: s.id });
  const start = weekStart(new Date());
  start.setDate(start.getDate() - (WEEKS - 1) * 7);
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  }, []);

  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const x = new Date(start);
      x.setDate(start.getDate() + w * 7 + d);
      return x;
    }),
  );
  const letter = { back: "B", chest: "C", legs: "L" } as const;

  return (
    <div className="rounded-2xl bg-mat p-4">
      <div ref={ref} className="no-scrollbar overflow-x-auto">
        <div className="flex w-max gap-[3px]">
          {weeks.map((days, w) => (
            <div key={w} className="flex flex-col gap-[3px]">
              <span className="h-4 w-[18px] overflow-visible text-xs whitespace-nowrap text-faint">{days.some((d) => d.getDate() === 1) || w === 0 ? days[6].toLocaleDateString("en-GB", { month: "short" }) : ""}</span>
              {days.map((d) => {
                const s = byDay.get(d.toDateString());
                const future = d > new Date();
                const label = `${fmtDate(d.toISOString())}: ${s ? (s.day ? DAYS[s.day].label : "Session") : "rest"}`;
                return s ? (
                  <button
                    key={d.getTime()}
                    onClick={() => go(`/s/${s.id}`)}
                    onMouseEnter={() => setHover(label)}
                    onFocus={() => setHover(label)}
                    onMouseLeave={() => setHover(null)}
                    className="grid h-[18px] w-[18px] place-items-center rounded-[4px] text-[10px] font-bold text-floor"
                    style={{ background: dayColor(s.day) }}
                    aria-label={label}
                  >
                    {s.day ? letter[s.day] : ""}
                  </button>
                ) : (
                  <span key={d.getTime()} className={cx("h-[18px] w-[18px] rounded-[4px]", future ? "bg-transparent" : "bg-bench/70")} />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-mute">
        {(["back", "chest", "legs"] as const).map((d) => (
          <span key={d} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[3px]" style={{ background: dayColor(d) }} />
            {DAYS[d].label}
          </span>
        ))}
        <span className="flex-1" />
        <span className="text-chalk">{hover ?? "Last 6 months"}</span>
      </div>
    </div>
  );
}

function Balance({ db }: { db: DB }) {
  const g = setsByGroup(db, 28);
  const rows: Group[] = ["back", "traps", "biceps", "chest", "shoulders", "triceps", "core", "legs"];
  const max = Math.max(40, ...rows.map((r) => g[r]));
  return (
    <div className="space-y-2 rounded-2xl bg-mat p-4">
      {rows.map((r) => (
        <div key={r} className="grid grid-cols-[5.5rem_1fr] items-center gap-3" title={`${GROUP_LABEL[r]}: ${g[r]} sets in 4 weeks`}>
          <span className="text-sm text-mute">{GROUP_LABEL[r]}</span>
          <div className="flex items-center gap-2">
            {g[r] > 0 && <div className="h-3 rounded-r-[4px] bg-chalk/75" style={{ width: `${(g[r] / max) * 85}%` }} />}
            <span className={cx("num text-lg", g[r] ? "text-chalk" : "text-faint")}>{g[r] || "none"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const TREND: Record<Trend, { label: string; icon: string; cls: string }> = {
  up: { label: "climbing", icon: "▲", cls: "text-green" },
  flat: { label: "steady", icon: "=", cls: "text-mute" },
  down: { label: "slipping", icon: "▼", cls: "text-amber" },
  new: { label: "new", icon: "", cls: "text-faint" },
};

function ExerciseList({ db }: { db: DB }) {
  const rows = db.exercises
    .filter((e) => !e.archived && !e.oneoff)
    .map((e) => ({ e, p: series(db, e.id) }))
    .filter((x) => x.p.length);
  const groups: (DayId | "other")[] = ["back", "chest", "legs", "other"];
  if (!rows.length) return <p className="text-sm text-mute">Log a few sessions and each exercise gets its own trend here.</p>;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {groups.map((g) => {
        const rs = rows.filter((x) => (x.e.day ?? "other") === g);
        if (!rs.length) return null;
        return (
          <div key={g}>
            <h3 className="mb-2 flex items-center gap-2 text-sm text-mute">
              <span className="h-3 w-1.5 rounded-full" style={{ background: dayColor(g === "other" ? null : g) }} />
              {g === "other" ? "Other" : DAYS[g].label}
            </h3>
            <div className="divide-y divide-rule/60 rounded-2xl bg-mat">
              {rs.map(({ e, p }) => {
                const tr = TREND[trend(p)];
                const last = p[p.length - 1];
                const stuck = stalledFor(p);
                return (
                  <button key={e.id} onClick={() => go(`/ex/${e.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-bench">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{e.name}</div>
                      <div className="text-sm text-mute">
                        {KIND_LABEL[e.kind]}, best{" "}
                        <span className="num text-base text-chalk">
                          {fmtW(last.top.w)}kg × {last.top.r}
                        </span>{" "}
                        {daysBetween(last.date) > 0 && !last.approx ? `· ${daysBetween(last.date)}d ago` : ""}
                      </div>
                    </div>
                    <Spark points={p} />
                    <div className={cx("w-20 text-right text-sm", tr.cls)} title={stuck >= 3 ? `No new best in ${stuck} sessions` : undefined}>
                      <span aria-hidden>{tr.icon}</span> {tr.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Spark({ points }: { points: Point[] }) {
  const p = points.slice(-12);
  const W = 72;
  const H = 26;
  if (p.length < 2) return <span className="w-[72px]" />;
  const ys = p.map((x) => x.e1rm);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const y = (v: number) => (hi === lo ? H / 2 : H - 3 - ((v - lo) / (hi - lo)) * (H - 6));
  const x = (i: number) => 3 + (i / (p.length - 1)) * (W - 6);
  return (
    <svg width={W} height={H} aria-hidden className="shrink-0">
      <polyline points={p.map((v, i) => `${x(i)},${y(v.e1rm)}`).join(" ")} fill="none" stroke="var(--color-mute)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(p.length - 1)} cy={y(ys[ys.length - 1])} r={3.5} fill="var(--color-chalk)" stroke="var(--color-mat)" strokeWidth={2} />
    </svg>
  );
}

