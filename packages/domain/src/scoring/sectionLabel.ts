/**
 * Maps an ability estimate + its standard error to the coarse
 * "strong" | "developing" | "needs_work" label shown to users
 * (SectionBreakdownDto.label in packages/contracts).
 *
 * Thresholds are on the theta scale (same scale as item difficulty,
 * roughly -4 to +4, centered on 0 = "average"). These are deliberately
 * simple, wide bands for v1 — the goal is a directionally-honest signal
 * ("you're doing fine here" vs "focus here next"), not a precise cutoff.
 * Revisit once we have real usage data on how these labels feel in
 * practice (candidate for docs/feedback/lessons.md if we end up wanting
 * this configurable per exam rather than hardcoded).
 *
 * A high standard error (very few responses so far, i.e. still close to
 * the prior) means the estimate is unreliable regardless of where it
 * falls, so we never confidently label a user "strong" until the estimate
 * has settled down at least somewhat.
 */

export type SectionLabel = "strong" | "developing" | "needs_work";

const STRONG_THETA_THRESHOLD = 0.5;
const NEEDS_WORK_THETA_THRESHOLD = -0.5;

/**
 * Above this standard error, we consider the estimate too uncertain to
 * call "strong" — falls back to "developing" instead, which reads as
 * encouraging-but-provisional rather than a premature confident verdict.
 */
const MAX_STANDARD_ERROR_FOR_STRONG_LABEL = 0.6;

export function sectionLabelFor(
  theta: number,
  standardError: number,
): SectionLabel {
  if (theta <= NEEDS_WORK_THETA_THRESHOLD) {
    return "needs_work";
  }
  if (theta >= STRONG_THETA_THRESHOLD && standardError <= MAX_STANDARD_ERROR_FOR_STRONG_LABEL) {
    return "strong";
  }
  return "developing";
}
