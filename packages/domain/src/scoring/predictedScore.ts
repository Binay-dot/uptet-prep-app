/**
 * Predicted score mapping.
 *
 * Given an ability estimate (theta) and a reference set of item
 * difficulties representing "a typical exam of this size", compute the
 * *expected* number of items a respondent at that ability would answer
 * correctly. Under the 1PL model this is just the sum, over the reference
 * items, of P(correct | theta, difficulty) — there is no separate
 * "predicted score" model; it falls straight out of IRT.
 *
 * IMPORTANT CAVEAT (real for v1, will get better over time):
 * the real item bank's difficulty distribution is not known precisely
 * until enough real PYQs have been loaded and field-tested/calibrated
 * (see docs/decisions/0003-content-and-scoring.md — difficulty parameters
 * are never hand-assigned). Until then, callers should pass a reasonable
 * DEFAULT_REFERENCE_DIFFICULTY_DISTRIBUTION (below) rather than blocking
 * the whole predicted-score feature on having a fully calibrated bank.
 * Once real calibrated item difficulties exist for a paper/section, the
 * caller should build and pass the *actual* distribution for that
 * paper/section instead of the default — this function itself does not
 * care where the distribution came from.
 */

import { estimateAbilityEap, type ScoredResponse } from "./abilityEstimate";

/**
 * A reasonable default reference distribution when no real calibrated item
 * bank exists yet: difficulties spread across a wide, roughly-normal range
 * matching a typical competitive-exam paper (some easy items, most items of
 * moderate difficulty, a few hard ones). This is a placeholder, not a
 * statistical claim about UPTET specifically.
 */
export const DEFAULT_REFERENCE_DIFFICULTY_DISTRIBUTION: number[] = [
  -2.0, -1.5, -1.5, -1.0, -1.0, -1.0, -0.5, -0.5, -0.5, -0.5, 0, 0, 0, 0, 0, 0,
  0.5, 0.5, 0.5, 0.5, 1.0, 1.0, 1.0, 1.5, 1.5, 2.0,
];

/**
 * Expected number of correct answers (out of the reference set's length)
 * for a respondent at the given ability.
 */
export function predictedRawScore(
  theta: number,
  referenceDifficulties: number[],
): number {
  if (referenceDifficulties.length === 0) return 0;
  let expectedCorrect = 0;
  for (const difficulty of referenceDifficulties) {
    expectedCorrect += 1 / (1 + Math.exp(-(theta - difficulty)));
  }
  return expectedCorrect;
}

/**
 * Convenience wrapper: expected score out of a given total, scaling the
 * reference distribution proportionally if it doesn't already match
 * `outOf` in length (e.g. a 26-item reference distribution scaled to
 * predict a score "out of 30").
 */
export function predictedScoreOutOf(
  theta: number,
  outOf: number,
  referenceDifficulties: number[] = DEFAULT_REFERENCE_DIFFICULTY_DISTRIBUTION,
): number {
  if (outOf <= 0 || referenceDifficulties.length === 0) return 0;
  const rawExpected = predictedRawScore(theta, referenceDifficulties);
  const scaled = (rawExpected / referenceDifficulties.length) * outOf;
  return Math.min(Math.max(scaled, 0), outOf);
}

/**
 * Convenience wrapper combining ability estimation and predicted score in
 * one call, for the common case of "given these responses, what's the
 * predicted score out of N".
 */
export function estimateAndPredictScore(
  responses: ScoredResponse[],
  outOf: number,
  referenceDifficulties: number[] = DEFAULT_REFERENCE_DIFFICULTY_DISTRIBUTION,
): { theta: number; standardError: number; predictedScore: number } {
  const { theta, standardError } = estimateAbilityEap(responses);
  const predictedScore = predictedScoreOutOf(theta, outOf, referenceDifficulties);
  return { theta, standardError, predictedScore };
}
