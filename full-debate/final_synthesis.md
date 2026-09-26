# Architecture debate -- 2026-09-26 15:19

## 1) Recommended stack (web, mobile, backend, database, auth, hosting) with one line of reasoning each.

**Build a versioned, working starter—not a shared production platform. Use B’s browser-security and identity boundaries, A’s deployment simplicity and concrete database discipline, and the reviewer’s certification requirements.**

| Concern | Recommendation | Reasoning |
|---|---|---|
| Web | **Next.js App Router, TypeScript, Tailwind, shadcn/ui** | One deployment can serve public pages, the authenticated UI, authentication callbacks, and the product API. |
| Mobile | **Expo, React Native, Expo Router, EAS** | Strong native delivery tooling while sharing TypeScript contracts and business logic with web. |
| Backend | **Next.js Route Handlers, Node runtime; modular monolith** | One authoritative API and local database transactions without another service to deploy. |
| Database | **Neon PostgreSQL, Drizzle, reviewed SQL migrations** | Managed relational storage with explicit constraints and transactions; no client-accessible product database API. |
| Auth | **Auth0 Universal Login, official Next.js/native SDKs** | Managed passwords and native PKCE, with browser credentials inaccessible to JavaScript by default. |
| Hosting | **Vercel + Neon + Auth0 + EAS** | A small operational footprint with clear paths to independent backend deployment later. |
| Shared application code | **pnpm workspaces, Zod, typed HTTP client, TanStack Query** | Real cross-platform reuse without imposing shared screens or a code-generation pipeline. |
| Operational services | **Upstash rate limits, Sentry, production transactional email** | Abuse protection, diagnosability, and reliable verification/recovery are launch requirements, not later polish. |

```text
Browser ── HttpOnly session ──┐
                             ├── Next.js authentication boundary
Expo ───── bearer token ─────┘             │
                                          ▼
                                Policy-enforcing services
                                          │
                                Scoped persistence functions
                                          │
                                          ▼
                                      PostgreSQL
```

No browser/mobile database access. No parallel product mutation implementation in Server Actions. Server-rendered reads enter the same authenticated application boundary without making HTTP requests back to Next.js.

### What I kept and rejected

- **From A, kept:** one deployment, explicit SQL transactions, concrete constraints/indexes, working vertical slices, repository-based agent handoffs, and narrow optional recipes.
- **From A, rejected:** JavaScript-readable browser refresh credentials as the factory default, provider-user deletion cascades, and email OTP as universal deletion authorization. These are foundational security/lifecycle decisions, not inexpensive upgrades.
- **From B, kept:** HttpOnly browser sessions, application-owned user IDs, explicit identity mapping, locally verified access tokens, and separate browser/native authentication adapters.
- **From B, rejected:** allowing multiple identity mappings before linking is implemented, and leaving deletion step-up as a protocol sketch. The starter supports one identity per product user and ships an executable deletion protocol.
- **From the reviewer, kept:** all approval conditions, especially serialized identity lifecycle transitions, fenced workers, executable authorization boundaries, both-client builds, released-mobile contracts, and protected deployment.
- **Rejected from the broader proposals:** mandatory Fastify, OpenAPI generation, generic repositories, a custom general-purpose queue, shared UI screens, and speculative workspaces. None earns its recurring cost in this starter.

**Commercial gate:** verify Auth0’s current pricing, environment arrangements, session features, and authentication requirements before implementation. Do not assume free tiers fund a portfolio of production apps. Nevertheless, Auth0 is the selected default—not one of several unresolved alternatives.

---

## 2) Repo/folder structure for sharing code between web and mobile.

Each generated product has its own repository, production database, auth configuration, mobile identifiers, secrets, and release lifecycle.

