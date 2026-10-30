import { useEffect, useState, type ReactNode } from "react";
import type { Exercise } from "../../../shared/types.ts";
import { AIMS, fmtW, isStack, stepOf, weightMeaning } from "../../../shared/logic.ts";
import { cx } from "../lib.ts";

/** Bottom sheet on phones, centered dialog on wider screens. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label={title} className="safe-b flex max-h-[90dvh] w-full flex-col rounded-t-3xl bg-mat sm:max-w-lg sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className={cx(pill, "-mr-1")}>
            Close
          </button>
        </div>
        {/* p-1 inside the scroller so focus rings and outlines aren't clipped */}
        <div className="overflow-y-auto px-4 pt-1 pb-6">{children}</div>
      </div>
    </div>
  );
}

/** Secondary button: always visibly a button (filled, 44px tall). */
export const pill = "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-bench px-4 font-medium text-chalk active:bg-rule hover:bg-rule";
export const pillSm = "inline-flex h-10 items-center justify-center rounded-lg bg-bench px-3 text-sm font-medium text-chalk active:bg-rule hover:bg-rule";
export const input = "block h-12 w-full min-w-0 appearance-none rounded-xl bg-floor px-3.5 text-base text-chalk placeholder:text-faint outline-none ring-inset focus:ring-2 focus:ring-mute";

/** "15kg" in display type with a smaller unit. */
export const Kg = ({ w, className }: { w: number; className?: string }) => (
  <span className={cx("num", className)}>
    {fmtW(w)}
    <span className="ml-[0.08em] text-[0.62em] font-semibold text-mute">kg</span>
  </span>
);

/**
 * − weight + with the number itself tappable to type any value.
 * Plates and free weights step by 0.5 and get jump buttons for a new pair of dumbbells or a plate.
 */
export function WeightStepper({ value, ex, onChange }: { value: number; ex: Exercise; onChange: (w: number) => void }) {
  const step = stepOf(ex);
  const [typing, setTyping] = useState(false);
  const set = (w: number) => onChange(Math.max(0, +w.toFixed(2)));
  const btn = "grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-rule text-3xl leading-none text-chalk active:bg-mute/50";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-3">
        <button className={btn} onClick={() => set(value - step)} aria-label={`Minus ${fmtW(step)} kg`}>
          −
        </button>
        {typing ? (
          <input
            autoFocus
            inputMode="decimal"
            defaultValue={fmtW(value)}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => {
              const v = parseFloat(e.target.value.replace(",", "."));
              if (!isNaN(v)) set(v);
              setTyping(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="num h-14 w-32 rounded-2xl bg-floor text-center text-4xl text-chalk outline-none ring-2 ring-chalk ring-inset"
            aria-label="Weight in kg"
          />
        ) : (
          <button onClick={() => setTyping(true)} className="h-14 w-32 rounded-2xl border-2 border-dashed border-rule text-4xl" aria-label={`${fmtW(value)} kg, tap to type`}>
            <Kg w={value} />
          </button>
        )}
        <button className={btn} onClick={() => set(value + step)} aria-label={`Plus ${fmtW(step)} kg`}>
          +
        </button>
      </div>
      {!isStack(ex) && (
        <div className="flex justify-center gap-2">
          {[-5, -2.5, 2.5, 5].map((d) => (
            <button key={d} onClick={() => set(value + d)} className="num h-10 min-w-14 rounded-lg bg-floor/70 px-2 text-lg text-mute active:bg-rule" aria-label={`${d > 0 ? "Plus" : "Minus"} ${Math.abs(d)} kg`}>
              {d > 0 ? "+" : "−"}
              {Math.abs(d)}
            </button>
          ))}
        </div>
      )}
      {weightMeaning(ex) && <p className="text-center text-sm text-mute">{weightMeaning(ex)}</p>}
    </div>
  );
}

/** Equal-width choice buttons. */
export function Choice<T extends string | number>({ value, options, onChange, size = "md" }: { value: T | undefined; options: { value: T; label: ReactNode; sub?: string }[]; onChange: (v: T) => void; size?: "md" | "lg" }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={cx(
              "flex flex-col items-center justify-center rounded-xl px-1 leading-tight font-medium",
              size === "lg" ? "h-16" : "h-12 text-[15px]",
              on ? "bg-chalk text-floor" : "bg-bench text-chalk active:bg-rule hover:bg-rule",
            )}
          >
            {o.label}
            {o.sub && <span className={cx("mt-0.5 text-xs font-normal", on ? "text-floor/70" : "text-mute")}>{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return <Choice value={value} options={options} onChange={onChange} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm text-mute">{label}</span>
      {children}
    </label>
  );
}

/** Rep goal: the usual numbers as chips, − + for anything else. */
export function AimPicker({ value, onChange }: { value: number; onChange: (r: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-7 gap-1">
        {AIMS.map((a) => (
          <button key={a} onClick={() => onChange(a)} aria-pressed={a === value} className={cx("num h-12 min-w-0 rounded-xl text-xl", a === value ? "bg-chalk text-floor" : "bg-floor text-chalk active:bg-rule")}>
            {a}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(1, value - 1))} className={cx(pill, "h-11 w-14 shrink-0 bg-floor px-0 text-xl")} aria-label="One rep less">
          −
        </button>
        <div className="num flex h-11 flex-1 items-center justify-center rounded-xl bg-floor/50 text-xl">
          {value} <span className="ml-1.5 font-sans text-sm font-normal text-mute">reps</span>
        </div>
        <button onClick={() => onChange(value + 1)} className={cx(pill, "h-11 w-14 shrink-0 bg-floor px-0 text-xl")} aria-label="One rep more">
          +
        </button>
      </div>
    </div>
  );
}

/** On/off row, a big tappable switch. */
export function Toggle({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} aria-pressed={value} className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-floor px-3.5 py-2 text-left active:bg-rule">
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        {sub && <span className="block text-sm text-mute">{sub}</span>}
      </span>
      <span className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors", value ? "bg-green" : "bg-rule")}>
        <span className={cx("absolute top-1 h-5 w-5 rounded-full bg-chalk transition-all", value ? "left-6" : "left-1")} />
      </span>
    </button>
  );
}
