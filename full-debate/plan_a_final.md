# Decision

I would keep **Next.js, Expo, and Supabase**, but change one important part of my previous design:

> **Make the Next.js API the exclusive product-data boundary. Use Drizzle to access Supabase Postgres from the server, rather than exposing product tables through Supabase’s Data API.**

The other architect is right that a client-accessible database API complicates authoritative TypeScript workflows. They are not right that solving this requires a separate Fastify deployment, Neon, and Auth0.

My revised defaults are:

| Concern | Choice |
|---|---|
| Web | Next.js App Router, Tailwind, shadcn/ui |
| Mobile | Expo, React Native, Expo Router |
| Backend | Next.js Route Handlers, Node runtime, modular monolith |
| Database | Supabase Postgres |
| Database access | Drizzle, reviewed SQL migrations, server-only database credentials |
| Authentication | Supabase Auth |
| Browser sessions | Supported Supabase SSR integration; JavaScript-readable credentials explicitly acknowledged |
| Mobile sessions | Supabase SDK with a tested SecureStore-backed adapter |
| Shared code | TypeScript, Zod contracts, typed HTTP client, TanStack Query |
| Repository | pnpm workspaces |
| Deployment | Vercel, Supabase, EAS |
| Testing | Vitest, local Supabase, Playwright, Maestro |
| Factory | Versioned working starter, repository specifications, executable checks |

```text
Browser ── cookies ──┐
                     ├── Next.js API ── Drizzle ── private Postgres schema
Expo ─── bearer ─────┘         │
                              └── verified identity from Supabase Auth

Browser / Expo ─────────────────── Supabase Auth
```

**Clients can authenticate with Supabase. They cannot read or write product tables through Supabase.**

This keeps one backend deployment and one database/auth provider, while giving application services a clear transaction and authorization boundary.

It also changes the trade-off: **database RLS is no longer the default protection against application authorization bugs.** Scoped queries and negative integration tests become mandatory.

---

# 1. What I would adopt from the other plan

## 1.1 An exclusive product API

This is the most valuable improvement.

The previous architecture had two paths:

```text
Client → Next.js service → database
Client → Supabase Data API → database
```

That required critical entitlements, quotas, transitions, and audit requirements to survive the second path—often by implementing them in SQL.

That is reasonable for a database-centric application. It is less attractive for a reusable factory whose business logic is supposed to live primarily in shared TypeScript and backend services.

The revised design has one product-data path:

```text
Client → Next.js API → application service → database
```

Postgres still owns constraints and concurrency-safe integrity. Services own workflows.

## 1.2 Explicit transaction ownership

Use Drizzle transactions directly from services.

A transaction should be visible in the workflow that needs it, rather than hidden inside a repository method that cannot compose with another operation.

## 1.3 Scoped repository functions

Adopt names such as:

```ts
findOwnedProject(db, actorId, projectId);
updateOwnedProject(db, actorId, projectId, changes);
listOwnedProjects(db, actorId, pagination);
```

Avoid a general-purpose `findById()` that invites callers to forget ownership.

## 1.4 A testable revocation matrix

Authentication behavior should be a tested table, not a paragraph saying “logout invalidates the session.”

Document separately:

- Local credential removal.
- Refresh-session revocation.
- Existing access-token validity.
- Application suspension.
- Provider logout.
- Account deletion.

## 1.5 Durable account deletion

Deleting a database row and deleting an identity are not one atomic transaction.

Adopt a small, retryable deletion workflow. That does not require a general-purpose job platform in the starter.

## 1.6 Authentication certification gates

Keep explicit release tests for:

- Concurrent refresh.
- Large stored sessions.
- Cross-device verification and recovery.
- Actual native callbacks.
- App restart.
- Logout and account switching.
- Compatibility with previously released mobile clients.

“Official SDK” is a sensible implementation choice, not proof that the integration works.

---

# 2. Concrete weaknesses in the competing plan

Their revised plan is credible. My disagreements are mostly about which costs deserve to be mandatory.

## 2.1 It bundles independent decisions together

These are separate choices:

1. Whether browsers can access credentials.
2. Whether clients can access database endpoints.
3. Whether the backend has its own deployment.
4. Whether the database and identity providers are separate vendors.

You can have an exclusive product API and ordinary SQL transactions inside Next.js. You can also implement a BFF in the same deployment.

Fastify does provide independence from Next.js and a good standalone HTTP framework. But it is not necessary for either transaction correctness or a modular monolith.

For this factory, the additional deployment is a cost before it is a demonstrated requirement.

## 2.2 The BFF creates another route surface

The design maintains:

```text
Browser-facing BFF routes
Backend API routes
Generated contracts/client
```

An explicit BFF allowlist is safer than an unrestricted proxy, but now route additions, errors, headers, cancellation, payload limits, and compatibility need attention in two places.

The BFF should not duplicate business rules, but it can still drift operationally.

That is manageable. It is not free.

## 2.3 Auth0 is a strong security choice with a real commercial dependency

The HttpOnly browser boundary is genuinely stronger against credential extraction. I would not dispute that.

However, the factory should validate the required Auth0 features, production/nonproduction arrangement, quotas, and pricing **before** standardizing on it across multiple products.