```text
AGENTS.md
README.md
.factory/template.json
.env.example
pnpm-workspace.yaml

apps/
  web/
    src/
      app/
        (public)/
        (authenticated)/
        api/v1/
        api/internal/account-deletions/
        auth/step-up/start/
        auth/step-up/callback/
      features/
      components/
      server/
        auth/
          browser-session.ts
          verify-user-token.ts
          resolve-actor.ts
          step-up.ts
        application/
          execute-operation.ts
          operation-registry.ts
          users/
          projects/
          items/
        persistence/
          users.ts
          identities.ts
          projects.ts
          items.ts
          unit-of-work.ts
        integrations/
          identity-admin.ts
        maintenance/
          account-deletions.ts
          identity-reconciliation.ts
        http/
          csrf.ts
          errors.ts
          request-context.ts
        env.ts

  mobile/
    app/
    src/
      features/
      components/
      auth/
      platform/
        credentials.ts
        deep-links.ts
      api.ts

packages/
  contracts/                 # Zod input/output schemas and error contracts
  domain/                    # Pure calculations and rules
  api-client/                # Named HTTP methods; injected transport
  query/                     # Query keys/options, not a global QueryClient
  database/                  # Server-only Drizzle schema and migration files
  design-tokens/
  config/

tests/
  unit/
  integration/
  authorization/
  web/
  mobile/
  compatibility/
    mobile/<release>/        # Frozen released-client parsers and fixtures

docs/
  product.md
  architecture.md
  data-model.md
  security.md
  decisions/
  features/001-private-projects/
    spec.md
    plan.md
  work/current.md
  runbooks/
  feedback/lessons.md

tooling/
  init-product.ts
  doctor.ts
  check-boundaries.ts
  check-operation-inventory.ts

.github/workflows/
  ci.yml
  staging.yml
  production.yml
```

### Sharing contract

Share contracts, domain calculations, API methods, query definitions, error parsing, and design tokens. Keep navigation, screens, credential storage, deep links, and platform UI separate.

```ts
api.projects.create({ name });
api.projects.list({ cursor, limit });
api.projects.get(projectId);
```

The browser transport uses same-origin cookies. Native transport obtains an access token from the native credentials manager. Both validate response DTOs and expose the same error model.

**Do not export database rows as API types.** Dates are strings on the wire; ownership fields are absent from write DTOs.

### Make portability executable

Addressing reviewer **C4**:

- Shared packages expose explicit ESM entry points through `exports`; no deep imports.
- Consume workspace TypeScript source consistently: Next.js transpiles the shared packages, Metro resolves them using the pinned Expo-supported monorepo configuration.
- `domain` and `contracts` use an ES-only TypeScript environment, without Node or DOM globals.
- Inject transport into `api-client`; no imports of browser storage, Node networking, or native credentials.
- React-dependent packages declare React as a peer dependency, not a bundled dependency.
- Pin and test a compatible Next.js/React/Expo matrix; verify each app resolves a single React instance.
- Build web **and iOS/Android JavaScript bundles on PRs changing shared runtime packages**.

### Factory process and agent handoff

`AGENTS.md` is the common instruction entry point for Cursor, VS Code, and other agents. It points to the product, architecture, security, assigned feature, and current-work files.

Every feature specification states:

- User outcome and non-goals.
- Authentication and ownership policy.
- Schema/API changes.
- Failure states.
- Acceptance tests.
- Rollout and compatibility considerations.

`docs/work/current.md` records the last verified commit, completed work, next bounded task, commands actually run, failures, and checks not run. Preserve decisions and executable requirements—not entire chat transcripts.

Factory commands:

```bash
pnpm factory:init
pnpm doctor
pnpm db:migrate
pnpm dev
pnpm check
```

The initializer changes identifiers and placeholders, records template provenance, and never copies credentials or silently provisions billable infrastructure.

Maintain a separate factory repository with `template/`, `recipes/`, `advisories/`, and `upgrade-guides/`. Security fixes get regression tests and reviewed backport PRs to existing products; template updates do not magically update generated apps.

---

## 3) Auth flow, step by step, from sign-up through to data being stored.

### A. Configure the supported authentication surface

The initial certified starter supports **Auth0 database email/password accounts, verified email, and one identity mapping per user**.

Social login, identity linking, and MFA are not silently half-supported. Add them only with connection-specific authentication, step-up, recovery, and deletion tests. In particular, do not enable a federated connection merely because ordinary login works.

Configure:

- Separate production/nonproduction identity environments.
- A web application, native application, API audience, and confidential step-up application.
- Exact callback/logout URLs.
- Native Authorization Code + PKCE.
- Approximately ten-minute API access tokens.
- Rotating refresh tokens with explicit inactivity and absolute expiry.
- Explicit browser session limits.
- Production email delivery and provider abuse controls.
- No client-credentials grant for the product-user API.

