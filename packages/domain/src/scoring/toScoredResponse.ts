import type { ScoredResponse } from "./abilityEstimate";

/**
 * The default difficulty assigned to an item that has no calibrated
 * difficulty yet. See
 * docs/decisions/0005-neutral-difficulty-fallback-for-scoring.md for the
 * full reasoning — in short: excluding uncalibrated items from scoring
 * entirely (rather than defaulting them) silently collapses every user's
 * predicted score to the same fixed number whenever the item bank is
 * mostly or entirely uncalibrated, which is the actual situation for a
 * new item bank. 0 is the neutral point on the theta/difficulty scale
 * (neither easy nor hard), so it doesn't bias the estimate in either
 * direction — it just contributes as "an average-difficulty item",
 * with the resulting uncertainty naturally reflected in a wider
 * standardError from estimateAbilityEap.
 */
export const NEUTRAL_FALLBACK_DIFFICULTY = 0;

/**
 * Turns one answered item into a ScoredResponse ready for
 * estimateAbilityEap / estimateAndPredictScore.
 *
 * This exists as its own small, pure, exported function — not inlined in
 * the API route handler — specifically because docs/features/001-quiz-
 * and-score-prediction.md requires the scoring calculation to be "a
 * pure, testable function (packages/domain) — not buried in a route
 * handler — since its correctness matters more than almost anything
 * else in this app". The bug this function fixes (2026-09-28: every
 * quiz's predicted score was a fixed 75/150 for every user, because the
 * "which responses count, and at what difficulty" decision lived
 * untested inside apps/web's service.ts) is exactly the kind of mistake
 * that mandate exists to prevent — the logic was buried, so nothing
 * caught it. Keep this here, keep it tested, and change it only via a
 * written ADR (see docs/decisions/0005 and AGENTS.md's boundaries list).
 */
export function toScoredResponse(
  difficultyAtAttempt: number | null,
  correct: boolean,
  fallbackDifficulty: number = NEUTRAL_FALLBACK_DIFFICULTY,
): ScoredResponse {
  return {
    difficulty: difficultyAtAttempt ?? fallbackDifficulty,
    correct,
  };
}
