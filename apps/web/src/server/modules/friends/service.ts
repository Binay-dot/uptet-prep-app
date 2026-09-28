import { getDb, schema } from "@uptet/database";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import type {
  SendFriendRequestInput,
  RespondToFriendRequestInput,
  FriendDto,
  LeaderboardEntryDto,
  SectionId,
} from "@uptet/contracts";
import type { Actor } from "../../auth/actor";
import { conflict, forbidden, notFound } from "../../http/apiError";

/** Always store a friendship with the smaller uuid first — see the check constraint in packages/database/src/schema/friends.ts. */
function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function sendFriendRequest(
  actor: Actor,
  input: SendFriendRequestInput,
): Promise<{ requestId: string }> {
  if (input.toUserId === actor.userId) {
    throw conflict("You can't send a friend request to yourself.");
  }
  const db = getDb();

  const [low, high] = orderedPair(actor.userId, input.toUserId);
  const existingFriendship = await db.query.friendships.findFirst({
    where: and(
      eq(schema.friendships.userIdLow, low),
      eq(schema.friendships.userIdHigh, high),
    ),
  });
  if (existingFriendship) {
    throw conflict("You're already friends.");
  }

  const existingPending = await db.query.friendRequests.findFirst({
    where: and(
      eq(schema.friendRequests.status, "pending"),
      or(
        and(
          eq(schema.friendRequests.fromUserId, actor.userId),
          eq(schema.friendRequests.toUserId, input.toUserId),
        ),
        and(
          eq(schema.friendRequests.fromUserId, input.toUserId),
          eq(schema.friendRequests.toUserId, actor.userId),
        ),
      ),
    ),
  });
  if (existingPending) {
    throw conflict("A friend request is already pending between you two.");
  }

  const [request] = await db
    .insert(schema.friendRequests)
    .values({ fromUserId: actor.userId, toUserId: input.toUserId })
    .returning();

  return { requestId: request.id };
}

export async function respondToFriendRequest(
  actor: Actor,
  input: RespondToFriendRequestInput,
): Promise<{ status: RespondToFriendRequestInput["response"] }> {
  const db = getDb();

  const request = await db.query.friendRequests.findFirst({
    where: eq(schema.friendRequests.id, input.requestId),
  });
  if (!request) throw notFound("Friend request not found.");
  if (request.toUserId !== actor.userId) {
    // Only the recipient can accept/decline — the sender cancelling their
    // own request is a different, not-yet-built action.
    throw forbidden("This friend request isn't addressed to you.");
  }
  if (request.status !== "pending") {
    throw conflict("This friend request has already been responded to.");
  }

  return db.transaction(async (tx) => {
    await tx
      .update(schema.friendRequests)
      .set({ status: input.response, respondedAt: new Date() })
      .where(eq(schema.friendRequests.id, request.id));

    if (input.response === "accepted") {
      const [low, high] = orderedPair(request.fromUserId, request.toUserId);
      await tx
        .insert(schema.friendships)
        .values({ userIdLow: low, userIdHigh: high })
        .onConflictDoNothing();
    }

    return { status: input.response };
  });
}

export async function listFriends(actor: Actor): Promise<FriendDto[]> {
  const db = getDb();
  const rows = await db.query.friendships.findMany({
    where: or(
      eq(schema.friendships.userIdLow, actor.userId),
      eq(schema.friendships.userIdHigh, actor.userId),
    ),
  });

  const friendIds = rows.map((row) =>
    row.userIdLow === actor.userId ? row.userIdHigh : row.userIdLow,
  );
  if (friendIds.length === 0) return [];

  const friendUsers = await db.query.users.findMany({
    where: inArray(schema.users.id, friendIds),
  });
  const friendshipByUserId = new Map(
    rows.map((row) => [
      row.userIdLow === actor.userId ? row.userIdHigh : row.userIdLow,
      row,
    ]),
  );

  return friendUsers.map((user) => ({
    userId: user.id,
    displayName: user.displayName,
    friendsSince: friendshipByUserId.get(user.id)!.createdAt.toISOString(),
  }));
}

/**
 * Friends-only leaderboard for one section — see
 * docs/decisions/0002-social-layer.md: there is deliberately no
 * global/public leaderboard query anywhere in this codebase. This
 * function's caller set is always {actor.userId} + actor's friend ids;
 * there is no code path that can widen it to "everyone".
 */
export async function getSectionLeaderboard(
  actor: Actor,
  sectionId: SectionId,
): Promise<LeaderboardEntryDto[]> {
  const db = getDb();

  const friendships = await db.query.friendships.findMany({
    where: or(
      eq(schema.friendships.userIdLow, actor.userId),
      eq(schema.friendships.userIdHigh, actor.userId),
    ),
  });
  const friendIds = friendships.map((row) =>
    row.userIdLow === actor.userId ? row.userIdHigh : row.userIdLow,
  );
  const scopedUserIds = [actor.userId, ...friendIds];

  const estimates = await db.query.sectionAbilityEstimates.findMany({
    where: and(
      eq(schema.sectionAbilityEstimates.sectionId, sectionId),
      inArray(schema.sectionAbilityEstimates.userId, scopedUserIds),
    ),
    orderBy: desc(schema.sectionAbilityEstimates.theta),
  });

  const usersById = new Map(
    (
      await db.query.users.findMany({
        where: inArray(schema.users.id, estimates.map((e) => e.userId)),
      })
    ).map((u) => [u.id, u]),
  );

  return estimates.map((estimate, index) => ({
    userId: estimate.userId,
    displayName: usersById.get(estimate.userId)?.displayName ?? null,
    sectionId,
    abilityEstimate: estimate.theta,
    rank: index + 1,
  }));
}
