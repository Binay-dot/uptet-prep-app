import { describe, expect, it } from "vitest";
import { toScoredResponse, NEUTRAL_FALLBACK_DIFFICULTY } from "../scoring/toScoredResponse";
import { estimateAndPredictScore } from "../scoring/predictedScore";

describe("toScoredResponse", () => {
  it("uses the neutral fallback difficulty when the item has no calibrated difficulty", () => {
    const result = toScoredResponse(null, true);
    expect(result.difficulty).toBe(NEUTRAL_FALLBACK_DIFFICULTY);
    expect(result.correct).toBe(true);
  });

  it("preserves correctness=false with the fallback difficulty", () => {
    const result = toScoredResponse(null, false);
    expect(result.difficulty).toBe(NEUTRAL_FALLBACK_DIFFICULTY);
    expect(result.correct).toBe(false);
  });

  it("uses the item's real calibrated difficulty when one exists, ignoring the fallback", () => {
    const result = toScoredResponse(1.5, true);
    expect(result.difficulty).toBe(1.5);
  });

  it("honors a custom fallback difficulty when explicitly passed", () => {
    const result = toScoredResponse(null, true, 0.75);
    expect(result.difficulty).toBe(0.75);
  });

  it("treats a real difficulty of exactly 0 as calibrated, not missing", () => {
    // Regression guard: `0 ?? fallback` is fine (?? only triggers on
    // null/undefined), but this pins that behavior explicitly since an
    // item legitimately calibrated at difficulty 0 must not be confused
    // with an uncalibrated one.
    const result = toScoredResponse(0, true, 99);
    expect(result.difficulty).toBe(0);
  });

  /**
   * The actual regression this whole file exists to prevent: a quiz
   * where every item is uncalibrated (difficultyAtAttempt === null) must
   * still produce a predicted score that responds to how the user
   * actually did — not the same fixed number regardless of performance.
   * This is precisely the bug found 2026-09-28 (every attempt scored
   * 75/150), and it happened one layer up from here (in apps/web's
   * service.ts, which has no test suite), so it's pinned here instead,
   * against the pure function that both the fix and any future change
   * must go through.
   */
  it("REGRESSION GUARD: an all-uncalibrated quiz still predicts a meaningfully different score for a strong vs weak performance", () => {
    const strongResponses = Array.from({ length: 20 }, () => toScoredResponse(null, true));
    const weakResponses = Array.from({ length: 20 }, () => toScoredResponse(null, false));

    const strong = estimateAndPredictScore(strongResponses, 150);
    const weak = estimateAndPredictScore(weakResponses, 150);

    // Not just "not equal" — meaningfully different, so a silent
    // near-no-op fix can't sneak back in and still pass.
    expect(strong.predictedScore - weak.predictedScore).toBeGreaterThan(50);

    // And neither collapses to the old flat-prior bug value.
    expect(strong.predictedScore).not.toBeCloseTo(75, 0);
    expect(weak.predictedScore).not.toBeCloseTo(75, 0);
  });
});
