import { pgTable, uuid, real, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sectionIdEnum } from "./enums";
import { users } from "./users";

/**
 * The latest ability estimate per (user, section) — a cache, not the
 * source of truth. The source of truth is always the full response
 * history in quiz_attempt_questions, run back through
 * estimateAbilityEap() from @uptet/domain; this table exists so reads
 * (dashboard, friends leaderboard) don't have to recompute EAP over full
 * history on every page load. Recomputed and upserted here after every
 * completed quiz attempt.
 */
export const sectionAbilityEstimates = pgTable(
  "section_ability_estimates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sectionId: sectionIdEnum("section_id").notNull(),
    theta: real("theta").notNull(),
    standardError: real("standard_error").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userSectionUnique: uniqueIndex("section_ability_estimates_user_section_idx").on(
      table.userId,
      table.sectionId,
    ),
  }),
);
