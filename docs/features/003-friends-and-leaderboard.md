# Friends list and friend-challenge quiz

## Outcome
A user can add other users as friends and see a small leaderboard limited
to their friends (not a global leaderboard), plus challenge a specific
friend to a quiz on a chosen section.

## Why this matters
This is the light social layer the product should have — deliberately
small. It rides on the same real content and scoring engine from feature
001; it is not a separate game mode with its own questions or its own
scoring logic.

## Acceptance criteria
- A user can send/accept a friend request (simple, not a full social graph
  feature — no follower counts, no public profiles).
- A user can see a leaderboard scoped to their friends only, ranked by
  their ability estimate (or a derived score) for a chosen section or
  overall — never a global/public leaderboard in v1.
- A user can challenge a specific friend to a quiz: same section, same
  question count, both complete it (does not have to be simultaneous —
  real-time head-to-head is not required for v1), and see a simple
  comparison of results afterward.
- Declined/ignored friend requests and challenges don't notify the sender
  repeatedly.
- A user's ability estimate is visible to friends only in the context of
  the leaderboard/challenge comparison they've opted into — not raw access
  to their full quiz history.

## Explicitly NOT in this feature
- Open matchmaking against random/unknown users (see
  `docs/decisions/0002-social-layer.md` for why this is deferred, not
  cancelled).
- Real-time simultaneous multiplayer (live "everyone answers at once")
  quizzes — async challenge-and-compare is enough for v1.
- Public/global leaderboards.

## Tests
- A user cannot see another user's ability estimate or quiz history unless
  they're friends and a challenge/leaderboard context applies.
- Blocking/removing a friend removes them from the leaderboard and stops
  further challenges from that person.

## Open questions
- None blocking — this feature can be built after 001 and 002 are solid.
