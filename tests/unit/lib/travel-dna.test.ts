import { describe, expect, it } from "vitest";
import {
  HardConstraintsSchema,
  StoredTravelDnaSchema,
  TravelerProfileSchema,
  describeConstraints,
  normalizeConstraints,
} from "@/lib/travel-dna";
import { makeTripRequest } from "@/tests/fixtures/trip";

const profile = makeTripRequest().profile;

describe("TravelerProfileSchema", () => {
  it("accepts a full Travel DNA", () => {
    const dna = {
      ...profile,
      localness: 4,
      discovery: 5,
      crowdTolerance: "low",
      constraints: { earliestStart: "09:00", maxWalkingKmPerDay: 6, avoidTags: ["museum"] },
    };
    expect(TravelerProfileSchema.parse(dna)).toEqual(dna);
  });

  it("keeps older profiles without the new fields valid", () => {
    expect(TravelerProfileSchema.parse(profile)).toEqual(profile);
  });

  it.each([
    ["localness above 5", { localness: 6 }],
    ["fractional discovery", { discovery: 2.5 }],
    ["unknown crowd tolerance", { crowdTolerance: "none" }],
  ])("rejects %s", (_label, extra) => {
    expect(TravelerProfileSchema.safeParse({ ...profile, ...extra }).success).toBe(false);
  });
});

describe("HardConstraintsSchema", () => {
  it("requires the earliest start to come before the latest end", () => {
    expect(HardConstraintsSchema.safeParse({ earliestStart: "10:00", latestEnd: "10:00" }).success).toBe(false);
    expect(HardConstraintsSchema.safeParse({ earliestStart: "09:00", latestEnd: "21:00" }).success).toBe(true);
  });

  it.each([
    ["a malformed time", { latestEnd: "9pm" }],
    ["a tiny walking limit", { maxWalkingKmPerDay: 0.1 }],
    ["zero stops", { maxStopsPerDay: 0 }],
    ["an eleven-item avoid list", { avoidTags: Array.from({ length: 11 }, (_, i) => `tag${i}`) }],
  ])("rejects %s", (_label, constraints) => {
    expect(HardConstraintsSchema.safeParse(constraints).success).toBe(false);
  });

  it("normalizes avoid tags to trimmed lowercase", () => {
    expect(HardConstraintsSchema.parse({ avoidTags: ["  Museum ", "NIGHTLIFE"] }).avoidTags).toEqual([
      "museum",
      "nightlife",
    ]);
  });
});

describe("stored Travel DNA", () => {
  it("is versioned", () => {
    const stored = { version: 1, profile, updatedAt: "2026-09-17T10:00:00.000Z" };
    expect(StoredTravelDnaSchema.parse(stored)).toEqual(stored);
    expect(StoredTravelDnaSchema.safeParse({ ...stored, version: 2 }).success).toBe(false);
  });
});

describe("normalizeConstraints", () => {
  it("drops unset limits and empty lists", () => {
    expect(
      normalizeConstraints({ earliestStart: undefined, latestEnd: "", maxStopsPerDay: 4, avoidTags: [] }),
    ).toEqual({ maxStopsPerDay: 4 });
    expect(normalizeConstraints()).toEqual({});
  });
});

describe("describeConstraints", () => {
  it("says each rule in plain language", () => {
    expect(
      describeConstraints({
        earliestStart: "09:00",
        latestEnd: "21:00",
        maxWalkingKmPerDay: 5,
        maxStopsPerDay: 1,
        maxActivityMinutes: 90,
        avoidTags: ["museum", "religious-site", "karaoke"],
      }),
    ).toEqual([
      "Nothing before 09:00",
      "Done by 21:00",
      "At most 5 km walking a day",
      "At most 1 stop a day",
      "No single stop over 1h 30m",
      "Never: museums, religious sites, karaoke",
    ]);
    expect(describeConstraints()).toEqual([]);
  });
});
