import { useEffect, type ReactNode } from "react";
import { fmtW } from "../../../shared/logic.ts";
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
      <div
        role="dialog"
        aria-label={title}
        className="safe-b flex max-h-[88dvh] w-full flex-col rounded-t-2xl bg-mat sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="-mr-2 rounded-full px-3 py-1 text-mute hover:text-chalk" aria-label="Close">
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

/** − 12.5 kg + : big targets for sweaty thumbs. */
export function WeightStepper({ value, step, onChange, size = "md" }: { value: number; step: number; onChange: (w: number) => void; size?: "md" | "lg" }) {
  const s = step || 1;
  const btn = cx("grid place-items-center rounded-xl bg-rule text-2xl leading-none text-chalk active:bg-mute/40", size === "lg" ? "h-12 w-12" : "h-10 w-10");
  return (
    <div className="flex items-center gap-2">
      <button className={btn} onClick={() => onChange(Math.max(0, +(value - s).toFixed(2)))} aria-label={`Minus ${fmtW(s)} kg`}>
        −
      </button>
      <div className={cx("num min-w-[4.5ch] text-center", size === "lg" ? "text-4xl" : "text-3xl")}>
        {fmtW(value)}
        <span className="ml-0.5 font-sans text-sm font-medium text-mute">kg</span>
      </div>
      <button className={btn} onClick={() => onChange(+(value + s).toFixed(2))} aria-label={`Plus ${fmtW(s)} kg`}>
        +
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-xl bg-floor p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx("rounded-lg px-3 py-1.5 text-sm font-medium", o.value === value ? "bg-bench text-chalk" : "text-mute hover:text-chalk")}
          aria-pressed={o.value === value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-mute">{label}</span>
      {children}
    </label>
  );
}

export const input = "w-full rounded-xl bg-floor px-3 py-2.5 text-chalk placeholder:text-faint outline-none focus:ring-2 focus:ring-rule";
