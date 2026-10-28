import { active } from "../../shared/logic.ts";
import { cx, dayColor, go, useDB, useRoute } from "./lib.ts";
import { TodayPage } from "./components/Today.tsx";
import { HistoryPage, SessionPage } from "./components/History.tsx";
import { ProgressPage } from "./components/Progress.tsx";
import { ExercisePage } from "./components/ExercisePage.tsx";

export function App() {
  const { data: db, error, refetch } = useDB();
  const [page, id] = useRoute();
  const live = db && active(db);
  const tab = page === "history" || page === "s" ? "history" : page === "progress" || page === "ex" ? "progress" : "today";

  const tabs = [
    { key: "today", href: "/", label: live ? "Session" : "Today" },
    { key: "history", href: "/history", label: "History" },
    { key: "progress", href: "/progress", label: "Progress" },
  ];

  return (
    <div className="min-h-dvh">
      {/* Desktop: top bar */}
      <header className="hidden border-b border-rule sm:block">
        <nav className="mx-auto flex max-w-6xl items-center gap-1 px-6 py-3">
          <span className="num mr-6 text-2xl uppercase">Gym</span>
          {tabs.map((t) => (
            <a key={t.key} href={"#" + t.href} className={cx("flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium", tab === t.key ? "bg-mat text-chalk" : "text-mute hover:text-chalk")}>
              {t.key === "today" && live && <span className="h-2 w-2 rounded-full" style={{ background: dayColor(live.day) }} />}
              {t.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="safe-t mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-10">
        {error ? (
          <div className="py-20 text-center">
            <p className="text-lg">Can't reach the server.</p>
            <p className="mt-1 text-mute">Check that the SSH tunnel is up, then try again. Sets you already logged are kept on this device.</p>
            <button onClick={() => refetch()} className="mt-4 rounded-xl bg-mat px-5 py-2.5 font-medium">
              Try again
            </button>
          </div>
        ) : !db ? (
          <p className="py-20 text-center text-mute">Loading…</p>
        ) : page === "history" ? (
          <HistoryPage db={db} />
        ) : page === "s" && id ? (
          <SessionPage db={db} id={id} />
        ) : page === "progress" ? (
          <ProgressPage db={db} />
        ) : page === "ex" && id ? (
          <ExercisePage db={db} id={id} />
        ) : (
          <TodayPage db={db} />
        )}
      </main>

      {/* Phone: bottom bar, thumb reach */}
      <nav className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-floor/95 backdrop-blur sm:hidden">
        <div className="flex">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => go(t.href)} className={cx("flex flex-1 flex-col items-center gap-1 pt-2.5 pb-2 text-sm font-medium", tab === t.key ? "text-chalk" : "text-faint")}>
              <span className="h-1 w-6 rounded-full" style={{ background: tab === t.key ? (t.key === "today" && live ? dayColor(live.day) : "var(--color-chalk)") : "transparent" }} />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
