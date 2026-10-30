import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DB } from "../shared/types.ts";
import { emptyDB, migrate } from "../shared/logic.ts";

// The whole database is one JSON file. Small (a few hundred sessions), human-readable, easy to back up.
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_DIR = process.env.GYM_DATA ?? path.join(root, "data");
const FILE = path.join(DATA_DIR, "gym.json");
const BACKUPS = path.join(DATA_DIR, "backups");

let db: DB | undefined;

export function load(): DB {
  if (db) return db;
  fs.mkdirSync(BACKUPS, { recursive: true });
  db = fs.existsSync(FILE) ? migrate(JSON.parse(fs.readFileSync(FILE, "utf8"))) : emptyDB();
  return db;
}

export function save(next: DB = load()) {
  db = next;
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, FILE); // atomic: a crash never leaves half a file
  // One backup per day, the first write of the day keeps yesterday's state.
  const day = path.join(BACKUPS, `gym-${new Date().toISOString().slice(0, 10)}.json`);
  if (!fs.existsSync(day)) fs.copyFileSync(FILE, day);
}
