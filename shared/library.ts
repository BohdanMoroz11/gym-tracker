import type { DayId, Exercise } from "./types.ts";

// Starter exercise library. Generic on purpose; personal tweaks live in data/gym.json.
const ex = (id: string, name: string, group: Exercise["group"], kind: Exercise["kind"], inc: number, range: [number, number], day?: DayId): Exercise => ({
  id,
  name,
  group,
  kind,
  inc,
  range,
  day,
});

export const LIBRARY: Exercise[] = [
  // Back day
  ex("shrug", "Dumbbell shrug", "traps", "dumbbell", 2.5, [12, 15], "back"),
  ex("row", "Seated row", "back", "machine", 6, [8, 10], "back"),
  ex("pulldown", "Lat pulldown", "back", "machine", 6, [8, 10], "back"),
  ex("high-row", "High row", "back", "machine", 6, [8, 10], "back"),
  ex("bicep", "Bicep curl", "biceps", "machine", 5, [12, 15], "back"),
  ex("hammer", "Hammer curl", "biceps", "dumbbell", 1, [8, 10], "back"),
  ex("core", "Ab crunch", "core", "machine", 6, [10, 12], "back"),
  // Chest day
  ex("incline", "Incline dumbbell press", "chest", "dumbbell", 2.5, [8, 10], "chest"),
  ex("shoulder-press", "Shoulder press", "shoulders", "machine", 6, [8, 10], "chest"),
  ex("tricep", "Tricep pushdown", "triceps", "cable", 6, [10, 12], "chest"),
  ex("fly", "Chest fly", "chest", "machine", 6, [8, 10], "chest"),
  ex("lateral", "Lateral raise", "shoulders", "machine", 6, [12, 15], "chest"),
  ex("rotation", "Core rotation", "core", "machine", 6, [8, 10], "chest"),
  // Legs (someday)
  ex("leg-press", "Leg press", "legs", "machine", 10, [10, 12], "legs"),
  ex("leg-ext", "Leg extension", "legs", "machine", 5, [10, 12], "legs"),
  ex("leg-curl", "Seated leg curl", "legs", "machine", 5, [10, 12], "legs"),
  ex("calf", "Calf raise", "legs", "machine", 5, [12, 15], "legs"),
  // Extras
  ex("bench", "Barbell bench press", "chest", "barbell", 2.5, [6, 8]),
  ex("rear-delt", "Rear delt fly", "shoulders", "machine", 6, [12, 15]),
  ex("db-curl", "Dumbbell bicep curl", "biceps", "dumbbell", 1, [10, 12]),
  ex("plank", "Plank (seconds as reps)", "core", "bodyweight", 0, [30, 60]),
];
