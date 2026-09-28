import { describe, expect, it } from "vitest";
import { estimateItemDifficultyEap, type ItemCalibrationResponse } from "../scoring/itemCalibration";
import { estimateAbilityEap } from "../scoring/abilityEstimate";

function responses(
  n: number,
  correct: boolean,
  theta = 0,
): ItemCalibrationResponse[] {
  return Array.from({ length: n }, () => ({ theta, correct }));
}

describe("estimateItemDifficultyEap", () => {
  it("returns the prior (difficulty=0, se=1) for zero responses", () => {
    const result = estimateItemDifficultyEap([]);
    expect(result.difficulty).toBe(0);
    expect(result.standardError).toBe(1);
  });

  it("does not blow up (unlike MLE) when everyone in the field-test sample got it right", () => {
    const result = estimateItemDifficultyEap(responses(8, true));
    expect(Number.isFinite(result.difficulty)).toBe(true);
    expect(Number.isFinite(result.standardError)).toBe(true);
    expect(result.difficulty).toBeLessThan(0);
  });

  it("does not blow up when everyone in the sample got it wrong", () => {
    const result = estimateItemDifficultyEap(responses(8, false));
    expect(Number.isFinite(result.difficulty)).toBe(true);
    expect(Number.isFinite(result.standardError)).toBe(true);
    expect(result.difficulty).toBeGreaterThan(0);
  });

  it("estimates a harder item (correctly answered only by high-ability respondents) as more difficult than an easier one", () => {
    const easyItem = estimateItemDifficultyEap([
      { theta: -1, correct: true },
      { theta: 0, correct: true },
      { theta: 1, correct: true },
    ]);
    const hardItem = estimateItemDifficultyEap([
      { theta: -1, correct: false },
      { theta: 0, correct: false },
      { theta: 1, correct: true },
    ]);
    expect(hardItem.difficulty).toBeGreaterThan(easyItem.difficulty);
  });

  it("standard error shrinks as more field-test responses accumulate", () => {
    const fewResponses = estimateItemDifficultyEap([
      { theta: -1, correct: false },
      { theta: 1, correct: true },
    ]);
    const manyResponses = estimateItemDifficultyEap([
      ...responses(10, false, -1),
      ...responses(10, true, 1),
    ]);
    expect(manyResponses.standardError).toBeLessThan(fewResponses.standardError);
  });

  it("recovers close to a known true difficulty from a well-mixed simulated sample", () => {
    const trueDifficulty = 1.0;
    const sample: ItemCalibrationResponse[] = [];
    for (let theta = -4; theta <= 4; theta += 0.25) {
      sample.push({ theta, correct: theta > trueDifficulty });
    }
    const result = estimateItemDifficultyEap(sample);
    expect(result.difficulty).toBeGreaterThan(0.5);
    expect(result.difficulty).toBeLessThan(1.5);
  });

  it("round-trips with estimateAbilityEap on the boundary case of no data", () => {
    const abilityPrior = estimateAbilityEap([]);
    const difficultyPrior = estimateItemDifficultyEap([]);
    expect(difficultyPrior.difficulty).toBe(abilityPrior.theta);
    expect(difficultyPrior.standardError).toBe(abilityPrior.standardError);
  });
});
