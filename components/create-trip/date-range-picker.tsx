"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  diffInDays,
  formatDisplayDate,
  formatMonthTitle,
  getMonthGrid,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinRange,
  startOfDay,
  toISODate,
  WEEKDAY_LABELS,
} from "@/lib/date";

export interface DateRange {
  start?: Date;
  end?: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (next: DateRange) => void;
  /** Earliest selectable day. Defaults to today — this plans future trips. */
  minDate?: Date;
}

// A single well-crafted month view rather than a two-month desktop
// layout: keyboard roving-focus across two live grids has real edge
// cases (which grid "owns" a boundary date, where focus lands when a
// key press crosses from the second grid back into the first) that
// aren't worth the risk for a date range that's fully choosable from
// one grid with prev/next. Still fully responsive — the grid and popover
// both scale down to a 360px phone width.
export function DateRangePicker({ value, onChange, minDate }: DateRangePickerProps) {
  const today = startOfDay(minDate ?? new Date());

  const [open, setOpen] = useState(false);
  const [baseMonth, setBaseMonth] = useState(() => value.start ?? today);
  const [focusedDate, setFocusedDate] = useState(() => value.start ?? today);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());

  const popoverId = useId();
  const gridLabelId = useId();

  // Close on outside click / Escape; restore focus to the trigger on
  // Escape so a keyboard user never loses their place.
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Keep the visible month and the roving-tabindex cell in sync whenever
  // focusedDate moves outside the currently displayed month.
  useEffect(() => {
    if (!isSameMonth(focusedDate, baseMonth)) setBaseMonth(focusedDate);
  }, [focusedDate, baseMonth]);

  // Move DOM focus to match focusedDate after each grid re-render (open,
  // month change, or arrow-key navigation) — the actual keyboard-nav step.
  useEffect(() => {
    if (!open) return;
    const cell = cellRefs.current.get(toISODate(focusedDate));
    cell?.focus();
  }, [open, focusedDate, baseMonth]);

  function selectDay(day: Date) {
    if (isBefore(day, today)) return;

    if (!value.start || (value.start && value.end)) {
      onChange({ start: day, end: undefined });
      return;
    }
    // value.start is set, value.end is not.
    if (isBefore(day, value.start)) {
      onChange({ start: day, end: undefined }); // restart from the earlier day
      return;
    }
    onChange({ start: value.start, end: day });
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 7,
      ArrowUp: -7,
    };

    if (e.key in moves) {
      e.preventDefault();
      setFocusedDate((d) => addDays(d, moves[e.key]));
      return;
    }
    if (e.key === "PageUp") {
      e.preventDefault();
      setFocusedDate((d) => addMonths(d, -1));
      return;
    }
    if (e.key === "PageDown") {
      e.preventDefault();
      setFocusedDate((d) => addMonths(d, 1));
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setFocusedDate((d) => addDays(d, -d.getDay()));
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setFocusedDate((d) => addDays(d, 6 - d.getDay()));
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectDay(focusedDate);
    }
  }

  const nights = value.start && value.end ? diffInDays(value.start, value.end) : null;
  const weeks = getMonthGrid(baseMonth);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-col gap-4 sm:flex-row">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popoverId}
          onClick={() => {
            setFocusedDate(value.start ?? today);
            setOpen((o) => !o);
          }}
          className="flex flex-1 flex-col gap-2 rounded-md border border-border bg-transparent px-4 py-3 text-left text-sm outline-none focus:border-accent"
        >
          <span className="font-mono text-xs uppercase tracking-widest text-muted">From</span>
          <span className={value.start ? "" : "text-muted"}>
            {value.start ? formatDisplayDate(value.start) : "Select date"}
          </span>
        </button>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popoverId}
          onClick={() => {
            setFocusedDate(value.end ?? value.start ?? today);
            setOpen((o) => !o);
          }}
          className="flex flex-1 flex-col gap-2 rounded-md border border-border bg-transparent px-4 py-3 text-left text-sm outline-none focus:border-accent"
        >
          <span className="font-mono text-xs uppercase tracking-widest text-muted">To</span>
          <span className={value.end ? "" : "text-muted"}>
            {value.end ? formatDisplayDate(value.end) : "Select date"}
          </span>
        </button>
      </div>

      {nights !== null ? (
        <p className="mt-2 font-mono text-xs text-accent">
          {nights} {nights === 1 ? "night" : "nights"}
        </p>
      ) : null}

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Choose travel dates"
          aria-modal="false"
          className="absolute z-30 mt-2 w-full max-w-sm rounded-lg border border-border bg-paper p-4 shadow-lg sm:w-[22rem]"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setFocusedDate((d) => addMonths(d, -1))}
              className="rounded-md p-2 hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <p id={gridLabelId} className="font-display text-sm font-medium">
              {formatMonthTitle(baseMonth)}
            </p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setFocusedDate((d) => addMonths(d, 1))}
              className="rounded-md p-2 hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div
            role="grid"
            aria-labelledby={gridLabelId}
            onKeyDown={handleGridKeyDown}
            className="mt-3"
          >
            <div role="row" className="grid grid-cols-7">
              {WEEKDAY_LABELS.map((label) => (
                <span
                  key={label}
                  role="columnheader"
                  aria-hidden="true"
                  className="py-1 text-center font-mono text-[0.65rem] uppercase text-muted"
                >
                  {label}
                </span>
              ))}
            </div>

            {weeks.map((week, wi) => (
              <div role="row" key={wi} className="grid grid-cols-7">
                {week.map((day) => {
                  const inMonth = isSameMonth(day, baseMonth);
                  const disabled = isBefore(day, today);
                  const isStart = value.start ? isSameDay(day, value.start) : false;
                  const isEnd = value.end ? isSameDay(day, value.end) : false;
                  const inRange =
                    value.start && value.end ? isWithinRange(day, value.start, value.end) : false;
                  const isFocusTarget = isSameDay(day, focusedDate);
                  const isToday = isSameDay(day, new Date());

                  if (!inMonth) {
                    return <span key={toISODate(day)} aria-hidden="true" className="h-10 w-10" />;
                  }

                  return (
                    <div
                      key={toISODate(day)}
                      role="gridcell"
                      aria-selected={isStart || isEnd}
                      className="flex justify-center"
                    >
                      <button
                        ref={(el) => {
                          if (el) cellRefs.current.set(toISODate(day), el);
                          else cellRefs.current.delete(toISODate(day));
                        }}
                        type="button"
                        disabled={disabled}
                        tabIndex={isFocusTarget ? 0 : -1}
                        aria-current={isToday ? "date" : undefined}
                        aria-label={`${day.toLocaleDateString(undefined, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}${isStart ? ", start date" : ""}${isEnd ? ", end date" : ""}`}
                        onClick={() => selectDay(day)}
                        onFocus={() => setFocusedDate(day)}
                        className={cellClasses({
                          disabled,
                          isStart,
                          isEnd,
                          inRange,
                          isToday,
                        })}
                      >
                        {day.getDate()}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <button
              type="button"
              onClick={() => onChange({ start: undefined, end: undefined })}
              className="text-xs text-muted underline underline-offset-4 hover:text-accent"
            >
              Clear dates
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className="rounded-md bg-accent px-4 py-2 text-xs font-medium text-paper hover:opacity-90"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function cellClasses({
  disabled,
  isStart,
  isEnd,
  inRange,
  isToday,
}: {
  disabled: boolean;
  isStart: boolean;
  isEnd: boolean;
  inRange: boolean;
  isToday: boolean;
}): string {
  const base =
    "flex h-10 w-10 items-center justify-center rounded-full text-sm outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  if (disabled) return `${base} cursor-not-allowed text-muted/40`;
  if (isStart || isEnd) return `${base} bg-accent text-paper font-medium`;
  if (inRange) return `${base} bg-accent-soft text-accent`;
  if (isToday) return `${base} border border-accent text-accent hover:bg-accent-soft`;
  return `${base} hover:bg-accent-soft`;
}

// Re-exported so callers building query params don't need their own
// import of the date module just for this one conversion.
export { toISODate, isAfter };
