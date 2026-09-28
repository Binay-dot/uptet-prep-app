import type { PaperId, SectionId } from "@uptet/contracts";

/**
 * Which sections belong to which paper — mirrors the comments in
 * @uptet/contracts/src/enums.ts ("mathematics" / "evs" are Paper 1 only,
 * "social_studies" is Paper 2 only). Kept here rather than in contracts
 * because it's server-side quiz-composition logic, not a client-facing
 * shape.
 */
export const SECTIONS_BY_PAPER: Record<PaperId, SectionId[]> = {
  paper_1: [
    "child_development_pedagogy",
    "language_1_hindi",
    "language_2_english",
    "mathematics",
    "evs",
  ],
  paper_2: [
    "child_development_pedagogy",
    "language_1_hindi",
    "language_2_english",
    "social_studies",
  ],
};
