# Gym

> ⚡ Vibe coded: agents wrote it, I steered. Maintained to the standard of "works on my machine".

A personal gym log that replaces a messy phone note. It remembers what you did last time, fills in today, and turns "go up / stay / drop on the second" into a plan the next session picks up. Logging a set is one tap.

**Today**
- The day that's due (back and chest alternate), with every exercise's targets for today, e.g. `Incline 15×8–10, 12.5×12–15`.
- Normal, lighter (comeback after a break, ~15% off) or deload (~40% off; doesn't move your targets).
- Last session at a glance and a couple of specific tips.

**During a session**
- Each exercise shows last time's sets and the note you left yourself.
- Weight is prefilled; tap the number of reps you did and the set is logged. Rest timer starts on its own.
- "Next time" is suggested for you (top of the rep range → one step up). Tap Same, All up, or change one set's weight and rep range. Add a note if you want.
- Reorder, skip, add or create exercises on the fly. Unlogged ones carry over to next time.
- Works through a flaky tunnel: every tap is saved on the phone first and synced when the server is reachable.

**History**: every session in note shorthand (`48×10×2`), editable after the fact.

**Progress**
- Training calendar for the last six months.
- Sets per muscle over 4 weeks (gaps stand out).
- Per-exercise trend (climbing / steady / slipping) with a chart, full history and setup (weight step, usual reps, seat-position note).
- Tips: stalled lifts, gains, push/pull balance, missing legs, deload timing.

Phone first (add it to the home screen), responsive up to desktop.

## Run it

Needs Node 22+.

```bash
npm install
npm start          # builds the frontend, serves everything on http://127.0.0.1:5200
```

The server binds to `127.0.0.1` only. From your own machine:

```bash
ssh -L 5200:127.0.0.1:5200 <server>
# then open http://localhost:5200
```

Development: `npm run dev` (Vite on :5203 with hot reload, API on :5200). `PORT`/`HOST` override the API address, `GYM_DATA` the data folder.

## Data

- Everything lives in `data/gym.json` (gitignored), with a daily copy in `data/backups/`.
- `npm run import -- [file] [--last YYYY-MM-DD] [--every 3] [--force]` imports an old plain-text log (`Incline 15x10, 12.5x13 (stay)`, sessions separated by blank lines, newest first). Imported sessions are marked as rough: they set starting weights but don't count in stats.

See [AGENTS.md](AGENTS.md) for architecture and design rules.
