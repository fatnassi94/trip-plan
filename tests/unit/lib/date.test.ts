import { describe, expect, it } from "vitest";
import {
  diffInDays,
  formatTripDay,
  formatTripRange,
  fromISODate,
  getMonthGrid,
  isWithinRange,
  toISODate,
} from "@/lib/date";

describe("date helpers", () => {
  it("round-trips ISO dates as local calendar days", () => {
    const d = fromISODate("2026-02-28");
    expect(d?.getDate()).toBe(28);
    expect(toISODate(d!)).toBe("2026-02-28");
  });

  it("rejects malformed ISO dates", () => {
    expect(fromISODate("28/02/2026")).toBeUndefined();
    expect(fromISODate("")).toBeUndefined();
  });

  it("counts nights between two dates", () => {
    expect(diffInDays(fromISODate("2026-10-12")!, fromISODate("2026-10-16")!)).toBe(4);
  });

  it("treats range membership as strictly between the ends (the picker styles ends separately)", () => {
    const start = fromISODate("2026-10-12")!;
    const end = fromISODate("2026-10-16")!;
    expect(isWithinRange(fromISODate("2026-10-14")!, start, end)).toBe(true);
    expect(isWithinRange(start, start, end)).toBe(false);
    expect(isWithinRange(end, start, end)).toBe(false);
    expect(isWithinRange(fromISODate("2026-10-17")!, start, end)).toBe(false);
  });

  it("formats trip ranges, adding the year once when both dates share it", () => {
    expect(formatTripRange("2026-10-12", "2026-10-16")).toBe("Oct 12 – Oct 16, 2026");
    expect(formatTripRange("2026-12-30", "2027-01-02")).toBe("Dec 30, 2026 – Jan 2, 2027");
    expect(formatTripRange("soon", "later")).toBe("soon → later");
  });

  it("names the calendar date of a trip day", () => {
    expect(formatTripDay("2026-10-12", 1)).toBe("Monday, Oct 12");
    expect(formatTripDay("2026-10-12", 3)).toBe("Wednesday, Oct 14");
    expect(formatTripDay("bad", 1)).toBeNull();
  });

  it("builds a month grid of full weeks containing every day in order", () => {
    const grid = getMonthGrid(fromISODate("2026-02-01")!);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    const february = grid.flat().filter((d) => d.getMonth() === 1).map((d) => d.getDate());
    expect(february).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
  });
});
