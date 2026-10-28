import { useState } from "react";
import type { DB, Mode, Session } from "../../../shared/types.ts";
import { DAYS, done, exMap, fmtDate, fmtSets } from "../../../shared/logic.ts";
import { cx, dayColor, go, useDeleteSession, useSaveSession } from "../lib.ts";
import { SessionEditor } from "./Session.tsx";
import { Field, input, Segmented } from "./ui.tsx";

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
                    <span className="h-4 w-1.5 rounded-full" style={{ background: dayColor(s.day) }} />
                    <span className="font-semibold">{s.day ? DAYS[s.day].label : "Session"}</span>
                    <span className="text-sm text-mute">{s.approx ? "date unknown" : fmtDate(s.date)}</span>
                    {s.mode !== "normal" && <span className="text-sm text-mute">{s.mode === "deload" ? "deload" : "lighter"}</span>}
                    <span className="flex-1" />
                    {mins !== null && <span className="text-sm text-faint">{mins} min</span>}
                  </div>
                  <div className="mt-2 space-y-0.5 text-sm">
                    {s.entries.map((e, i) => (
                      <p key={i} className={cx("truncate", !e.sets.length && "text-faint")}>
                        <span className={e.sets.length ? "text-mute" : ""}>{m.get(e.ex)?.short ?? e.ex}</span> {e.sets.length ? fmtSets(e.sets) : "skipped"}
                        {e.note && <span className="text-faint"> ({e.note})</span>}
                      </p>
                    ))}
                  </div>
                  {s.note && <p className="mt-2 text-sm text-mute">“{s.note}”</p>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function SessionPage({ db, id }: { db: DB; id: string }) {
  const save = useSaveSession();
  const del = useDeleteSession();
  const [sure, setSure] = useState(false);
  const s = db.sessions.find((x) => x.id === id);
  if (!s) return <p className="py-16 text-center text-mute">This session was deleted.</p>;
  if (!s.end) {
    go("/");
    return null;
  }
  const length = new Date(s.end).getTime() - new Date(s.date).getTime();

  return (
    <div className="mx-auto max-w-2xl pt-4 pb-10">
      <button onClick={() => history.back()} className="text-sm text-mute hover:text-chalk">
        ‹ Back
      </button>
      <div className="mt-2 flex items-center gap-3">
        <span className="h-10 w-2 rounded-full" style={{ background: dayColor(s.day) }} />
        <h1 className="num text-4xl uppercase">{s.day ? DAYS[s.day].label : "Session"}</h1>
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl bg-mat p-4 sm:grid-cols-2">
        <Field label={s.approx ? "Date (a guess, fix it if you remember)" : "Started"}>
          <input
            type="datetime-local"
            className={input}
            value={toLocalInput(s.date)}
            onChange={(e) => {
              if (!e.target.value) return;
              const date = new Date(e.target.value).toISOString();
              save({ ...s, date, end: new Date(new Date(date).getTime() + length).toISOString() });
            }}
          />
        </Field>
        <Field label="Kind">
          <Segmented<Mode>
            value={s.mode}
            onChange={(mode) => save({ ...s, mode })}
            options={[
              { value: "normal", label: "Normal" },
              { value: "comeback", label: "Lighter" },
              { value: "deload", label: "Deload" },
            ]}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Session note">
            <input className={input} value={s.note ?? ""} placeholder="Nothing noted" onChange={(e) => save({ ...s, note: e.target.value || undefined })} />
          </Field>
        </div>
        {s.approx && (
          <button onClick={() => save({ ...s, approx: undefined })} className="justify-self-start rounded-lg text-sm text-mute hover:text-chalk sm:col-span-2">
            These numbers are right, count this session in stats
          </button>
        )}
      </div>

      <h2 className="mt-6 mb-2 text-sm text-mute">Tap an exercise to fix sets or next time's plan</h2>
      <SessionEditor db={db} session={s} onChange={save} live={false} />

      <button
        onClick={() => {
          if (!sure) return setSure(true);
          del(s.id);
          go("/history");
        }}
        className="mt-8 text-sm text-mute hover:text-red"
      >
        {sure ? "Tap again to delete this session for good" : "Delete session"}
      </button>
    </div>
  );
}
