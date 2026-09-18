import { describe, expect, it } from "vitest";
import {
  dayEnergy,
  describeItemEffort,
  energyCapacity,
  energyLevel,
  itemEnergy,
  summarizePacing,
  tripEnergy,
} from "@/lib/energy";
import { makeItem, makeTrip, makeTripRequest } from "@/tests/fixtures/trip";

const profile = makeTripRequest().profile;

describe("itemEnergy", () => {
  it("grows with duration", () => {
    const short = itemEnergy(makeItem({ durationMinutes: 30, tags: [] }));
    const long = itemEnergy(makeItem({ durationMinutes: 180, tags: [] }));
    expect(long).toBeGreaterThan(short);
  });

  it("grows with the walk to reach it", () => {
    const item = makeItem({ tags: [] });
    expect(itemEnergy(item, 2)).toBeGreaterThan(itemEnergy(item, 0));
    expect(itemEnergy(item, 2) - itemEnergy(item, 0)).toBe(20);
  });

  it("costs less for a meal than for an activity of the same length", () => {
    const base = { durationMinutes: 90, tags: [] as string[] };
    expect(itemEnergy(makeItem({ ...base, type: "meal" }))).toBeLessThan(
      itemEnergy(makeItem({ ...base, type: "activity" })),
    );
  });

  it("weighs strenuous stops above restful ones", () => {
    const base = { durationMinutes: 120 };
    const hike = itemEnergy(makeItem({ ...base, tags: ["hiking"] }));
    const museum = itemEnergy(makeItem({ ...base, tags: ["museum"] }));
    const garden = itemEnergy(makeItem({ ...base, tags: ["garden"] }));
    expect(hike).toBeGreaterThan(museum);
    expect(museum).toBeGreaterThan(garden);
  });

  it("treats tags case- and plural-insensitively, and ignores unknown ones", () => {
    const known = itemEnergy(makeItem({ tags: ["Museums"] }));
    expect(known).toBe(itemEnergy(makeItem({ tags: ["museum"] })));
    expect(itemEnergy(makeItem({ tags: ["wibble"] }))).toBe(itemEnergy(makeItem({ tags: [] })));
  });

  it("never goes negative", () => {
    expect(itemEnergy(makeItem({ durationMinutes: 15, tags: ["spa", "relax", "cafe"] }))).toBeGreaterThanOrEqual(0);
  });
});

describe("energyCapacity", () => {
  it("rises with pace and walking tolerance", () => {
    const relaxed = energyCapacity({ ...profile, pace: "relaxed" });
    const packed = energyCapacity({ ...profile, pace: "packed" });
    expect(packed).toBeGreaterThan(relaxed);
    expect(energyCapacity({ ...profile, walkingTolerance: "high" })).toBeGreaterThan(
      energyCapacity({ ...profile, walkingTolerance: "low" }),
    );
  });

  it("falls back to balanced/medium for a trip with no profile", () => {
    expect(energyCapacity()).toBe(energyCapacity({ ...profile, pace: "balanced", walkingTolerance: "medium" }));
  });
});

describe("energyLevel", () => {
  it.each([
    [50, "light"],
    [60, "light"],
    [61, "steady"],
    [100, "steady"],
    [101, "heavy"],
  ])("scores %i of 100 as %s", (score, level) => {
    expect(energyLevel(score, 100)).toBe(level);
  });
});

