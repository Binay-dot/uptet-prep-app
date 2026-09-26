# Architecture

This is the decided reference architecture for every app built from this
factory. It came out of a structured debate between two independent
architects and a principal-engineer design review (see
`decisions/0001-stack.md` for the full reasoning and what was rejected).
Do not re-litigate these choices per app — only revisit them by writing a
new ADR in `decisions/` if something concrete forces a change.

## Stack

| Concern | Choice |
|---|---|
| Web | Next.js (App Router), TypeScript, Tailwind, shadcn/ui |
| Mobile | Expo, React Native, Expo Router, EAS |
| Backend | Next.js Route Handlers, Node runtime — one deployment, no separate API service |
| Database | Neon PostgreSQL |
| Database access | Drizzle ORM, hand-reviewed SQL migrations (never edit a deployed migration) |
| Auth | Auth0 — Universal Login, official web + native SDKs |
| Browser sessions | HttpOnly, Secure session cookie — never readable by browser JavaScript |
| Native sessions | Authorization Code + PKCE, stored via the platform's secure credentials manager |
| Shared code | pnpm workspaces, Zod (contracts), TanStack Query, a typed API client |
| Hosting | Vercel (web/API), Neon (database), Auth0, EAS (mobile builds) |

## Non-negotiable pattern: one product-data path

```
Browser ── HttpOnly session ──┐
                              ├── Next.js application boundary
Expo ───── bearer token ──────┘             │
                                            ▼
                                  Policy-enforcing services
                                            │
                                  Scoped, ownership-checked queries
                                            │
                                            ▼
                                        PostgreSQL
```

No client (browser or mobile) ever talks to the database directly. Every
read and write goes through the Next.js API, through a service that resolves
who the caller is and checks their status, through a query that proves
ownership in the SQL itself.

## Patterns applied, and why

- **Modular monolith** — one backend deployment, organized by feature module.
  Simpler to run and reason about than a separate API service, until there's
  a demonstrated reason to split it out.
- **BFF credential boundary, no separate proxy** — the same Next.js
  deployment terminates browser sessions and the API; there's no second HTTP
  hop just to keep credentials server-side.
- **Complete mediation** — every route goes through one centralized actor
  resolution + status check. A new route cannot accidentally skip
  authorization by construction, because it has no other way to reach the
  database.
- **Identity aggregate with serialized lifecycle** — one stable identity
  record per user; account creation and account deletion both lock and
  transition this same record, so they can't race each other.
- **Transaction-bound capability for deletion** — account deletion requires
  a short-lived, single-use, freshly-authenticated challenge. A normal
  access token is never treated as proof of a *recent* login.
- **Leased work with fencing tokens** — any background job (like processing
  a deletion) claims work with an expiring lease and a generation number, so
  a stale/resumed worker can't silently overwrite newer progress.
- **Consumer-driven contracts for mobile** — before changing the API,
  replay it against frozen request/response fixtures from already-published
  mobile app versions, so a backend change can't silently break an app
  someone already has installed.

## Code sharing (web ↔ mobile)

Share: Zod schemas, pure business logic, the typed API client, TanStack
Query definitions, design tokens.

Do NOT force-share: screens, navigation, credential storage, deep links,
platform-specific UI.

## Full detail

The complete reasoning, database schema, auth flow, folder structure, and
testing strategy are in `decisions/0001-stack.md` (the full debate output).
This file is the summary a coding agent should work from day to day.
