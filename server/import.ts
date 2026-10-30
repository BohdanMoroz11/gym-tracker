// Imports the old iPhone-note log into data/gym.json.
//   npm run import -- [file=.reference] [--last YYYY-MM-DD] [--every 3] [--force]
// The note is newest-first, sessions separated by blank lines, lines like "Incline 15x10, 12.5x13 (stay)".
// The notes have no dates, so they're spread back from --last every --every days and flagged approx.
import fs from "node:fs";
import { emptyDB, exMap, newId } from "../shared/logic.ts";
import type { Entry, Exercise, Session, SetLog, Target } from "../shared/types.ts";
import { load, save } from "./store.ts";

const args = process.argv.slice(2);
const flag = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const force = args.includes("--force") && args.splice(args.indexOf("--force"), 1);
const lastArg = flag("--last");
const every = Number(flag("--every") ?? 3);
const file = args[0] ?? ".reference";

const db = load();
if (db.sessions.length && !force) {
  console.error(`data/gym.json already has ${db.sessions.length} sessions. Use --force to replace them.`);
  process.exit(1);
}
const fresh = force ? emptyDB() : db;
const m = exMap(fresh);
// The owner's shorthand ("hummers", "rotation"...) lives in the gitignored private/aliases.json; otherwise match by name.
const ALIASES: Record<string, string> = fs.existsSync("private/aliases.json") ? JSON.parse(fs.readFileSync("private/aliases.json", "utf8")) : {};
for (const e of fresh.exercises) ALIASES[e.name.toLowerCase()] ??= e.id;

const blocks = fs
  .readFileSync(file, "utf8")
  .split(/\n\s*\n/)
  .map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean))
  .filter((b) => b.length);

const last = lastArg ? new Date(lastArg + "T18:00:00") : new Date(Date.now() - 2 * 86_400_000);
last.setHours(18, 0, 0, 0);

const unknown = new Set<string>();
const sessions: Session[] = blocks.map((lines, i) => {
  const entries: Entry[] = [];
  for (const line of lines) {
    const [, rawName, rest = ""] = line.match(/^([^\d(]+?)\s*(\d.*|\(.*)?$/) ?? [];
    if (!rawName) continue;
    const id = ALIASES[rawName.toLowerCase()];
    const ex = id && m.get(id);
    if (!ex) {
      unknown.add(rawName);
      continue;
    }
    const notes = [...rest.matchAll(/\(([^)]*)\)?/g)].map((x) => x[1].trim()).filter(Boolean);
    const sets: SetLog[] = [];
    for (const [, w, r, n] of rest.replace(/\([^)]*\)?/g, "").matchAll(/(\d+(?:\.\d+)?)\s*x\s*(\d+)(?:\s*x\s*(\d*))?/g))
      for (let k = 0; k < (n ? Number(n) : 1); k++) sets.push({ w: Number(w), r: Number(r) });
    const entry: Entry = { ex: ex.id, sets };
    const note = notes.join("; ");
    if (note) entry.note = note;
    if (sets.length) entry.next = readNote(note, sets, ex);
    entries.push(entry);
  }
  // Whichever program has more of these exercises.
  const day = [...fresh.programs].sort((a, b) => entries.filter((e) => b.items.includes(e.ex)).length - entries.filter((e) => a.items.includes(e.ex)).length)[0]?.id ?? null;
  const date = new Date(last.getTime() - i * every * 86_400_000);
  return { id: newId() + i, day, date: date.toISOString(), end: new Date(date.getTime() + 3_600_000).toISOString(), mode: "normal", entries, approx: true };
});

fresh.sessions = sessions;
save(fresh);
console.log(`Imported ${sessions.length} sessions (newest ${sessions[0]?.date.slice(0, 10)}, every ${every} days).`);
if (unknown.size) console.log("Skipped unknown exercise names:", [...unknown].join(", "));

/** Turns the owner's shorthand ("12 on the second", "go up", "drop to 18 on second", "try 15 again") into targets. Default: stay. */
function readNote(note: string, sets: SetLog[], ex: Exercise): Target[] {
  // A lighter set after the first is a back-off set: higher rep goal.
  const t: Target[] = sets.map((s, i) => ({ w: s.w, r: i > 0 && s.w < sets[0].w ? Math.max(15, ex.aim) : ex.aim }));
  const n = note.toLowerCase();
  const isWeight = (v: number, i: number) => ex.inc > 0 && v !== sets[i].r && Math.abs(v - sets[i].w) % ex.inc < 0.01 && v > 4;
  const second = Math.min(1, t.length - 1);
  if (/^go up$/.test(n)) t.forEach((x) => (x.w += ex.inc));
  for (const [, v, which] of n.matchAll(/(?<![\d.-])(\d+(?:\.\d+)?)\s+(?:ok\s+)?(?:on\s+)?(?:the\s+)?(first|second)/g)) {
    const i = which === "first" ? 0 : second;
    if (isWeight(Number(v), i) || which === "first") t[i].w = Number(v);
    else t[i].r = Number(v);
  }
  // "12-15" ranges: the goal is the top.
  for (const [, , hi, on] of n.matchAll(/(\d+)-(\d+)(\s+on\s+(?:the\s+)?second)?/g)) (on || /second/.test(n) ? [t[second]] : t).forEach((x) => (x.r = Number(hi)));
  const goTo = n.match(/(?:go to|try)\s+(\d+)/);
  if (goTo && !isWeight(Number(goTo[1]), 0)) (/second|again/.test(n) ? [t[second]] : t).forEach((x) => (x.r = Number(goTo[1])));
  return t;
}
