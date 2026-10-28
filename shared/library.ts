import type { DayId, Exercise } from "./types.ts";

// Starter exercise library. Generic on purpose; personal tweaks live in data/gym.json.
const ex = (
  id: string,
  short: string,
  name: string,
  group: Exercise["group"],
  kind: Exercise["kind"],
  inc: number,
  range: [number, number],
  day?: DayId,
): Exercise => ({ id, short, name, group, kind, inc, range, day });

export const LIBRARY: Exercise[] = [
  // Back day
  ex("shrug", "Shrugs", "Dumbbell shrug", "traps", "dumbbell", 2.5, [12, 15], "back"),
  ex("row", "Row", "Seated row machine", "back", "machine", 6, [8, 10], "back"),
  ex("pulldown", "Pulldown", "Lat pulldown", "back", "machine", 6, [8, 10], "back"),
  ex("high-row", "High row", "High row machine", "back", "machine", 6, [8, 10], "back"),
  ex("bicep", "Bicep", "Bicep curl machine", "biceps", "machine", 5, [12, 15], "back"),
  ex("hammer", "Hammer curl", "Dumbbell hammer curl", "biceps", "dumbbell", 1, [8, 10], "back"),
  ex("core", "Core", "Ab crunch machine", "core", "machine", 6, [10, 12], "back"),
  // Chest day
  ex("incline", "Incline", "Incline dumbbell press", "chest", "dumbbell", 2.5, [8, 10], "chest"),
  ex("shoulder-press", "Shoulder press", "Shoulder press machine", "shoulders", "machine", 6, [8, 10], "chest"),
  ex("tricep", "Tricep", "Cable tricep pushdown", "triceps", "cable", 6, [10, 12], "chest"),
  ex("fly", "Fly", "Chest fly machine", "chest", "machine", 6, [8, 10], "chest"),
  ex("lateral", "Lateral", "Lateral raise machine", "shoulders", "machine", 6, [12, 15], "chest"),
  ex("rotation", "Rotation", "Core rotation machine", "core", "machine", 6, [8, 10], "chest"),
  // Legs (someday)
  ex("leg-press", "Leg press", "Leg press machine", "legs", "machine", 10, [10, 12], "legs"),
  ex("leg-ext", "Leg extension", "Leg extension machine", "legs", "machine", 5, [10, 12], "legs"),
  ex("leg-curl", "Leg curl", "Seated leg curl machine", "legs", "machine", 5, [10, 12], "legs"),
  ex("calf", "Calf raise", "Calf raise machine", "legs", "machine", 5, [12, 15], "legs"),
  // Extras
  ex("bench", "Bench", "Barbell bench press", "chest", "barbell", 2.5, [6, 8]),
  ex("pec-deck-rear", "Rear delt", "Rear delt fly machine", "shoulders", "machine", 6, [12, 15]),
  ex("plank", "Plank", "Plank (seconds as reps)", "core", "bodyweight", 0, [30, 60]),
];
