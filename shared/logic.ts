import type { DayId, DB, Entry, Exercise, Group, Mode, Session, SetLog, Target } from "./types.ts";
import { LIBRARY } from "./library.ts";

export const DAYS: Record<DayId, { label: string; groups: string }> = {
  back: { label: "Back day", groups: "Back and biceps" },
  chest: { label: "Chest day", groups: "Chest, shoulders and triceps" },
  legs: { label: "Legs day", groups: "Legs" },
};

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
const fmtRange = (lo: number, hi: number) => (lo === hi ? String(hi) : `${lo}–${hi}`);

/** Same shorthand as the old notes: "15×10, 12.5×13", "48×10×2". */
export function fmtSets(sets: SetLog[]): string {
  const out: string[] = [];
  for (let i = 0; i < sets.length; ) {
    let n = 1;
    while (i + n < sets.length && sets[i + n].w === sets[i].w && sets[i + n].r === sets[i].r) n++;
    out.push(`${fmtW(sets[i].w)}×${sets[i].r}${n > 1 ? `×${n}` : ""}`);
    i += n;
  }
  return out.join(", ");
}

export function fmtTargets(ts: Target[]): string {
  const out: string[] = [];
  for (let i = 0; i < ts.length; ) {
    let n = 1;
    const a = ts[i];
    while (i + n < ts.length && ts[i + n].w === a.w && ts[i + n].lo === a.lo && ts[i + n].hi === a.hi) n++;
    out.push(`${fmtW(a.w)}×${fmtRange(a.lo, a.hi)}${n > 1 ? ` ×${n}` : ""}`);
    i += n;
  }
  return out.join(", ");
}

export const fmtRangeT = (t: Target) => fmtRange(t.lo, t.hi);

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

// ---------- progression ----------

/** Default rep range for set i. A lighter set after the first is a back-off set: higher reps. */
export function rangeFor(ex: Exercise, ws: number[], i: number): [number, number] {
  if (i > 0 && ws[i] < ws[0] && ex.range[1] < 15) return [12, 15];
  return ex.range;
}

/** Double progression, per set: top of the range → one step up; way short → one step down; else stay. */
export function suggestNext(entry: Entry, ex: Exercise): Target[] {
  return entry.sets.map((s, i) => {
    const p = entry.plan?.[i];
    const [dlo, dhi] = rangeFor(ex, entry.sets.map((x) => x.w), i);
    const lo = p?.lo ?? dlo;
    const hi = p?.hi ?? dhi;
    let w = s.w;
    if (s.r >= hi) w = s.w + ex.inc;
    else if (s.r < lo - 2 && ex.inc && s.w > ex.inc) w = s.w - ex.inc;
    return { w, lo, hi };
  });
}

export const nextOf = (entry: Entry, ex: Exercise) => entry.next ?? suggestNext(entry, ex);

/** What the last real (non-deload) time told us to do now. */
export function targetsFor(db: DB, ex: Exercise, skipSession?: string): Target[] {
  const h = history(db, ex.id, skipSession).find((x) => x.session.mode !== "deload");
  if (!h) return [];
  return nextOf(h.entry, ex);
}

export function applyMode(ts: Target[], mode: Mode, ex: Exercise): Target[] {
  if (mode === "normal") return ts;
  const f = MODE_FACTOR[mode];
  return ts.map((t) => ({ ...t, w: roundTo(t.w * f, ex.inc) }));
}

/** Exercise order for a day: the last session of that day (including the ones planned but skipped). */
export function dayPlan(db: DB, day: DayId): string[] {
  const last = done(db).find((s) => s.day === day);
  if (last?.entries.length) return last.entries.map((e) => e.ex);
  return db.exercises.filter((e) => e.day === day && !e.archived).map((e) => e.id);
}

export function suggestDay(db: DB): DayId {
  const last = done(db).find((s) => s.day === "back" || s.day === "chest");
  return last?.day === "back" ? "chest" : "back";
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function startSession(db: DB, day: DayId | null, mode: Mode): Session {
  const ids = day ? dayPlan(db, day) : [];
  const m = exMap(db);
  return {
    id: newId(),
    day,
    date: new Date().toISOString(),
    mode,
    entries: ids.filter((id) => m.has(id)).map((id) => newEntry(db, m.get(id)!, mode)),
  };
}

export function newEntry(db: DB, ex: Exercise, mode: Mode): Entry {
  let plan = targetsFor(db, ex);
  if (!plan.length) plan = [0, 1].map(() => ({ w: ex.inc * 2, lo: ex.range[0], hi: ex.range[1] }));
  return { ex: ex.id, sets: [], plan: applyMode(plan, mode, ex) };
}

/** Defaults for a fresh database. */
export const emptyDB = (): DB => ({ version: 1, exercises: structuredClone(LIBRARY), sessions: [] });

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
      out.push({ id: `stall-${ex.id}`, tone: "nudge", ex: ex.id, text: `${ex.short} hasn't beaten its best in ${stuck} sessions. Drop one step (${fmtW(ex.inc)} kg) and build back up to the top of the range.` });
      continue;
    }
    const month = p.filter((x) => daysBetween(x.date) <= 30 && x.mode === "normal");
    const older = p.filter((x) => daysBetween(x.date) > 30 && x.mode === "normal");
    if (month.length && older.length) {
      const gain = Math.max(...month.map((x) => x.top.w)) - Math.max(...older.slice(-3).map((x) => x.top.w));
      if (gain > 0) out.push({ id: `gain-${ex.id}`, tone: "good", ex: ex.id, text: `${ex.short} is up ${fmtW(gain)} kg on the top set this month.` });
    }
  }

  const legSets = setsByGroup(db, 60).legs;
  if (done(db).length >= 3 && legSets === 0)
    out.push({ id: "legs", tone: "nudge", text: "No leg sets in the last two months. One leg machine at the end of a session is a 6-minute start." });

  const g = setsByGroup(db, 28);
  const pull = g.back + g.traps + g.biceps;
  const push = g.chest + g.shoulders + g.triceps;
  if (pull + push >= 20) {
    if (push > pull * 1.6) out.push({ id: "bal", tone: "nudge", text: `${push} pushing sets vs ${pull} pulling in 4 weeks. A back day next evens it out.` });
    else if (pull > push * 1.6) out.push({ id: "bal", tone: "nudge", text: `${pull} pulling sets vs ${push} pushing in 4 weeks. A chest day next evens it out.` });
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