The native application contains no client secret.

### B. Sign-up and session establishment

1. The client starts Universal Login.
2. Auth0 receives the password directly, hashes it, and handles email verification.
3. Web returns to the official SDK callback; the server exchanges the code.
4. The SDK creates its encrypted/authenticated **HttpOnly, Secure** session cookie.
5. Native returns through its registered callback; its SDK completes PKCE and stores credentials using the platform-backed credentials manager.
6. Neither client stores refresh credentials in localStorage, AsyncStorage, query caches, or application logs.
7. Disable the web SDK’s optional browser access-token endpoint. Browser JavaScript never receives API or refresh tokens.

Use the official SDK’s cookie-session mode initially. Certify cookie size and concurrent refresh on actual hosting. If it fails, use a supported server-side session store with proven distributed refresh coordination before release; a process-local mutex is not a fix.

### C. Authenticate each product request

A centralized adapter performs:

1. **If an Authorization header exists:** require a valid bearer credential; never fall back to cookies.
2. Otherwise resolve the browser SDK session and obtain its API token server-side.
3. Validate signature, expected issuer/audience, permitted algorithm, expiry, required claims, and authorized application using `jose` and cached JWKS.
4. Reject ID tokens and unsupported principals.
5. Resolve the application identity and current user status.
6. Produce an internal `UserActor`; ordinary code cannot construct one through public exports.

Addressing **B4**, the provider configuration issues a namespaced principal classification for allowed interactive-user flows. The verifier requires that classification and an allowlisted authorized client. Service principals, if introduced later, use a separate audience and actor type—not bootstrap.

A missing or invalid credential returns `401`. JWKS/network unavailability when verification cannot proceed returns `503`, **not** `401`, and must not erase the client session. There is no fail-open fallback.

### D. Provision the product user explicitly

The client calls `POST /api/v1/me/bootstrap`.

1. Verify the user principal and trusted email-verification claim.
2. In a transaction, insert the stable identity lifecycle row if absent.
3. Lock that row using `SELECT … FOR UPDATE`.
4. Reject `deleting` or `tombstoned` identities.
5. If active, return the existing eligible user.
6. If pending, create the application user and activate the mapping.
7. Commit.

The unique identity key and row lock serialize concurrent bootstrap requests. Ordinary product endpoints do not create users implicitly.

This same stable identity row coordinates deletion: **never delete the mapping and subsequently create a tombstone in another transaction**.

### E. Store and retrieve product data

For `POST /api/v1/projects`:

1. Resolve the actor through the centralized entry point.
2. For cookie authentication, validate exact `Origin` and intended content type.
3. Apply request-size and rate limits.
4. Validate a strict Zod DTO such as `{ name: string }`.
5. Begin a transaction through the application unit of work.
6. Recheck active account status while holding a shared lock on the user row.
7. Insert using `owner_id = actor.userId`; explicitly map permitted fields.
8. Commit and return a response DTO.

Deletion acquires an exclusive lock on that user row, so it waits for already-authorized writes to finish before setting the logical access barrier.

Reads and updates use ownership predicates in the SQL itself:

```sql
update app.projects
set name = $1
where id = $2 and owner_id = $3
returning id, name, created_at;
```

Child operations join or otherwise prove ownership of the parent. Missing and inaccessible private objects normally return `404`.

### F. Refresh, logout, and account switching

SDKs own refresh. The shared API client does not implement another refresh protocol.

| Event | Actual guarantee |
|---|---|
| Local logout | Remove local session/credentials and private caches |
| Refresh revocation | Prevent the targeted refresh credential from renewing |
| Provider logout | End the relevant provider browser session |
| Existing access JWT | Can remain valid until expiry |
| Product suspension/deletion | Reject new operations after current database-status check |

On account change, cancel requests, discard the old account’s QueryClient, clear private persisted state, and prevent late responses from repopulating it. SSR caches are request-scoped. Private native data is memory-only initially.

Password recovery remains hosted by Auth0. Test cross-device links, expiry, reuse, non-enumerating responses, and actual post-reset session behavior.

### G. Concrete deletion step-up

This resolves reviewer **A2/B1**, rather than saying “reauthenticate.”

Use a dedicated confidential Auth0 application and a maintained OIDC client library such as `openid-client` for this narrow server-side transaction flow.

