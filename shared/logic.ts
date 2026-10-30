import type { Color, DB, Entry, Exercise, Group, Kind, Mode, Program, Session, SetLog, Target } from "./types.ts";
import { LIBRARY, STARTER_PROGRAMS } from "./library.ts";

export const GROUP_LABEL: Record<Group, string> = {
  back: "Back",
  traps: "Traps",
  biceps: "Biceps",
  chest: "Chest",
  shoulders: "Shoulders",
  triceps: "Triceps",
  core: "Core",
  legs: "Legs",
  other: "Other",
};

export const MODE_FACTOR: Record<Mode, number> = { normal: 1, deload: 0.6, comeback: 0.85 };
/** A break this long offers comeback mode. */
export const COMEBACK_DAYS = 14;

const DAY_MS = 86_400_000;

// ---------- formatting ----------

export const fmtW = (w: number) => (Number.isInteger(w) ? String(w) : w.toFixed(2).replace(/0+$/, ""));

/** "15kg × 10, 12.5kg × 13"; identical sets collapse to "48kg × 10 (2 sets)". Works for sets and targets alike. */
export function fmtSets(sets: { w: number; r: number }[]): string {
  const out: string[] = [];
  for (let i = 0; i < sets.length; ) {
    let n = 1;
    while (i + n < sets.length && sets[i + n].w === sets[i].w && sets[i + n].r === sets[i].r) n++;
    out.push(`${fmtW(sets[i].w)}kg × ${sets[i].r}${n > 1 ? ` (${n} sets)` : ""}`);
    i += n;
  }
  return out.join(", ");
}
export const fmtTargets = (ts: Target[]) => fmtSets(ts);

export const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

// ---------- equipment ----------

export const KINDS: { value: Kind; label: string; hint: string }[] = [
  { value: "stack", label: "Machine, pin stack", hint: "Moves by its stack step" },
  { value: "plates", label: "Machine, plates", hint: "0.5 kg steps, ±2.5 and ±5 jumps" },
  { value: "cable", label: "Cable", hint: "Moves by its stack step" },
  { value: "dumbbell", label: "Dumbbells", hint: "Weight per dumbbell" },
  { value: "barbell", label: "Barbell", hint: "Total weight on the bar" },
  { value: "bodyweight", label: "Bodyweight", hint: "Added weight, 0 for none" },
];
export const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label])) as Record<Kind, string>;

export const isFree = (ex: Exercise) => ex.kind === "dumbbell" || ex.kind === "barbell" || ex.kind === "bodyweight";
/** Pin stacks and cables move by the stack step; plates and free weights by 0.5, with jump buttons for big changes. */
export const isStack = (ex: Exercise) => ex.kind === "stack" || ex.kind === "cable";
export const stepOf = (ex: Exercise) => (isStack(ex) ? ex.inc || 1 : 0.5);

/** "Dumbbells, both arms together", "Machine, pin stack · one side at a time". */
export function equipLabel(ex: Exercise): string {
  if (ex.kind === "dumbbell") return ex.side === "each" ? "Dumbbell, one arm at a time" : "Dumbbells, both arms together";
  return KIND_LABEL[ex.kind] + (ex.side === "each" ? ", one side at a time" : "");
}
/** What the weight number means, shown under the stepper. */
export function weightMeaning(ex: Exercise): string | undefined {
  if (ex.kind === "dumbbell") return "kg per dumbbell";
  if (ex.side === "each") return "kg per side, reps per side";
  if (ex.kind === "bodyweight") return "added kg";
  return undefined;
}

// ---------- programs ----------

export const COLORS: Color[] = ["blue", "red", "yellow", "chalk"];
export const programOf = (db: DB, id: string | null | undefined) => (id ? db.programs.find((p) => p.id === id) : undefined);
export const sessionLabel = (db: DB, s: Session) => programOf(db, s.day)?.name ?? "Session";
/** Programs an exercise is in, by name. */
export const programsWith = (db: DB, exId: string) => db.programs.filter((p) => p.items.includes(exId));

// ---------- dates ----------

