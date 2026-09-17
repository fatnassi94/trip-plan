"use client";

// A labelled 1–N scale between two poles (Tourist ↔ Local, Famous ↔
// Hidden). Native range input for free keyboard, touch and screen-reader
// support — same reasoning as components/profile/budget-selector.tsx.
export function ScaleSlider({
  label,
  value,
  onChange,
  labels,
  left,
  right,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** One label per step, left to right. */
  labels: readonly string[];
  left: string;
  right: string;
}) {
  const percent = labels.length > 1 ? ((value - 1) / (labels.length - 1)) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-sm font-semibold text-ink">{label}</span>
        <span
          aria-hidden="true"
          className="rounded-full bg-warm-soft px-2.5 py-0.5 font-mono text-[0.65rem] font-bold text-warm"
        >
          {labels[value - 1]}
        </span>
      </div>
      <div className="px-2">
        <input
          type="range"
          min={1}
          max={labels.length}
          step={1}
          value={value}
          aria-label={label}
          aria-valuetext={labels[value - 1]}
          onChange={(e) => onChange(Number(e.target.value))}
          className="roam-slider mt-3 w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          style={{
            background: `linear-gradient(to right, hsl(var(--accent)) ${percent}%, hsl(var(--accent-soft)) ${percent}%)`,
          }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-muted">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}