1. An authenticated, rate-limited `POST /me/deletion/challenge` creates a five-minute challenge bound to the application user, identity, and `delete_account` operation.
2. Persist hashes of random OAuth state, nonce, and a client completion secret; persist the PKCE verifier encrypted server-side.
3. Return an authorization URL and completion secret. Web keeps the secret in memory; native keeps it in protected transient storage.
4. Open the system browser with `response_type=code`, PKCE, `scope=openid`, `max_age=0`, `prompt=login`, and the exact server callback.
5. The server callback atomically claims the challenge for verification, checks state/expiry, exchanges the code, and validates the ID token’s signature, issuer, audience, nonce, subject, and required `auth_time`.
6. Require authentication during the challenge window, allowing only documented small clock skew. An ordinary access token or recent callback is insufficient.
7. The initial implementation accepts only the certified database connection. Any enabled MFA policy must also satisfy tested assurance claims; absent evidence fails closed.
8. Mark the challenge verified. Discard temporary tokens; request no offline access.
9. Redirect to a fixed web completion page or registered app link containing only a challenge identifier—not authorization credentials.
10. The original authenticated client submits challenge ID plus completion secret to `POST /me/deletion/confirm`.
11. In one transaction, lock identity, user, and challenge; verify identity, operation, expiry, and secret; consume the challenge; mark identity `deleting` and user `deletion_pending`; insert the durable deletion request.

Callbacks that fail or are interrupted require a new challenge. Rate-limit outstanding challenges. The secret, original actor, and stored challenge jointly prevent a callback identifier from becoming a deletion capability.

### H. Durable deletion and out-of-band identity changes

A bounded authenticated Cron handler:

1. Claims a request, increments its fencing generation, and sets an expiring lease.
2. Removes installed external resources using snapshotted identifiers.
3. Deletes the provider identity; “already absent” is success.
4. Purges application data in bounded chunks.
5. Atomically disconnects the user from the stable identity row, marks that row tombstoned, removes the user, and completes the request.

Every progress update includes the lease owner and generation in its `WHERE` clause. A resumed stale worker cannot commit progress. External calls still require idempotency or already-absent semantics.

Provider-admin deletion **does not cascade into product tables**. A scheduled, checkpointed provider reconciliation process—and trusted provider events where available—detects missing identities and enters the same durable lifecycle. Provider outages are not interpreted as deletion.

Document the detection delay: out-of-band provider deletion is not instantaneous application revocation. Provide an application suspension operation for immediate product blocking.

---

## 4) Starting database schema for the core entities.

Auth0/its SDKs own passwords and ordinary sessions. **Do not create parallel password or refresh-token tables.**

The following is the starting relational model. These definitions belong in reviewed migrations, not dashboard-only configuration.

