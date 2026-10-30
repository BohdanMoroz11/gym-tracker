# Gym

> ⚡ Vibe coded: agents wrote it, I steered. Maintained to the standard of "works on my machine".

A personal gym log that replaces a messy phone note. It remembers what you did last time, fills in today, and turns "go up / stay / drop on the second" into a plan the next session picks up. Logging a set is one tap.

**Program**: each day type (back day, chest day, add your own) is a list of exercises in order. Edit it any time, or mid-session behind the Edit switch. Weights and reps aren't part of it: they carry over from the last session.

**Exercises**: the exercise database. Name, equipment (pin-stack machine, plate-loaded machine, cable, dumbbells, barbell, bodyweight), one side at a time or both, weight step, usual rep goal and a note that stays.

**Today**
- The day type that's due, with each exercise's weights for today, e.g. `Incline 15kg × 10, 12.5kg × 15`.
- Normal, lighter (comeback after a break, ~15% off) or deload (~40% off; doesn't move your weights).
- Last session at a glance and a couple of specific tips.

**During a session**
- Done exercises stack on top in the order you actually did them ("2nd, planned 5th"); the rest wait below in program order. Machine taken? Just open the next one.
- Each set has a rep goal (10, 12, 15…). Hit it or beat it = green; one or two short is fine; further short is flagged.
- Weight is prefilled; tap the number of reps you did and the set is logged. Rest timer starts on its own.
- Steppers fit the equipment: pin stacks move a plate at a time, plate-loaded machines and free weights by 0.5 kg with ±2.5/±5 jumps, or tap the number and type it.
- Two kinds of note: the note that stays with the exercise (seat position, form cue), and a note for next time only, shown once next session.
- "Next time" starts as the same. One tap for the usual next step: set 1 heavier, more reps on set 2, set 2 heavier (never past set 1). Anything else per set.
- Not done? "Skip today" or "Machine not available", so a broken machine isn't your fault in the log.
- Add exercises on the fly: from the list, as a new exercise, or as a one-off you just type in.
- Finish with how your body and head felt (1–5) and when you actually finished, if you forgot to tap Finish.
- Works through a flaky tunnel: every tap is saved on the phone first and synced when the server is reachable.

**History**: every session, editable after the fact, including the order things were done in.

**Progress**
- Training calendar for the last six months.
- Sets per muscle over 4 weeks (gaps stand out).
- Per-exercise trend (climbing / steady / slipping) with a chart and full history.
- Tips: stalled lifts, gains, push/pull balance, deload timing.

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
