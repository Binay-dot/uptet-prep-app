# Current work

Status: local dev environment fully working and verified end-to-end
(Neon + Auth0 + the Next.js app all talking to each other correctly).
Not yet deployed anywhere; not yet pushed to GitHub.

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
    a real Neon database
  - `apps/web` — Next.js App Router: Auth0 session + bearer-token actor
    resolution (`resolveActor`), the `apiRoute()` mediation wrapper, and
    three real modules wired end-to-end: users (bootstrap/get/update),
    quiz (start attempt with random item selection, submit with real EAP
    scoring + ability-estimate upsert), friends (requests, friendships,
    friends-only leaderboard). Dashboard page now does a real bootstrap
    call on load (proven working against live infra). Everything else is
    still an unstyled placeholder.
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
  `dotenv.config()` fixes).

## Next
1. Push this repo to GitHub — currently only exists locally, no history
   backed up anywhere.
2. Build the actual quiz-taking UI (wire up `/api/v1/quiz-attempts` start
   + submit on real pages) — backend logic is real and tested, there's
   just no UI to drive it yet.
3. Source the first batch of real UPTET PYQs (official UPBEB PDFs) to seed
   the question bank — nothing in `questions` table has real content yet,
   so step 2's UI would have nothing real to serve until this is done too.
4. Design the UI for the core quiz-taking and results screens (Design
   artifact) — current pages are unstyled placeholders.
5. Test the mobile app end-to-end (same Auth0 PKCE + API pattern as web,
   never actually run yet).
6. Build the item-calibration job (real difficulty estimation from
   response data) — current code only promotes `calibration` -> `live` by
   response count, it does NOT yet compute a real difficulty parameter.
   Flagged in the quiz service's code comments.
7. `packages/query` (TanStack Query definitions) and `packages/api-client`
   (shared typed client) mentioned in the architecture are not built yet
   — apps/mobile has its own local API client for now; decide whether to
   extract it once apps/web needs the same pattern client-side.

## Verified
- `pnpm -r typecheck` — clean (contracts, domain, database, web, mobile)
- `pnpm --filter @uptet/domain test` — 20/20 passing
- `pnpm --filter @uptet/database generate` — produces valid SQL migration
- `pnpm --filter @uptet/web build` — succeeds
- **Live, against real infra:** Neon migration applied, restricted DB
  role works, Auth0 login works, full sign-in -> API -> database round
  trip works (2026-09-28)

## Blockers
None currently. Open item to resolve before feature 002 is fully
buildable: confirm current format UPBEB publishes past papers/answer keys
in.