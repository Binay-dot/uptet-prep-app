import { describe, expect, it } from "vitest";
import { estimateAbilityEap, type ScoredResponse } from "../scoring/abilityEstimate";

function allCorrect(n: number, difficulty = 0): ScoredResponse[] {
  return Array.from({ length: n }, () => ({ difficulty, correct: true }));
}

function allIncorrect(n: number, difficulty = 0): ScoredResponse[] {
  return Array.from({ length: n }, () => ({ difficulty, correct: false }));
}

describe("estimateAbilityEap", () => {
  it("returns the prior (theta=0, se=1) for zero responses", () => {
    const result = estimateAbilityEap([]);
    expect(result.theta).toBe(0);
    expect(result.standardError).toBe(1);
  });

  it("does not blow up (unlike MLE) on an all-correct response pattern", () => {
    // This is the exact case MLE cannot handle — the reason EAP was chosen.
    // A brand-new user's first quiz, answered perfectly, must still return
    // a finite, sensible theta rather than +Infinity or NaN.
    const result = estimateAbilityEap(allCorrect(8));
    expect(Number.isFinite(result.theta)).toBe(true);
    expect(Number.isFinite(result.standardError)).toBe(true);
    expect(result.theta).toBeGreaterThan(0);
  });

  it("does not blow up on an all-incorrect response pattern", () => {
    const result = estimateAbilityEap(allIncorrect(8));
    expect(Number.isFinite(result.theta)).toBe(true);
    expect(Number.isFinite(result.standardError)).toBe(true);
    expect(result.theta).toBeLessThan(0);
  });

  it("is monotonic: more correct answers (at fixed difficulty) never decreases theta", () => {
    const thetas: number[] = [];
    for (let correctCount = 0; correctCount <= 10; correctCount++) {
      const responses: ScoredResponse[] = [
        ...allCorrect(correctCount),
        ...allIncorrect(10 - correctCount),
      ];
      thetas.push(estimateAbilityEap(responses).theta);
    }
    for (let i = 1; i < thetas.length; i++) {
      expect(thetas[i]).toBeGreaterThanOrEqual(thetas[i - 1]);
    }
  });

  it("estimates a harder-difficulty correct answer as reflecting higher ability than an easier one", () => {
    const easyCorrect = estimateAbilityEap([{ difficulty: -2, correct: true }]);
    const hardCorrect = estimateAbilityEap([{ difficulty: 2, correct: true }]);
    expect(hardCorrect.theta).toBeGreaterThan(easyCorrect.theta);
  });

  it("standard error shrinks as more responses accumulate", () => {
    const fewResponses = estimateAbilityEap(allCorrect(2).concat(allIncorrect(2)));
    const manyResponses = estimateAbilityEap(allCorrect(20).concat(allIncorrect(20)));
    expect(manyResponses.standardError).toBeLessThan(fewResponses.standardError);
  });

  it("stays within a plausible theta range for realistic inputs", () => {
    const result = estimateAbilityEap(allCorrect(15));
    expect(result.theta).toBeGreaterThan(-6);
    expect(result.theta).toBeLessThan(6);
  });
});
