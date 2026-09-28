import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import {
  paperIdEnum,
  sectionIdEnum,
  questionSourceEnum,
  questionStatusEnum,
} from "./enums";
import { users } from "./users";

/**
 * Question bank. `correctOptionIndex`, `difficulty` and `discrimination`
 * are server-only fields — the API layer must never serialize them into a
 * client-facing QuestionDto before an attempt is scored (see
 * packages/contracts/src/question.ts, which keeps QuestionDto and
 * QuestionRecord as two deliberately different shapes for this reason).
 *
 * `difficulty` / `discrimination` are nullable and start out null. They
 * are populated only by the calibration job, never hand-entered — see
 * docs/decisions/0003-content-and-scoring.md. A `status = 'calibration'`
 * question can be null on both; a `status = 'live'` question should not
 * be (enforced in application code, not a DB constraint, since the
 * transition itself is a business rule with a "how much data is enough"
 * judgment call — see docs/features/002-content-ingestion-and-review.md).
 */
export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paperId: paperIdEnum("paper_id").notNull(),
    sectionId: sectionIdEnum("section_id").notNull(),
    prompt: text("prompt").notNull(),
    /** Exactly 4 options, validated at the application boundary (Zod), not here. */
    options: jsonb("options").$type<string[]>().notNull(),
    correctOptionIndex: integer("correct_option_index").notNull(),

    source: questionSourceEnum("source").notNull(),
    status: questionStatusEnum("status").notNull().default("calibration"),

    /** Which official past paper this came from, e.g. "UPTET 2023". Required for source = 'pyq'. */
    sourceYear: integer("source_year"),
    /** Free-text provenance note: syllabus topic drafted from, or PYQ paper details. */
    sourceNote: text("source_note"),

    /** Who approved an ai_drafted item (and when) — null for pyq_verified items, which don't go through the review queue. */
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    /** Kept (not deleted) on rejection, so rejection patterns can inform future drafting prompts. */
    rejectionReason: text("rejection_reason"),

    /** IRT 1PL difficulty (b) parameter. Null until calibrated. */
    difficulty: real("difficulty"),
    /** Optional discrimination parameter, for a future move to 2PL. Null in v1's 1PL model. */
    discrimination: real("discrimination"),
    /** How many live responses this item has accumulated — drives the calibration -> live transition. */
    responseCount: integer("response_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Every quiz-serving query filters by paper + section + status
    // ("give me N live questions for this section"), so that's the index
    // that matters, not a generic id lookup.
    paperSectionStatusIdx: index("questions_paper_section_status_idx").on(
      table.paperId,
      table.sectionId,
      table.status,
    ),
  }),
);
