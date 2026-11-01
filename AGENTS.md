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

- **Server**: Node + Express, TypeScript via `tsx`. `server/`. See Deployment below. Outside the container, the API defaults to `127.0.0.1:5200` (Courtside 5180, Touchline 5190).
- **Frontend**: React 18 + Vite + Tailwind v4 + TanStack Query. `web/`. Dev server on 5203 proxies `/api`.
- **Shared**: `shared/types.ts` (the contract), `shared/logic.ts` (progression, formatting, stats, tips; used by both sides), `shared/library.ts` (starter exercises).
- **Storage**: one JSON file, `data/gym.json` (override the folder with `GYM_DATA`). Atomic writes (tmp + rename), first write each day copies to `data/backups/gym-YYYY-MM-DD.json`. Small data and one user, so no DB engine needed. If it ever outgrows this, `node:sqlite` is built in.
- Hash routing: `#/` today/live session, `#/program`, `#/exercises`, `#/history`, `#/s/:id` session detail/edit, `#/progress`, `#/ex/:id` exercise.
- `data/gym.json` is versioned (`version: 2`); `migrate()` in logic.ts upgrades older files on load.

## Layout

```
server/
  index.ts    GET /api/db (everything), PUT/DELETE /api/sessions/:id, PUT /api/exercises/:id, PUT/DELETE /api/programs/:id, serves dist/
  store.ts    JSON file load/save + daily backup
  import.ts   one-off: parse the old note (.reference) into sessions (npm run import -- --force)
shared/
  types.ts    Exercise, Program, Session, Entry, SetLog, Target
  logic.ts    nextOptions/sameNext/targetsFor, markStarted/followProgram, startSession, migrate, prsIn, series/trend/stalledFor, setsByGroup, weekStreak, tips
  library.ts  starter exercises and the two starter programs
web/src/
  lib.ts      useDB, offline-tolerant saving (localStorage "gym.pending" queue), router, helpers
  components/ Today (start screen + live session), Session (SessionEditor, ExerciseCard, SetInput, NextTime, SessionBar, FinishSheet),
              Program (page, ProgramEditor, ProgramSheet), Exercises (database page, ExerciseForm/Sheet, ExercisePicker),
              History (list + SessionPage editing), Progress (calendar, balance, tips, exercise trends), ExercisePage (chart, history, setup), ui
```

## Domain model

