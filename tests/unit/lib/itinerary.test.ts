import { describe, expect, it } from "vitest";
import { addMinutes, dayPart, formatDuration, isMapped, summarizeDay, toMinutes } from "@/lib/itinerary";
import { makeItem, makeTrip } from "@/tests/fixtures/trip";

describe("itinerary helpers", () => {
  it("parses HH:MM into minutes and rejects garbage", () => {
    expect(toMinutes("09:05")).toBe(545);
    expect(toMinutes("9:05")).toBe(545);
    expect(toMinutes("noon")).toBeNull();
  });

  it("adds minutes, wrapping past midnight", () => {
    expect(addMinutes("09:30", 90)).toBe("11:00");
    expect(addMinutes("23:30", 45)).toBe("00:15");
    expect(addMinutes("bad", 30)).toBe("bad");
  });

  it.each([
    ["08:00", "Morning"],
    ["11:59", "Morning"],
    ["12:00", "Midday"],
    ["14:00", "Afternoon"],
    ["18:00", "Evening"],
    ["??", "Anytime"],
  ])("labels %s as %s", (start, label) => {
    expect(dayPart(start)).toBe(label);
  });

  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(135)).toBe("2h 15m");
  });

  it("only counts an item as mapped when it has both coordinates", () => {
    expect(isMapped(makeItem())).toBe(true);
    expect(isMapped(makeItem({ lat: undefined }))).toBe(false);
  });

  it("summarizes a day from its items", () => {
    const day = makeTrip().days[0];
    expect(summarizeDay(day)).toEqual({
      stops: 3,
      meals: 1,
      mapped: 3,
      plannedMinutes: 90 + 75 + 60,
      firstStart: "09:30",
      lastEnd: "17:30",
    });
  });
});
