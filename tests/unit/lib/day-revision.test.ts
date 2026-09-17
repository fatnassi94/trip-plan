import { describe, expect, it } from "vitest";
import { parseDayRevision } from "@/lib/ai/schema";
import { diffDay, hasChanges, replaceDay } from "@/lib/itinerary";
import { makeRainyDay, RAIN_CHANGES, RAIN_REPLY } from "@/tests/fixtures/assistant";
import { makeItem, makeTrip } from "@/tests/fixtures/trip";

describe("parseDayRevision (assistant output gate)", () => {
  it("accepts a valid revision of the requested day", () => {
    const day = makeRainyDay();
    expect(parseDayRevision({ reply: RAIN_REPLY, day }, 1)).toEqual({ reply: RAIN_REPLY, day });
  });

  it("rejects a revision that changes which day it is", () => {
    const day = { ...makeRainyDay(), day: 2 };
    expect(() => parseDayRevision({ reply: RAIN_REPLY, day }, 1)).toThrow(/keep day 1/);
  });

  it("rejects a missing or empty reply, and prose instead of JSON", () => {
    expect(() => parseDayRevision({ reply: "   ", day: makeRainyDay() }, 1)).toThrow();
    expect(() => parseDayRevision({ day: makeRainyDay() }, 1)).toThrow();
    expect(() => parseDayRevision("Sure! I moved the museum.", 1)).toThrow();
  });

  it("rejects a revised day with overlapping stops", () => {
    const day = makeRainyDay();
    day.items[1].start = "10:00"; // castle runs 09:30–11:00
    expect(() => parseDayRevision({ reply: RAIN_REPLY, day }, 1)).toThrow(/business rules.*overlaps/);
  });

  it("rejects a day emptied of stops or a new stop without a reason", () => {
    expect(() => parseDayRevision({ reply: RAIN_REPLY, day: { ...makeRainyDay(), items: [] } }, 1)).toThrow();
    const noReason = makeRainyDay();
    noReason.items[1].reason = "";
    expect(() => parseDayRevision({ reply: RAIN_REPLY, day: noReason }, 1)).toThrow();
  });
});

describe("diffDay", () => {
  const before = makeTrip().days[0];

  it("reports nothing for an identical day", () => {
    const changes = diffDay(before, structuredClone(before));
    expect(changes).toEqual({ added: [], removed: [], retimed: [] });
    expect(hasChanges(changes)).toBe(false);
  });

  it("finds added and removed stops", () => {
    const changes = diffDay(before, makeRainyDay());
    expect(changes).toEqual(RAIN_CHANGES);
    expect(hasChanges(changes)).toBe(true);
  });

  it("reports a stop whose start or duration moved", () => {
    const after = structuredClone(before);
    after.items[0].start = "10:00";
    after.items[2].durationMinutes = 90;
    expect(diffDay(before, after).retimed).toEqual([
      { name: "Castelo de São Jorge", from: "09:30–11:00", to: "10:00–11:30" },
      { name: "Miradouro de Santa Luzia", from: "16:30–17:30", to: "16:30–18:00" },
    ]);
  });

  it("matches stops by name regardless of case and surrounding spaces", () => {
    const after = structuredClone(before);
    after.items[0] = makeItem({ ...after.items[0], name: "  castelo de SÃO jorge " });
    expect(hasChanges(diffDay(before, after))).toBe(false);
  });
});

describe("replaceDay", () => {
  it("swaps only the matching day and leaves the original trip untouched", () => {
    const trip = makeTrip();
    const next = replaceDay(trip, makeRainyDay());
    expect(next.days[0]).toEqual(makeRainyDay());
    expect(next.days[1]).toBe(trip.days[1]);
    expect(trip.days[0].items).toHaveLength(3);
  });
});
