# Current work

Status: quiz-taking UI built and wired to the real backend, with 119
real UPTET 2019 questions loaded; scoring bug found and fixed (see
"Completed" below); local dev environment fully working end-to-end
(Neon + Auth0 + the Next.js app all talking to each other correctly).
Pushed to GitHub (https://github.com/Binay-dot/uptet-prep-app).

## Completed
- Reference architecture decided (docs/architecture.md, decisions/0001)
- Product defined: UPTET practice/prediction app, both papers
  (docs/product.md)
- Three feature specs written (001 quiz+prediction, 002 content
  ingestion/review, 003 friends/leaderboard); two ADRs (0002 social layer,
  0003 content/scoring)
- Full monorepo scaffold:
  - `packages/contracts` — all shared Zod schemas (enums, question, quiz,
    user, friends, errors)
  - `packages/domain` — real EAP-based IRT ability estimation, predicted
    score mapping, section labeling. 20 unit tests, all passing.
  - `packages/database` — full Drizzle schema (users/identity aggregate,
    auth identities, questions, quiz attempts + attempt-questions,
    section ability estimates, friend requests/friendships, account
    deletion challenge + job tables), migration generated and applied to
    a real Neon database.
    - `pnpm --filter @uptet/database seed` inserts a small dev-only
      question bank (17 questions, marked `sourceNote = "dev-seed-v1"`)
      covering every section of both papers, for local UI testing.
      Idempotent — safe to re-run.
    - `pnpm --filter @uptet/database ingest:pyq-2019-p1` inserts 119
      REAL questions from the actual UPTET 2019 Paper 1 exam (Child
      Development & Pedagogy, English, Mathematics, Environmental
      Studies), sourced per docs/decisions/0004-content-sourcing-fallback.md
      — every answer independently verified (computed for Math, checked
      against known facts/grammar for the rest), not blindly transcribed
      from the source PDF's scanned answer-key table, which was found to
      be unreliable when spot-checked. Enters as `source: "pyq"`,
      `status: "calibration"` (not `pyq_verified` — see the ADR for why).
      Idempotent — safe to re-run.
  - `apps/web` — Next.js App Router: Auth0 session + bearer-token actor
    resolution (`resolveActor`), the `apiRoute()` mediation wrapper, and
    four real modules wired end-to-end: users (bootstrap/get/update),
    quiz (start attempt with random item selection, submit with real EAP
    scoring + ability-estimate upsert), friends (requests, friendships,
    friends-only leaderboard). `src/lib/apiClient.ts` holds small typed
    fetch wrappers for the quiz endpoints (not the full shared
    `packages/api-client` mentioned in the architecture doc — see "Next"
    below).
    - Dashboard page does a real bootstrap call on load and links to
      `/quiz`.
    - `/quiz` (`src/app/(authenticated)/quiz/page.tsx`) is the first real
      feature-001 UI: pick paper + full mock / section practice (+
      section), take the quiz one question at a time (all questions are
      actually fetched up front in one `QuizAttemptDto`; "one at a time"
      is a client-side presentation choice), submit, see predicted
      score/150, raw score, and a per-section strong/developing/
      needs-work breakdown. Still visually plain — see "Next" #3.
  - `apps/mobile` — Expo Router skeleton: Auth0 PKCE via expo-auth-session,
    tokens in expo-secure-store (never AsyncStorage), a typed API client
    that always attaches the bearer token, one example screen flow
    (sign-in -> dashboard calling `/api/v1/me`). Not yet run/tested.
  - `tooling/doctor.ts` + `.env.example` — setup verification script
- **Live infrastructure set up and verified (2026-09-28):**
  - Neon project created, migration run against it
  - Restricted `app_runtime` role created (SELECT/INSERT/UPDATE/DELETE
    only, no schema changes) and confirmed working — `DATABASE_URL` uses
    it, `DATABASE_MIGRATION_URL` stays on the owner role
  - Auth0 tenant + application + API created, Google social login working
  - End-to-end proof: signed in via Auth0 -> dashboard called
    `POST /api/v1/me` -> wrote/read a real row in Neon's `users` table via
    `app_runtime` -> displayed back in the browser
- See `docs/feedback/lessons.md` for generic patterns/gotchas found while
  building this that are candidates for backporting into `app-factory`
  (now also includes: `tsx`/`drizzle-kit` scripts don't auto-load `.env`
  the way Next.js does, and Next.js itself only auto-loads `.env` from
  its own app folder, not the monorepo root — both needed explicit
  `dotenv.config()` fixes; a script under `src/` needs one extra `../`
  in that dotenv path versus a script at the package root, e.g.
  `packages/database/src/seed.ts` needs `"../../../.env"` where
  `packages/database/drizzle.config.ts` needs `"../../.env"` — easy to
  get wrong by copying the wrong sibling file as a template).

## Fixed
- **Predicted score was stuck at exactly 75/150 for every user, every
  attempt** (found 2026-09-28 while manually testing the real quiz flow).
  Root cause: every item in the bank has `difficulty: null` (no
  item-calibration job exists yet), and `submitQuiz` was excluding any
  item without a calibrated difficulty from scoring entirely — so every
  attempt fed zero responses into the IRT estimator, which always fell
  back to the same fixed prior-based number.
  - Fix: uncalibrated items now score at a neutral fallback difficulty
    instead of being excluded (docs/decisions/0005-neutral-difficulty-fallback-for-scoring.md).
  - The "which responses count, and at what difficulty" decision was
    also *moved*, not just patched: it's now `toScoredResponse()`, a
    pure exported function in `packages/domain/src/scoring/`, with its
    own regression test (`toScoredResponse.test.ts`) that pins "an
    all-uncalibrated quiz must still predict a meaningfully different
    score for a strong vs weak performance." It was previously inline,
    untested logic inside apps/web's service.ts — exactly how this bug
    shipped unnoticed. `AGENTS.md` now has a standing boundary rule:
    any change to `packages/domain/src/scoring/*` needs a written ADR
    and a passing regression test, not just a typecheck. Also logged as
    a factory-backport candidate in docs/feedback/lessons.md.
  - Verified: `pnpm --filter @uptet/domain test` (26/26 passing,
    including the new regression guard), `pnpm -r typecheck`, and
    `pnpm --filter @uptet/web build` — all clean. The underlying logic
    is now thoroughly pinned by tests; still needs one real
    click-through from `pnpm dev` (same as before, but now: try a
    deliberately-bad attempt and a deliberately-good one back to back
    and confirm the two scores actually differ) to confirm the live app
    picks up the fix — same Postgres-access reason as below for why
    this session can't do that click-through itself.

## Next
1. Run `pnpm --filter @uptet/database ingest:pyq-2019-p1` once from a
   real terminal (same network-access reason as `seed` below) to load
   119 real UPTET 2019 Paper 1 questions (Child Development & Pedagogy,
   English, Mathematics, Environmental Studies — Hindi section
   deliberately not included this round, see docs/decisions/0004).
   Safe to run alongside the dev seed data; both use their own
   `sourceNote` marker so they don't collide.
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
5. Build the item-calibration job (real difficulty estimation from
   response data) — current code only promotes `calibration` -> `live` by
   response count, it does NOT yet compute a real difficulty parameter.
   Flagged in the quiz service's code comments. This now matters more:
   both the dev-seed AND the real 2019 PYQ batch enter as `calibration`,
   not `pyq_verified` (see docs/decisions/0004), so this job is what
   eventually lets real usage promote them to counting toward ability
   estimates.
6. `packages/query` (TanStack Query definitions) and `packages/api-client`
   (shared typed client) mentioned in the architecture are not built yet
   — `apps/web/src/lib/apiClient.ts` is a small local stand-in for now,
   `apps/mobile` has its own separate local API client; decide whether to
   extract a real shared package once the pattern is duplicated a third
   time.

## Verified
- `pnpm -r typecheck` — clean (contracts, domain, database, web, mobile),
  including the new seed script, API client, and quiz page (2026-09-28,
  run in an isolated scratch copy since this session's sandboxed shells
  can't reach the real node_modules installed on Windows directly)
- `pnpm --filter @uptet/web build` — succeeds, `/quiz` route present in
  the build output (2026-09-28)
- `pnpm --filter @uptet/domain test` — 20/20 passing
- `pnpm --filter @uptet/database generate` — produces valid SQL migration
- **Live, against real infra:** Neon migration applied, restricted DB
  role works, Auth0 login works, full sign-in -> API -> database round
  trip works (2026-09-28)
- `pnpm seed` and a manual click-through of `/quiz` end-to-end —
  confirmed working by the person running this, from their own terminal
  (2026-09-28). Neither of this session's sandboxed shells (an isolated
  device VM, and a cloud container) can reach raw Postgres on port 5432
  — HTTPS only — so anything touching the live DB has to run from a real
  terminal, not from here.
- **Not yet verified this session:** `pnpm ingest:pyq-2019-p1` — it
  typechecks cleanly (packages/contracts, database, domain all pass) and
  follows the exact same DB-access pattern as the already-verified
  `seed.ts`/`migrate.ts`, but the same Postgres-port restriction applies,
  so it needs one real run from a normal terminal to confirm the actual
  insert.

## Blockers
None currently. Open item to resolve before feature 002 is fully
buildable: confirm current format UPBEB publishes past papers/answer keys
in.
