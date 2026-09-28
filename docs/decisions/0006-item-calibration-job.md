# 0006 — Item calibration job: leave-one-out EAP difficulty estimation

## Context
Per docs/decisions/0003-content-and-scoring.md, item difficulty is never
hand-assigned — it must come from real response data. Until now that job
didn't exist: `questions.difficulty` stayed null forever, and the
calibration -> live promotion in the quiz service was based on
`responseCount` alone, explicitly flagged there as a placeholder.

## Decision
1. **Difficulty estimation method: EAP, not MLE** — same reasoning as
   `estimateAbilityEap` (docs/decisions/0003, `abilityEstimate.ts`): MLE
   has no finite solution when a field-test sample is all-correct or
   all-incorrect, which is common for a newly-calibrating item with a
   small sample. `estimateItemDifficultyEap` (packages/domain) reuses the
   exact same quadrature-grid / N(0,1)-prior machinery as ability
   estimation — refactored out of `abilityEstimate.ts` into shared
   exports — so the 1PL formula has one implementation for both
   directions of the model, not two that could drift apart.
2. **Respondent ability for calibration is computed leave-one-out, per
   response.** For each recorded response to the item being calibrated,
   its respondent's theta is re-estimated from every *other* item they
   answered in the *same section* of the *same attempt*, excluding the
   response being used to calibrate this item. This is standard
   field-testing practice: an item under test shouldn't be allowed to
   influence the ability estimate used to calibrate it. It reuses
   `toScoredResponse` + `estimateAbilityEap` — the exact same scoring path
   production quiz submission already uses — rather than introducing a
   second, parallel ability model that could disagree with what users
   actually see.
3. **The job (`packages/database/src/calibrate-items.ts`) only computes
   difficulty. It does not flip `status` to `live`.** That decision stays
   in the quiz service, gated by a new shared policy
   (`packages/domain/src/scoring/calibrationPolicy.ts`):
   - `responseCount >= MIN_RESPONSES_TO_ATTEMPT_CALIBRATION` (30, same
     number as before, now shared instead of duplicated)
   - `difficulty IS NOT NULL` (the job has actually run for this item)
   - `difficultyStandardError <= MAX_STANDARD_ERROR_FOR_LIVE_PROMOTION`
     (0.6, same threshold `sectionLabelFor` already uses to gate a
     confident "strong" label) — new condition. Hitting the response-count
     threshold doesn't by itself mean the *estimate* has settled; a small
     or lopsided sample can still leave the posterior wide, and promoting
     on count alone risked exactly the same kind of confidently-wrong
     behavior this project has repeatedly decided against elsewhere (EAP
     over MLE, standard-error gating on section labels, dropping a PYQ
     answer nobody could verify).
4. A new nullable `difficultyStandardError` column on `questions` (real,
   nullable) stores the item-side counterpart to
   `sectionAbilityEstimates.standardError` — migration
   `0001_groovy_bastion.sql`.
5. No scheduler/cron exists yet — this job is run manually/periodically
   for now, same as the PYQ ingest scripts. Automating it is out of scope
   for this pass.

## Reasoning
This is the same failure mode this project has already hit once on the
*person* side (the "every attempt scores 75/150" bug,
docs/decisions/0005) applied to the *item* side: a scoring/calibration
decision that silently defaults to something wrong when the input data is
thin, rather than failing loudly or degrading honestly. EAP + a
standard-error gate is the same fix pattern applied consistently.

Reusing `abilityEstimate.ts`'s grid/prior/probability helpers instead of
duplicating them means a future correction to the 1PL formula (or the
prior) can't accidentally get fixed on one side of the model and not the
other.

## Conditions for revisiting
- `MIN_RESPONSES_TO_ATTEMPT_CALIBRATION` and
  `MAX_STANDARD_ERROR_FOR_LIVE_PROMOTION` are both tuning decisions, not
  fixed here — revisit once real usage data exists on how quickly
  estimates actually settle in practice.
- If/when this job is automated on a schedule, the "run it, then let the
  next quiz submission's promotion check pick up the result" two-step
  flow should be reconsidered — right now an item can sit fully
  calibrated but not yet promoted until *any* user submits *any* quiz
  after the job runs, which is a harmless but slightly odd latency this
  ADR is choosing not to solve yet.
- Discrimination (2PL) is still out of scope — `discrimination` stays
  null, same as before.
