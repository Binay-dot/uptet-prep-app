import { z } from "zod";

/**
 * The two UPTET papers. v1 supports both, per docs/product.md.
 */
export const PaperId = z.enum(["paper_1", "paper_2"]);
export type PaperId = z.infer<typeof PaperId>;

/**
 * Sections within each paper. Paper 1 and Paper 2 share
 * child_development_pedagogy and the language sections; each paper also has
 * its own subject-specific section(s).
 *
 * v1 language track: English only (Sanskrit/Urdu deferred — see
 * docs/product.md "explicitly out of scope for v1").
 * v1 Paper 2 specialization track: Social Studies only (Math & Science
 * track deferred).
 */
export const SectionId = z.enum([
  "child_development_pedagogy",
  "language_1_hindi",
  "language_2_english",
  "mathematics", // Paper 1 only
  "evs", // Paper 1 only (Environmental Studies)
  "social_studies", // Paper 2 only, v1 specialization track
]);
export type SectionId = z.infer<typeof SectionId>;

/**
 * Where a question came from. This drives the trust/calibration rules in
 * docs/decisions/0003-content-and-scoring.md — never assign these by hand,
 * they reflect a real provenance decision made at ingestion time.
 */
export const QuestionSource = z.enum(["pyq", "ai_drafted"]);
export type QuestionSource = z.infer<typeof QuestionSource>;

/**
 * A question's lifecycle status.
 * - pyq_verified: sourced from an official past paper + official answer
 *   key. Counts fully toward ability estimates immediately.
 * - calibration: reviewer-approved AI-drafted item, but not yet enough
 *   response data to trust its difficulty. Appears in quizzes but must
 *   NOT affect the visible ability estimate (see feature 001 + 002).
 * - live: enough response data collected; counts fully.
 * - rejected: reviewer rejected it. Kept for record, never served.
 */
export const QuestionStatus = z.enum([
  "pyq_verified",
  "calibration",
  "live",
  "rejected",
]);
export type QuestionStatus = z.infer<typeof QuestionStatus>;

export const QuizScope = z.enum(["section_practice", "full_mock"]);
export type QuizScope = z.infer<typeof QuizScope>;

export const FriendRequestStatus = z.enum([
  "pending",
  "accepted",
  "declined",
]);
export type FriendRequestStatus = z.infer<typeof FriendRequestStatus>;
