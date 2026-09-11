// The scoring engine — the part of RoamAI that isn't the LLM. Weights from
// the project plan §37. Kept as plain, testable functions so "why did this
// place score higher" is always answerable without re-prompting a model.

export const SCORING_WEIGHTS = {
  personalRelevance: 0.3,
  distance: 0.2,
  interestMatch: 0.2,
  budgetFit: 0.1,
  openingHours: 0.1,
  popularity: 0.05,
  novelty: 0.05,
} as const;

export type ScoreFactors = Record<keyof typeof SCORING_WEIGHTS, number>;

/** Every factor must already be normalized to 0–1 before scoring. */
export function scoreCandidate(factors: ScoreFactors): number {
  let total = 0;
  for (const key of Object.keys(SCORING_WEIGHTS) as (keyof typeof SCORING_WEIGHTS)[]) {
    const value = factors[key];
    if (value < 0 || value > 1 || Number.isNaN(value)) {
      throw new Error(`scoreCandidate: "${key}" must be normalized to 0–1, got ${value}`);
    }
    total += value * SCORING_WEIGHTS[key];
  }
  return total;
}

export function rankCandidates<T>(
  candidates: T[],
  toFactors: (candidate: T) => ScoreFactors,
): { candidate: T; score: number }[] {
  return candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(toFactors(candidate)) }))
    .sort((a, b) => b.score - a.score);
}
