# Current work

Status: quiz-taking UI built and wired to the real backend, with 119
real UPTET 2019 questions loaded (content-reviewed and fixed); scoring
bug found and fixed; item-calibration job built (not yet run against
live data — see "Next"); local dev environment fully working end-to-end
(Neon + Auth0 + the Next.js app all talking to each other correctly).
Pushed to GitHub (https://github.com/Binay-dot/uptet-prep-app) through
commit `aa1c742`; the calibration-job commit below is still local,
pending push.

## Completed
- Reference architecture decided (docs/architecture.md, decisions/0001)
- Product defined: UPTET practice/prediction app, both papers
  (docs/product.md)
- Three feature specs written (001 quiz+prediction, 002 content
  ingestion/review, 003 friends/leaderboard); ADRs 0002 (social layer),
  0003 (content/scoring), 0004 (content-sourcing fallback), 0005
  (neutral difficulty fallback), 0006 (item-calibration job)
- Full monorepo scaffold:
  - `packages/contracts` — all shared Zod schemas (enums, question, quiz,
    user, friends, errors)
  - `packages/domain` — real EAP-based IRT ability estimation, predicted
    score mapping, section labeling, item-calibration difficulty
    estimation. 28 unit tests, all passing (see "Item calibration job"
    below).
  - `packages/database` — full Drizzle schema (users/identity aggregate,
    auth identities, questions incl. `difficulty`/`difficultyStandardError`,
    quiz attempts + attempt-questions, section ability estimates, friend
    requests/friendships, account deletion challenge + job tables), two
    migrations generated and applied to a real Neon database.
    - `pnpm --filter @uptet/database seed` inserts a small dev-only
      question bank (17 questions, marked `sourceNote = "dev-seed-v1"`)
      covering every section of both papers, for local UI testing.
      Idempotent — safe to re-run.
    - `pnpm --filter @uptet/database ingest:pyq-2019-p1` inserts 119
      REAL questions from the actual UPTET 2019 Paper 1 exam (Child
      Development & Pedagogy, English, Mathematics, Environmental
      Studies), sourced per docs/decisions/0004-content-sourcing-fallback.md
      — every answer independently verified, not blindly transcribed
      from the source PDF's scanned answer-key table, which was found to
      be unreliable when spot-checked. Enters as `source: "pyq"`,
      `status: "calibration"` (not `pyq_verified` — see the ADR for why).
      **Run and verified against live Neon (2026-09-28).** Two content
      bugs found in review afterward and fixed both at the source (this
      script) and on the already-ingested rows (targeted update-in-place
      via `packages/database/src/fix-2019-p1-content.ts`, chosen over
      delete+reinsert specifically to avoid orphaning real quiz-attempt
      history the FK constraint correctly refused to let happen): two
      English follow-up questions didn't repeat their source passage
      (lost context shown one question at a time), and three match-list
      questions had jumbled option strings.
  - `apps/web` — Next.js App Router: Auth0 session + bearer-token actor
    resolution (`resolveActor`), the `apiRoute()` mediation wrapper, and
    four real modules wired end-to-end: users (bootstrap/get/update),
    quiz (start attempt with random item selection, submit with real EAP
    scoring + ability-estimate upsert + calibration->live promotion),
    friends (requests, friendships, friends-only leaderboard).
    `src/lib/apiClient.ts` holds small typed fetch wrappers for the quiz
    endpoints (not the full shared `packages/api-client` mentioned in
    the architecture doc — see "Next" below).
    - Dashboard page does a real bootstrap call on load and links to
      `/quiz`.
    - `/quiz` (`src/app/(authenticated)/quiz/page.tsx`) is the first real
      feature-001 UI: pick paper + full mock / section practice (+
      section), take the quiz one question at a time, submit, see
      predicted score/150, raw score, and a per-section
      strong/developing/needs-work breakdown. Still visually plain — see
      "Next".
  - `apps/mobile` — Expo Router skeleton: Auth0 PKCE via expo-auth-session,
    tokens in expo-secure-store (never AsyncStorage), a typed API client
    that always attaches the bearer token, one example screen flow
    (sign-in -> dashboard calling `/api/v1/me`). Not yet run/tested.
  - `tooling/doctor.ts` + `.env.example` — setup verification script
- **Live infrastructure set up and verified (2026-09-28):**
  - Neon project created, both migrations run against it
  - Restricted `app_runtime` role created (SELECT/INSERT/UPDATE/DELETE
    only, no schema changes) and confirmed working — `DATABASE_URL` uses
    it, `DATABASE_MIGRATION_URL` stays on the owner role
  - Auth0 tenant + application + API created, Google social login working
  - End-to-end proof: signed in via Auth0 -> dashboard called
    `POST /api/v1/me` -> wrote/read a real row in Neon's `users` table via
    `app_runtime` -> displayed back in the browser
- See `docs/feedback/lessons.md` for generic patterns/gotchas found while
  building this that are candidates for backporting into `app-factory`.

## Fixed
- **Predicted score was stuck at exactly 75/150 for every user, every
  attempt** (found 2026-09-28 while manually testing the real quiz flow).
  Root cause: every item in the bank had `difficulty: null` (no
  item-calibration job existed yet), and `submitQuiz` was excluding any
  item without a calibrated difficulty from scoring entirely — so every
  attempt fed zero responses into the IRT estimator, which always fell
  back to the same fixed prior-based number.
  - Fix: uncalibrated items now score at a neutral fallback difficulty
    instead of being excluded (docs/decisions/0005). The "which
    responses count, and at what difficulty" decision was also *moved*,
    not just patched: it's now `toScoredResponse()`, a pure exported
    function in `packages/domain/src/scoring/`, with its own regression
    test. `AGENTS.md` has a standing boundary rule from this: any change
    to `packages/domain/src/scoring/*` needs a written ADR and a passing
    regression test, not just a typecheck.
  - Verified live: `pnpm seed` and a manual click-through of `/quiz`
    end-to-end, confirmed by the person running this from their own
    terminal (2026-09-28).
- **Two content bugs in the ingested 2019 PYQ batch** — see "Completed"
  above for detail. Fixed at the source and on the live rows via a
  targeted UPDATE (ids unchanged, quiz-attempt history intact). Verified
  live: the fix script ran cleanly against Neon, matched and updated all
  6 affected rows (2026-09-28).

## Item calibration job (built, not yet run live)
Per AGENTS.md's boundary rule, this is a `packages/domain/src/scoring/*`
change, so it came with docs/decisions/0006-item-calibration-job.md and
tests, not just a typecheck.
- `estimateItemDifficultyEap` (`packages/domain/src/scoring/itemCalibration.ts`)
  — the item-side counterpart to `estimateAbilityEap`: same 1PL formula,
  same EAP-not-MLE reasoning (a field-testing sample is very often
  all-correct or all-incorrect for a small/new item, which has no finite
  MLE solution), reusing the exact same quadrature-grid/prior/probability
  helpers (refactored out of `abilityEstimate.ts` into shared exports)
  rather than duplicating the formula.
- `packages/database/src/calibrate-items.ts` — the job itself. For every
  `calibration`-status question with >= `MIN_RESPONSES_TO_ATTEMPT_CALIBRATION`
  (30) responses, computes each respondent's *leave-one-out* ability
  (from their other same-section, same-attempt answers, excluding the
  item being calibrated) and runs `estimateItemDifficultyEap` over the
  result, writing `questions.difficulty` / `difficultyStandardError`.
  Idempotent, safe to re-run — always recomputes from current data.
- Migration `0001_groovy_bastion.sql` adds the nullable
  `difficultyStandardError` column.
- The quiz service's calibration -> live promotion rule (previously
  response-count only, explicitly flagged as a placeholder) now also
  requires a non-null difficulty and `difficultyStandardError <=
  MAX_STANDARD_ERROR_FOR_LIVE_PROMOTION` (0.6, same threshold
  `sectionLabelFor` uses for a confident "strong" label) — both
  thresholds moved into a new shared
  `packages/domain/src/scoring/calibrationPolicy.ts` so the job and the
  promotion check can't drift apart by editing one copy and not the
  other.