export function daysBetween(a: string | Date, b: string | Date = new Date()): number {
  const d = (x: string | Date) => {
    const t = new Date(x);
    return Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  };
  return Math.round((d(b) - d(a)) / DAY_MS);
}

export function agoLabel(date: string): string {
  const d = daysBetween(date);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Date(iso).toLocaleDateString("en-GB", opts);

// ---------- lookups ----------

export const exMap = (db: DB) => new Map(db.exercises.map((e) => [e.id, e]));
export const done = (db: DB) => db.sessions.filter((s) => s.end).sort((a, b) => b.date.localeCompare(a.date));
/** Sessions logged in the app. Imported old notes (approx) are unreliable: guessed dates, typos, missing sets.
 *  They seed targets but never count toward records, streaks, balance or tips. */
export const logged = (db: DB) => done(db).filter((s) => !s.approx);
export const active = (db: DB) => db.sessions.find((s) => !s.end);

export function roundTo(w: number, inc: number): number {
  if (!inc) return Math.max(0, Math.round(w));
  return Math.max(inc, Math.round(w / inc) * inc);
}

export interface HistoryItem {
  session: Session;
  entry: Entry;
}

/** Entries with at least one set, newest first. */
export function history(db: DB, exId: string, skipSession?: string): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const s of done(db)) {
    if (s.id === skipSession) continue;
    const e = s.entries.find((x) => x.ex === exId && x.sets.length);
    if (e) out.push({ session: s, entry: e });
  }
  return out;
}

// ---------- reps and progression ----------

/** Rep goals people actually pick. "+reps" moves to the next one. */
export const AIMS = [5, 6, 8, 10, 12, 15, 20];
export const nextAim = (r: number) => AIMS.find((a) => a > r) ?? r + 5;

/** At or over the goal = hit. One or two short = close (fine). Further short = a miss. */
export type Verdict = "hit" | "close" | "short";
export const verdict = (r: number, aim: number): Verdict => (r >= aim ? "hit" : r >= aim - 2 ? "close" : "short");

/** Today's target for set i, extending the plan with its last set when more sets are done than planned. */
export function targetAt(entry: Entry, ex: Exercise, i: number): Target {
  const plan = entry.plan ?? [];
  const t = plan[i] ?? plan[plan.length - 1];
  return { w: plan[i]?.w ?? entry.sets[i - 1]?.w ?? t?.w ?? ex.inc * 2, r: t?.r ?? ex.aim };
}

/** Next time, unchanged: the weights done today (or planned, for sets not done) with today's goals. */
export function sameNext(entry: Entry, ex: Exercise): Target[] {
  const n = Math.max(entry.plan?.length ?? 0, entry.sets.length);
  return Array.from({ length: n }, (_, i) => ({ w: entry.sets[i]?.w ?? targetAt(entry, ex, i).w, r: targetAt(entry, ex, i).r }));
}

export const nextOf = (entry: Entry, ex: Exercise) => entry.next ?? sameNext(entry, ex);

export interface NextOption {
  key: string;
  label: string;
  ts: Target[];
}

/**
 * The owner's progression, as one-tap choices. Usual path for 10kg × 10 (2 sets):
 * weight up on set 1 → reps up on set 2 (12, 15) → weight up on set 2 → repeat. Set 2 is never heavier than set 1.
 * Anything else (both up, lower the goal) goes through the per-set editor.
 */