describe("dayEnergy", () => {
  const day = makeTrip().days[0];

  it("adds up its stops, including the walking between them", () => {
    const energy = dayEnergy(day, profile);
    expect(energy.score).toBe(energy.items.reduce((sum, i) => sum + i.energy, 0));
    expect(energy.items.map((i) => i.item.name)).toEqual(day.items.map((i) => i.name));
    expect(energy.items[0].walkKm).toBe(0); // nothing walked to the first stop
    expect(energy.items[1].walkKm).toBeGreaterThan(0);
    expect(energy.walkingKm).toBeGreaterThan(0);
  });

  it("reads the same day as heavier for a relaxed traveler than a packed one", () => {
    const relaxed = dayEnergy(day, { ...profile, pace: "relaxed", walkingTolerance: "low" });
    const packed = dayEnergy(day, { ...profile, pace: "packed", walkingTolerance: "high" });
    expect(relaxed.percent).toBeGreaterThan(packed.percent);
    expect(relaxed.score).toBe(packed.score); // the day itself hasn't changed
  });

  it("gets lighter when stops are removed", () => {
    const lighter = dayEnergy({ ...day, items: [day.items[0]] }, profile);
    expect(lighter.score).toBeLessThan(dayEnergy(day, profile).score);
  });

  it("reports walking as unknown when too few stops have coordinates", () => {
    const unplaced = { ...day, items: day.items.map((i) => ({ ...i, lat: undefined, lng: undefined })) };
    const energy = dayEnergy(unplaced, profile);
    expect(energy.walkingKm).toBeNull();
    expect(energy.score).toBeGreaterThan(0);
  });
});

describe("calibration", () => {
  it("reads an ordinary day — a few stops, short walks — as light or steady, not heavy", () => {
    expect(dayEnergy(makeTrip().days[0], profile).level).not.toBe("heavy");
  });

  it("reads a day built around a long hike and a late night as heavy", () => {
    const big = {
      day: 1,
      title: "Sintra and out",
      items: [
        makeItem({ name: "Pena Park trail", start: "08:00", durationMinutes: 300, tags: ["hiking"] }),
        makeItem({ name: "Bairro Alto bars", start: "21:00", durationMinutes: 180, tags: ["nightlife"] }),
      ],
    };
    expect(dayEnergy(big, profile).level).toBe("heavy");
  });
});

describe("tripEnergy", () => {
  it("scores every day and finds no issue in a balanced trip", () => {
    const energy = tripEnergy(makeTrip());
    expect(energy.days.map((d) => d.day)).toEqual([1, 2]);
    expect(energy.issues).toEqual([]);
  });

  it("flags two heavy days back to back", () => {
    const heavy = (day: number) => ({
      day,
      title: `Day ${day}`,
      items: [
        makeItem({ name: `Hike ${day}`, start: "08:00", durationMinutes: 300, tags: ["hiking"] }),
        makeItem({ name: `Club ${day}`, start: "20:00", durationMinutes: 180, tags: ["nightlife"] }),
      ],
    });
    const energy = tripEnergy({ days: [heavy(1), heavy(2)], profile });
    expect(energy.days.every((d) => d.level === "heavy")).toBe(true);
    expect(energy.issues[0]).toBe("Days 1 and 2 are both heavy, back to back.");
  });

  it("uses the trip's own saved Travel DNA", () => {
    const trip = makeTrip();
    const relaxed = tripEnergy({ ...trip, profile: { ...profile, pace: "relaxed", walkingTolerance: "low" } });
    const packed = tripEnergy({ ...trip, profile: { ...profile, pace: "packed", walkingTolerance: "high" } });
    expect(relaxed.days[0].capacity).toBeLessThan(packed.days[0].capacity);
  });
});

describe("wording", () => {
  it("bands per-stop effort", () => {
    expect(describeItemEffort(10)).toBe("Easy");
    expect(describeItemEffort(30)).toBe("Moderate");
    expect(describeItemEffort(80)).toBe("Demanding");
  });

  it("calls an ordinary hour-and-a-half sight moderate, and a long hike demanding", () => {
    expect(describeItemEffort(itemEnergy(makeItem({ durationMinutes: 90, tags: ["landmark"] })))).toBe("Moderate");
    expect(describeItemEffort(itemEnergy(makeItem({ type: "meal", durationMinutes: 75, tags: ["food"] })))).toBe("Easy");
    expect(describeItemEffort(itemEnergy(makeItem({ durationMinutes: 300, tags: ["hiking"] })))).toBe("Demanding");
  });

  it("summarizes the shape of a trip", () => {
    expect(summarizePacing(tripEnergy(makeTrip()).days)).toMatch(/light|steady|heavy/);
  });
});
