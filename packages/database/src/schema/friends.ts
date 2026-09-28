import {
  pgTable,
  uuid,
  timestamp,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { friendRequestStatusEnum, sectionIdEnum } from "./enums";
import { users } from "./users";

/**
 * A pending/accepted/declined friend request. Once accepted, a row is
 * also written to `friendships` (below) — friendRequests keeps the
 * history (including declines) rather than being deleted, but the
 * leaderboard/friends-list queries read from `friendships`, not this
 * table.
 */
export const friendRequests = pgTable(
  "friend_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendRequestStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => ({
    // Prevents sending a second request while one is already pending
    // between the same two people (in either direction is NOT enforced
    // by this index alone — application code checks both directions
    // before inserting).
    fromToPendingUnique: uniqueIndex("friend_requests_from_to_idx").on(
      table.fromUserId,
      table.toUserId,
    ),
    toUserIdx: index("friend_requests_to_user_idx").on(table.toUserId),
  }),
);

/**
 * A confirmed, symmetric friendship. Always stored with `userIdLow <
 * userIdHigh` (the smaller uuid first) so a friendship is represented by
 * exactly one row regardless of who sent the original request — this
 * keeps "is A friends with B" and "list all of A's friends" both a single
 * indexed lookup instead of a UNION of two directions.
 */
export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userIdLow: uuid("user_id_low")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userIdHigh: uuid("user_id_high")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pairUnique: uniqueIndex("friendships_pair_idx").on(
      table.userIdLow,
      table.userIdHigh,
    ),
    // Ordering invariant enforced in the database, not just in
    // application code that writes this table — application code is
    // still responsible for sorting the pair before insert, but this
    // catches a bug that would otherwise silently duplicate a
    // friendship as two rows.
    orderedPairCheck: check(
      "friendships_ordered_pair_check",
      sql`${table.userIdLow} < ${table.userIdHigh}`,
    ),
  }),
);
