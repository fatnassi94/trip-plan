import { describe, expect, it } from "vitest";
import {
  BUDGET_TIERS,
  PACES,
  QUESTIONS,
  TRAVELER_TYPES,
  WALKING,
  answerSummary,
  describeTravelDna,
  unansweredRequired,
} from "@/lib/dna-questions";
import type { TravelerProfile } from "@/types/trip";

// The interview is data, so what gets asked — and in what order — is
// testable without rendering a thing.

const profile = (over: Partial<TravelerProfile> = {}): TravelerProfile => ({
  travelerTypes: ["Foodie"],
  budgetTier: "comfort",
  pace: "balanced",
  walkingTolerance: "medium",
  foodPreferences: [],
  dislikes: [],
  localness: 3,
  discovery: 3,
  crowdTolerance: "medium",
  constraints: {},
  ...over,
});

describe("the Travel DNA script", () => {
  it("opens with traveler types, because everything else builds on them", () => {
    expect(QUESTIONS[0].id).toBe("personas");
    expect(QUESTIONS[0].kind).toBe("multi");
  });

  it("asks every question exactly once", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the heavy, optional questions last so a trip can be built quickly", () => {
    const optional = QUESTIONS.filter((q) => q.optional).map((q) => q.id);
    expect(optional).toEqual(["food", "dislikes", "rules"]);
    const firstOptional = QUESTIONS.findIndex((q) => q.optional);
    expect(QUESTIONS.slice(firstOptional).every((q) => q.optional)).toBe(true);
  });

  it("only ever blocks on traveler types", () => {
    expect(unansweredRequired(profile({ travelerTypes: [] }))).toEqual(["personas"]);
    expect(unansweredRequired(profile())).toEqual([]);
  });

  it("uses the same option values the API and the AI prompt expect", () => {
    // These strings reach types/trip.ts and lib/ai/prompts.ts — a reworded
    // label is fine, a rewritten value is a silent breakage.
    expect(BUDGET_TIERS.map((c) => c.value)).toEqual(["budget", "comfort", "premium"]);
    expect(PACES.map((c) => c.value)).toEqual(["relaxed", "balanced", "packed"]);
    expect(WALKING.map((c) => c.value)).toEqual(["low", "medium", "high"]);
    expect(TRAVELER_TYPES.map((c) => c.value)).toContain("Culture lover");
  });
});

describe("answerSummary", () => {
  const find = (id: string) => QUESTIONS.find((q) => q.id === id)!;

  it("echoes the traveler's own words back", () => {
    const p = profile({ travelerTypes: ["Foodie", "Nature"], budgetTier: "premium" });
    expect(answerSummary(find("personas"), p)).toBe("Foodie, Nature");
    expect(answerSummary(find("budget"), p)).toBe("Premium");
  });

  it("reads the 1-5 scales back as their label, not a number", () => {
    expect(answerSummary(find("localness"), profile({ localness: 5 }))).toBe("Like a local");
    expect(answerSummary(find("discovery"), profile({ discovery: 1 }))).toBe("Famous icons");
  });

  it("says something friendly when an optional question was skipped", () => {
    expect(answerSummary(find("food"), profile())).toBe("Anything good");
    expect(answerSummary(find("dislikes"), profile())).toBe("Nothing in particular");
    expect(answerSummary(find("rules"), profile())).toBe("Use your judgement");
  });

  it("counts the hard rules that were actually set", () => {
    const p = profile({ constraints: { earliestStart: "10:00", avoidTags: ["museum"] } });
    expect(answerSummary(find("rules"), p)).toBe("2 rules set");
    const one = profile({ constraints: { earliestStart: "10:00", avoidTags: [] } });
    expect(answerSummary(find("rules"), one)).toBe("1 rule set");
  });
});

describe("describeTravelDna", () => {
  it("names an archetype from the pace and the first traveler type", () => {
    expect(describeTravelDna(profile({ pace: "packed" })).title).toBe("The Energetic Epicurean");
    expect(describeTravelDna(profile({ pace: "relaxed", travelerTypes: ["Nature"] })).title).toBe(
      "The Unhurried Naturalist",
    );
  });

  it("waits for an answer before claiming to know anything", () => {
    const empty = describeTravelDna(profile({ travelerTypes: [] }));
    expect(empty.title).toBe("Your travel DNA");
    expect(empty.summary).toMatch(/Pick at least one traveler type/);
  });

  it("summarises the answers in plain language", () => {
    const p = profile({ travelerTypes: ["Foodie"], foodPreferences: ["street food"], localness: 5 });
    expect(describeTravelDna(p).summary).toContain("street food");
    expect(describeTravelDna(p).summary).toContain("like a local");
  });
});
