// The contract between server and UI. The whole database is one small JSON document (data/gym.json).

export type Group = "back" | "traps" | "biceps" | "chest" | "shoulders" | "triceps" | "core" | "legs" | "other";
/** stack = pin-selected weight stack, plates = plate-loaded machine. */
export type Kind = "stack" | "plates" | "cable" | "dumbbell" | "barbell" | "bodyweight";
export type Mode = "normal" | "deload" | "comeback";
export type Color = "blue" | "red" | "yellow" | "chalk";

export interface Exercise {
  id: string;
  name: string; // proper name, e.g. "Lat pulldown"; equipment is shown separately
  group: Group;
  kind: Kind;
  inc: number; // kg added by "+weight" next time; stack and cable steppers move by it too
  aim: number; // default rep goal for a new set
  side?: "each"; // one arm/leg at a time, same weight and reps per side
  note?: string; // note that stays: seat position, grip, form cue
  archived?: boolean;
  oneoff?: boolean; // typed in for one session, never listed
}

/** A day type ("Back day"): which exercises, in which order. Weights live in the sessions. */
export interface Program {
  id: string;
  name: string;
  color: Color;
  items: string[]; // exercise ids, in order
}

export interface SetLog {
  w: number; // kg
  r: number; // reps
  t?: number; // logged at (ms), drives the rest timer
}

/** One planned set: weight plus the rep goal. More is fine, 1-2 short is okay, more short is a miss. */
export interface Target {
  w: number;
  r: number;
}

export interface Entry {
  ex: string; // exercise id
  sets: SetLog[];
  /** Targets this entry started from (snapshot when the session started). */
  plan?: Target[];
  /** Targets for next time. Absent = the same as today. */
  next?: Target[];
  note?: string; // note for next time only
  /** Why there are no sets: my call, or the machine was broken/taken. */
  skip?: "skipped" | "unavailable";
}

export interface Session {
  id: string;
  day: string | null; // program id; null = free session
  date: string; // ISO start time
  end?: string; // ISO; absent = still in progress
  mode: Mode;
  /** Exercise order as the program had it at the start. */
  planned?: string[];
  /** In the order actually done; not started ones after. */
  entries: Entry[];
  note?: string;
  feel?: { body?: number; mind?: number }; // 1-5, asked when finishing
  approx?: boolean; // imported with a guessed date
}

export interface DB {
  version: 2;
  exercises: Exercise[];
  programs: Program[];
  sessions: Session[];
}
