# 0007 — Deployment target for real test-user access

## Context
The backend and quiz flow are built and verified against live Neon +
Auth0, but `apps/web` only runs on `localhost` — nobody outside this
machine can reach it. Real item calibration (0006) needs real response
data, which needs real users, which needs a reachable URL. This is new
infrastructure, so per AGENTS.md it needs a written reason here and
explicit human approval before anything billable gets provisioned —
approval was given in chat on 2026-09-29.

## Decision
1. **Host: Vercel**, for `apps/web` only — this is what
   `docs/architecture.md` / `docs/decisions/0001-stack.md` already named
   as the decided hosting target, not a new choice.
2. **Deploy via Vercel's GitHub integration** (import the existing
   `Binay-dot/uptet-prep-app` repo, set the root directory to `apps/web`),
   not the Vercel CLI. Two reasons: (a) this sandboxed environment's
   network is allowlisted and cannot reach `vercel.com` at all — even the
   CLI's `vercel deploy` needs a real terminal — so CLI-driven deploy from
   here isn't possible regardless; (b) GitHub-integration deploys mean
   every future push to `main` redeploys automatically, which is the
   right default for a repo already using GitHub as its source of truth.
3. **Same Neon database as local dev, not a separate "staging" branch.**
   The entire point of this deploy is to accumulate real responses for
   calibration (0006) — splitting test-user traffic into a separate
   database would fragment the exact data this step exists to collect.
   Revisit this once real user count/data sensitivity grows past "a small
   trusted test group."
4. **Test users sign up through the existing real Auth0 Universal Login**
   (Google social login already verified working) — no separate
   test-account system. Auth0's Allowed Callback URLs / Allowed Logout
   URLs / Allowed Web Origins need the new Vercel domain added once it's
   known.
5. Environment variables on Vercel are the same keys as `.env.example`,
   with real values copied over manually by the project owner (not by an
   agent — see AGENTS.md and the credential-handling rule this project has
   followed throughout: secret values are never printed into a session
   transcript).

## Reasoning
This isn't introducing new architecture — it's executing what
`docs/architecture.md` already decided, at the point the product actually
needs it (real calibration data can't come from anywhere but real users
hitting a real URL). The GitHub-integration choice over CLI is purely
practical given this session's sandboxed network, not a reason to prefer
one over the other in general.

## Conditions for revisiting
- If test users move beyond "a small trusted group" (0-risk to real
  UPTET candidates' data if something goes wrong), reconsider a separate
  Neon branch/database for staging before wider rollout.
- If Vercel's free tier limits are hit, that's a new billable-infra
  decision requiring its own approval, not an automatic upgrade.