export function nextOptions(entry: Entry, ex: Exercise): NextOption[] {
  const base = sameNext(entry, ex);
  const out: NextOption[] = [{ key: "same", label: "Same", ts: base }];
  if (!base.length) return out;
  const up = (w: number) => +(w + ex.inc).toFixed(2);
  const first = base[0];
  const rest = base.slice(1);
  const restName = rest.length > 1 ? `Sets 2–${base.length}` : "Set 2";
  if (ex.inc > 0) out.push({ key: "w1", label: rest.length ? `Set 1 → ${fmtW(up(first.w))}kg` : `→ ${fmtW(up(first.w))}kg`, ts: [{ ...first, w: up(first.w) }, ...rest] });
  if (!rest.length) {
    out.push({ key: "r1", label: `→ ${nextAim(first.r)} reps`, ts: [{ ...first, r: nextAim(first.r) }] });
    return out;
  }
  const sameAim = rest.every((t) => t.r === rest[0].r);
  out.push({ key: "r2", label: `${restName} → ${sameAim ? `${nextAim(rest[0].r)} reps` : "more reps"}`, ts: [first, ...rest.map((t) => ({ ...t, r: nextAim(t.r) }))] });
  const heavier = rest.map((t) => ({ ...t, w: Math.min(first.w, up(t.w)) }));
  if (ex.inc > 0 && heavier.some((t, i) => t.w !== rest[i].w)) {
    const sameW = heavier.every((t) => t.w === heavier[0].w);
    out.push({ key: "w2", label: `${restName} → ${sameW ? `${fmtW(heavier[0].w)}kg` : "heavier"}`, ts: [first, ...heavier] });
  }
  return out;
}

/** What the last real (non-deload) time said to do now. */
export function targetsFor(db: DB, ex: Exercise, skipSession?: string): Target[] {
  const h = history(db, ex.id, skipSession).find((x) => x.session.mode !== "deload");
  if (!h) return [];
  return nextOf(h.entry, ex);
}

/** The note left last time for this exercise, if the last time had one. It's for one session only. */
export function noteFromLast(db: DB, exId: string, session: Session): HistoryItem | undefined {
  const h = history(db, exId, session.id).find((x) => x.session.date < session.date);
  return h?.entry.note ? h : undefined;
}

export function applyMode(ts: Target[], mode: Mode, ex: Exercise): Target[] {
  if (mode === "normal") return ts;
  const f = MODE_FACTOR[mode];
  return ts.map((t) => ({ ...t, w: roundTo(t.w * f, stepOf(ex)) }));
}

/** The program least recently trained (never trained first). */
export function suggestDay(db: DB): string | null {
  if (!db.programs.length) return null;
  const last = (p: Program) => done(db).find((s) => s.day === p.id)?.date ?? "";
  return [...db.programs].sort((a, b) => last(a).localeCompare(last(b)))[0].id;
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const slug = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36).slice(-4);

export function startSession(db: DB, day: string | null, mode: Mode): Session {
  const m = exMap(db);
  const ids = (programOf(db, day)?.items ?? []).filter((id) => m.has(id));
  return { id: newId(), day, date: new Date().toISOString(), mode, planned: ids, entries: ids.map((id) => newEntry(db, m.get(id)!, mode)) };
}

export function newEntry(db: DB, ex: Exercise, mode: Mode): Entry {
  let plan = targetsFor(db, ex);
  if (!plan.length) plan = [0, 1].map(() => ({ w: isStack(ex) ? ex.inc * 2 : 10, r: ex.aim }));
  return { ex: ex.id, sets: [], plan: applyMode(plan, mode, ex) };
}

export const started = (e: Entry) => e.sets.length > 0;

/** The first set on an exercise puts it right after the ones already done, so entries keep the real order. */
export function markStarted(entries: Entry[], i: number): Entry[] {
  const out = [...entries];
  const [e] = out.splice(i, 1);
  const at = out.findIndex((x) => !started(x));
  out.splice(at < 0 ? out.length : at, 0, e);
  return out;
}

/** After the program changed mid-session: what's not started yet follows the new program. Done exercises stay put. */
export function followProgram(db: DB, s: Session, program: Program): Session {
  const m = exMap(db);
  const begun = s.entries.filter((e) => started(e) || e.skip);
  const waiting = new Map(s.entries.filter((e) => !begun.includes(e)).map((e) => [e.ex, e]));
  const fromProgram = program.items.filter((id) => m.has(id) && !begun.some((e) => e.ex === id)).map((id) => waiting.get(id) ?? newEntry(db, m.get(id)!, s.mode));
  // Exercises added by hand today (never in the plan) stay too.
  const added = [...waiting.values()].filter((e) => !program.items.includes(e.ex) && !s.planned?.includes(e.ex));
  return { ...s, planned: program.items.filter((id) => m.has(id)), entries: [...begun, ...fromProgram, ...added] };
}

