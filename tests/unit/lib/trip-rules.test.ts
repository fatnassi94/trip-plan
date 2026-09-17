import { describe, expect, it } from "vitest";
import { parseDayRevision, parseTripResponse } from "@/lib/ai/schema";
import {
  WALKING_DETOUR_FACTOR,
  checkConstraints,
  checkTripConstraints,
  distanceKm,
  estimateWalkingKm,
} from "@/lib/trip-rules";
import { makeRainyDay, RAIN_REPLY } from "@/tests/fixtures/assistant";
import { makeItem, makeTrip } from "@/tests/fixtures/trip";

// Day 1 of makeTrip(): castle 09:30–11:00 (90m, tag "views"),
// taberna 12:30–13:45 (meal, 75m), miradouro 16:30–17:30 (60m).
const day = makeTrip().days[0];
const castle = { lat: 38.7139, lng: -9.1335 };
const taberna = { lat: 38.7107, lng: -9.1432 };
const miradouro = { lat: 38.7118, lng: -9.1303 };
const belem = { lat: 38.6979, lng: -9.2068 };

describe("distanceKm", () => {
  it("measures great-circle distance", () => {
    expect(distanceKm(castle, castle)).toBe(0);
    expect(distanceKm(castle, belem)).toBeGreaterThan(6.4);
    expect(distanceKm(castle, belem)).toBeLessThan(6.8);
    expect(distanceKm(castle, belem)).toBeCloseTo(distanceKm(belem, castle), 10);
  });
});

describe("estimateWalkingKm", () => {
  it("sums the legs between located stops, with the detour factor", () => {
    const expected = (distanceKm(castle, taberna) + distanceKm(taberna, miradouro)) * WALKING_DETOUR_FACTOR;
    expect(estimateWalkingKm(day)).toBeCloseTo(expected, 10);
  });

  it("follows start times, not list order", () => {
    const shuffled = { ...day, items: [day.items[2], day.items[0], day.items[1]] };
    expect(estimateWalkingKm(shuffled)).toBeCloseTo(estimateWalkingKm(day)!, 10);
  });

  it("doesn't count a leg covered by a transit item", () => {
    const withTram = {
      ...day,
      items: [
        day.items[0],
        makeItem({ type: "transit", name: "Tram 28", start: "11:15", durationMinutes: 20, lat: undefined, lng: undefined }),
        day.items[1],
        day.items[2],
      ],
    };
    expect(estimateWalkingKm(withTram)).toBeCloseTo(distanceKm(taberna, miradouro) * WALKING_DETOUR_FACTOR, 10);
  });

  it("returns null — unknown, not zero — when fewer than two stops can be placed", () => {
    expect(estimateWalkingKm(makeTrip().days[1])).toBeNull();
    const unplaced = { ...day, items: day.items.map((i) => ({ ...i, lat: undefined, lng: undefined })) };
    expect(estimateWalkingKm(unplaced)).toBeNull();
  });
});

describe("checkConstraints", () => {
  it("finds nothing without constraints", () => {
    expect(checkConstraints(day)).toEqual([]);
    expect(checkConstraints(day, {})).toEqual([]);
    expect(checkTripConstraints(makeTrip(), undefined)).toEqual([]);
  });

  it("enforces the earliest start", () => {
    expect(checkConstraints(day, { earliestStart: "10:00" })).toEqual([
      {
        rule: "earliestStart",
        day: 1,
        message: 'Day 1: "Castelo de São Jorge" starts at 09:30, before the 10:00 earliest start',
      },
    ]);
    expect(checkConstraints(day, { earliestStart: "09:30" })).toEqual([]);
  });

  it("enforces the latest end", () => {
    const violations = checkConstraints(day, { latestEnd: "17:00" });
    expect(violations.map((v) => v.rule)).toEqual(["latestEnd"]);
    expect(violations[0].message).toContain('"Miradouro de Santa Luzia" ends at 17:30');
    expect(checkConstraints(day, { latestEnd: "17:30" })).toEqual([]);
  });

  it("limits stops per day, ignoring transit legs", () => {
    expect(checkConstraints(day, { maxStopsPerDay: 2 })[0].message).toBe("Day 1: 3 stops, over the limit of 2");
    const withTram = {
      ...day,
      items: [...day.items, makeItem({ type: "transit", name: "Taxi", start: "18:00", durationMinutes: 15 })],
    };
    expect(checkConstraints(withTram, { maxStopsPerDay: 3 })).toEqual([]);
  });

  it("limits the length of any single stop", () => {
    const violations = checkConstraints(day, { maxActivityMinutes: 60 });
    expect(violations.map((v) => v.message)).toEqual([
      'Day 1: "Castelo de São Jorge" lasts 90 min, over the 60 min limit',
      'Day 1: "Taberna da Rua das Flores" lasts 75 min, over the 60 min limit',
    ]);
  });

  it("rules out tagged categories, treating singular and plural alike", () => {
    const withMuseum = {
      ...day,
      items: [...day.items, makeItem({ name: "MAAT", start: "18:00", durationMinutes: 60, tags: ["Museum", "art"] })],
    };
    expect(checkConstraints(withMuseum, { avoidTags: ["museums"] })).toEqual([
      { rule: "avoidTags", day: 1, message: 'Day 1: "MAAT" is tagged "Museum", which you asked never to include' },
    ]);
    expect(checkConstraints(day, { avoidTags: ["museum"] })).toEqual([]);
  });

  it("caps estimated walking, and only when it can be estimated", () => {
    const walked = estimateWalkingKm(day)!;
    expect(checkConstraints(day, { maxWalkingKmPerDay: Math.floor(walked) })[0]).toMatchObject({
      rule: "maxWalkingKmPerDay",
      message: expect.stringContaining("(estimated)"),
    });
    expect(checkConstraints(day, { maxWalkingKmPerDay: Math.ceil(walked) })).toEqual([]);
    expect(checkConstraints(makeTrip().days[1], { maxWalkingKmPerDay: 0.5 })).toEqual([]);
  });

  it("checks every day of a trip", () => {
    const violations = checkTripConstraints(makeTrip(), { earliestStart: "10:30" });
    expect(violations.map((v) => v.day)).toEqual([1, 2]);
  });
});

describe("hard constraints gate AI output", () => {
  it("rejects a generated trip that breaks a rule", () => {
    expect(() => parseTripResponse(makeTrip(), { earliestStart: "10:00" })).toThrow(/earliest start/);
    expect(parseTripResponse(makeTrip(), { earliestStart: "09:00" })).toEqual(makeTrip());
  });

  it("rejects an assistant revision that breaks a rule", () => {
    expect(() =>
      parseDayRevision({ reply: RAIN_REPLY, day: makeRainyDay() }, 1, { maxActivityMinutes: 100 }),
    ).toThrow(/Museu Nacional do Azulejo" lasts 120 min/);
  });
});