The important distinction is:

> Auth0’s browser credential boundary is a reason to choose it. It is not evidence that every other architectural choice in the plan is necessary.

## 2.4 A single ingress is not automatic authorization

Their repositories are correctly scoped, but one new unscoped query can still disclose another user’s data.

Neither “centralized authorization” nor “repository pattern” prevents that by itself.

Their design—and my revised design—needs:

- Narrow query interfaces.
- Ownership predicates in database operations.
- Cross-user tests for every access path.
- Explicit review of exports, search, bulk operations, and admin endpoints.

Removing client database access simplifies the boundary, but does not eliminate IDOR vulnerabilities.

## 2.5 OpenAPI generation is not yet earning its place

For two first-party TypeScript clients, shared Zod contracts and named HTTP methods are sufficient initially.

The generated pipeline adds:

- Schema conversion.
- Generated artifacts.
- Drift checks.
- Version compatibility among libraries.
- Potential divergence between runtime transformations and wire schemas.

Their plan handles these risks thoughtfully. I would still defer the machinery until API size or external consumers justify it.

## 2.6 Their custom PostgreSQL worker is more infrastructure than it appears

A reliable worker needs more than `FOR UPDATE SKIP LOCKED`:

- Expiring leases.
- Retry policy.
- Idempotency.
- Poison-job handling.
- Observability.
- Shutdown behavior.
- Recovery from partial external effects.

For a narrow deletion workflow, a small state machine is appropriate. For general asynchronous product work, I would usually buy a managed execution service before maintaining a queue framework.

## 2.7 A mandatory always-on API costs money and attention

Render plus Vercel is not an unreasonable stack. But it introduces another environment, deployment, runtime configuration, and availability dependency for every product.

I would accept that when backend independence becomes valuable—not because a seasoned architecture must have a separate API service.

---

# Part 1 — The application factory

# 3. What the factory actually is

The factory is:

1. A **working reference application**.
2. A **versioned starter repository**.
3. A **repeatable specification and implementation process**.
4. A **small recipe library** for optional capabilities.
5. A **backport process** for important fixes.

It is not a shared production platform.

Each generated product gets its own:

- Repository.
- Supabase project and environment separation.
- Vercel deployment.
- Mobile identifiers.
- Secrets.
- Release lifecycle.
- Operating budget.

Share source and lessons. Do not share production credentials or couple unrelated products’ availability.

---

# 4. Persistent planning and agent context

## 4.1 Repository documents are the source of truth

```text
AGENTS.md
README.md

docs/
  product.md
  architecture.md
  data-model.md
  security.md

  decisions/
    0001-stack.md
    0002-identity-and-ownership.md

  features/
    001-private-projects.md

  work/
    current.md

  runbooks/
    local-development.md
    deployment.md
    incidents.md
    backup-and-restore.md

  feedback/
    lessons.md

.factory/
  template.json
```

Keep the responsibilities distinct:

| File | Purpose |
|---|---|
| `product.md` | User, problem, workflows, MVP, non-goals |
| `architecture.md` | Components, request flow, dependencies, transaction ownership |
| `data-model.md` | Entities, constraints, ownership, deletion |
| `security.md` | Trust boundaries, authorization, session semantics, limitations |
| `decisions/` | Important choices and conditions for revisiting |
| `features/` | Implementable behavior and acceptance tests |
| `work/current.md` | Current verified state and next task |
| `runbooks/` | Commands for operating and recovering the app |
| `feedback/lessons.md` | Evidence for changing the factory |

Do not preserve every chat transcript. Preserve decisions and executable requirements.

## 4.2 Root agent instructions

```md
# AGENTS.md

## Read first
- docs/product.md
- docs/architecture.md
- docs/security.md
- docs/work/current.md
- The assigned feature specification

## Boundaries
- Browser/mobile code cannot import server or database modules.
- Domain code cannot import HTTP, database, or platform modules.
- Product data is accessible only through the application API.
- Every private resource query must enforce ownership.
- Never accept ownership, role, or entitlement from client input.
- Never use migration/admin credentials for ordinary requests.
- Database changes require new reviewed migrations.
- Never edit an already-deployed migration.
- Do not add infrastructure without documenting why.

## Completion
- Acceptance criteria implemented
- Relevant checks run
- Unrun checks explicitly reported
- Documentation updated where behavior changed
- docs/work/current.md updated
```

Keep Cursor/editor-specific configuration small and point it here.

## 4.3 Feature specification

```md
# Create and retrieve a private project

## Outcome
A signed-in user can create a project on one client and retrieve
it on the other.

## Acceptance criteria
- Name is trimmed and 1–100 characters.
- Unauthenticated requests return 401.
- Ownership comes from verified identity.
- Another user cannot read, modify, or delete the project.
- Product tables cannot be accessed through Supabase's Data API.
- Both clients display validation and network errors.
- Failed submission preserves form input.

## Implementation
- Migration
- POST /api/v1/projects
- GET /api/v1/projects
- Shared schemas and client methods
- Web and native forms

## Tests
- Success
- Invalid input
- Missing authentication
- Cross-user access
- Forged owner field
- Expired session
- Direct database API denied

## Out of scope
Sharing, billing, offline editing.

## Open questions
None.
```