```sql
create schema app;

create table app.users (
  id uuid primary key default gen_random_uuid(),
  display_name text check (char_length(display_name) <= 100),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'deletion_pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Stable lifecycle record, including the tombstone.
create table app.auth_identities (
  id uuid primary key default gen_random_uuid(),
  issuer text not null,
  subject text not null,
  user_id uuid unique references app.users(id) on delete restrict,
  state text not null
    check (state in ('pending', 'active', 'deleting', 'tombstoned')),
  tombstoned_at timestamptz,
  retain_until timestamptz,
  created_at timestamptz not null default now(),
  unique (issuer, subject),
  check (
    (state = 'pending'
      and user_id is null
      and tombstoned_at is null and retain_until is null)
    or
    (state in ('active', 'deleting')
      and user_id is not null
      and tombstoned_at is null and retain_until is null)
    or
    (state = 'tombstoned'
      and user_id is null
      and tombstoned_at is not null
      and retain_until is not null
      and retain_until >= tombstoned_at)
  )
);

create table app.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.users(id) on delete restrict,
  name text not null
    check (name = btrim(name) and char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_cursor
  on app.projects(owner_id, created_at desc, id desc);

create table app.items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references app.projects(id) on delete restrict,
  title text not null
    check (title = btrim(title) and char_length(title) between 1 and 200),
  status text not null default 'todo'
    check (status in ('todo', 'doing', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_project_cursor
  on app.items(project_id, created_at desc, id desc);

create table app.deletion_challenges (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null
    references app.auth_identities(id) on delete restrict,
  user_id uuid not null references app.users(id) on delete restrict,
  operation text not null check (operation = 'delete_account'),
  state text not null default 'pending'
    check (state in (
      'pending', 'verifying', 'verified', 'consumed', 'failed'
    )),
  oauth_state_hash bytea not null unique,
  nonce_hash bytea not null,
  completion_secret_hash bytea not null,
  pkce_verifier_ciphertext bytea,
  required_assurance text not null,
  auth_time timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  verified_at timestamptz,
  consumed_at timestamptz,
  check (expires_at > created_at),
  check (state not in ('verified', 'consumed')
    or (verified_at is not null and auth_time is not null)),
  check ((state = 'consumed') = (consumed_at is not null))
);

create table app.account_deletions (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null
    references app.auth_identities(id) on delete restrict,

  -- Deliberately no FK: this immutable snapshot survives user removal.
  target_user_id uuid not null unique,
  reason text not null
    check (reason in ('user_request', 'provider_deleted')),
  phase text not null default 'external'
    check (phase in ('external', 'purge', 'finalize', 'done')),
  cleanup_manifest jsonb not null default '{}'::jsonb,

  lease_owner uuid,
  lease_until timestamptz,
  lease_generation bigint not null default 0
    check (lease_generation >= 0),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error_code text,

  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((lease_owner is null) = (lease_until is null)),
  check ((phase = 'done') = (completed_at is not null)),
  check (phase <> 'done' or lease_owner is null)
);

create index deletion_work_ready
  on app.account_deletions(next_attempt_at)
  where phase <> 'done';
```

### Additional migration-enforced invariants

- A small trigger maintains `updated_at`.
- Identity issuer/subject are immutable.
- Identity transitions are limited to `pending → active → deleting → tombstoned`.
- Once assigned, an identity cannot be reassigned to another user; clearing `user_id` is allowed only during tombstoning.
- Challenge and deletion state transitions are checked by migration-managed transition triggers and compare-and-swap updates.
- Cleanup manifests are versioned and application-schema validated; they contain cleanup identifiers, never bearer credentials.

The unique `target_user_id` allows one lifetime deletion workflow per user, stronger than merely one active request.

### Purge, retention, and concurrency

- Bootstrap and deletion lock the same identity row, in the same lock order: **identity → user → challenge/request**.
- Do not remove the stable identity row during deletion. This closes reviewer **B3’s** recreation gap.
- Retain tombstones for a documented period exceeding every configured token/session lifetime and revocation uncertainty; start with 90 days under shorter configured credential lifetimes.
- Garbage collection requires confirmed provider removal, elapsed retention, and removal of dependent workflow records. If those conditions cannot be established, retain the security marker and document why.
- Purge items and projects in bounded batches, with statement timeouts and a wall-clock budget. Restrictive foreign keys prevent accidental unbounded cascades.
- Move the same state machine to Trigger.dev when backlog or individual-account cleanup cannot meet the deletion SLA within hosting limits; do not redesign it as a queue framework.

### Database privileges

`app_runtime` is not the schema owner, cannot perform DDL or role management, and receives only necessary table privileges. Migrations use separate credentials and a controlled direct connection; runtime uses bounded pooled connections.

There is no public database API. Future storage, RPC, Realtime, or database-access recipes must pass deny-by-default capability tests before installation—preserving reviewer **A4’s** broader lesson.

RLS is not in the baseline. Scoped queries plus tests are **not equivalent** to database-enforced ownership. Sensitive-data products must install and certify the RLS recipe before launch, including transaction-local identity and pool-isolation tests.

---

## 5) Design patterns applied, and why, referencing the reviewer's notes.