/** Defaults for a fresh database. */
export const emptyDB = (): DB => ({ version: 2, exercises: structuredClone(LIBRARY), programs: structuredClone(STARTER_PROGRAMS), sessions: [] });

// ---------- migration ----------

/** v1 had rep ranges, a fixed back/chest/legs day list and "machine" for every machine. */
export function migrate(raw: any): DB {
  if (raw.version === 2) return raw as DB;
  const toT = (ts?: any[]) => ts?.map((t) => ("r" in t ? t : { w: t.w, r: t.hi }));
  const exercises: Exercise[] = raw.exercises
    .filter((e: { day?: string; group: string }) => e.day !== "legs")
    .map(({ day: _d, range, kind, ...e }: Exercise & { day?: string; range: [number, number] }) => ({ ...e, kind: (kind as string) === "machine" ? "stack" : kind, aim: e.aim ?? range?.[1] ?? 10 }));
  const sessions: Session[] = raw.sessions.map((s: Session) => ({
    ...s,
    day: s.day === "legs" ? null : s.day,
    entries: s.entries.map((e) => ({ ...e, plan: toT(e.plan), next: toT(e.next) })),
  }));
  const programs: Program[] = (["back", "chest"] as const).map((d, i) => {
    const last = sessions.filter((s) => s.end && s.day === d).sort((a, b) => b.date.localeCompare(a.date))[0];
    const items = last?.entries.length ? last.entries.map((e) => e.ex) : STARTER_PROGRAMS[i].items;
    return { ...STARTER_PROGRAMS[i], items: items.filter((id) => exercises.some((e) => e.id === id)) };
  });
  return { version: 2, exercises, programs, sessions };
}

// ---------- records & stats ----------

export const e1rm = (s: SetLog) => (s.r ? s.w * (1 + s.r / 30) : 0);
const better = (a: SetLog, b: SetLog) => a.w > b.w || (a.w === b.w && a.r > b.r);
export const topSet = (sets: SetLog[]) => sets.reduce<SetLog | undefined>((t, s) => (!t || better(s, t) ? s : t), undefined);

/** Sets in this entry that beat everything before it: heavier, or more reps at the heaviest weight. */
export function prsIn(db: DB, session: Session, entry: Entry): SetLog | undefined {
  const before = history(db, entry.ex).filter((h) => !h.session.approx && h.session.date < session.date && h.session.id !== session.id);
  if (!before.length) return undefined;
  const best = topSet(before.flatMap((h) => h.entry.sets))!;
  const mine = topSet(entry.sets);
  return mine && better(mine, best) ? mine : undefined;
}

export interface Point {
  date: string;
  top: SetLog;
  e1rm: number;
  mode: Mode;
  approx?: boolean;
}

export function series(db: DB, exId: string): Point[] {
  return history(db, exId)
    .map(({ session, entry }) => {
      const top = topSet(entry.sets)!;
      return { date: session.date, top, e1rm: Math.max(...entry.sets.map(e1rm)), mode: session.mode, approx: session.approx };
    })
    .reverse();
}

export type Trend = "up" | "flat" | "down" | "new";

/** Compares the best of the last 3 normal sessions with the 3 before. */
export function trend(points: Point[]): Trend {
  const p = points.filter((x) => x.mode === "normal" && !x.approx);
  if (p.length < 4) return "new";
  const best = (xs: Point[]) => Math.max(...xs.map((x) => x.e1rm));
  const recent = best(p.slice(-3));
  const prev = best(p.slice(-6, -3));
  if (recent > prev * 1.02) return "up";
  if (recent < prev * 0.95) return "down";
  return "flat";
}

/** Sessions that haven't beaten the best before them. */
export function stalledFor(points: Point[]): number {
  const p = points.filter((x) => x.mode === "normal" && !x.approx);
  let n = 0;
  for (let i = p.length - 1; i > 0; i--) {
    const before = Math.max(...p.slice(0, i).map((x) => x.e1rm));
    if (p[i].e1rm > before) break;
    n++;
  }
  return n;
}

