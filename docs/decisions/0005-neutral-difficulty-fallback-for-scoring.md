# 0005 — Fall back to neutral difficulty for uncalibrated items in scoring

## Context
Feature 001's acceptance criteria say two things that turned out to be in
tension once real usage started:
1. "Items still in 'calibration' status... must not count toward the
   user's visible ability estimate until they've been promoted out of
   calibration."
2. "A new user with no prior history still gets a first estimate after
   their first quiz — it doesn't need dozens of attempts to show
   *something* useful, even if early estimates are wider/less certain."

Both assumed a normal mix of already-trusted items (`pyq_verified` /
`live`) alongside a smaller number of new, unproven `calibration` items —
the standard field-testing pattern described in
docs/decisions/0003-content-and-scoring.md. That assumption broke: with
content sourced under docs/decisions/0004 (third-party PYQs, honestly
entered as `calibration` rather than `pyq_verified`) and no
item-calibration job built yet (still open — see docs/work/current.md),
**100% of the item bank is `calibration` status**, all with
`difficulty: null`.

`submitQuiz` (apps/web/src/server/modules/quiz/service.ts) followed rule
#1 literally: it only fed a response into IRT scoring when the item's
`difficultyAtAttempt` was non-null. With zero live-calibrated items in
the whole bank, every quiz attempt produced zero scored responses,
regardless of what the user actually answered. The estimator then fell
back to the prior (theta = 0), and against the fixed default reference
difficulty distribution (symmetric around 0), that always produced
exactly the same predicted score — 75/150 for every user, every attempt,
confirmed while testing the shipped `/quiz` flow (2026-09-28). Rule #2
was being violated in practice: nobody got *any* real first estimate.

## Decision
When scoring a submitted quiz attempt, an item with no calibrated
difficulty (`difficultyAtAttempt === null`) is now scored using a neutral
fallback difficulty of `0` (average difficulty on the theta scale),
instead of being excluded from the ability estimate entirely.

This is a deliberate, narrow reinterpretation of acceptance criterion #1:
its real intent (per docs/decisions/0003) is "don't let one unproven item
corrupt an otherwise-trustworthy estimate," not "produce no estimate at
all when the whole bank happens to be unproven." Criterion #2 — get a
useful first signal, even if uncertain — is the one that actually matters
when the bank is 100% calibration items, so it wins here.

The EAP estimator's own uncertainty handling already does the safety work
this reinterpretation needs: with only neutral-difficulty evidence, the
posterior stays close to the wide N(0,1) prior, `standardError` stays
high, and `sectionLabelFor` (packages/domain) already refuses to label a
high-standard-error estimate "strong" — so a shaky, uncalibrated-item-only
estimate reads as provisional ("developing"), not falsely confident. The
`responseCount`-based calibration -> live promotion logic is untouched by
this change.

## Reasoning
The alternative (leave it as-is until the item-calibration job exists)
means the flagship feature — explicitly "the single most important
feature in the app" per docs/features/001 — shows a fixed, meaningless
number to every single user for as long as the item bank stays 100%
uncalibrated, which could be a long time given calibration needs real
accumulated response volume. That fails the product's actual purpose
worse than the neutral-difficulty approximation does.

## Conditions for revisiting
Once the item-calibration job (docs/work/current.md "Next") is built and
a meaningful share of the bank has real calibrated difficulty, re-examine
whether uncalibrated items should go back to being excluded rather than
scored at a neutral default — by then there should be enough calibrated
items that excluding the rest no longer collapses every estimate to the
same flat number.