| Pattern | Concrete application | Why / reviewer concern |
|---|---|---|
| **Modular monolith** | One Next.js backend, feature-oriented application modules | Preserves A’s simplicity and B’s final consolidation without sacrificing transactions. |
| **BFF credential boundary** | HttpOnly web session; no browser token endpoint | Addresses **A1** without a second HTTP proxy deployment. HttpOnly limits token extraction, not authenticated actions by XSS. |
| **Complete mediation** | Routes and SSR invoke registered application operations; those resolve actors and status | Addresses **C1**: authentication and status checks cannot depend on each caller remembering them. |
| **Executable dependency boundaries** | Only persistence modules import Drizzle/runtime DB; ordinary features cannot import maintenance/admin modules | Prevents a new route from bypassing authorization through raw SQL. Enforced in CI. |
| **Feature-specific repositories** | `findOwnedProject`, `updateOwnedProject`, ownership-scoped child queries | Keeps ownership visible without generic CRUD abstractions. |
| **Transaction-owning services** | Services orchestrate scoped repositories through a unit of work | Makes multi-entity atomicity and concurrency controls explicit. A transaction alone does not fix check-then-act races. |
| **Functional core, imperative shell** | Pure domain calculations shared by clients/server | Real reuse while keeping persistence and authority on the server. |
| **Identity aggregate and serialized lifecycle** | One stable identity row, one mapping per user, locks shared by bootstrap/deletion | Resolves **A3, B2, B3**; no provider cascade or unsupported linking behavior. |
| **Transaction-bound capability** | Short-lived deletion challenge verified through OIDC and consumed atomically | Resolves **A2/B1**; fresh token issuance is not fresh human authentication. |
| **Leased work with fencing** | Lease generation checked on every transition | Resolves **C2**; idempotency alone does not stop stale-worker writes. |
| **Logical deletion barrier + chunked purge** | Immediate `deletion_pending`, bounded physical cleanup | Resolves **C3** without large cascades or long serverless transactions. |
| **Consumer-driven contracts** | Frozen released-mobile parsers and request fixtures | Resolves **C5**; updating shared schemas everywhere cannot hide a mobile breaking change. |
| **Architecture fitness functions** | Import rules, endpoint inventory, privilege checks, dual-platform builds | Makes the reviewer’s conditions ongoing properties rather than one-time reviews. |

### API conventions

Use `/api/v1`, strict input schemas, explicit DTOs, bounded cursor pagination, request IDs, and a single Problem Details-style error contract. Use stable machine codes; never expose SQL/provider errors.

Register every protected operation:

```ts
{
  name: "projects.update",
  auth: "user",
  ownership: "project-owner",
  modes: ["cookie", "bearer"],
  mutation: true
}
```

The inventory includes SSR reads, exports, search, and bulk operations—not just URL routes.

### Security and scaling defaults

- Exact-origin CSRF checks for cookie mutations; no permissive credentialed CORS.
- Restrictive tested CSP, safe rendering, minimal authenticated-page third-party scripts.
- Explicit `private, no-store` behavior for sensitive responses and session-bearing pages.
- Upstash-backed operation/user/IP limits; sensitive operations fail closed on limiter failure.
- No server secrets in `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`.
- Short transactions, indexed owner queries, cursor pagination, bounded pools, statement/outbound timeouts.
- API and database in nearby regions; watch aggregate serverless connections.
- No critical post-response promises. Use durable execution and an outbox when committed data must trigger an external action.

---

## 6) Testing/CI basics.

### Tests worth paying for

**Unit — Vitest**

Contracts, domain rules, error mapping, transport parsing, cache isolation, and deletion transitions.

**Integration — real PostgreSQL and the runtime role**

Ownership on every operation, forbidden reparenting, invalid stored states, provisioning races, transaction rollback, status barriers, runtime privilege restrictions, and migrations from both empty and previous-release databases.

**Required lifecycle race tests**

- Bootstrap racing bootstrap.
- Bootstrap racing deletion finalization.
- Provider-admin deletion with external cleanup still pending.
- Old tokens after deletion.
- Lease expiry while the first worker is still running.
- Large representative account purge.
- Failed external cleanup followed by successful retry.

**Authorization matrix — generated from operation inventory**

Every applicable operation tests anonymous, owner, different user, suspended user, deleting user, cookie mode, and bearer mode. CI rejects an operation without its policy/test registration. This implements reviewer **C6**.

**Web — Playwright; native — Maestro plus real devices**

Signup, verification, login, core CRUD, session persistence, callback interruption, restart, refresh, logout/account switching, and deletion. Real-device native authentication starts in week one, not just before release.

**Deployed auth certification**

Test realistic cookie sizes, cookie updates on error/redirect paths, concurrent refresh across instances, wrong issuer/audience, key rotation, unsupported principals, invalid bearer plus valid cookie, recovery across devices, and actual revocation behavior.

### Mobile compatibility policy

