import { describe, expect, it } from "vitest";
import { sectionLabelFor } from "../scoring/sectionLabel";

describe("sectionLabelFor", () => {
  it("labels a clearly low ability as needs_work", () => {
    expect(sectionLabelFor(-1.5, 0.3)).toBe("needs_work");
  });

  it("labels a clearly high, well-estimated ability as strong", () => {
    expect(sectionLabelFor(1.2, 0.3)).toBe("strong");
  });

  it("labels an average ability as developing", () => {
    expect(sectionLabelFor(0, 0.3)).toBe("developing");
  });

  it("does not label a high ability as strong when the estimate is still too uncertain", () => {
    // A brand-new user could get lucky on 1-2 questions and show a high
    // theta, but with a huge standard error — we should not confidently
    // call that "strong" yet.
    expect(sectionLabelFor(1.2, 1.0)).toBe("developing");
  });

  it("still labels needs_work even with high uncertainty (no false comfort)", () => {
    expect(sectionLabelFor(-1.5, 1.0)).toBe("needs_work");
  });
});
