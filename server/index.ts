import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Exercise, Program, Session } from "../shared/types.ts";
import { load, save } from "./store.ts";

const PORT = Number(process.env.PORT ?? 5200);
const HOST = process.env.HOST ?? "127.0.0.1"; // local default; the container sets HOST and PORT
const root = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/db", (_req, res) => res.json(load()));

app.put("/api/sessions/:id", (req, res) => {
  const s = req.body as Session;
  if (!s?.id || s.id !== req.params.id || !Array.isArray(s.entries)) return res.status(400).json({ error: "bad session" });
  const db = load();
  const i = db.sessions.findIndex((x) => x.id === s.id);
  if (i >= 0) db.sessions[i] = s;
  else db.sessions.push(s);
  save();
  res.json({ ok: true });
});

app.delete("/api/sessions/:id", (req, res) => {
  const db = load();
  db.sessions = db.sessions.filter((x) => x.id !== req.params.id);
  save();
  res.json({ ok: true });
});

app.put("/api/exercises/:id", (req, res) => {
  const e = req.body as Exercise;
  if (!e?.id || e.id !== req.params.id || !e.name) return res.status(400).json({ error: "bad exercise" });
  const db = load();
  const i = db.exercises.findIndex((x) => x.id === e.id);
  if (i >= 0) db.exercises[i] = e;
  else db.exercises.push(e);
  save();
  res.json({ ok: true });
});

app.put("/api/programs/:id", (req, res) => {
  const p = req.body as Program;
  if (!p?.id || p.id !== req.params.id || !p.name || !Array.isArray(p.items)) return res.status(400).json({ error: "bad program" });
  const db = load();
  const i = db.programs.findIndex((x) => x.id === p.id);
  if (i >= 0) db.programs[i] = p;
  else db.programs.push(p);
  save();
  res.json({ ok: true });
});

app.delete("/api/programs/:id", (req, res) => {
  const db = load();
  db.programs = db.programs.filter((x) => x.id !== req.params.id);
  save();
  res.json({ ok: true });
});

// Serve the built frontend.
const dist = path.join(root, "../dist");
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));

app.listen(PORT, HOST, () => console.log(`gym-tracker on http://${HOST}:${PORT}`));
