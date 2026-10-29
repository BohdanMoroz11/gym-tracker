# AGENTS.md

Context for coding agents (and future me). Read this before changing things.

**Also read `private/CONTEXT.md` if it exists** (gitignored): who the owner is, their training history, routine, shorthand and what they want. It shapes most UX decisions here. Never copy its contents into committed files.

## What this is

A personal gym log for one person. Sibling of `~/projects/nba-tracker` and `~/projects/football-tracker` (same stack and spirit, own design). The owner cares about **UI/UX**, not the code.

The point: **as little logging overhead as possible.** The owner isn't disciplined about tracking, and heavy tracking has failed before. The app's job is the bookkeeping they used to do in an iPhone note: show what they did last time, prefill today, log a set in one tap, and turn "go up / stay / drop on the second" into a structured plan for next time.

## Privacy rules (repo is public)

- Personal data is gitignored: `.reference` (old iPhone note), `data/` (the database and backups), `private/` (context, shorthand aliases).
- Committed code stays generic. The starter exercise library (`shared/library.ts`) is fine; weights, logs, notes, the owner's history and shorthand are not.
- Before committing, run `git status` and make sure nothing from those paths shows up.

## Stack

- **Server**: Node + Express, TypeScript via `tsx`. `server/`. Binds `127.0.0.1:5200` (Courtside 5180, Touchline 5190). Reached via SSH tunnel.
- **Frontend**: React 18 + Vite + Tailwind v4 + TanStack Query. `web/`. Dev server on 5203 proxies `/api`.
- **Shared**: `shared/types.ts` (the contract), `shared/logic.ts` (progression, formatting, stats, tips; used by both sides), `shared/library.ts` (starter exercises).
- **Storage**: one JSON file, `data/gym.json` (override the folder with `GYM_DATA`). Atomic writes (tmp + rename), first write each day copies to `data/backups/gym-YYYY-MM-DD.json`. Small data and one user, so no DB engine needed. If it ever outgrows this, `node:sqlite` is built in.
- Hash routing: `#/` today/live session, `#/history`, `#/s/:id` session detail/edit, `#/progress`, `#/ex/:id` exercise.

## Layout

```
server/
  index.ts    GET /api/db (everything), PUT/DELETE /api/sessions/:id, PUT /api/exercises/:id, serves dist/
  store.ts    JSON file load/save + daily backup
  import.ts   one-off: parse the old note (.reference) into sessions (npm run import -- --force)
shared/
  types.ts    Exercise, Session, Entry, SetLog, Target
  logic.ts    suggestNext (double progression), targetsFor, dayPlan, startSession, prsIn, series/trend/stalledFor, setsByGroup, weekStreak, tips
  library.ts  starter exercises with weight step and default rep range
web/src/
  lib.ts      useDB, offline-tolerant saving (localStorage "gym.pending" queue), router, helpers
  components/ Today (start screen + live session), Session (SessionEditor, ExerciseCard, SetInput, NextTime, AddExerciseSheet, SessionBar, FinishSheet),
              History (list + SessionPage editing), Progress (calendar, balance, tips, exercise trends), ExercisePage (chart, history, setup), ui
```

## Domain model