## 4.4 Handoff file

```md
# Current work

Feature: docs/features/001-private-projects.md
Branch: feature/private-projects
Last verified commit: ...

Complete:
- Migration and API
- Cross-user tests
- Web form

Next:
- Connect native form
- Run device smoke test

Verified:
- pnpm typecheck: passed
- pnpm test:integration: passed
- Native build: not run

Blockers:
None.
```

## 4.5 Planning-to-implementation loop

1. Discuss the feature.
2. Produce repository-ready specification changes.
3. Resolve ownership, permissions, and destructive behavior.
4. Commit the specification.
5. Assign one vertical slice.
6. Review implementation and actual test results.
7. Deploy.
8. Record lessons.

Example assignment:

> Read `AGENTS.md` and feature 001. Implement project creation and retrieval on API, web, and mobile. Include cross-user tests. Do not add collaboration, offline sync, or infrastructure. Report checks run and update the handoff.

Require human approval for production configuration changes, destructive migrations, and credential provisioning.

---

# 5. Concrete scaffold

```text
apps/
  web/
    src/
      app/
        (public)/
        (authenticated)/
        auth/
          callback/route.ts
        api/
          v1/
            me/route.ts
            me/bootstrap/route.ts
            me/deletion/challenge/route.ts
            me/deletion/confirm/route.ts
            projects/route.ts
            projects/[id]/route.ts
          internal/
            account-deletions/route.ts

      components/
      features/

      lib/
        api.ts
        supabase/
          browser.ts
          server.ts
          refresh.ts

      server/
        env.ts
        http/
          authenticate.ts
          csrf.ts
          errors.ts
          request-context.ts
        modules/
          users/
            service.ts
            queries.ts
          projects/
            service.ts
            queries.ts
          items/
            service.ts
            queries.ts
        integrations/
          identity-admin.ts
        maintenance/
          process-account-deletions.ts

  mobile/
    app/
      (auth)/
      (authenticated)/
      auth/callback.tsx
    src/
      components/
      features/
      lib/
        api.ts
        supabase.ts
        secure-session-storage.ts

packages/
  contracts/
  domain/
  api-client/
  query/
  database/
    src/
      schema/
      client.ts
    migrations/
  design-tokens/
  config/

supabase/
  config.toml
  seed.sql

tests/
  integration/
  web/
  mobile/

scripts/
  doctor.ts
  init-product.ts
  check-boundaries.ts

recipes/
upgrade-guides/
docs/

.github/workflows/
  ci.yml
  deploy.yml

.env.example
AGENTS.md
pnpm-workspace.yaml
package.json
```

Use feature modules without extracting every module into its own workspace package.

### Dependency rules

```text
contracts  → Zod
domain     → pure TypeScript
api-client → contracts
query      → api-client + TanStack Query

web/mobile clients → contracts, domain, api-client, query
web server          → contracts, domain, database
database            → Drizzle + Postgres driver
```

Enforce with:

- Package exports.
- ESLint import restrictions.
- `server-only` markers in Next.js server modules.
- Separate public/server environment modules.
- CI boundary checks.

Pin a compatible Next.js/React/Expo combination. Do not independently install arbitrary “latest” versions.

---

# 6. What the starter must ship

The reference application must implement:

- Signup and email verification.
- Login.
- Password recovery.
- Browser and native session persistence.
- Refresh and logout.
- OAuth callback plumbing.
- Idempotent profile bootstrap.
- Private project/item CRUD.
- Cross-user authorization tests.
- Direct Data API denial tests.
- Account deletion.
- Loading, empty, error, and expired-session states.
- CI and deployment.
- Error reporting.
- Backup/restore runbook with a completed exercise.

Provide:

```bash
pnpm factory:init
pnpm doctor
pnpm db:migrate
pnpm dev
pnpm check
```

The initializer updates:

- Product and package names.
- Bundle/application identifiers.
- URL schemes.
- Domains and public configuration placeholders.
- Template provenance.

```json
{
  "templateVersion": "1.0.0",
  "templateCommit": "abc123",
  "createdAt": "2026-09-26"
}
```

It must not copy secrets or silently provision billable resources.

The doctor command checks configuration and tooling without printing credentials.

---

# 7. Factory evolution

Maintain:

```text
app-factory/
  template/
  recipes/
  upgrade-guides/
  advisories/
  CHANGELOG.md
```

After shipping:

| Finding | Action |
|---|---|
| Security/correctness bug | Fix, regression test, advisory, backport |
| Repeated useful capability | Add a recipe |
| Proven broadly useful capability | Promote into the default |
| Product-specific behavior | Keep in the product |
| Speculative abstraction | Do not add |

Recipes should cover:

- Workspace tenancy.
- Billing.
- Uploads.
- Push notifications.
- Durable jobs/outbox.
- Offline synchronization.
- OpenAPI generation.
- Database RLS.
- HttpOnly browser authentication.

Template updates do not automatically update existing products. Track active products and send reviewed backport PRs.

Periodically initialize a product into a clean directory and build it. A healthy reference repository does not prove that its generator still works.

---

# Part 2 — The reference architecture

# 8. Stack rationale

## Web: Next.js

Use Next.js for:

