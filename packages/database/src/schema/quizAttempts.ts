import {
  pgTable,
  uuid,
  integer,
  real,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { paperIdEnum, sectionIdEnum, quizScopeEnum } from "./enums";
import { users } from "./users";
import { questions } from "./questions";

/**
 * One quiz attempt (a "session_practice" set or a "full_mock"). The set
 * of questions is fixed at start time (see quizAttemptQuestions below) so
 * that resuming or re-rendering an in-progress attempt always shows the
 * same questions in the same order — we don't want to be re-querying
 * "give me N live questions" mid-attempt and getting a different set.
 *
 * Every query against this table in application code MUST filter by
 * `userId = <the authenticated caller>` — this is the "ownership checks
 * live in application SQL" pattern from docs/security.md (no RLS by
 * default in v1).
 */
export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    paperId: paperIdEnum("paper_id").notNull(),
    scope: quizScopeEnum("scope").notNull(),
    /** Required when scope = 'section_practice', null for 'full_mock' — mirrors StartQuizInput's refinement in @uptet/contracts. */
    sectionId: sectionIdEnum("section_id"),

    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** Denormalized once the attempt is scored, so QuizResultDto reads don't have to re-aggregate every time. */
    rawScore: integer("raw_score"),
    rawTotal: integer("raw_total"),
    predictedScoreOutOf150: real("predicted_score_out_of_150"),
  },
  (table) => ({
    // "show me this user's attempts, most recent first" is the main
    // access pattern (history, resuming an in-progress attempt).
    userStartedAtIdx: index("quiz_attempts_user_started_at_idx").on(
      table.userId,
      table.startedAt,
    ),
  }),
);

/**
 * The fixed set of questions belonging to one attempt, in presentation
 * order, plus the user's answer once submitted. This is intentionally a
 * separate table from `questions` (not a jsonb array column on
 * quiz_attempts) so a single response can be updated/queried directly and
 * so `questions.responseCount` can be incremented from a plain join.
 */
export const quizAttemptQuestions = pgTable(
  "quiz_attempt_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => quizAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    /** 0-based position within the attempt. */
    orderIndex: integer("order_index").notNull(),

    selectedOptionIndex: integer("selected_option_index"),
    isCorrect: boolean("is_correct"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),

    /**
     * Snapshot of the question's difficulty *at the time it was served*,
     * copied from questions.difficulty. Scoring an attempt must use this
     * value, not a live re-read of questions.difficulty — an item's
     * difficulty can be recalibrated later as more response data comes
     * in, and a past attempt's score should stay stable rather than
     * silently drifting when that happens.
     */
    difficultyAtAttempt: real("difficulty_at_attempt"),
  },
  (table) => ({
    attemptOrderUnique: uniqueIndex("quiz_attempt_questions_attempt_order_idx").on(
      table.attemptId,
      table.orderIndex,
    ),
    // Used by the calibration job: "every response ever recorded for this question".
    questionIdx: index("quiz_attempt_questions_question_idx").on(table.questionId),
  }),
);
