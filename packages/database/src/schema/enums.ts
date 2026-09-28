import { pgEnum } from "drizzle-orm/pg-core";

/**
 * These MUST stay in sync with packages/contracts/src/enums.ts. That
 * package is the source of truth for what values are valid at the API
 * boundary; these pgEnums are the source of truth for what the database
 * will accept. If you add a value to one, add it to the other in the same
 * change, and generate + review a migration for this file's enums.
 */

export const paperIdEnum = pgEnum("paper_id", ["paper_1", "paper_2"]);

export const sectionIdEnum = pgEnum("section_id", [
  "child_development_pedagogy",
  "language_1_hindi",
  "language_2_english",
  "mathematics",
  "evs",
  "social_studies",
]);

export const questionSourceEnum = pgEnum("question_source", [
  "pyq",
  "ai_drafted",
]);

export const questionStatusEnum = pgEnum("question_status", [
  "pyq_verified",
  "calibration",
  "live",
  "rejected",
]);

export const quizScopeEnum = pgEnum("quiz_scope", [
  "section_practice",
  "full_mock",
]);

export const friendRequestStatusEnum = pgEnum("friend_request_status", [
  "pending",
  "accepted",
  "declined",
]);

/**
 * `student` is the default for anyone who signs up through the ordinary
 * flow. `content_reviewer` is granted out-of-band (not self-service) to
 * the small set of named reviewers — see
 * docs/features/002-content-ingestion-and-review.md. `admin` is reserved
 * for operational tooling, not currently exposed in any UI.
 */
export const userRoleEnum = pgEnum("user_role", [
  "student",
  "content_reviewer",
  "admin",
]);

/**
 * Serialized lifecycle for the identity aggregate (see docs/security.md).
 * Signup transitions a record into `active`; account deletion transitions
 * it through `pending_deletion` to `deleted` rather than issuing a hard
 * DELETE, so a leased background job can safely finish tearing down
 * dependent data without racing a concurrent re-signup on the same
 * identity.
 */
export const userLifecycleStatusEnum = pgEnum("user_lifecycle_status", [
  "active",
  "pending_deletion",
  "deleted",
]);