- **Program** (a day type: "Back day", "Chest day"): name, plate color, and the **exercise ids in order. Nothing else.** Weights and rep goals are *state* and live in the sessions; the owner was explicit about that split. Programs are edited on the Program tab, or mid-session (Edit switch → "Edit the … program" sheet). A mid-session edit rearranges what isn't started yet (`followProgram`); done exercises stay. There is no legs day: the owner adds day types themselves when they want one (+ New day type).
- **Session**: `day` = program id (null = free session), `mode` (normal / comeback = ~15% lighter / deload = ~40% lighter), `planned` = program order at the start, `entries` = **actual order**: the first set on an exercise moves it right behind the done ones (`markStarted`), so done-order and program-order are both recorded. Past sessions can be reordered ("Fix order"). `end` missing = in progress, `feel` = body and head ratings 1–5 asked at finish. Only one session is open at a time. The finish sheet picks the end time ("Now", "After last set" = last set + 5 min, ±5 min) and asks why each not-done exercise wasn't done. One left open more than 4 h after its last set closes itself.
- **Exercise**: proper names only (no shorthand). `kind`: `stack` (pin-selected machine), `plates` (plate-loaded machine), `cable`, `dumbbell`, `barbell`, `bodyweight`. Stack and cable steppers move by `inc` (e.g. 6 kg); everything else by 0.5 kg with ±2.5/±5 jumps (`stepOf`). `inc` is also what "+weight" adds next time. `side: "each"` = one arm/leg at a time, same weight and reps per side, logged once; shown in the equipment label ("Dumbbells, both arms together" is explicit too, and dumbbell weight is per dumbbell). `aim` = usual rep goal for a new set. `note` = the note that stays. `oneoff` = typed in for one session, hidden from lists and stats. Edited on the Exercises tab, the exercise page, or mid-session (Edit switch).
- **Entry**: one exercise in a session. `plan` = targets snapshotted at start, `sets` = what was done, `next` = targets for next time (absent = the same as today, `sameNext`), `note` = note for next time only (shown once, on the next session's card, as "You left this for today"), `skip` = `skipped` (owner's call) or `unavailable` (machine broken/taken: not the owner's fault).
- **Target**: `{ w, r }`: weight and a **rep goal** (a number, not a range). More is fine. 1–2 short is okay. Further short means the goal or weight is off, or it's just a bad day (`verdict`).
- **Next time** defaults to **the same**. The owner's progression (`nextOptions`), e.g. from 10kg × 10 (2 sets): set 1 heavier (12/10) → more reps on set 2 (12, then 15) → set 2 heavier → repeat. Set 2 is never heavier than set 1. These are the one-tap choices; anything else (both up, lower the goal) is the per-set editor. No auto-suggestion beyond "Goal hit on every set".
- **Aim mid-session**: each set's goal can be changed while logging ("Goal 10 reps · Change"). It rewrites that set in `plan`, and next time starts from it.
- **Targets for today** (`targetsFor`): the `next` of the latest non-deload entry for that exercise with sets. Deload sessions never move targets.
- **Imported old notes** (`approx: true`): unreliable (forgotten logs, wrong numbers, inconsistent format, guessed dates). They seed targets and show in history, but are excluded from records, trends, tips, streaks, the calendar and muscle balance (`logged()` in logic.ts). Each one has a "these numbers are right" button that clears the flag.

## Design

Direction: **"plates on rubber"**. Rubber-floor charcoal (`floor`, `mat`, `bench`, `rule`), chalk text, **competition plate colors as the only accents, each with a meaning**: program colors (blue, red, yellow or chalk; back = blue, chest = red), green = goal hit / done / changed for next time, amber = short of the goal. Yellow left bar = the note left last time. Numbers are the loud element: Big Shoulders Display (`.num`, tabular) for weights, reps and headings; Barlow for UI text. Fonts are self-hosted via @fontsource so they work on flaky connections.

- **One tap per set.** The set input is a weight stepper (prefilled) plus a strip of rep numbers; the goal chip has a green ring. Tapping a number logs the set. Don't add confirm steps.
- **Weights always carry the unit**: "15kg × 10" (`fmtSets`, `<Kg>`).
- **Every tappable thing looks tappable**: filled `pill` buttons (44px+), dashed outlines for "add" actions, no bare text links. Rep chips and the weight stepper are 56px. Keep rings `ring-inset` and give scrollers vertical padding so outlines aren't clipped. On phones, use stacked/equal-width grids instead of squeezing a title and buttons into one row.
- **Rare things stay out of the way.** Editing the program, reordering, removing and editing exercises mid-session sit behind the session bar's Edit switch. The normal card only shows logging, next time, and Skip / Machine not available.
- **Two notes, clearly labelled.** "Note that stays" (`exercise.note`, chalk bar, tap to edit the exercise) and "You left this for today" (last entry's `note`, yellow bar, also previewed on collapsed up-next cards). The input is "Note for next time only (gone after that)", available from the first set.
- **Nothing is required.** Notes, finishing all sets, finishing the session: all optional. Unlogged exercises just carry over.
- **The app makes the decision, the owner can override it.** "Next time" is pre-filled with the suggestion; the owner only taps when they disagree.
- **Never lose a set.** Saves go to localStorage first, then the server, retried until they stick. The session bar shows saved / saving / "saved on phone, will sync".
- Phone first (iPhone via home screen, PWA manifest + apple meta). Bottom tab bar on phones, top bar from `sm`. Session column max-w-2xl; start screen and progress use two columns at `lg`.
- Tone: no guilt about gaps. Comeback mode is offered after 14+ days off, the streak counts weeks (not days). No legs nudges (owner asked to remove them).
- Tips (`tips()` in logic.ts) are rule-based and specific: stalled 4+ sessions, gains this month, push/pull imbalance, long break, 6 solid weeks → deload.
- Charts: single series, chalk line, hollow dots for imported points, crosshair readout on hover/tap. Calendar cells carry the program's first letter as well as color (yellow vs red is weak for some color vision).
- Motion: only the `settle` flash when a set is logged. Reduced motion respected.
- Check at 390×844 (iPhone) and 1440×900.

## Conventions

- Small files, functional components, Tailwind inline, minimal comments explaining *why*.
- Run `npm run typecheck` and `npm run build` before committing.
- To eyeball UI: `npm start`, then screenshot with Playwright (chromium is in `~/.cache/ms-playwright`).

## Ideas for later

- Plate calculator / dumbbell rack awareness (real available weights per machine instead of a fixed step).
- Program blocks (time periods): tag sessions to a block ("hypertrophy, Oct–Nov"), compare blocks.
- Rest timer goal per exercise with a gentle vibration (Android only; iOS web can't vibrate).
- Body weight log, if the owner wants it.

<!-- platform:start -->
## Deployment

Live at https://gym.bohdanmoroz.com, behind the shared hub login. Do not add auth to this app.

- The `gym-tracker` container mounts this repo's primary checkout and runs `npm run live`. Caddy reaches it at `gym-tracker:3000`. No host port is published.
- There is no build or deploy step. Files changed in the primary checkout go live automatically, so `main` there is production.
- Worktree changes are not live until merged into the primary checkout's `main`. If merged on GitHub, run `git pull` in the primary checkout.
- Preview in a worktree with `npm run dev`. Don't use the primary checkout for experiments.
- If dependencies change, once they're on `main` run `npm install` in the primary checkout, on the host, then `docker restart gym-tracker`.
- If `compose.yml` changes, run `docker compose up -d` in the primary checkout.
- Logs: `docker logs -f gym-tracker`.
- Never use root or an Alpine image: files and `node_modules` are shared with the host.
- Routing, login and the app list belong to the `hub` repo. Don't change them from here.
- `data/` is the only copy of real user data. Never delete or overwrite it.
<!-- platform:end -->
