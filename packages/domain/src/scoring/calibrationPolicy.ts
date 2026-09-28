/**
 * The calibration -> live promotion policy: when is an item's difficulty
 * estimate trustworthy enough to count toward a user's visible ability
 * estimate?
 *
 * This lives here (packages/domain), not in apps/web's quiz service or in
 * the calibrate-items job script, so both sides of the gate — the job
 * that computes difficulty, and the request-handling code that decides
 * whether to promote — read the exact same numbers. Before this file
 * existed, RESPONSES_NEEDED_FOR_LIVE_STATUS lived as a local constant
 * inside apps/web/src/server/modules/quiz/service.ts; see
 * docs/decisions/0006-item-calibration-job.md for why it moved here and
 * gained a standard-error condition alongside the response-count one.
 */

/**
 * An item is only a *candidate* for calibration (i.e. the job will
 * attempt to compute a difficulty estimate for it at all) once it has
 * this many recorded responses. Below this, there just isn't enough
 * field-test data yet to be worth spending an EAP pass on — a tuning
 * decision, not a hard number to nail down up front (see
 * docs/features/002-content-ingestion-and-review.md, "start
 * conservative").
 */
export const MIN_RESPONSES_TO_ATTEMPT_CALIBRATION = 30;

/**
 * An item only promotes calibration -> live once ALL of:
 *   1. responseCount >= MIN_RESPONSES_TO_ATTEMPT_CALIBRATION
 *   2. difficulty is non-null (the calibration job has actually run and
 *      produced an estimate for it)
 *   3. difficultyStandardError <= MAX_STANDARD_ERROR_FOR_LIVE_PROMOTION
 *
 * Condition 3 is the important addition over the old response-count-only
 * rule: hitting the response-count threshold does not by itself mean the
 * *estimate* has settled down — a small, lopsided sample (e.g. mostly
 * high-ability respondents, or a coincidentally uniform run of
 * correct/incorrect answers) can still leave the EAP posterior wide. This
 * mirrors sectionLabelFor's MAX_STANDARD_ERROR_FOR_STRONG_LABEL: don't
 * treat an estimate as trustworthy just because it exists.
 */
export const MAX_STANDARD_ERROR_FOR_LIVE_PROMOTION = 0.6;
