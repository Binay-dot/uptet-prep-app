import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { userRoleEnum, userLifecycleStatusEnum, paperIdEnum } from "./enums";

/**
 * The identity aggregate. One row per person, ever — this is the stable
 * record that signup and account-deletion both lock and transition
 * through `lifecycleStatus` (see docs/security.md: "serialized lifecycle").
 * Never hard-delete this row directly from application code; deletion is
 * a transition to `pending_deletion`, followed by a background job that
 * tears down dependent data and only then flips it to `deleted`.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name"),
  /**
   * Which paper(s) this student is preparing for. Stored as jsonb rather
   * than a join table for v1 — it's a small, user-editable set (max 2
   * values from paperIdEnum), not something we query across at scale.
   * Validate its contents at the application boundary against
   * PaperId[] from @uptet/contracts; the column itself doesn't enforce
   * the enum (jsonb can't reference a pg enum type).
   */
  preparingFor: jsonb("preparing_for").$type<Array<(typeof paperIdEnum.enumValues)[number]>>().notNull().default([]),
  role: userRoleEnum("role").notNull().default("student"),
  lifecycleStatus: userLifecycleStatusEnum("lifecycle_status")
    .notNull()
    .default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Maps an external auth provider's subject identifier to our internal
 * user id. Kept as its own table (rather than a column on `users`) so
 * that adding a second identity provider later, or supporting one person
 * with more than one linked login, doesn't require reshaping `users`.
 *
 * v1 only ever has Auth0 as `provider`, and only one row per user, but the
 * schema doesn't assume that.
 */
export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("auth0"),
    /** The provider's stable subject identifier, e.g. Auth0's `sub` claim. */
    providerSubject: text("provider_subject").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    providerSubjectUnique: uniqueIndex("auth_identities_provider_subject_idx").on(
      table.provider,
      table.providerSubject,
    ),
  }),
);
