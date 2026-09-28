/**
 * Item calibration: estimating an item's 1PL difficulty (b) parameter
 * from real field-test response data. This is the other half of the IRT
 * model in ./abilityEstimate.ts — same formula
 * (P(correct | theta, difficulty) = 1 / (1 + exp(-(theta - difficulty)))),
 * just solved for difficulty with theta held fixed, instead of solved for
 * theta with difficulty held fixed.
 *
 * WHY EAP HERE TOO (not MLE) — same reasoning as estimateAbilityEap:
 * a newly-drafted item in its early field-testing window very often gets
 * answered correctly by everyone who saw it (an easy item, or just a
 * small/lucky sample) or incorrectly by everyone (a hard item, or a
 * broken item). MLE has no finite solution in either case — the
 * likelihood is monotonic in b and its maximum runs off to +/-infinity.
 * That is exactly the situation this job runs in most often: v1's whole
 * item bank starts in `calibration` status (see
 * docs/decisions/0003-content-and-scoring.md), so this function has to
 * behave sensibly on small, possibly-lopsided samples, not just on a
 * large, well-mixed one. EAP over the same quadrature grid with the same
 * N(0, 1) prior gives a finite estimate and a standard error we can gate
 * promotion on (see docs/decisions/0006-item-calibration-job.md) instead
 * of confidently claiming an extreme difficulty from a handful of
 * responses.
 *
 * WHERE THE FIXED thetas COME FROM (the caller's job, not this file's):
 * this function takes each response's respondent ability (theta) as a
 * given, already-estimated number — it does not re-derive theta itself.
 * The calibration job (packages/database/src/calibrate-items.ts) computes
 * each one as a *leave-one-out* ability estimate: the respondent's
 * estimateAbilityEap() result from every other item they answered in the
 * same section of the same attempt, excluding the very response being
 * used to calibrate this item. This is standard field-testing practice
 * (an item under test shouldn't be allowed to influence the ability
 * estimate used to calibrate it) and it mirrors the same
 * toScoredResponse()-based scoring path production quiz submission
 * already uses, rather than introducing a second, parallel ability model.
 */

import { probabilityCorrect, standardNormalDensity, buildQuadratureGrid } from "./abilityEstimate";

/** One field-test response to the item being calibrated. */
export interface ItemCalibrationResponse {
  /** The respondent's ability (theta), held fixed — see file header. */
  theta: number;
  correct: boolean;
}

export interface ItemDifficultyEstimateResult {
  /** IRT 1PL difficulty (b) estimate, on the same theta scale as ability. */
  difficulty: number;
  /** Posterior standard deviation of the difficulty estimate. */
  standardError: number;
}

const DIFFICULTY_GRID = buildQuadratureGrid();

/**
 * Estimate an item's difficulty (b) and its standard error from a set of
 * field-test responses with known (fixed) respondent abilities, using EAP
 * over a fixed quadrature grid with a N(0, 1) prior.
 *
 * Returns difficulty = 0, standardError = 1 (the prior itself) when given
 * zero responses — there is nothing yet to update the prior with.
 */
export function estimateItemDifficultyEap(
  responses: ItemCalibrationResponse[],
): ItemDifficultyEstimateResult {
  if (responses.length === 0) {
    return { difficulty: 0, standardError: 1 };
  }

  let normalizingConstant = 0;
  const posteriorWeights: number[] = new Array(DIFFICULTY_GRID.length);

  for (let i = 0; i < DIFFICULTY_GRID.length; i++) {
    const difficulty = DIFFICULTY_GRID[i];
    let likelihood = 1;
    for (const response of responses) {
      const p = probabilityCorrect(response.theta, difficulty);
      likelihood *= response.correct ? p : 1 - p;
    }
    const weight = likelihood * standardNormalDensity(difficulty);
    posteriorWeights[i] = weight;
    normalizingConstant += weight;
  }

  if (normalizingConstant === 0 || !Number.isFinite(normalizingConstant)) {
    return { difficulty: 0, standardError: 1 };
  }

  let difficultyMean = 0;
  for (let i = 0; i < DIFFICULTY_GRID.length; i++) {
    difficultyMean += DIFFICULTY_GRID[i] * (posteriorWeights[i] / normalizingConstant);
  }

  let variance = 0;
  for (let i = 0; i < DIFFICULTY_GRID.length; i++) {
    const deviation = DIFFICULTY_GRID[i] - difficultyMean;
    variance += deviation * deviation * (posteriorWeights[i] / normalizingConstant);
  }

  return {
    difficulty: difficultyMean,
    standardError: Math.sqrt(Math.max(variance, 0)),
  };
}
