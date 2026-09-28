import { describe, expect, it } from "vitest";
import {
  DEFAULT_REFERENCE_DIFFICULTY_DISTRIBUTION,
  estimateAndPredictScore,
  predictedScoreOutOf,
} from "../scoring/predictedScore";
import type { ScoredResponse } from "../scoring/abilityEstimate";

describe("predictedScoreOutOf", () => {
  it("returns 0 for theta at negative infinity-ish (extremely low ability)", () => {
    const score = predictedScoreOutOf(-10, 30);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThan(1);
  });

  it("approaches the max for a very high ability", () => {
    const score = predictedScoreOutOf(10, 30);
    expect(score).toBeGreaterThan(29);
    expect(score).toBeLessThanOrEqual(30);
  });

  it("returns roughly half of outOf for an average-ability respondent against the default distribution", () => {
    // The default reference distribution is centered on 0, so a theta of 0
    // (average ability) should land roughly in the middle of the range —
    // not an exact match (per the acceptance criteria), just a sane bound.
    const score = predictedScoreOutOf(0, 30);
    expect(score).toBeGreaterThan(10);
    expect(score).toBeLessThan(20);
  });

  it("is monotonically increasing in theta", () => {
    const thetas = [-2, -1, 0, 1, 2];
    const scores = thetas.map((theta) => predictedScoreOutOf(theta, 30));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });

  it("never exceeds outOf and never goes below 0, regardless of theta", () => {
    for (const theta of [-100, -5, 0, 5, 100]) {
      const score = predictedScoreOutOf(theta, 30);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(30);
    }
  });

  it("uses the default distribution when none is passed explicitly", () => {
    const withDefault = predictedScoreOutOf(0.3, 30);
    const explicit = predictedScoreOutOf(
      0.3,
      30,
      DEFAULT_REFERENCE_DIFFICULTY_DISTRIBUTION,
    );
    expect(withDefault).toBe(explicit);
  });
});

describe("estimateAndPredictScore", () => {
  it("produces a sensible end-to-end result for a plausible response sequence", () => {
    // A user who gets most of a section right should predict well above
    // half marks; this is a regression test against sane output ranges,
    // not an exact-match test on a moving statistical model (per
    // docs/features/001-quiz-and-score-prediction.md acceptance criteria).
    const responses: ScoredResponse[] = [
      { difficulty: -1, correct: true },
      { difficulty: -0.5, correct: true },
      { difficulty: 0, correct: true },
      { difficulty: 0.5, correct: true },
      { difficulty: 1, correct: false },
      { difficulty: 1.5, correct: false },
    ];
    const result = estimateAndPredictScore(responses, 30);
    expect(result.predictedScore).toBeGreaterThan(15);
    expect(result.predictedScore).toBeLessThanOrEqual(30);
    expect(result.standardError).toBeGreaterThan(0);
  });

  it("predicts a higher score for a stronger response pattern than a weaker one", () => {
    const strong: ScoredResponse[] = Array.from({ length: 8 }, () => ({
      difficulty: 0.5,
      correct: true,
    }));
    const weak: ScoredResponse[] = Array.from({ length: 8 }, () => ({
      difficulty: 0.5,
      correct: false,
    }));
    const strongResult = estimateAndPredictScore(strong, 30);
    const weakResult = estimateAndPredictScore(weak, 30);
    expect(strongResult.predictedScore).toBeGreaterThan(weakResult.predictedScore);
  });
});
