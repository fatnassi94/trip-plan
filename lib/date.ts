// Small, dependency-free date helpers for the create-trip date range
// picker (components/create-trip/date-range-picker.tsx). Deliberately not
// pulling in date-fns/dayjs for a handful of pure calendar-grid functions
// — one fewer dependency to version-match against React 18/Next 14.
//
// Every function treats dates as local calendar days (midnight in the
// browser's own timezone), never UTC — the classic date-picker bug is a
// `toISOString()` call silently rolling a date back a day for anyone west
// of UTC.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return undefined;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// Trip headers format with a fixed locale: these strings can render on
// the server and again in the browser, and a locale-dependent format
// would make the two disagree (a hydration mismatch).
const TRIP_LOCALE = "en-US";

/** "Sep 18 – Sep 25, 2026" for trip headers; raw strings if unparseable. */
export function formatTripRange(startIso: string, endIso: string): string {
  const start = fromISODate(startIso);
  const end = fromISODate(endIso);
  if (!start || !end) return `${startIso} → ${endIso}`;
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString(TRIP_LOCALE, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endLabel = end.toLocaleDateString(TRIP_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

/** The calendar date of a 1-indexed trip day, e.g. "Thursday, Sep 19". */
export function formatTripDay(startIso: string, dayNumber: number): string | null {
  const start = fromISODate(startIso);
  if (!start) return null;
  return addDays(start, dayNumber - 1).toLocaleDateString(TRIP_LOCALE, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Strictly before, comparing calendar days only (time-of-day ignored). */
export function isBefore(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() < startOfDay(b).getTime();
}

export function isAfter(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() > startOfDay(b).getTime();
}

/** True for days strictly between start and end (exclusive both ends). */
export function isWithinRange(day: Date, start: Date, end: Date): boolean {
  const t = startOfDay(day).getTime();
  return t > startOfDay(start).getTime() && t < startOfDay(end).getTime();
}

export function diffInDays(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

export function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatMonthTitle(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

/**
 * Six full weeks (42 days, Sunday-first) covering `month`, padded with
 * the tail of the previous month and the head of the next — the
 * standard fixed-height calendar grid so the picker never reflows
 * between months with 4 vs. 6 visible weeks.
 */
export function getMonthGrid(month: Date): Date[][] {
  const first = startOfMonth(month);
  const gridStart = addDays(first, -first.getDay());

  const weeks: Date[][] = [];
  let cursor = gridStart;
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}