- **Session**: `day` (back / chest / legs / null = free), `mode` (normal / comeback = ~15% lighter / deload = ~40% lighter), `entries` in the order done, `end` missing = in progress, `feel` = body and head ratings 1–5 asked at finish. Only one session is open at a time. The finish sheet lets you pick the end time ("Now", "After last set" = last set + 5 min, ±5 min); it defaults to after the last set if that was 15+ min ago. One left open more than 4 h after its last set closes itself.
- **Exercise**: proper names only (no cryptic shorthand; the owner's shorthand is only for importing). `kind` splits machines/cables from free weights (dumbbell, barbell, bodyweight), and lists are grouped that way. `inc` is the go-up step; the − + stepper moves free weights by 0.5 kg (`stepOf`), with ±2.5/±5 jump buttons, and the number can be tapped to type. `oneoff` exercises are typed in for one session and hidden from lists and stats.
- **Entry**: one exercise in a session. `plan` = targets snapshotted at start, `sets` = what was done, `next` = targets for next time (absent = computed with `suggestNext`), `note` = free text for next time. Entries with no sets are "planned but skipped". They stay in the day's order for next time.
- **Target**: `{ w, lo, hi }`, weight plus rep range, per set. This replaces the free-text notes: "12 on the second, 12-15" becomes set 2 = 12 × 12–15.
- **Next time** defaults to **the same** weights and aims (`sameNext`), owner's call. One-tap presets (`nextPresets`): Same, Up on set N (bump the last/back-off set first, which is how the owner progresses), All up. Per-set weight and aim edits are possible; anything not equal to Same is stored in `next`. `suggestNext` (double progression) only drives the green "hit the top of the range on set N" hint. A lighter set after the first is a back-off set and defaults to 12–15 (`rangeFor`).
- **Aim mid-session**: each set's aim can be changed while logging ("Aim 8–10 · Change"). It rewrites that set in `plan`, and next time follows it.
- **Targets for today** (`targetsFor`): the `next` of the latest non-deload entry for that exercise. Deload sessions never move targets.
- **Day plan** (`dayPlan`): exercise order of the last session of that day, else library exercises tagged with that day.
- **Imported old notes** (`approx: true`): unreliable (forgotten logs, wrong numbers, inconsistent format, guessed dates). They seed targets and show in history, but are excluded from records, trends, tips, streaks, the calendar and muscle balance (`logged()` in logic.ts). Each one has a "these numbers are right" button that clears the flag.

## Design

Direction: **"plates on rubber"**. Rubber-floor charcoal (`floor`, `mat`, `bench`, `rule`), chalk text, **competition plate colors as the only accents, each with a meaning**: blue = back day, red = chest day, yellow = legs day, green = go up / done, amber = go down / short. Numbers are the loud element: Big Shoulders Display (`.num`, tabular) for weights, reps and headings; Barlow for UI text. Fonts are self-hosted via @fontsource so they work through the tunnel.

- **One tap per set.** The set input is a weight stepper (prefilled from the plan) plus a strip of rep numbers. Tapping the number logs the set. Target-range chips are outlined. Don't add confirm steps.
- **Weights always carry the unit**: "15kg × 10" (`fmtSets`, `<Kg>`).
- **Every tappable thing looks tappable**: filled `pill` buttons (44px+), dashed outlines for "add" actions, no bare text links. Rep chips and the weight stepper are 56px. Keep rings `ring-inset` and give scrollers vertical padding so outlines aren't clipped. On phones, use stacked/equal-width grids instead of squeezing a title and buttons into one row.
- **Note for next time** (`entry.note`, one session → the next) is available as soon as one set is logged.
- **Note that stays** (`exercise.note`: seat position, form cues) is edited right on the session card and shown prominently: chalk left bar at the top of the open card, a two-line preview on the collapsed card, and on the exercise page. Keep it visible; the owner asked for that.
- **Nothing is required.** Notes, finishing all sets, finishing the session: all optional. Unlogged exercises just carry over.
- **The app makes the decision, the owner can override it.** "Next time" is pre-filled with the suggestion; the owner only taps when they disagree.
- **Never lose a set.** Saves go to localStorage first, then the server, retried until they stick. The session bar shows saved / saving / "saved on phone, will sync".
- Phone first (iPhone via home screen, PWA manifest + apple meta). Bottom tab bar on phones, top bar from `sm`. Session column max-w-2xl; start screen and progress use two columns at `lg`.
- Tone: no guilt about gaps. Comeback mode is offered after 14+ days off, the streak counts weeks (not days), and the legs nudge is one quiet line.
- Tips (`tips()` in logic.ts) are rule-based and specific: stalled 4+ sessions, gains this month, push/pull imbalance, no legs, long break, 6 solid weeks → deload.
- Charts: single series, chalk line, hollow dots for imported points, crosshair readout on hover/tap. Calendar cells carry a day letter as well as color (yellow vs red is weak for some color vision).
- Motion: only the `settle` flash when a set is logged. Reduced motion respected.
- Check at 390×844 (iPhone) and 1440×900.

## Conventions

- Small files, functional components, Tailwind inline, minimal comments explaining *why*.
- Run `npm run typecheck` and `npm run build` before committing.
- To eyeball UI: `npm start`, then screenshot with Playwright (chromium is in `~/.cache/ms-playwright`).

## Ideas for later

- Plate calculator / dumbbell rack awareness (real available weights per machine instead of a fixed step).
- Program blocks: tag sessions to a block ("hypertrophy, Oct–Nov"), compare blocks.
- Rest timer goal per exercise with a gentle vibration (Android only; iOS web can't vibrate).
- Body weight log, if the owner wants it.
- Proper deploy with auth when it leaves the SSH tunnel.
