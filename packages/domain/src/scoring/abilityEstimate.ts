/**
 * Item Response Theory (IRT) ability estimation.
 *
 * Model: 1-parameter logistic / Rasch model.
 *   P(correct | theta, difficulty) = 1 / (1 + exp(-(theta - difficulty)))
 *
 * Estimation method: Expected A Posteriori (EAP), not Maximum Likelihood
 * Estimation (MLE).
 *
 * WHY EAP AND NOT MLE (read this before "simplifying" to MLE):
 * MLE has no finite solution when a respondent answers every item correctly
 * or every item incorrectly — the likelihood function is monotonic and its
 * maximum runs off to +/-infinity. That is not an edge case here: it is the
 * *common* case for a brand-new user's very first short quiz (e.g. 5-10
 * questions). EAP instead integrates the likelihood against a prior belief
 * about ability (we use a standard normal prior, N(0, 1), which is the
 * conventional default when no population calibration data exists yet) over
 * a fixed grid of theta values ("quadrature points"). This always converges
 * to a finite estimate, and it naturally produces a posterior standard
 * deviation we can report as the standard error of the estimate — which is
 * exactly what lets the UI show "still calibrating" for a new user instead
 * of a falsely precise number (see SectionBreakdownDto.standardError in
 * packages/contracts).
 *
 * The exact same degeneracy (and the same EAP fix) applies on the *item*
 * side during field-testing — see ./itemCalibration.ts, which reuses the
 * quadrature-grid / normal-density / probabilityCorrect machinery below
 * rather than re-implementing it, so the 1PL formula has one source of
 * truth for both directions of the model.
 *
 * See docs/features/001-quiz-and-score-prediction.md and
 * docs/decisions/0003-content-and-scoring.md for the product-level
 * rationale (including: difficulty parameters are never hand-assigned —
 * they come only from field-testing/calibration against real respondents).
 */

/** One answered item: its calibrated difficulty and whether it was answered correctly. */
export interface ScoredResponse {
  /** IRT difficulty (b) parameter for this item, on the same theta scale. */
  difficulty: number;
  correct: boolean;
}

export interface AbilityEstimateResult {
  /** Ability estimate (theta), typically in roughly [-4, 4]. */
  theta: number;
  /** Posterior standard deviation of theta — the standard error of the estimate. */
  standardError: number;
}

/** Quadrature grid: fixed points across a wide, dense range of plausible theta/difficulty. */
export const QUADRATURE_MIN = -6;
export const QUADRATURE_MAX = 6;
export const QUADRATURE_STEPS = 121; // step size = 0.1

/**
 * Builds a fixed grid of points over [min, max]. Shared by ability
 * estimation (grid over theta) and item calibration (grid over
 * difficulty) — same numerical approach, same source of truth, just a
 * different free variable held fixed on the other side of the equation.
 */
export function buildQuadratureGrid(
  min: number = QUADRATURE_MIN,
  max: number = QUADRATURE_MAX,
  steps: number = QUADRATURE_STEPS,
): number[] {
  const points: number[] = [];
  const step = (max - min) / (steps - 1);
  for (let i = 0; i < steps; i++) {
    points.push(min + i * step);
  }
  return points;
}

const QUADRATURE_GRID = buildQuadratureGrid();

/** Standard normal density, used as the prior over theta (or, in item calibration, over difficulty). */
export function standardNormalDensity(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/** 1PL probability of a correct response at a given theta/difficulty pair. */
export function probabilityCorrect(theta: number, difficulty: number): number {
  return 1 / (1 + Math.exp(-(theta - difficulty)));
}

/**
 * Estimate ability (theta) and its standard error from a set of scored
 * responses, using EAP over a fixed quadrature grid with a N(0, 1) prior.
 *
 * Returns theta = 0, standardError = 1 (the prior itself) when given zero
 * responses — there is nothing yet to update the prior with.
 */
export function estimateAbilityEap(
  responses: ScoredResponse[],
): AbilityEstimateResult {
  if (responses.length === 0) {
    return { theta: 0, standardError: 1 };
  }

  let normalizingConstant = 0;
  const posteriorWeights: number[] = new Array(QUADRATURE_GRID.length);

  for (let i = 0; i < QUADRATURE_GRID.length; i++) {
    const theta = QUADRATURE_GRID[i];
    let likelihood = 1;
    for (const response of responses) {
      const p = probabilityCorrect(theta, response.difficulty);
      likelihood *= response.correct ? p : 1 - p;
    }
    const weight = likelihood * standardNormalDensity(theta);
    posteriorWeights[i] = weight;
    normalizingConstant += weight;
  }

  // Degenerate case: likelihood underflowed to zero everywhere (extremely
  // long response strings can do this in floating point). Fall back to the
  // prior rather than dividing by zero.
  if (normalizingConstant === 0 || !Number.isFinite(normalizingConstant)) {
    return { theta: 0, standardError: 1 };
  }

  let thetaMean = 0;
  for (let i = 0; i < QUADRATURE_GRID.length; i++) {
    thetaMean += QUADRATURE_GRID[i] * (posteriorWeights[i] / normalizingConstant);
  }

  let variance = 0;
  for (let i = 0; i < QUADRATURE_GRID.length; i++) {
    const deviation = QUADRATURE_GRID[i] - thetaMean;
    variance += deviation * deviation * (posteriorWeights[i] / normalizingConstant);
  }

  return {
    theta: thetaMean,
    standardError: Math.sqrt(Math.max(variance, 0)),
  };
}
