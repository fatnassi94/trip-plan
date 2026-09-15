import type { ItineraryItem, TripDay } from "@/types/trip";

// Pure, display-side helpers over an already-validated itinerary: times,
// day parts, and per-day totals for the trip, day and map headers. Every
// number here is derived from the trip itself — nothing estimated.

export function toMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function addMinutes(start: string, minutes: number): string {
  const base = toMinutes(start);
  if (base == null) return start;
  const total = base + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function dayPart(start: string): string {
  const t = toMinutes(start);
  if (t == null) return "Anytime";
  if (t < 12 * 60) return "Morning";
  if (t < 14 * 60) return "Midday";
  if (t < 18 * 60) return "Afternoon";
  return "Evening";
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function isMapped(item: ItineraryItem): boolean {
  return item.lat != null && item.lng != null;
}

export function summarizeDay(day: TripDay) {
  const items = day.items;
  const last = items[items.length - 1];
  return {
    stops: items.length,
    meals: items.filter((i) => i.type === "meal").length,
    mapped: items.filter(isMapped).length,
    plannedMinutes: items.reduce((sum, i) => sum + i.durationMinutes, 0),
    firstStart: items[0]?.start,
    lastEnd: last ? addMinutes(last.start, last.durationMinutes) : undefined,
  };
}