- Public pages.
- Authenticated web UI.
- Server rendering where useful.
- Authentication callbacks.
- The shared product API.

Use Route Handlers with the **Node runtime** for database access.

Do not implement a second set of product mutations in Server Actions. Server-rendered reads may call the same authenticated service functions directly; browser and native mutations use the API.

## Mobile: Expo

Expo Router and EAS provide a maintainable path to native builds, navigation, and distribution.

Use development builds early. Do not certify authentication from Expo Go alone.

## Database and identity: Supabase

Supabase provides managed Postgres, Auth, and a useful local development environment.

We deliberately do **not** use every Supabase feature:

- Auth is client-accessible.
- Product tables are private.
- Ordinary product requests use SQL from the server.
- Storage is installed only when needed.

This avoids another database vendor without making the database API part of the public application contract.

## Data access: Drizzle

Drizzle gives typed SQL-oriented access without hiding transactions.

Use `postgres-js` with the provider’s appropriate pooled runtime connection. For transaction-pooling configurations that do not support prepared statements, configure the driver accordingly.

Keep connection counts small and bounded. A serverless deployment can create many independent pools.

Use separate credentials for:

- Runtime queries.
- Migrations.
- Identity administration.

## Shared state and validation

- Zod for wire contracts.
- React Hook Form for forms.
- TanStack Query for server state.
- Pure TypeScript for reusable domain calculations.

---

# 9. Code sharing

Share:

- Request and response schemas.
- Public enums.
- Pure domain rules.
- API methods.
- Error parsing.
- Query keys and query options.
- Platform-independent formatting.
- Design tokens.

Do not force sharing of:

- Screens.
- Navigation.
- Browser/native credential storage.
- Deep links.
- File pickers.
- Push handling.
- Platform-specific accessibility.

Example:

```ts
import { z } from "zod";

export const CreateProjectInput = z.object({
  name: z.string().trim().min(1).max(100),
}).strict();

export const ProjectDto = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
});

export type CreateProjectInput =
  z.infer<typeof CreateProjectInput>;
```

Both clients validate for feedback. The backend validates independently.

Database rows are not public DTOs. Dates cross the wire as strings; monetary values use an explicitly chosen integer/decimal representation.

### Typed client

```ts
api.projects.create(input);
api.projects.list({ cursor, limit });
api.projects.get(id);
```

Inject platform transport:

```ts
createApiClient({
  baseUrl,
  getAccessToken,
  credentials,
});
```

- Browser: same-origin URL and cookies.
- Native: HTTPS URL and bearer token.

Parse successful responses with the corresponding schema. Normalize failures centrally. Support cancellation and bounded timeouts.

Do not automatically retry arbitrary mutations.

### Cache isolation

On logout or account change:

1. Cancel private requests.
2. Dispose of or clear the previous account’s query client.
3. Clear persisted private state.
4. Prevent late responses from repopulating the old account’s cache.

A fresh query client per authenticated account lifetime is simpler than carefully editing every cache key.

Never share an authenticated SSR query cache across users.

---

# 10. Authentication end to end

## 10.1 Responsibilities

**Supabase Auth owns:**

- Password hashing and verification.
- Verification and recovery.
- OAuth identity integration.
- Access and refresh tokens.
- Provider-managed sessions.

**The application owns:**

- Profiles.
- Account status.
- Ownership and permissions.
- Entitlements.
- Deletion.
- Product-data access.

Do not create your own password or refresh-token tables.

## 10.2 Browser credential decision

Use the supported `@supabase/ssr` integration for the pinned Next.js version, including its refresh boundary.

**Its standard browser integration uses JavaScript-accessible session credentials. This is not an HttpOnly BFF.**

That is a real disadvantage compared with the competing plan.

Mitigate with:

- A restrictive, tested CSP.
- Minimal third-party scripts.
- No unsafe HTML rendering.
- Dependency updates.
- Secure cookie configuration.
- Redacted logs and monitoring.

These controls reduce risk; they do not make the credential boundary equivalent to HttpOnly.

For highly sensitive products, make a reviewed HttpOnly/BFF recipe a prerequisite. Do not attempt to obtain it by changing one cookie flag and breaking the browser SDK.

I retain the supported Supabase integration here because it minimizes authentication integration work for the ordinary personal-product default. This decision must be visible in `security.md`, not buried.

## 10.3 Native credential storage

Use the Supabase SDK with a SecureStore-backed storage adapter.

The starter must contain the actual implementation and tests:

- No refresh credentials in AsyncStorage.
- No silent plaintext fallback.
- Realistic large sessions tested on iOS and Android.
- Tested handling of storage-size limitations.
- PKCE verifier persistence.
- Foreground/background refresh lifecycle.
- App-restart behavior.
- Concurrent refresh behavior.
- No biometric prompt on every routine renewal.

Avoid storing unnecessary provider tokens or oversized metadata. If the chosen storage strategy cannot reliably persist a realistic session, the starter is not certified for release.

## 10.4 Signup

