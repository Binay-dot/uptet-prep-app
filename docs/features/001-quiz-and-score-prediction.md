# Take a practice quiz and see a score/readiness prediction

## Outcome
A signed-up UPTET aspirant can take a practice quiz (by section, or a full
150-question mock under real timing) and, after submitting it, sees:
- A predicted score out of 150 for the real exam
- A per-section breakdown: which sections they're strong/weak in
- How this compares to their own past attempts (trend, not just one number)

This is the single most important feature in the app — it should be built,
tested, and feel solid before any social feature.

## Why this matters (context for whoever builds this)
A raw "you got 22/30" is not what this app is for — that's just percent
correct. The predicted score and section breakdown come from an IRT
(Item Response Theory) ability estimate: each question has a difficulty
(and ideally discrimination) parameter, and a user's answers update an
estimate of their underlying ability per section, which then maps to a
predicted real-exam score. See `docs/architecture.md` and
`docs/decisions/0003-content-and-scoring.md` for the full reasoning.

## Acceptance criteria
- A user can start a quiz scoped to: one section, one full paper (Paper 1
  or Paper 2, whichever they're registered for), or a mixed practice set.
- Each question is presented one at a time (MCQ, 4 options), matching the
  real exam's format. No negative marking, matching the real exam.
- On submission, the system computes (or updates) an ability estimate per
  section for that user, using the difficulty parameters of the items
  answered.
- The user sees: predicted score /150, per-section strong/weak labels, and
  how many questions they answered in that session.
- A new user with no prior history still gets a first estimate after their
  first quiz — it doesn't need dozens of attempts to show *something*
  useful, even if early estimates are wider/less certain.
- Items still in "calibration" status (see feature 002) can appear in
  practice quizzes but must not count toward the user's visible ability
  estimate until they've been promoted out of calibration. **Update
  (2026-09-28):** in practice this meant literally zero items counted
  (the whole bank was calibration-status with no calibration job to
  promote/estimate difficulty yet), which produced the same fixed
  predicted score for every user regardless of performance — failing the
  "gets *something* useful after their first quiz" criterion below far
  worse than the alternative. See
  docs/decisions/0005-neutral-difficulty-fallback-for-scoring.md: an
  uncalibrated item is now scored at a neutral fallback difficulty
  instead of excluded, which was judged the better reading of this
  feature's actual intent.
- Works correctly whether the user is preparing for Paper 1, Paper 2, or
  both — predictions are per-paper.

## Implementation notes
- Quiz session, response, and per-user-per-section ability estimate are
  distinct records — don't conflate "a quiz attempt" with "the user's
  running ability estimate."
- The scoring/prediction calculation should be a pure, testable function
  (packages/domain) — not buried in a route handler — since its correctness
  matters more than almost anything else in this app.
- Start with a standard 2-parameter (or simpler 1-parameter) IRT model
  rather than reaching for the most complex version; the goal is a
  reasonable first prediction, refined over time as more response data
  comes in.

## Tests
- Predicted score changes sensibly as a user answers more/fewer questions
  correctly (regression test with fixed input sequences and expected
  output ranges, not exact-match on a moving statistical model).
- A user's own private ability estimate is never visible to or computable
  by another user.
- Calibration-only items never affect the visible ability estimate.
- Full-mock quiz enforces real exam question count/timing; section
  practice does not need to.

## Out of scope (for this feature)
- Friends/leaderboard comparison (feature 003)
- Content review queue (feature 002)
- Detailed historical charts beyond a simple trend indicator

## Open questions
- Exact IRT model choice (1PL/Rasch vs 2PL) — can be decided during
  implementation based on how much per-item data exists at launch; start
  simple, don't block launch on a "perfect" model.