Support every public mobile release shipped in the preceding **six months**, extended when adoption data shows a meaningful installed population still depends on it.

For each supported release, retain immutable representative requests, response parsers, pagination behavior, and error expectations. Run them against the current API.

Within `/api/v1`:

- Do not remove required response fields or change their meaning.
- Do not introduce required request fields.
- Add enum values only when supported clients demonstrably tolerate unknown values.
- Preserve cursor and stable error-code behavior.
- Use a new contract/version for genuinely incompatible behavior.

### PR pipeline

```text
Frozen-lockfile install
→ lint, import boundaries, operation inventory
→ typecheck and unit tests
→ real migrations and database/API tests
→ released-mobile compatibility tests
→ web production build and smoke tests
→ iOS/Android bundle builds for shared/runtime changes
→ secret/dependency scanning
```

Run full both-platform builds before releases even when a PR’s changed-path checks skip them. Periodically generate a new product into an empty directory and run the same path.

### Secure deployment, not merely CI

Addressing **C7**:

- Default workflow permissions to read-only; grant narrowly per job.
- Pin third-party actions to reviewed commit SHAs.
- No production secrets in fork PRs or preview deployments.
- Use short-lived deployment credentials where supported.
- Protect production environments with approval.
- Serialize migration and deployment promotion per environment.
- Promote a tested commit and identified artifacts; if environment-specific builds are necessary, build and test those exact artifacts before promotion.
- Record commit, migration version, web artifact, and EAS build/update identifiers.
- Apply expand-and-contract migrations once, before compatible application deployment.
- Review callback URLs, cookie settings, API audience, secrets, database role, limits, and backup configuration in a staging-to-production checklist.

Configure recovery objectives, backups/PITR, error/latency alerts, deletion backlog alerts, and spending alerts. Perform a restore exercise before certification, including reconciliation with Auth0 and previously deleted accounts. A database restore does not rewind external systems.

**The factory is not certified because these tests are listed. It is certified only when their deployed results are recorded.**

---

## 7) A numbered first-week action plan.

1. **Day 1 — Freeze the decisions and establish durable context.**  
   Create `AGENTS.md`, the core docs, identity/ownership ADR, feature 001, and the handoff file. Validate Auth0 commercial fit and configure isolated nonproduction infrastructure. Select the initial email/password-only authentication surface.

2. **Day 1 — Establish the monorepo and portability checks.**  
   Create web/mobile apps and shared packages. Pin the dependency matrix. Add import restrictions. Prove a shared schema and API-client method compile in Next.js and both native bundles.

3. **Day 2 — Implement schema and the application boundary.**  
   Create migrations, runtime credentials, operation registry, actor resolution interfaces, scoped persistence functions, and the stable identity lifecycle. Add privilege and concurrent-bootstrap tests.

4. **Day 3 — Authenticate on real hosting and real phones.**  
   Implement web SDK sessions, native PKCE/credentials manager, JWT user-principal verification, and explicit bootstrap. Test cookie propagation, invalid bearer precedence, account switching, and native callbacks.

5. **Day 4 — Ship one complete private-data slice.**  
   Create/list/update projects on web and native through the same API. Add cross-user tests, strict DTO validation, CSRF, bounded pagination, private caching rules, and operation inventory coverage.

6. **Day 5 — Implement the destructive lifecycle, not a placeholder button.**  
   Build deletion challenge persistence, the server OIDC callback, atomic confirmation, fenced processing, and chunked purge. Test bootstrap/deletion races and out-of-band provider deletion. If incomplete, keep deletion unreleased and the factory uncertified.

7. **Day 6 — Harden deployment and recovery.**  
   Add protected serialized production workflows, monitoring, abuse limits, secret scanning, migration upgrade tests, and backup configuration. Run staging recovery and deployed authentication checks; record failures honestly.

8. **Day 7 — Exercise the factory itself.**  
   Generate a fresh product from the starter, run `doctor`, build both clients, apply migrations, and execute the reference workflow. Freeze the first mobile contract fixtures and record lessons. Tag `0.1.0` only if the demonstrated scope passes; reserve `1.0.0` for all certification gates.

**The outcome of week one is a demonstrated vertical slice and an explicit list of remaining release gates—not a promise that secure authentication, deletion, and recovery can always be finished in seven days.**