1. Client validates email/password.
2. Client sends them directly to Supabase Auth over TLS.
3. Supabase creates the identity and sends verification.
4. UI displays “check your email.”
5. The allowlisted callback completes the configured verification flow.
6. The SDK establishes a session where that flow supports it.
7. Client calls `POST /api/v1/me/bootstrap`.
8. Backend verifies the Supabase identity.
9. Backend creates the application profile idempotently.
10. Client loads private data.

Test verification in the same browser and on another device.

Some PKCE flows require the initiating client’s verifier. Provide a supported “verified—return to login” fallback rather than assuming every link can establish a session on every device.

## 10.5 Browser login and requests

1. Browser calls `signInWithPassword`.
2. Supabase verifies the password.
3. The SSR-compatible client persists the session.
4. Browser calls `/api/v1/projects`.
5. Route constructs a request-scoped Supabase auth client.
6. Route verifies identity using `auth.getUser()` as the initial default.
7. Route loads application account status.
8. Route parses input.
9. Service executes scoped SQL queries.
10. Route returns a DTO.

Do not treat a locally decoded token or `getSession()` result as sufficient server authentication.

Ensure refresh responses propagate updated cookies, including relevant redirects and error paths.

## 10.6 Native login and requests

1. Native SDK signs in.
2. Session is persisted securely.
3. Shared transport gets the current access token.
4. Request sends `Authorization: Bearer …`.
5. Backend verifies it with the configured Supabase project.
6. Backend loads application account status.
7. The same services run.

An explicitly supplied invalid bearer token must fail. It must not fall back to a valid browser cookie.

Never reuse a mutable authenticated Supabase client across requests.

## 10.7 Verification cost and semantics

`getUser()` adds an identity-provider request. Accept that initially and measure it.

Later, supported local JWT verification can reduce that cost, provided it checks the expected issuer, audience, signature, timing, and permitted algorithms, with key rotation support.

Neither approach should be described as a blanket guarantee of immediate refresh-session revocation enforcement.

Application suspension is separate: the API checks current application status on each request. Avoid caching status initially.

## 10.8 Refresh and logout

Let the SDK manage token renewal and rotation. Do not implement a competing refresh-token mechanism in the API client.

| Action | Expected effect |
|---|---|
| Local sign-out | Remove local credentials and private caches |
| Revoke this refresh session | Prevent that session from renewing |
| Revoke all refresh sessions | Prevent the targeted sessions from renewing |
| Existing access JWT | May remain valid until expiry |
| Application suspension | New API requests rejected after status check |
| Identity-provider browser logout | Provider-specific; not implied by local logout |

An already-running request may finish during suspension. A critical financial or destructive transaction may need to recheck status within its transaction.

Transient network failure should not erase a recoverable session. Definitive renewal failure should clear unusable credentials and prompt login.

## 10.9 Social login

Start with Google if useful; add Apple when product requirements or platform rules call for it.

Use the supported authorization-code/PKCE flow:

1. Open the system authentication browser.
2. Authenticate with the provider.
3. Return through Supabase.
4. Redirect to the registered application callback.
5. Complete code exchange.
6. Establish session.
7. Bootstrap the profile.

Use exact allowlists and safe post-login destinations. Prefer verified Universal Links/App Links where supported.

Do not put access tokens in application query strings. Do not link accounts merely because client-provided email addresses match.

## 10.10 Recovery

1. Request reset email.
2. Show a non-enumerating response.
3. Complete the configured recovery callback.
4. Establish the permitted recovery session.
5. Update the password through Supabase.
6. Apply the documented session-revocation behavior.

Test expired/reused links and different-device behavior. A recovery session should not accidentally become an unrestricted bypass of any application-level verification requirements.

---

# 11. Database design and access boundary

## 11.1 Default entities

```text
auth.users                 Supabase-managed identities
auth.sessions              Supabase-managed sessions

app.users                  Product profile and account status
app.projects               User-owned primary resource
app.items                  Child resource

app.account_deletions      Durable deletion workflow
```

Use a private `app` schema that is **not listed among Data API exposed schemas**.

Also revoke access from public/client database roles. Schema non-exposure and database privileges are complementary controls.

Disable the Data API if the product does not need it and the project configuration supports doing so without affecting required services. Correct privileges remain necessary regardless.

## 11.2 Example schema

The reviewed migration should create the equivalent of:

```sql
create schema app;

create table app.users (
  id uuid primary key
    references auth.users(id) on delete cascade,
  display_name text
    check (char_length(display_name) <= 100),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'deletion_pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null
    references app.users(id) on delete cascade,
  name text not null
    check (
      name = btrim(name)
      and char_length(name) between 1 and 100
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_created_idx
  on app.projects(owner_id, created_at desc, id desc);

create table app.items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references app.projects(id) on delete cascade,
  title text not null
    check (
      title = btrim(title)
      and char_length(title) between 1 and 200
    ),
  status text not null default 'todo'
    check (status in ('todo', 'doing', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_project_created_idx
  on app.items(project_id, created_at desc, id desc);
```

Maintain `updated_at` with a small migration-managed trigger.

Keep email in the identity provider unless the product needs a separate contact address.

Do not automatically add workspaces, soft deletion, event sourcing, or generic audit tables.

## 11.3 Database roles

Create a dedicated `app_runtime` login:

- No superuser privileges.
- No `BYPASSRLS`.
- No schema creation or migration privileges.
- No access to provider-managed auth tables.
- Only required privileges on application tables and sequences.

