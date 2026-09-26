# 0002 — Defer open matchmaking; ship friend-only social features first

## Context
Early product discussion considered a "play with a random person or a
friend" quiz mode, closer to Kahoot/Quizizz-style casual multiplayer.

## Decision
Ship friends-only features (friend list, friends-scoped leaderboard,
async friend challenge) in v1. Do NOT build open "random opponent"
matchmaking yet.

## Reasoning
- Random matchmaking has a cold-start problem: with a small early user
  base, a stranger queueing for a match will often find no one, which
  feels broken and damages first impressions.
- Pure entertainment/social quiz mechanics without a serious underlying
  purpose tend to fade once novelty wears off (see: HQ Trivia's decline —
  https://productmint.com/what-happened-to-hq-trivia/). This app's real
  differentiator is the score/readiness prediction (feature 001); the
  social layer supports that, it doesn't replace it.
- Friend-based features work with zero other platform users beyond the
  friend group itself, so they can ship and be useful immediately.

## Conditions for revisiting
Once there's a genuinely active concurrent user base (not a specific
number decided in advance — revisit when friend-challenge usage data
suggests demand for a stranger-matching mode), open matchmaking can be
added as a new feature, seeded with real user demand data rather than a
guess.
