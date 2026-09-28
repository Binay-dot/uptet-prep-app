import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Step 1 of account deletion (docs/security.md): a fresh, single-use,
 * short-lived authentication challenge. A normal access token issued five
 * minutes ago is NOT proof the human is present right now — deletion must
 * require this separate, freshly-issued, one-time token instead of just
 * checking "is this request authenticated".
 *
 * Flow: user re-authenticates (or otherwise proves recent presence) ->
 * server issues a row here with a short expiry -> the delete-account
 * endpoint requires this token's id AND checks it is unused and unexpired
 * AND immediately marks it used in the same transaction that flips the
 * user to `pending_deletion`.
 */
export const accountDeletionChallenges = pgTable(
  "account_deletion_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Short-lived — a few minutes, enforced in application code at issue time. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => ({
    userIdx: index("account_deletion_challenges_user_idx").on(table.userId),
  }),
);

/**
 * Step 3 of account deletion: the background teardown job, tracked with
 * an expiring lease and a fencing/generation token so a resumed stale
 * worker can never overwrite progress made by a newer worker that took
 * over after the lease expired ("leased work with fencing tokens").
 *
 * A worker may only write progress if the fencing token it holds still
 * matches `fencingToken` on this row at write time; if another worker has
 * since re-leased the job, `fencingToken` will have moved on and the
 * stale worker's write must be rejected (checked in application code via
 * a conditional UPDATE ... WHERE fencing_token = $held_token).
 */
export const accountDeletionJobs = pgTable(
  "account_deletion_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Incremented every time the job is (re-)leased; the current holder's proof of ownership. */
    fencingToken: integer("fencing_token").notNull().default(0),
    leaseHolder: text("lease_holder"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /**
     * True once teardown is fully done and the user row has been flipped
     * to `deleted`. This becomes the permanent tombstone marker — an old,
     * still-valid token presented after this point must be rejected
     * rather than allowed to recreate/reactivate the account.
     */
    tombstoned: boolean("tombstoned").notNull().default(false),
  },
  (table) => ({
    userIdx: index("account_deletion_jobs_user_idx").on(table.userId),
  }),
);