The migration role owns schema changes. Ordinary handlers never receive its connection string.

Apply explicit grants and default privileges for future objects. Revoke unintended function execution privileges as well as table access.

An elevated Supabase API key is **not** the runtime SQL credential.

## 11.4 Ownership queries

Project update:

```sql
update app.projects
set name = $1
where id = $2
  and owner_id = $3
returning id, name, created_at;
```

Item access:

```sql
select i.*
from app.items i
join app.projects p on p.id = i.project_id
where i.id = $1
  and p.owner_id = $2;
```

Create or reparent an item only through an operation that proves ownership of the destination project.

Never spread client input into an insert/update. Explicitly map allowed fields.

## 11.5 Where rules belong

| Rule | Authority |
|---|---|
| Request shape | API schema |
| User identity | Verified auth boundary |
| Account status | Application database, checked by API |
| Resource ownership | Scoped SQL operation |
| Workflow/entitlement decision | Application service |
| Uniqueness and referential integrity | Database constraints |
| Concurrency-sensitive balance/quota | Transaction plus locks/atomic SQL |
| Client preview | Shared pure domain function; not authoritative |

A transaction does not fix an unlocked check-then-insert race.

For example, enforcing a per-user count quota requires appropriate serialization—such as locking a stable owner row before counting and inserting—not merely wrapping both statements in a transaction.

## 11.6 RLS decision

RLS is an optional defense-in-depth recipe, not a decorative checkbox.

Installing it requires:

- A non-bypass runtime role.
- Transaction-local verified identity context.
- Pooling tests proving identity does not leak between requests.
- Explicit worker/admin behavior.
- Actual policy isolation tests.

The default has a clear limitation: a backend bug can issue an unscoped query. The factory mitigates this through narrow query functions, boundaries, and tests, but does not claim those are equivalent to database-enforced ownership.

For higher-sensitivity products, install and certify the RLS recipe before launch.

## 11.7 Migrations

Use Drizzle schema definitions with reviewed generated/custom SQL migrations. Commit both.

Run migrations through one controlled deployment workflow using the appropriate migration connection, not from every server instance.

Use expand-and-contract:

1. Add compatible schema.
2. Deploy compatible code.
3. Backfill.
4. Add stricter constraints.
5. Remove old behavior after the mobile support window.

Do not edit deployed migrations or make untracked production dashboard changes.

---

# 12. Account deletion

Deletion is a narrow built-in durable workflow.

## 12.1 Step-up confirmation

Do not treat a recently refreshed access token as proof of recent user authentication.

For this starter, require a verified email address and use a fresh email OTP confirmation for account deletion:

1. Authenticated user requests deletion confirmation.
2. Backend obtains the verified email from Supabase, not request JSON.
3. Backend initiates the supported email OTP flow with account creation disabled.
4. User submits the code.
5. Backend verifies it using an isolated auth client.
6. Verified identity must equal the originally authenticated user.
7. Backend authorizes only the deletion operation.

Rate-limit requests and attempts. Do not return the temporary verification session to the client; revoke/clean it up through the supported SDK behavior.

This is a concrete default for verified-email accounts. Products supporting identities without verified email need a different tested step-up recipe.

## 12.2 Durable state machine

In one database transaction:

1. Mark the application user `deletion_pending`.
2. Insert a unique deletion request.

The API immediately rejects subsequent ordinary requests for that user.

A scheduled maintenance handler then:

1. Claims a small batch with an expiring lease.
2. Performs external cleanup.
3. Deletes the Supabase identity using the server-only admin integration.
4. Lets relational cascades remove owned product data.
5. Marks the deletion request complete.

Keep the workflow record independent of the identity’s cascading foreign keys so it survives long enough to record completion.

Treat “identity already absent” as success. Make every step retryable.

For the starter, invoke a bounded handler through **Vercel Cron**, authenticated with its configured server secret. Verify schedule and execution-limit support in the selected hosting plan.

Uploads and billing recipes must extend the deletion workflow. Database cascades do not remove files, cancel subscriptions, or erase backups.

---

# 13. Patterns that earn their place

## Modular monolith

One backend deployment, organized by capability.

**Why:** simple operations, local transactions, understandable code.

## Layered architecture

```text
Route → application service → scoped query functions → Postgres
```

- Route: authentication, CSRF, validation, HTTP mapping.
- Service: workflow, permission decisions, transaction ownership.
- Queries: explicit scoped SQL.
- Database: durable integrity.

Do not add a forwarding service layer to every trivial read.

## Functional core, imperative shell

Pure calculations and decisions live in `packages/domain`.

Clients use them for previews. Services recompute authoritative results.

## Lightweight repository pattern

Feature-specific query functions isolate persistence without pretending all databases are interchangeable.

No `BaseRepository<T>`, generic CRUD framework, or dependency-injection container.

## Selective dependency inversion

Small adapters make sense for:

- Identity administration.
- Billing.
- Email.
- Storage.
- External APIs.
- Time, where deterministic tests need it.

Do not create an interface for every module.

## Idempotency and transactional outbox

Use idempotency keys for duplicate-sensitive operations.