export function setsByGroup(db: DB, days = 28): Record<Group, number> {
  const out = Object.fromEntries(Object.keys(GROUP_LABEL).map((g) => [g, 0])) as Record<Group, number>;
  const m = exMap(db);
  for (const s of logged(db)) {
    if (daysBetween(s.date) > days) continue;
    for (const e of s.entries) {
      const ex = m.get(e.ex);
      if (ex) out[ex.group] += e.sets.length;
    }
  }
  return out;
}

/** Monday of the week containing d (local time). */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Weeks in a row (up to this one) with at least one session. This week only breaks it once it's over. */
export function weekStreak(db: DB): number {
  const weeks = new Set(logged(db).map((s) => weekStart(new Date(s.date)).getTime()));
  const w = weekStart(new Date());
  let n = weeks.has(w.getTime()) ? 1 : 0;
  for (;;) {
    w.setDate(w.getDate() - 7);
    if (!weeks.has(w.getTime())) return n;
    n++;
  }
}

// ---------- tips ----------

export interface Tip {
  id: string;
  tone: "good" | "info" | "nudge";
  text: string;
  ex?: string;
}

export function tips(db: DB): Tip[] {
  const out: Tip[] = [];
  const sessions = logged(db);
  const last = done(db)[0];

  if (last) {
    const gap = daysBetween(last.date);
    if (gap >= COMEBACK_DAYS)
      out.push({ id: "gap", tone: "info", text: `${gap} days since the last session. Showing up matters more than the weight today, so comeback mode starts about 15% lighter.` });
  }

  for (const ex of db.exercises) {
    const p = series(db, ex.id).filter((x) => !x.approx);
    if (!p.length || daysBetween(p[p.length - 1].date) > 45) continue;
    const stuck = stalledFor(p);
    if (stuck >= 4) {
      out.push({ id: `stall-${ex.id}`, tone: "nudge", ex: ex.id, text: `${ex.name} hasn't beaten its best in ${stuck} sessions. Drop one step (${fmtW(ex.inc)} kg) and build the reps back up.` });
      continue;
    }
    const month = p.filter((x) => daysBetween(x.date) <= 30 && x.mode === "normal");
    const older = p.filter((x) => daysBetween(x.date) > 30 && x.mode === "normal");
    if (month.length && older.length) {
      const gain = Math.max(...month.map((x) => x.top.w)) - Math.max(...older.slice(-3).map((x) => x.top.w));
      if (gain > 0) out.push({ id: `gain-${ex.id}`, tone: "good", ex: ex.id, text: `${ex.name} is up ${fmtW(gain)} kg on the top set this month.` });
    }
  }

  const g = setsByGroup(db, 28);
  const pull = g.back + g.traps + g.biceps;
  const push = g.chest + g.shoulders + g.triceps;
  if (pull + push >= 20) {
    if (push > pull * 1.6) out.push({ id: "bal", tone: "nudge", text: `${push} pushing sets vs ${pull} pulling in 4 weeks. More pulling evens it out.` });
    else if (pull > push * 1.6) out.push({ id: "bal", tone: "nudge", text: `${pull} pulling sets vs ${push} pushing in 4 weeks. More pushing evens it out.` });
  }

  // Six straight weeks of 2+ sessions without a deload.
  const perWeek = new Map<number, Session[]>();
  for (const s of sessions) {
    const k = weekStart(new Date(s.date)).getTime();
    perWeek.set(k, [...(perWeek.get(k) ?? []), s]);
  }
  let solid = 0;
  const w = weekStart(new Date());
  for (let i = 0; i < 12; i++) {
    const ss = perWeek.get(w.getTime()) ?? [];
    if (ss.some((s) => s.mode === "deload")) break;
    if (ss.length >= 2) solid++;
    else if (i > 0) break;
    w.setDate(w.getDate() - 7);
  }
  if (solid >= 6) out.push({ id: "deload", tone: "info", text: `${solid} solid weeks in a row. A lighter week now tends to make the next block go better. Start a session in deload mode.` });

  const order = { nudge: 0, info: 1, good: 2 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}