- **Verified in an isolated scratch copy only so far** (this session's
  sandboxed shells can't reach the real Windows node_modules or the live
  Neon DB directly — same reasoning as always): 28/28
  `pnpm --filter @uptet/domain test` passing, including 7 new tests for
  `estimateItemDifficultyEap` (zero-response prior, doesn't blow up on
  all-correct/all-incorrect samples, harder items score as more
  difficult, standard error shrinks with more data, recovers a known
  true difficulty from a simulated sample, and a boundary-case symmetry
  check against `estimateAbilityEap`). **Not yet run**: `pnpm install`
  (needed — `packages/database` now depends on `@uptet/domain`, a new
  workspace dependency), `pnpm -r typecheck`, `pnpm --filter @uptet/web
  build`, or the actual `pnpm --filter @uptet/database
  calibrate:items` job against live data (there isn't 30+ responses on
  any one item yet anyway, so it'd currently report 0 candidates — worth
  running once anyway to confirm it executes cleanly).

## Next
1. From a real terminal: `pnpm install` (new `@uptet/domain` workspace
   dependency in `packages/database`), then `pnpm --filter
   @uptet/database migrate` (applies `0001_groovy_bastion.sql`), then
   `pnpm -r typecheck` and `pnpm --filter @uptet/web build` to confirm
   the calibration-job change is clean end-to-end. Then commit + push
   (currently only staged locally in this session's working tree).
2. Source a second real batch — Paper 2 content (Social Studies section
   has none yet), and the Hindi language section (dropped from the first
   batch — see docs/decisions/0004-content-sourcing-fallback.md for why).
   A second candidate PDF (UPTET Jan 2022 Paper 1) is already saved at
   `docs/features/source-pdfs/` for this.
3. Design the UI for the core quiz-taking and results screens (Design
   artifact) — current pages (including the new `/quiz` page) are
   functional but visually plain.
4. Test the mobile app end-to-end (same Auth0 PKCE + API pattern as web,
   never actually run yet).
5. `packages/query` (TanStack Query definitions) and `packages/api-client`
   (shared typed client) mentioned in the architecture are not built yet
   — `apps/web/src/lib/apiClient.ts` is a small local stand-in for now,
   `apps/mobile` has its own separate local API client; decide whether to
   extract a real shared package once the pattern is duplicated a third
   time.
6. Once real usage accumulates >= 30 responses on some items, run
   `pnpm --filter @uptet/database calibrate:items` for real and confirm
   at least one item actually promotes calibration -> live on the next
   quiz submission after that.

## Verified
- `pnpm -r typecheck` — clean as of the pre-calibration-job commit
  (`aa1c742`); not yet re-run since (see "Item calibration job" above).
- `pnpm --filter @uptet/web build` — succeeds as of `aa1c742`, `/quiz`
  route present in the build output.
- `pnpm --filter @uptet/domain test` — 28/28 passing (isolated scratch
  copy; not yet re-run inside the real workspace since the calibration
  job's `@uptet/domain` dependency was added to `packages/database`).
- `pnpm --filter @uptet/database generate` — produces valid SQL
  migrations (both 0000 and 0001).
- **Live, against real infra:** Neon migration applied, restricted DB
  role works, Auth0 login works, full sign-in -> API -> database round
  trip works; `pnpm seed`, `pnpm ingest:pyq-2019-p1`, and
  `pnpm exec tsx src/fix-2019-p1-content.ts` all run and verified
  against live Neon, from a real terminal (2026-09-28). Neither of this
  session's sandboxed shells (an isolated device VM, and a cloud
  container) can reach raw Postgres on port 5432 — HTTPS/package-registry
  traffic only — so anything touching the live DB has to run from a real
  terminal, not from here.
- **Not yet verified against live data:** `pnpm --filter @uptet/database
  calibrate:items` (the new job) and the updated promotion gate in
  `submitQuiz` — both typecheck-clean in isolation but need one real run
  once `pnpm install` has picked up the new workspace dependency.

## Blockers
None currently. Open item to resolve before feature 002 is fully
buildable: confirm current format UPBEB publishes past papers/answer keys
in.
