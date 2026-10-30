import { useState } from "react";
import type { DB, Mode, Session } from "../../../shared/types.ts";
import { done, exMap, fmtDate, fmtSets, sessionLabel } from "../../../shared/logic.ts";
import { cx, dayColor, go, useDeleteSession, useSaveSession } from "../lib.ts";
import { FEEL, Rating, SessionEditor } from "./Session.tsx";
import { Field, input, pill, Segmented } from "./ui.tsx";

export function HistoryPage({ db }: { db: DB }) {
  const sessions = done(db);
  const m = exMap(db);
  const months = new Map<string, Session[]>();
  for (const s of sessions) {
    const k = s.approx ? "From your old notes" : new Date(s.date).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    months.set(k, [...(months.get(k) ?? []), s]);
  }
  if (!sessions.length) return <p className="py-16 text-center text-mute">Finished sessions show up here.</p>;

  return (
    <div className="pt-4 pb-10">
      <h1 className="num text-5xl uppercase">History</h1>
      {[...months].map(([month, ss]) => (
        <section key={month} className="mt-6">
          <h2 className="mb-2 flex items-baseline gap-2 text-sm text-mute">
            {month}
            <span className="text-faint">{ss.length} sessions</span>
          </h2>
          {month === "From your old notes" && <p className="mb-2 text-sm text-faint">Imported from the iPhone note. Dates are guesses and some numbers may be off. They only seed the starting weights; they don't count in stats.</p>}
          <div className="grid gap-2 md:grid-cols-2">
            {ss.map((s) => {
              const mins = s.end && !s.approx ? Math.round((new Date(s.end).getTime() - new Date(s.date).getTime()) / 60000) : null;
              return (
                <button key={s.id} onClick={() => go(`/s/${s.id}`)} className="rounded-2xl bg-mat p-4 text-left hover:bg-bench">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-1.5 rounded-full" style={{ background: dayColor(db, s.day) }} />
                    <span className="font-semibold">{sessionLabel(db, s)}</span>
                    <span className="text-sm text-mute">{s.approx ? "date unknown" : fmtDate(s.date)}</span>
                    {s.mode !== "normal" && <span className="text-sm text-mute">{s.mode === "deload" ? "deload" : "lighter"}</span>}
                    <span className="flex-1" />
                    {mins !== null && <span className="text-sm text-faint">{mins} min</span>}
                  </div>
                  <div className="mt-2 space-y-0.5 text-sm">
                    {s.entries.map((e, i) => (
                      <p key={i} className={cx("truncate", !e.sets.length && "text-faint")}>
                        <span className={e.sets.length ? "text-mute" : ""}>{m.get(e.ex)?.name ?? e.ex}</span> {e.sets.length ? fmtSets(e.sets) : e.skip === "unavailable" ? "not available" : "skipped"}
                        {e.note && <span className="text-faint"> ({e.note})</span>}
                      </p>
                    ))}
                  </div>
                  {(s.feel || s.note) && (
                    <p className="mt-2 text-sm text-mute">
                      {s.feel?.body && <>Body {FEEL.body[s.feel.body - 1].toLowerCase()}. </>}
                      {s.feel?.mind && <>Head {FEEL.mind[s.feel.mind - 1].toLowerCase()}. </>}
                      {s.note && <>“{s.note}”</>}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function SessionPage({ db, id }: { db: DB; id: string }) {
  const save = useSaveSession();
  const del = useDeleteSession();
  const [sure, setSure] = useState(false);
  const [editing, setEditing] = useState(false);
  const s = db.sessions.find((x) => x.id === id);
  if (!s) return <p className="py-16 text-center text-mute">This session was deleted.</p>;
  if (!s.end) {
    go("/");
    return null;
  }
  const start = new Date(s.date);
  const end = new Date(s.end);
  const mins = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  /** Moving the date or start time keeps the length; length is changed on its own. */
  const setStart = (date: string, time: string) => {
    const d = new Date(`${date}T${time}`);
    if (isNaN(d.getTime())) return;
    save({ ...s, date: d.toISOString(), end: new Date(d.getTime() + mins * 60000).toISOString() });
  };
  const setLength = (m: number) => save({ ...s, end: new Date(start.getTime() + Math.max(5, m) * 60000).toISOString() });

  return (
    <div className="mx-auto max-w-2xl pt-4 pb-10">
      <button onClick={() => history.back()} className={pill}>
        ‹ Back
      </button>
      <div className="mt-4 flex items-center gap-3">
        <span className="h-10 w-2 shrink-0 rounded-full" style={{ background: dayColor(db, s.day) }} />
        <h1 className="num text-4xl uppercase">{sessionLabel(db, s)}</h1>
      </div>

      <div className="mt-4 space-y-5 rounded-2xl bg-mat p-4">
        {s.approx && <p className="text-sm text-mute">From your old notes. The date is a guess; fix it if you remember.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Day">
            <input type="date" className={input} value={dateStr(start)} onChange={(e) => e.target.value && setStart(e.target.value, timeStr(start))} />
          </Field>
          <Field label="Started">
            <input type="time" className={input} value={timeStr(start)} onChange={(e) => e.target.value && setStart(dateStr(start), e.target.value)} />
          </Field>
        </div>
        <div>
          <div className="mb-1.5 text-sm text-mute">Length</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLength(mins - 5)} className={cx(pill, "h-12 w-16 shrink-0 px-0")} aria-label="5 minutes shorter">
              −5
            </button>
            <div className="num flex h-12 min-w-0 flex-1 items-center justify-center rounded-xl bg-floor text-2xl">
              {mins} min <span className="ml-2 font-sans text-sm font-normal text-mute">until {timeStr(end)}</span>
            </div>
            <button onClick={() => setLength(mins + 5)} className={cx(pill, "h-12 w-16 shrink-0 px-0")} aria-label="5 minutes longer">
              +5
            </button>
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-sm text-mute">Kind</div>
          <Segmented<Mode>
            value={s.mode}
            onChange={(mode) => save({ ...s, mode })}
            options={[
              { value: "normal", label: "Normal" },
              { value: "comeback", label: "Lighter" },
              { value: "deload", label: "Deload" },
            ]}
          />
        </div>
        <Rating label="Body" words={FEEL.body} value={s.feel?.body} onChange={(body) => save({ ...s, feel: { ...s.feel, body } })} />
        <Rating label="Head" words={FEEL.mind} value={s.feel?.mind} onChange={(mind) => save({ ...s, feel: { ...s.feel, mind } })} />
        <Field label="Session note">
          <input className={input} value={s.note ?? ""} placeholder="Nothing noted" onChange={(e) => save({ ...s, note: e.target.value || undefined })} />
        </Field>
        {s.approx && (
          <button onClick={() => save({ ...s, approx: undefined })} className={cx(pill, "h-auto w-full py-3 text-left")}>
            These numbers are right, count this session in stats
          </button>
        )}
      </div>

      <div className="mt-6 mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <p className="text-sm text-mute">{editing ? "Open an exercise to move it up or down, or remove it." : "Tap an exercise to fix its sets or next time."}</p>
        <button onClick={() => setEditing(!editing)} aria-pressed={editing} className={cx(pill, editing && "bg-chalk text-floor active:bg-chalk hover:bg-chalk")}>
          {editing ? "Done" : "Fix order"}
        </button>
      </div>
      <SessionEditor db={db} session={s} onChange={save} live={false} editing={editing} />

      <button
        onClick={() => {
          if (!sure) return setSure(true);
          del(s.id);
          go("/history");
        }}
        className={cx(pill, "mt-8 w-full bg-transparent", sure ? "text-red" : "text-mute")}
      >
        {sure ? "Tap again to delete this session for good" : "Delete session"}
      </button>
    </div>
  );
}
