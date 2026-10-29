// The contract between server and UI. The whole database is one small JSON document (data/gym.json).

export type Group = "back" | "traps" | "biceps" | "chest" | "shoulders" | "triceps" | "core" | "legs" | "other";
export type Kind = "machine" | "cable" | "dumbbell" | "barbell" | "bodyweight";
export type DayId = "back" | "chest" | "legs";
export type Mode = "normal" | "deload" | "comeback";

export interface Exercise {
  id: string;
  name: string; // proper name, e.g. "Core rotation"; equipment is shown separately
  group: Group;
  kind: Kind;
  inc: number; // kg per progression step ("go up"); the stepper uses 0.5 for free weights
  range: [number, number]; // default rep target
  note?: string; // standing note: seat position, grip...
  day?: DayId; // which day it usually belongs to
  archived?: boolean;
  oneoff?: boolean; // typed in for one session, never listed
}

export interface SetLog {
  w: number; // kg
  r: number; // reps
  t?: number; // logged at (ms), drives the rest timer
}

/** One planned set: weight plus a rep range to aim for. */
export interface Target {
  w: number;
  lo: number;
  hi: number;
}

export interface Entry {
  ex: string; // exercise id
  sets: SetLog[];
  /** Targets for the next time. Absent = computed from sets. */
  next?: Target[];
  note?: string; // note for next time
  /** Targets this entry started from (snapshot at session start). */
  plan?: Target[];
}

export interface Session {
  id: string;
  day: DayId | null; // null = free session
  date: string; // ISO start time
  end?: string; // ISO; absent = still in progress
  mode: Mode;
  entries: Entry[];
  note?: string;
  feel?: { body?: number; mind?: number }; // 1-5, asked when finishing
  approx?: boolean; // imported with a guessed date
}

export interface DB {
  version: 1;
  exercises: Exercise[];
  sessions: Session[];
}
