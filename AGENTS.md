# AGENTS.md

This file is the entry point for any coding agent (Cursor, OpenCode, Claude
Code, or anything else) working in this repository. Read this file, and the
files it points to, before writing or changing any code.

## Read first, in this order
1. `docs/architecture.md` — the decided stack and patterns for this app
2. `docs/product.md` — what this app is and who it's for
3. `docs/security.md` — auth, ownership, and data-handling rules
4. `docs/work/current.md` — what's already done, what's next
5. The specific feature file you've been assigned, under `docs/features/`

## Boundaries (do not violate these without a written decision in docs/decisions/)
- Browser/mobile client code must never import server or database modules.
- Domain logic (packages/domain) must never import HTTP, database, or platform modules.
- The IRT scoring engine (packages/domain/src/scoring/*) is this product's
  actual differentiator — treat changes to it with more care than
  anywhere else in the codebase, not less. Any behavior change here
  (not just a refactor) needs a written ADR in docs/decisions/, same as
  any other architectural decision, explaining what changed and why.
  Never let a "which responses count, and how" decision live untested
  inside a route handler or service function instead of here — that's
  literally how the 2026-09-28 bug happened (every quiz scored a fixed
  75/150 because the scoring-selection logic was buried, untested, in
  apps/web's service.ts; see docs/decisions/0005). Every scoring change
  needs a passing regression test in packages/domain/src/__tests__/
  before it ships, not just a typecheck.
- Product data is reachable ONLY through the application's own API — never a
  direct client-to-database path.
- Every operation that reads or writes a private resource must enforce
  ownership (e.g. `where id = $1 and owner_id = $2`), not just check that the
  caller is logged in.
- Never trust ownership, role, or entitlement values sent from the client.
- Ordinary request handling must never use migration or admin database
  credentials — only the least-privilege runtime role.
- Any new database change requires a new, reviewed migration file. Never
  edit a migration that has already been deployed.
- Don't add new infrastructure, services, or dependencies without writing
  down why in `docs/decisions/`.

## When you finish a task
- Confirm the acceptance criteria in the feature file are actually met.
- Run the relevant checks (tests, typecheck, lint) and report the results
  honestly — including which checks you did NOT run.
- Update `docs/work/current.md` with what's done and what's next.
- If you changed behavior that the docs describe, update those docs too.

## What NOT to do
- Don't invent new architecture on the fly. If something isn't covered by
  `docs/architecture.md`, stop and flag it rather than guessing.
- Don't silently skip a step in a feature file's acceptance criteria.
- Don't provision billable infrastructure or change production configuration
  without explicit human approval.
