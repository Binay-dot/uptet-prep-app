# 0001 — Stack and architecture decision

## Context
Building a personal "app factory": a repeatable process and reference
architecture for shipping multiple apps (web + Expo/React Native mobile +
backend + database + auth), without re-deciding the hard parts every time.

## Decision
See `docs/architecture.md` for the summary a coding agent should work from.

This decision was reached by running two independent AI architects through
several rounds of cross-critique, followed by a principal-engineer design
review that specifically hunted for security, scalability, and pattern
gaps, followed by a judge synthesis that resolved the disagreements. The
full transcripts of all four stages are preserved below for reference.

## Alternatives rejected
- **Supabase (Auth + Data API)** — rejected as the default because its
  standard browser integration exposes session credentials to JavaScript,
  and its client-accessible database API creates a second, harder-to-audit
  path to product data alongside the application's own API. (A recipe for
  Supabase-based auth may still be added later for a specific product if
  circumstances justify it — that would be a new ADR.)
- **A separate backend service (Fastify, etc.)** — rejected as the default;
  adds a deployment and an HTTP hop without adding correctness that a
  well-structured Next.js modular monolith doesn't already provide. Revisit
  only when there's a demonstrated reason (independent scaling, another
  team owning the backend, workloads exceeding the hosting model).
- **OpenAPI code generation** — deferred; with two first-party TypeScript
  clients, hand-written Zod contracts + a typed client are sufficient and
  avoid an extra generation/drift-checking pipeline.
- **Database RLS as the default** — deferred to an optional recipe, since it
  requires its own certification (pooling isolation tests, non-bypass
  roles) rather than being a free checkbox.

## Conditions for revisiting
- If a product has unusually strict data-sensitivity requirements, install
  the RLS recipe and/or the HttpOnly-hardening recipe before launch — write
  a new ADR noting the specific product and reason.
- If backend workloads genuinely outgrow the Next.js hosting model, extract
  a standalone API — write a new ADR when that happens, don't do it
  preemptively.

## Full source material (for deep reference only — don't re-read this for
## every task; `docs/architecture.md` is the working summary)
- `full-debate/plan_a_final.md`
- `full-debate/plan_b_final.md`
- `full-debate/design_review.md`
- `full-debate/final_synthesis.md`
