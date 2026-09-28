import { z } from "zod";
import { SectionId, FriendRequestStatus } from "./enums";

export const SendFriendRequestInput = z
  .object({
    toUserId: z.string().uuid(),
  })
  .strict();
export type SendFriendRequestInput = z.infer<typeof SendFriendRequestInput>;

export const RespondToFriendRequestInput = z
  .object({
    requestId: z.string().uuid(),
    response: z.enum(["accepted", "declined"]),
  })
  .strict();
export type RespondToFriendRequestInput = z.infer<
  typeof RespondToFriendRequestInput
>;

export const FriendDto = z
  .object({
    userId: z.string().uuid(),
    displayName: z.string().max(100).nullable(),
    friendsSince: z.string().datetime(),
  })
  .strict();
export type FriendDto = z.infer<typeof FriendDto>;

/**
 * Leaderboard is ALWAYS scoped to the caller's friends. There is no
 * global/public leaderboard in v1 — see
 * docs/decisions/0002-social-layer.md.
 */
export const LeaderboardEntryDto = z
  .object({
    userId: z.string().uuid(),
    displayName: z.string().max(100).nullable(),
    sectionId: SectionId,
    abilityEstimate: z.number().finite(),
    rank: z.number().int().min(1),
  })
  .strict();
export type LeaderboardEntryDto = z.infer<typeof LeaderboardEntryDto>;

export const ChallengeFriendInput = z
  .object({
    friendUserId: z.string().uuid(),
    sectionId: SectionId,
    questionCount: z.number().int().min(5).max(30).default(10),
  })
  .strict();
export type ChallengeFriendInput = z.infer<typeof ChallengeFriendInput>;