When a committed database change must reliably cause an external action, add an outbox or equivalent durable delivery mechanism.

A post-response promise is not reliable background execution.

These are optional recipes until an actual feature needs them.

---

# 14. API conventions

```text
POST   /api/v1/me/bootstrap
GET    /api/v1/me

POST   /api/v1/me/deletion/challenge
POST   /api/v1/me/deletion/confirm

GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id
PATCH  /api/v1/projects/:id
DELETE /api/v1/projects/:id

GET    /api/v1/projects/:id/items
POST   /api/v1/projects/:id/items
```

Defaults:

- Parse paths, queries, and bodies.
- Reject unexpected write fields.
- Derive ownership from verified identity.
- Cap body and page sizes.
- Use cursor pagination with stable `(created_at, id)` ordering.
- Return explicit DTOs.
- Return `404` for inaccessible private resources where appropriate.
- Never expose raw SQL or provider errors.

Error contract:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Check the highlighted fields.",
    "fieldErrors": {
      "name": ["Name is required."]
    },
    "requestId": "..."
  }
}
```

Use consistent `400`, `401`, `403`, `404`, `409`, `429`, and `500` mappings. Clients branch on stable codes, not prose.

Preserve `/api/v1` compatibility for supported native releases. Adding a database column does not require a new API version; changing a public field’s meaning might.

---

# 15. Security controls

## Secrets

- Public Supabase identifiers are public configuration.
- Runtime DB credentials, admin keys, SMTP credentials, and cron secrets are server-only.
- Nothing secret enters `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`.
- Validate environment configuration.
- Keep privileged integrations separate from ordinary query modules.

## CSRF

For cookie-authenticated product mutations:

- Require an exact allowed `Origin`.
- Reject missing/unexpected origins.
- Accept intended content types only.
- Never mutate through GET.

Bearer-authenticated native requests do not rely on browser cookies. An invalid bearer token must not silently select the cookie path.

Follow the provider’s supported authentication callback behavior separately.

## CORS

Do not configure permissive CORS for native apps; native HTTP does not require it.

Enable cross-origin browser access only when a product actually needs it.

## Caching

Explicitly prevent authenticated pages and responses from entering shared public caches.

Do not rely on framework defaults remaining unchanged between versions.

## Rate limiting

Use:

- Supabase Auth’s configured abuse controls.
- CAPTCHA when justified.
- A small Upstash Redis-backed limiter for application writes and abuse-sensitive endpoints.

Document outage behavior:

- Sensitive/costly operations fail closed with an availability error.
- Low-risk reads may use a conservative local fallback, explicitly not a global limit.

Use hosting-provided trusted client-IP information. Do not trust arbitrary forwarded headers.

Because product tables are no longer client-accessible, application data traffic cannot bypass the API limiter through PostgREST.

## Resource bounds

Set limits for:

- Request bodies.
- Pagination.
- Database statement duration.
- HTTP timeouts.
- Outbound requests.
- Expensive third-party API spending.

## Upload recipe

Use Supabase Storage when required:

- Private buckets.
- No blanket client permissions.
- Server authorization before issuing scoped signed URLs.
- Server-generated object keys.
- Short expirations.
- Size enforcement and post-upload validation.
- Quarantine/scanning where files are redistributed.
- Orphan cleanup.
- Account-deletion integration.

A signed upload URL does not by itself make uploaded content trustworthy.

---

# 16. Testing strategy

## 16.1 Unit tests: Vitest

Prioritize:

- Shared schemas.
- Domain rules.
- DTO/error mapping.
- API-client parsing.
- Retry and cancellation behavior.
- Query/cache isolation behavior.

Do not optimize for a coverage percentage.

## 16.2 Database/API integration

Run local Supabase and apply the real migrations.

Execute ordinary API queries with the **runtime database role**, not the migration superuser.

Mandatory cases:

- Unauthenticated access denied.
- Cross-user read/update/delete denied.
- Forged owner fields rejected.
- Reparenting into another user’s project rejected.
- Invalid stored values rejected.
- Bootstrap is concurrency-safe.
- Transaction failures leave no partial state.
- Suspended/deletion-pending users denied.
- Stable pagination.
- Deletion retries and lease recovery.
- Runtime role cannot alter schema or access auth tables.
- Supabase Data API cannot access product tables.

That last test protects the new architectural boundary.

## 16.3 Authentication integration

Test actual cookie and bearer requests, not only mocked actors.

Cover:

- Invalid/expired tokens.
- Token from the wrong Supabase project.
- Invalid bearer plus valid cookie.
- Refresh and concurrent requests.
- Verification/recovery callbacks.
- CSRF rejection.
- Session persistence.
- Logout/account switching.
- Revocation behavior matrix.

Use a small hosted nonproduction suite for real OAuth and deployment-specific behavior.

## 16.4 End-to-end

**Playwright:**

1. Signup/verification.
2. Login.
3. Create and retrieve private data.
4. Reload with session persistence.
5. Logout and lose access.
6. Confirm private data is not publicly cached.

**Maestro:**

1. Login/callback.
2. Core workflow.
3. Restart.
4. Expiry/refresh.
5. Logout/account switch.

Run native smoke tests on release candidates or scheduled builds, not every documentation PR.

---

# 17. CI/CD and environments

## PR pipeline

```text
Frozen-lockfile install
→ lint and boundary checks
→ typecheck
→ unit tests
→ local Supabase startup
→ migrations
→ database/API integration tests
→ web production build
→ web smoke tests
→ Expo dependency/configuration checks
→ secret scanning
```

Add migration-from-previous-version tests when a release changes existing schema.

Use Renovate or Dependabot with reviewed updates.

Periodically:

```text
Initialize clean product
→ doctor
→ migrations/tests
→ production web build
→ mobile bundle build
```

Hosted credentials and device tests belong in controlled pipelines, not untrusted fork PRs.

## Environments

Per product:

- Local Supabase.
- One isolated hosted nonproduction environment.
- Production.
- EAS development, preview, and production profiles.

Do not give production secrets to preview deployments. Do not allow arbitrary preview authentication callbacks.

## Release sequence

1. Apply backward-compatible migrations once.
2. Deploy compatible web/API.
3. Run smoke tests.
4. Release native builds when ready.
5. Remove old behavior only after the compatibility window.

EAS OTA updates are for compatible JavaScript/assets. Native dependency or runtime changes require new builds.

Web rollback, database restoration, and native recovery are different procedures.

---

# 18. Operations, scaling, and cost

## Monitoring

Include:

- Structured sanitized logs.
- Request IDs.
- Sentry releases and error reporting.
- Uptime checks.
- Error-rate/latency alerts.
- Deletion-workflow alerts.
- Spending alerts.

Never log passwords, cookies, refresh tokens, recovery links, or unnecessary personal data.

## Email

Use production SMTP through a transactional provider such as Resend.

Configure SPF/DKIM and domain settings. Test real verification and recovery delivery.

## Backups

Choose a Supabase backup/PITR configuration matching the required recovery objectives.

Perform a restore exercise before launch.

Verify:

- Data and schema.
- Database roles and grants.
- Application startup.
- Identity/application consistency.
- Effects of deletions or external actions after the restored point.

A database restore does not necessarily restore object contents or rewind billing and email. Document reconciliation.

## Scaling

Start with:

- Stateless handlers.
- Nearby API/database regions.
- Bounded pooled connections.
- Indexed ownership/filter/order queries.
- Cursor pagination.
- No N+1 queries.
- Short transactions.
- Statement timeouts.
- Atomic updates under contention.

Watch total connections across serverless instances; a small pool in each instance can still create a large aggregate.

When durable general-purpose jobs become necessary, add **Trigger.dev** and use a transactional outbox when reliable database-to-job delivery is required.

Extract a standalone API only when:

- Independent deployment is valuable.
- Backend workloads exceed the hosting model.
- Scaling characteristics diverge.
- Another team owns the backend.
- Next.js coupling becomes a demonstrated maintenance cost.

The HTTP contracts and framework-independent services make that extraction possible without prepaying for it.

## Cost discipline

Baseline services:

- Vercel.
- Supabase.
- EAS and app-store accounts.
- Transactional email.
- Monitoring.
- Small distributed rate-limiting usage.

Check current pricing, commercial-use terms, cron limits, connection limits, and backup availability.

Keep costs controlled by:

- Local development.
- One hosted nonproduction environment initially.
- No database per PR.
- Archiving abandoned products.
- Avoiding unnecessary always-on services.
- Setting spending limits on expensive integrations.

Do not replace managed authentication or database operations with custom infrastructure to save a small monthly bill.

---

# 19. Final evaluation

| Criterion | Assessment |
|---|---|
| **Security** | Managed identity, exclusive product API, least-privilege SQL role, scoped queries, negative tests. JavaScript-readable browser credentials and lack of default RLS remain explicit limitations. |
| **Scalability** | Stateless API, pooled Postgres, transaction support, clear path to managed jobs and later API extraction. |
| **Maintainability** | One backend deployment, feature modules, clear rule ownership, short durable docs, executable boundaries. |
| **Code reuse** | Shared contracts, domain rules, client methods, query definitions, and tokens—not forced shared screens. |
| **Velocity** | Supported auth SDKs, direct transactions, working reference slices, no mandatory BFF/API duplication or code-generation pipeline. |
| **Cost** | Fewer baseline deployments and vendors than the competing plan. |
| **Testing** | Focus on real identity boundaries, cross-user isolation, private database access, concurrency, and critical workflows. |

# Build order

1. Create repository conventions and executable boundaries.
2. Establish the private database schema and runtime role.
3. Implement browser and native authentication.
4. Ship one private CRUD workflow on both clients.
5. Prove cross-user isolation and Data API denial.
6. Add recovery, deletion, rate limits, and cache clearing.
7. Deploy to real hosting and real phones.
8. Test restoration and release procedures.
9. Build and test the initializer.
10. Tag the starter.
11. Ship the first actual product.
12. Improve the factory from evidence.

**The key revision is not “use more enterprise architecture.” It is “choose one authoritative product-data path.”**

Keep the deployment simple, make ownership explicit, share the code that genuinely transfers across platforms, and spend testing effort on the places where a small mistake exposes data or breaks sessions. The factory should remove repeated foundation work—not become a separate platform business you never intended to build.