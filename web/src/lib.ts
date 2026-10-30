import { useEffect, useState, useSyncExternalStore } from "react";
import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Color, DB, Exercise, Program, Session } from "../../shared/types.ts";

// ---------- data + offline-tolerant saving ----------
// Gym wifi and SSH tunnels drop. Every session save goes to localStorage first ("pending"),
// shows up in the UI immediately, and is pushed to the server until it sticks.

const PENDING = "gym.pending";
type Pending = Record<string, Session | { deleted: true; id: string }>;

const readPending = (): Pending => {
  try {
    return JSON.parse(localStorage.getItem(PENDING) ?? "{}");
  } catch {
    return {};
  }
};
const writePending = (p: Pending) => {
  try {
    localStorage.setItem(PENDING, JSON.stringify(p));
  } catch {
    /* storage full or blocked: the server push still happens */
  }
};

function overlay(db: DB, p: Pending): DB {
  let sessions = db.sessions;
  for (const [id, s] of Object.entries(p)) {
    sessions = sessions.filter((x) => x.id !== id);
    if (!("deleted" in s)) sessions = [...sessions, s];
  }
  return { ...db, sessions };
}

async function fetchDB(): Promise<DB> {
  const r = await fetch("/api/db");
  if (!r.ok) throw new Error(`Server said ${r.status}`);
  return overlay(await r.json(), readPending());
}

export function useDB() {
  return useQuery({ queryKey: ["db"], queryFn: fetchDB, refetchOnWindowFocus: true });
}

type SyncState = "saved" | "saving" | "offline";
let sync: SyncState = Object.keys(readPending()).length ? "offline" : "saved";
const syncSubs = new Set<() => void>();
const setSync = (s: SyncState) => {
  sync = s;
  syncSubs.forEach((f) => f());
};
export const useSync = () =>
  useSyncExternalStore(
    (f) => (syncSubs.add(f), () => syncSubs.delete(f)),
    () => sync,
  );

let timer: ReturnType<typeof setTimeout> | undefined;
async function flush() {
  const p = readPending();
  const ids = Object.keys(p);
  if (!ids.length) return setSync("saved");
  setSync("saving");
  try {
    for (const id of ids) {
      const s = p[id];
      const r =
        "deleted" in s
          ? await fetch(`/api/sessions/${id}`, { method: "DELETE" })
          : await fetch(`/api/sessions/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(s) });
      if (!r.ok) throw new Error(String(r.status));
      const now = readPending();
      if (now[id] === undefined || JSON.stringify(now[id]) === JSON.stringify(s)) {
        delete now[id];
        writePending(now);
      }
    }
    setSync(Object.keys(readPending()).length ? "saving" : "saved");
    if (Object.keys(readPending()).length) schedule(300);
  } catch {
    setSync("offline");
    schedule(4000);
  }
}
const schedule = (ms: number) => {
  clearTimeout(timer);
  timer = setTimeout(flush, ms);
};
if (sync !== "saved") schedule(500);
window.addEventListener("online", () => schedule(0));

function queue(qc: QueryClient, id: string, s: Session | { deleted: true; id: string }) {
  writePending({ ...readPending(), [id]: s });
  qc.setQueryData<DB>(["db"], (db) => db && overlay(db, { [id]: s }));
  schedule(400);
}

export function useSaveSession() {
  const qc = useQueryClient();
  return (s: Session) => queue(qc, s.id, s);
}
export function useDeleteSession() {
  const qc = useQueryClient();
  return (id: string) => queue(qc, id, { deleted: true, id });
}

export function useSaveExercise() {
  const qc = useQueryClient();
  return async (e: Exercise) => {
    qc.setQueryData<DB>(["db"], (db) => db && { ...db, exercises: db.exercises.some((x) => x.id === e.id) ? db.exercises.map((x) => (x.id === e.id ? e : x)) : [...db.exercises, e] });
    await fetch(`/api/exercises/${e.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(e) });
  };
}

export function useSaveProgram() {
  const qc = useQueryClient();
  return async (p: Program) => {
    qc.setQueryData<DB>(["db"], (db) => db && { ...db, programs: db.programs.some((x) => x.id === p.id) ? db.programs.map((x) => (x.id === p.id ? p : x)) : [...db.programs, p] });
    await fetch(`/api/programs/${p.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
  };
}
export function useDeleteProgram() {
  const qc = useQueryClient();
  return async (id: string) => {
    qc.setQueryData<DB>(["db"], (db) => db && { ...db, programs: db.programs.filter((x) => x.id !== id) });
    await fetch(`/api/programs/${id}`, { method: "DELETE" });
  };
}

// ---------- routing ----------
// #/ today · #/program · #/exercises · #/history · #/s/:id session · #/progress · #/ex/:id exercise

export function useRoute(): string[] {
  const get = () => location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [r, setR] = useState(get);
  useEffect(() => {
    const f = () => {
      setR(get());
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  return r;
}
export const go = (path: string) => (location.hash = path);

// ---------- misc ----------

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

export const COLOR_VAR: Record<Color, string> = { blue: "var(--color-blue)", red: "var(--color-red)", yellow: "var(--color-yellow)", chalk: "var(--color-chalk)" };
/** A program's plate color; free sessions are grey. */
export const dayColor = (db: DB, id: string | null | undefined) => {
  const p = id ? db.programs.find((x) => x.id === id) : undefined;
  return p ? COLOR_VAR[p.color] : "var(--color-faint)";
};

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
