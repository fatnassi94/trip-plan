import { describe, expect, it } from "vitest";
import { rankCandidates, scoreCandidate, SCORING_WEIGHTS, type ScoreFactors } from "@/lib/ai/scoring";

const factors = (value: number): ScoreFactors => ({
  personalRelevance: value,
  distance: value,
  interestMatch: value,
  budgetFit: value,
  openingHours: value,
  popularity: value,
  novelty: value,
});

describe("scoring engine", () => {
  it("has weights that sum to 1", () => {
    const sum = Object.values(SCORING_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("scores the extremes as 0 and 1", () => {
    expect(scoreCandidate(factors(0))).toBe(0);
    expect(scoreCandidate(factors(1))).toBeCloseTo(1, 10);
  });

  it("weights personal relevance above popularity", () => {
    const relevant = { ...factors(0), personalRelevance: 1 };
    const popular = { ...factors(0), popularity: 1 };
    expect(scoreCandidate(relevant)).toBeGreaterThan(scoreCandidate(popular));
  });

  it.each([1.2, -0.1, Number.NaN])("throws on an un-normalized factor (%s)", (bad) => {
    expect(() => scoreCandidate({ ...factors(0.5), distance: bad })).toThrow(/distance/);
  });

  it("ranks candidates best-first", () => {
    const ranked = rankCandidates([0.2, 0.9, 0.5], (v) => factors(v));
    expect(ranked.map((r) => r.candidate)).toEqual([0.9, 0.5, 0.2]);
  });
});
