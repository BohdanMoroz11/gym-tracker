import type { Exercise, Program } from "./types.ts";

// Starter exercise library. Generic on purpose; personal tweaks live in data/gym.json.
const ex = (id: string, name: string, group: Exercise["group"], kind: Exercise["kind"], inc: number, aim: number, side?: "each"): Exercise => ({
  id,
  name,
  group,
  kind,
  inc,
  aim,
  ...(side && { side }),
});

export const LIBRARY: Exercise[] = [
  ex("shrug", "Dumbbell shrug", "traps", "dumbbell", 2.5, 15),
  ex("row", "Seated row", "back", "stack", 6, 10, "each"),
  ex("pulldown", "Lat pulldown", "back", "stack", 6, 10),
  ex("high-row", "High row", "back", "cable", 6, 10),
  ex("bicep", "Bicep curl machine", "biceps", "plates", 2.5, 15),
  ex("hammer", "Hammer curl", "biceps", "dumbbell", 1, 10),
  ex("core", "Ab crunch", "core", "stack", 6, 12),
  ex("incline", "Incline dumbbell press", "chest", "dumbbell", 2.5, 10),
  ex("shoulder-press", "Shoulder press", "shoulders", "stack", 6, 10),
  ex("tricep", "Tricep pushdown", "triceps", "cable", 6, 12),
  ex("fly", "Chest fly", "chest", "stack", 6, 10),
  ex("lateral", "Lateral raise", "shoulders", "stack", 6, 15),
  ex("rotation", "Ab rotation", "core", "stack", 6, 10),
  ex("bench", "Barbell bench press", "chest", "barbell", 2.5, 8),
  ex("rear-delt", "Rear delt fly", "shoulders", "stack", 6, 15),
  ex("db-curl", "Dumbbell bicep curl", "biceps", "dumbbell", 1, 12),
  ex("plank", "Plank (seconds as reps)", "core", "bodyweight", 0, 60),
];

export const STARTER_PROGRAMS: Program[] = [
  { id: "back", name: "Back day", color: "blue", items: ["shrug", "row", "pulldown", "high-row", "bicep", "hammer", "core"] },
  { id: "chest", name: "Chest day", color: "red", items: ["incline", "shoulder-press", "tricep", "fly", "lateral", "rotation"] },
];
