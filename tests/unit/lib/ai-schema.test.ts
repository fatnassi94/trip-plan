import { describe, expect, it } from "vitest";
import { checkBusinessRules, parseTripResponse, TripSchema } from "@/lib/ai/schema";
import { makeItem, makeTrip } from "@/tests/fixtures/trip";

// The gate between "the model said something" and "we trust it". Every
// test feeds deliberately broken output and asserts it's rejected.

describe("parseTripResponse", () => {
  it("accepts a valid trip", () => {
    const trip = makeTrip();
    expect(parseTripResponse(trip)).toEqual(trip);
  });

  it("rejects non-object model output", () => {
    expect(() => parseTripResponse("Here is your trip to Lisbon!")).toThrow();
    expect(() => parseTripResponse(null)).toThrow();
  });

  it("rejects an item without a reason", () => {
    const trip = makeTrip();
    trip.days[0].items[0].reason = "";
    expect(() => parseTripResponse(trip)).toThrow();
  });

  it("rejects malformed start times", () => {
    for (const start of ["9:30", "24:00", "12:60", "noon"]) {
      const trip = makeTrip();
      trip.days[0].items[0].start = start;
      expect(() => parseTripResponse(trip), start).toThrow();
    }
  });

  it("rejects out-of-range coordinates", () => {
    const trip = makeTrip();
    trip.days[0].items[0].lat = 91;
    expect(() => parseTripResponse(trip)).toThrow();
  });

  it("rejects a day with no items and a trip with no days", () => {
    const emptyDay = makeTrip();
    emptyDay.days[1].items = [];
    expect(() => parseTripResponse(emptyDay)).toThrow();
    expect(() => parseTripResponse(makeTrip({ days: [] }))).toThrow();
  });

  it("rejects unknown item types", () => {
    const trip = makeTrip() as unknown as { days: { items: { type: string }[] }[] };
    trip.days[0].items[0].type = "shopping-spree";
    expect(() => parseTripResponse(trip)).toThrow();
  });

  it("throws a business-rule error naming the overlap", () => {
    const trip = makeTrip();
    trip.days[0].items[1].start = "10:00"; // castle runs 09:30–11:00
    expect(() => parseTripResponse(trip)).toThrow(/business rules.*overlaps/);
  });
});

describe("checkBusinessRules", () => {
  const validate = (trip: ReturnType<typeof makeTrip>) => checkBusinessRules(TripSchema.parse(trip));

  it("finds no problems in a valid trip", () => {
    expect(validate(makeTrip())).toEqual([]);
  });

  it("allows back-to-back items (end == next start)", () => {
    const trip = makeTrip();
    trip.days[0].items[1].start = "11:00";
    expect(validate(trip)).toEqual([]);
  });

  it("detects overlaps regardless of the order items are listed in", () => {
    const trip = makeTrip();
    trip.days[0].items = [
      makeItem({ name: "Late", start: "15:00", durationMinutes: 60 }),
      makeItem({ name: "Early", start: "14:30", durationMinutes: 60 }),
    ];
    expect(validate(trip)).toEqual(['Day 1: "Early" overlaps "Late"']);
  });

  it("flags a day planned past 14 hours", () => {
    const trip = makeTrip();
    trip.days[0].items = [
      makeItem({ name: "A", start: "06:00", durationMinutes: 300 }),
      makeItem({ name: "B", start: "11:00", durationMinutes: 300 }),
      makeItem({ name: "C", start: "16:00", durationMinutes: 300 }),
    ];
    expect(validate(trip)).toEqual(["Day 1: overloaded (15h planned)"]);
  });

  it("reports problems from every day, not just the first", () => {
    const trip = makeTrip();
    trip.days[0].items[1].start = "10:00";
    trip.days[1].items.push(makeItem({ name: "Clash", start: "10:30" }));
    expect(validate(trip)).toHaveLength(2);
  });
});
