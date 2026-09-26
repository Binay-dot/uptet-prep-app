# Updated decision

I would make one substantial change to my previous recommendation:

> **Keep managed authentication, server-only browser credentials, PostgreSQL, and one authoritative product API—but put that API inside Next.js initially.**

The competing plan correctly separates four decisions that I had bundled too tightly:

1. Who can access product data.
2. Where browser credentials live.
3. Whether the API needs its own deployment.
4. Whether identity and database services come from the same vendor.

A separate Fastify deployment is useful, but it is not necessary to establish sound authorization, service boundaries, or transactions.

My revised factory defaults are:

| Concern | Decision |
|---|---|
| Web | Next.js App Router, Tailwind, shadcn/ui |
| Mobile | Expo, React Native, Expo Router |
| Backend | Next.js Route Handlers, Node runtime, modular monolith |
| Database | Neon PostgreSQL |
| Database access | Drizzle, reviewed SQL migrations |
| Authentication | Auth0 Universal Login and official web/native SDKs |
| Browser authentication | HttpOnly, SDK-protected session; tokens unavailable to browser JavaScript |
| Native authentication | Authorization Code + PKCE; native credentials manager |
| Shared contracts | Zod schemas and explicit typed HTTP methods |
| Client state | TanStack Query |
| Repository | pnpm workspaces |
| Deployment | Vercel, Neon, Auth0, EAS |
| Abuse controls | Upstash-backed distributed limits |
| General-purpose durable jobs | Optional Trigger.dev recipe |
| Default ownership | User-owned records; workspaces are an explicit recipe |

The architecture becomes:

```text
Browser ── HttpOnly session ──┐
                             │
                             ▼
                       Next.js application
                       ┌─────────────────────────┐
                       │ Authentication adapters │
Expo ── access token ──►│ Product API             │
                       │ Application services    │
                       │ Scoped repositories     │
                       └────────────┬────────────┘
                                    │
                                    ▼
                              PostgreSQL

Browser / Expo ── hosted authentication ── Auth0
```

**There is one product API and one implementation of product rules.** Browser-specific authentication happens in the same deployment, without an HTTP proxy to another copy of the routes.

I retain Auth0 because I want server-managed browser credentials as a default, not a sensitivity-dependent upgrade. I retain Neon because, after choosing Auth0 and disabling client database access, I do not need Supabase’s additional platform capabilities in the base template.

This is a concrete recommendation, not a claim that Supabase or Fastify is unsuitable.

---

# 1. What I would adopt from the competing plan

## 1.1 One backend deployment initially

This is its strongest operational improvement.

Next.js Route Handlers can provide a legitimate application API for both web and native clients. Framework-independent services and repositories establish the important boundaries; another deployment does not create them automatically.

I would remove the mandatory Render/Fastify deployment.

A standalone API becomes an extraction decision when there is evidence for it—not a condition for calling the architecture production-ready.

## 1.2 Shared Zod contracts before OpenAPI generation

For two first-party TypeScript clients, a small, explicit client is sufficient:

```ts
api.projects.create(input);
api.projects.list({ cursor, limit });
api.projects.get(id);
```

I would defer the OpenAPI generation pipeline until:

- External consumers need a documented contract.
- The endpoint inventory makes manual client maintenance error-prone.
- Contract generation demonstrably saves work.

Runtime schemas, response parsing, and compatibility tests remain mandatory. Removing generation does not mean replacing contracts with unchecked `fetch()` calls.

## 1.3 Test database privileges using the actual runtime role

This deserves stronger emphasis than my previous plan gave it.

Integration tests must prove that ordinary application credentials cannot:

- Alter schemas.
- Create tables.
- Access administrative tables they do not need.
- Assume a privileged role.

Running every integration test as the database owner hides deployment mistakes.

## 1.4 Managed execution for general asynchronous work

I would not make a custom PostgreSQL job framework the default recipe.

Use Trigger.dev when general-purpose durable execution becomes necessary. Use a transactional outbox when a committed database change must reliably cause job submission.

Keep the built-in account-deletion workflow narrowly scoped. Do not let it quietly grow into a home-built queue platform.

## 1.5 Explicit bearer-token precedence

If an `Authorization` header is present but invalid, fail authentication.

Do not fall back to a valid browser cookie. Authentication mode must not change opportunistically after a failure.

## 1.6 Stronger attention to deletion confirmation

A recently refreshed token is not evidence of recent human authentication. Destructive account operations need an explicit step-up policy.

I would adopt that requirement, but not their email-OTP mechanism as a universal default.

---

# 2. Concrete weaknesses in the competing plan

The revised competitor has fixed the most important weakness of its earlier design: product data no longer has a direct client-accessible database path.

My earlier criticisms about bypassing TypeScript workflows through PostgREST therefore **no longer apply**, provided their schema exposure and privilege tests actually pass.

The remaining disagreements are narrower.

## 2.1 JavaScript-readable refresh credentials remain the largest security compromise

The plan acknowledges this correctly.

With a JavaScript-readable refresh credential, an XSS vulnerability may permit credential extraction and continued access outside the compromised page. Rotation and reuse detection reduce that risk; they do not remove it.

An HttpOnly session does not defeat XSS. Malicious JavaScript can still issue authenticated requests while running in the victim’s browser. But it removes an important credential-exfiltration path.

For a factory, I prefer making this boundary standard once rather than asking every new product to decide whether it is “sensitive enough.”

## 2.2 The HttpOnly recipe is a substantial architectural change

Their optional HttpOnly recipe is not equivalent to installing a small security header package.

It changes:

- Which component owns renewal.
- Whether browser code can use the auth SDK directly.
- Login and recovery integration.
- Cookie handling.
- Logout semantics.
- SSR behavior.
- Tests and client initialization.

They explicitly warn against changing one cookie flag, which is good. Nevertheless, postponing this decision can make the eventual upgrade more expensive than its placement in a recipe list suggests.

## 2.3 Email OTP deletion confirmation needs an assurance policy

Their deletion flow is concrete, but it should not be universally described as sufficient step-up authentication.

For an account authenticated with stronger factors, fresh email access may represent **lower assurance**, not equivalent assurance. It also depends on:

- Correct binding to the original identity.
- Supported behavior for social and passwordless accounts.
- OTP attempt limits.
- Avoiding unintended account creation or linking.
- Cleanup of temporary sessions.
- The product’s policy for compromised email accounts.

For verified-email, email-only accounts it can be reasonable. For the factory default, I would use a provider-supported fresh-authentication flow and preserve any required MFA assurance.

## 2.4 Provider identity and product lifecycle are tightly coupled

Their schema uses the provider identity UUID as the product user ID and cascades provider deletion into product deletion.

That is convenient, but it has consequences:

- Accidental administrative deletion can cascade into product data.
- Account linking and provider migration have more schema implications.
- External cleanup must happen before a cascade removes information needed to perform it.
- Restoring identity and application data requires careful coordination.

This is not inherently incorrect. I prefer an application-owned user ID plus explicit identity mappings and an explicit deletion workflow.

The extra mapping table is justified here because identity is one of the foundations the factory is intended to stabilize.

## 2.5 `getUser()` on every API request creates an availability dependency

Their plan recognizes the latency cost. The availability cost also matters:

```text
Database healthy + application healthy + identity lookup unavailable
→ ordinary product request fails
```

Local JWT verification with cached signing keys is preferable for routine bearer authentication once properly implemented.

It still does not provide immediate refresh-session revocation. Current application status remains a database check.

## 2.6 Serverless transactions need operational limits, not just architecture diagrams

This applies to my revised plan too.

A modular monolith in Next.js must account for:

- Aggregate connections across instances.
- Execution limits.
- Frozen or terminated processes.
- Regional placement.
- Transaction-pooler behavior.
- Long-running outbound requests.
- Unreliable work scheduled after an HTTP response.

Correct layering does not make those limitations disappear.

## 2.7 Their cost advantage is plausible, not universal

Fewer vendors and deployments usually simplify operations. They do not guarantee the lowest bill.

Environment minimums, database project pricing, backup requirements, auth usage, and hosting execution limits can dominate costs.

Compare actual production and staging configurations—not free-tier marketing summaries.

---

# Part 1 — The application factory

# 3. What the factory produces

The factory is:

1. A working reference application.
2. A versioned starter.
3. A repository-based planning and handoff process.
4. A small library of complete optional recipes.
5. A security-backport process.

It is **not** a shared production platform.

Each product gets independent:

- Repositories and release history.
- Database credentials and production database.
- Auth applications and appropriate environment isolation.
- Mobile identifiers.
- Deployments.
- Secrets.
- Recovery objectives.
- Operating budget.

Share code and knowledge. Do not couple unrelated products through shared runtime credentials or a central product database.

---

# 4. Persistent planning and agent context

Use repository documents as the durable memory.

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
    001-private-projects/
      spec.md
      plan.md

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

### Responsibilities

| File | Contents |
|---|---|
| `product.md` | Users, problem, workflows, MVP, non-goals |
| `architecture.md` | Components, dependencies, request paths, transaction ownership |
| `data-model.md` | Entities, ownership, constraints, indexes, retention |
| `security.md` | Trust boundaries, authentication, authorization, abuse controls, limitations |
| `decisions/` | Important decisions and conditions for revisiting them |
| Feature `spec.md` | Behavior, permissions, failure states, acceptance criteria |
| Feature `plan.md` | Schema/API/client changes, tests, implementation sequence |
| `work/current.md` | Verified current state and next bounded task |
| `runbooks/` | Executable operating and recovery procedures |
| `feedback/lessons.md` | Evidence for changing the factory |

Do not retain every chat transcript as architecture documentation. Preserve decisions and requirements.

### ADR format

```text
Context
Decision
Alternatives rejected
Consequences
Conditions for revisiting
```

Write ADRs for ownership, identity, persistence, public compatibility, and important integrations—not every component.

### Handoff file

```md
Objective:
Feature specification:
Branch:
Last verified commit:

Completed:
Remaining:
Known failures:

Commands run and results:
Checks not run:
Decisions needed:
Next smallest useful task:
```

This is a work checkpoint, not a second architecture document.

---

# 5. Agent instructions and implementation loop

Root `AGENTS.md`:

```md
## Read first
- docs/product.md
- docs/architecture.md
- docs/security.md
- docs/work/current.md
- Assigned feature spec and plan

## Boundaries
- Browser/mobile code cannot import server or database modules.
- Domain code cannot import HTTP, database, or platform modules.
- Product data is accessible only through the application backend.
- Every private-resource operation must enforce ownership.
- Never trust client-supplied ownership, roles, or entitlements.
- Never log credentials or production personal data.
- Ordinary requests cannot use migration/admin credentials.
- Database changes require new reviewed migrations.
- Do not edit deployed migrations.
- Do not add infrastructure without documenting why.

## Completion
- Implement acceptance criteria.
- Run relevant checks.
- Explicitly report checks not run.
- Update affected documentation.
- Update docs/work/current.md.
```

Editor-specific rules should point to this file, not duplicate it.

### Repeatable loop

1. Discuss the feature.
2. Produce repository-ready specification changes.
3. Resolve ownership and permission questions.
4. Commit the approved specification.
5. Assign one vertical slice.
6. Review implementation and actual test output.
7. Deploy.
8. Record lessons.

Example assignment:

> Implement feature 001: create and retrieve a private project on web and mobile. Include cross-user tests and failure states. Do not add workspaces, offline synchronization, or infrastructure. Report commands run and update the handoff.

Human approval is required for destructive migrations, production configuration, credential provisioning, and billable infrastructure.

---

# 6. Concrete scaffold

```text
apps/
  web/
    src/
      app/
        (public)/
        (authenticated)/
        api/
          v1/
            me/
            projects/
          internal/
            account-deletions/

      components/
      features/

      server/
        env.ts

        auth/
          auth0.ts
          verify-access-token.ts
          resolve-actor.ts
          step-up.ts

        http/
          route.ts
          csrf.ts
          errors.ts
          request-context.ts

        modules/
          users/
            service.ts
            repository.ts
          projects/
            service.ts
            repository.ts
          items/
            service.ts
            repository.ts

        integrations/
          identity-admin.ts

        maintenance/
          account-deletions.ts

  mobile/
    app/
      (public)/
      (authenticated)/
    src/
      components/
      features/
      auth/
      api/
      storage/

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
  test-utils/
  eslint-config/
  typescript-config/

tests/
  integration/
  web/
  mobile/

tooling/
  init-product.ts
  doctor.ts
  check-boundaries.ts

docs/
.github/workflows/
docker-compose.yml
.env.example
AGENTS.md
pnpm-workspace.yaml
.factory/template.json
```

The exact Next.js middleware/proxy and Auth0 route integration files must follow the **pinned SDK/framework versions**. Do not copy an old authentication integration into a new framework release without retesting it.

### Dependency rules

```text
contracts → Zod
domain → pure TypeScript
api-client → contracts
query → api-client + TanStack Query

web/mobile clients → contracts, domain, api-client, query
server services → domain, contracts, repositories
repositories → database
server auth → provider SDK / token verification
```

Enforce with package exports, ESLint restrictions, and server-only markers.

Use pnpm workspaces initially. Add Turborepo only when measured build times justify it.

Pin a compatible Next.js/React/Expo dependency matrix. Upgrade it deliberately.

---

# 7. Required defaults and optional recipes

## Required in every generated product

- Signup, verification, login, recovery.
- Web and native session persistence.
- Refresh and documented logout behavior.
- Idempotent user provisioning.
- Private project/item reference workflow.
- Shared schemas, HTTP client, and query definitions.
- Account deletion.
- Distributed abuse limits.
- Authorization integration tests.
- CI and deployment configuration.
- Monitoring and incident runbook.
- Backup configuration and restore procedure.

## Optional recipes

- Workspaces and invitations.
- Billing and entitlements.
- Private uploads.
- Push notifications.
- Durable jobs and transactional outbox.
- Offline synchronization.
- Database RLS.
- Server-side browser session storage.
- OpenAPI generation.
- Standalone API extraction.

A recipe is not a paragraph recommending a package. It includes implementation, configuration, migrations where relevant, tests, and operating instructions.

**Until its recipe is installed, the capability is unavailable.**

---

# 8. Initialization and feedback

Provide:

```bash
pnpm factory:init
pnpm doctor
pnpm db:migrate
pnpm dev
pnpm check
```

The initializer configures:

- Product/package names.
- Bundle and application identifiers.
- Domains and URL schemes.
- Public auth identifiers.
- Environment examples.
- Template provenance.

```json
{
  "templateVersion": "1.0.0",
  "templateCommit": "abc123"
}
```

It must not copy production secrets or silently provision services.

The doctor command validates tooling and configuration without printing secrets.

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
| Product-specific behavior | Keep in product |
| Repeated useful capability | Add recipe |
| Proven broadly useful default | Promote into template |
| Security/correctness defect | Fix, regression test, advisory, backport |
| Speculative abstraction | Do not add |

Track active products and their factory versions. Updating the template does not update existing apps.

Periodically initialize a clean product and run its full build/test path. A green template repository does not prove the initializer works.

---

# Part 2 — The reference architecture

# 9. Stack rationale

## Next.js: web plus product API

Use Next.js for:

- Public pages.
- Authenticated web UI.
- Authentication callbacks and browser sessions.
- `/api/v1` product routes.
- Server rendering where beneficial.

Use the Node runtime for database-backed handlers.

Business rules belong in application services, not route files or React components.

Server-rendered reads may call the same services directly after resolving an actor. They should not make HTTP requests back into their own application. Browser and native mutations use the public product routes.

Do not create an independent mutation implementation in Server Actions.

## Expo: native clients

Use Expo Router, development builds, and EAS.

Auth0’s native integration requires a suitable development build; Expo Go is not the authentication certification environment.

Test real iOS and Android callbacks early.

## Neon PostgreSQL

Use managed PostgreSQL for:

- Transactions.
- Referential integrity.
- Concurrency-safe constraints.
- Predictable query behavior.
- A maintainable relational model.

Use Docker PostgreSQL locally and disposable PostgreSQL in CI.

Do not expose a product-data database API to clients.

## Drizzle

Use typed, SQL-oriented queries and reviewed migrations.

Generated migration output is a draft requiring review—not permission to deploy.

Use an appropriate pooled runtime endpoint, bounded connection pools, and a separate migration connection. Configure prepared statements according to the selected driver and pooler’s documented support.

## Auth0

Use Universal Login, `@auth0/nextjs-auth0`, and `react-native-auth0`.

The reasons are:

- Hosted password handling.
- Supported browser and native protocol integrations.
- Server-managed browser credentials.
- Social login and future MFA support.

Auth0 does not implement product ownership or entitlements.

Before adopting the factory, validate current pricing and required features against both production and nonproduction environments. Commercial fit is a real prerequisite.

---

# 10. Patterns and boundaries

## Modular monolith

One backend deployment, feature-oriented modules:

```text
users
projects
items
```

**Why:** simple deployment and local transactions without giving up internal structure.

## Layered architecture

```text
Route → application service → repository → PostgreSQL
```

- **Route:** authentication mode, CSRF, input parsing, HTTP mapping.
- **Service:** workflow, authorization decisions, transaction ownership.
- **Repository:** explicit scoped queries.
- **Database:** structural and concurrency-safe invariants.

Do not add a forwarding service merely to satisfy a diagram. Use the layer when it has responsibility.

## Feature-specific repository pattern

Prefer:

```ts
findOwnedProject(db, actorId, projectId);
updateOwnedProject(tx, actorId, projectId, changes);
listOwnedProjects(db, actorId, pagination);
```

Avoid generic repositories and ambiguous unscoped helpers in product paths:

```ts
BaseRepository<T>
findById(id)
```

Administrative queries belong in visibly separate, restricted modules.

## Functional core, imperative shell

Put pure rules and calculations in `packages/domain`.

Clients use them for previews. Services execute them authoritatively.

A client-calculated price, entitlement, or transition result is never trusted.

## BFF security boundary, without a proxy tier

Next.js owns browser sessions and prevents credentials from reaching browser JavaScript.

It does **not** need to proxy an HTTP request to another deployment to achieve that boundary.

Browser cookie authentication and native bearer authentication converge on the same actor and services.

## Selective dependency inversion

Use adapters for identity administration, billing, storage, and external APIs.

Do not introduce an interface for every function or a dependency-injection container by default.

---

# 11. Shared code and contracts

Share:

- Zod request and response schemas.
- Public DTOs and enums.
- Pure business rules.
- Typed API methods.
- Error parsing.
- TanStack Query keys/options.
- Platform-independent formatting.
- Design tokens.

Do not force sharing of:

- Screens.
- Navigation.
- Credential storage.
- Browser/native UI primitives.
- File pickers.
- Deep-link handling.
- Database entities.

Example:

```ts
export const CreateProjectInput = z.object({
  name: z.string().trim().min(1).max(100),
}).strict();

export const ProjectDto = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
});
```

Use strings for dates on the wire. Choose explicit integer or decimal representations for money.

### HTTP client

```ts
createApiClient({
  baseUrl,
  getAccessToken,
  credentials,
});
```

- Browser: same-origin URL and cookies.
- Native: public HTTPS API URL and bearer token.
- Server-rendered reads: service calls rather than self-HTTP.

The client must support:

- Bounded timeouts.
- Cancellation.
- Stable error parsing.
- Response validation.
- No automatic retries of arbitrary mutations.

Keep endpoint methods explicit rather than building a generic RPC framework.

### Private cache lifecycle

Use a fresh query client per authenticated account lifetime.

On logout/account switch:

1. Stop or cancel private requests.
2. Dispose of the old query client.
3. Clear private persisted state.
4. Prevent late responses from affecting the new account.

For SSR, create request-scoped authenticated caches. Never put private query state in a module-level singleton.

Private mobile caches are memory-only by default. Offline persistence is a separate security and synchronization feature.

---

# 12. Authentication end to end

## 12.1 Responsibilities

**Auth0 owns:**

- Password hashing.
- Credential verification.
- Verification and recovery flows.
- Social identity integration.
- Provider sessions.
- Refresh-token issuance and rotation.

**The application owns:**

- Product users.
- Account status.
- Ownership and permissions.
- Entitlements.
- Product-data deletion.
- Authorization on every operation.

Use `(issuer, subject)` as the external identity key. Email is not a stable identity key.

---

## 12.2 Provider configuration

Per product configure:

1. A Regular Web Application.
2. A Native Application.
3. An API audience.

Separate production from nonproduction identity configuration.

Configure:

- Exact callback and logout URLs.
- Authorization Code flow.
- PKCE where supported by the SDK flow and required for native.
- Short-lived access tokens; approximately ten minutes is a reasonable starting point.
- Rotating refresh tokens and reuse detection.
- Refresh inactivity and absolute limits.
- Browser session limits.
- Verification and abuse policies.
- Minimal scopes.
- Production email delivery.

Request `offline_access` only where renewal is intended and enabled.

The native app is a public client. It contains no client secret.

---

## 12.3 Browser signup and login

1. Browser visits the SDK login route.
2. Next.js redirects to Universal Login.
3. Auth0 handles signup/login/social authentication.
4. Auth0 returns an authorization code to the allowlisted callback.
5. The SDK validates the protocol response and exchanges the code server-side.
6. The SDK establishes its protected browser session.
7. Browser calls `/api/v1/me/bootstrap`.
8. The route’s authentication adapter obtains the API access token server-side.
9. The shared token verifier validates it.
10. The backend provisions or resolves the application user.

Use the SDK-supported encrypted/authenticated cookie session initially:

- `HttpOnly`.
- `Secure` in production.
- Supported SameSite behavior.
- Narrow cookie scope.
- Minimal session claims.

Disable any optional browser access-token endpoint in the pinned SDK. Do not create an equivalent.

An encrypted cookie may contain session material. “Server-managed credentials” means browser JavaScript cannot access them, not necessarily that all session bytes live in a server database.

---

## 12.4 One API, two authentication adapters

The request adapter follows this sequence:

```text
Authorization header present?
  Yes:
    Require a supported Bearer credential.
    Verify it or reject.
    Never fall back to cookies.

  No:
    Resolve the SDK browser session.
    For mutations, enforce browser CSRF policy.
    Obtain the API token server-side through the SDK.
    Verify it with the same token verifier.

Then:
  Resolve application identity.
  Load current account status.
  Construct Actor.
```

The web application requests the same API audience needed by native clients.

This intentionally keeps one token-verification path without making an HTTP request to itself.

The pinned SDK integration must propagate any required session-cookie updates on successful responses and relevant error paths.

For server-rendered reads, use the SDK-supported server context. If that context cannot persist a required renewal, use the supported refresh boundary; do not improvise cookie writes during rendering.

### CSRF controls

For cookie-authenticated mutations:

- Require an exact allowlisted `Origin`.
- Reject missing or unexpected origins.
- Require intended content types.
- Never mutate product state through GET.
- Do not enable permissive credentialed CORS.

Authentication callbacks and provider redirects follow their SDK-specific protections separately.

Authenticated responses must not enter shared public caches.

---

## 12.5 Native authentication

1. Open Universal Login in the system authentication browser.
2. Use Authorization Code + PKCE.
3. Return through the registered callback.
4. The native SDK completes the exchange.
5. Persist credentials through its platform-backed credentials manager.
6. Ask that manager for valid access credentials.
7. Call the same `/api/v1` routes directly.

Never store refresh credentials in AsyncStorage, query caches, Redux state, or logs.

Prefer verified Universal Links/App Links where the supported integration permits them. Custom schemes require exact registration and device testing.

Secure platform storage reduces risk; it does not make a compromised device trustworthy.

---

## 12.6 Token verification

Use a maintained JWT verification library such as `jose`, with:

- Expected issuer.
- Expected API audience.
- Explicit algorithm allowlist.
- Signature verification.
- Expiration and applicable timing checks.
- Required scopes where relevant.
- Cached JWKS and key-rotation support.
- Bounded key-fetch behavior.

Reject ID tokens as API credentials.

After cryptographic verification, load current product-user status. Start with a database lookup on every request. Later caching must document its suspension delay.

Do not claim local JWT verification provides immediate provider-session revocation.

---

## 12.7 Provisioning

Expose:

```text
POST /api/v1/me/bootstrap
```

In a transaction:

1. Look up `(issuer, subject)`.
2. If mapped, return the eligible application user.
3. Otherwise create an application user.
4. Insert the unique identity mapping.
5. Commit.

If concurrent provisioning conflicts, roll back the losing creation transaction and read the winning mapping. Do not leave orphan users.

Do not accept verification status, ownership, roles, or entitlements from the request body.

If verification status is needed, obtain it from a trusted provider source or deliberately configured namespaced claim. Document its freshness.

Ordinary product routes never auto-create users. Provisioning is an explicit lifecycle operation.

---

## 12.8 Refresh, logout, and revocation

Let SDKs perform refresh. Do not add another refresh protocol to the shared HTTP client.

| Action | Guarantee |
|---|---|
| Local logout | Removes this client’s session/credentials and private caches |
| Provider logout | Ends the relevant provider browser session |
| Refresh revocation | Prevents the targeted credential/session from renewing |
| Existing access JWT | May remain valid until expiration |
| Application suspension | New API requests fail after current-status lookup |
| All-device logout | Only the implemented and tested provider revocation semantics |

Do not present these as interchangeable.

A request already in progress can finish during suspension. Critical destructive or financial operations may need a status check inside their transaction.

Transient network errors should not erase recoverable sessions. Definitive renewal failure should prompt login.

Expose all-device logout only when its actual semantics are implemented and tested.

---

## 12.9 Passwords, recovery, and social login

Passwords never pass through the product backend.

Test:

- Verification.
- Password reset.
- Expired/reused links.
- Different-browser/device behavior.
- Non-enumerating responses.
- Session behavior after password changes.

Start with email/password and Google if useful. Add Apple when required by product needs or platform policy.

Do not automatically link identities because emails match. Use provider-supported linking with proof of control.

Allowlist post-login destinations.

---

## 12.10 Authentication certification gate

Before tagging a factory release, test:

- Real hosting cookie/header limits.
- Large realistic sessions.
- Concurrent refresh across requests and instances.
- App restart.
- Interrupted login.
- Background/foreground transitions.
- Real-device callbacks.
- Recovery and verification across devices.
- Logout and account switching.
- Revocation behavior.

If the encrypted-cookie integration cannot reliably handle the tested renewal workload, install the supported server-side-session implementation and required refresh coordination **before release**.

A process-local mutex is not a distributed solution. Merely storing sessions centrally does not automatically serialize refresh.

The template is not certified until these tests pass.

---

# 13. Database design

## 13.1 Default entities

| Table | Important fields and constraints |
|---|---|
| `users` | UUID PK, display name, status, timestamps |
| `auth_identities` | User FK, issuer, subject, unique `(issuer, subject)` |
| `projects` | UUID PK, owner FK, name, timestamps |
| `items` | UUID PK, project FK, title, status, timestamps |
| `account_deletions` | Durable request ID, workflow state, retry/lease metadata |
| `identity_tombstones` | Minimal blocked-identity marker for deletion/recreation protection |

Auth0 and its SDKs own ordinary sessions and refresh credentials. Do not invent parallel password/session tables.

`account_deletions` must survive product-user deletion long enough to record completion. Do not place it under an unconditional user cascade.

### Constraints and indexes

Use:

- `NOT NULL`.
- Foreign keys.
- Uniqueness.
- Length and status checks.
- Explicit deletion policies.
- `timestamptz`.
- Query-driven indexes.

Examples:

```text
projects(owner_id, created_at DESC, id DESC)
items(project_id, created_at DESC, id DESC)
auth_identities UNIQUE(issuer, subject)
```

Maintain `updated_at` with a small, migration-managed trigger.

Do not blanket-soft-delete every entity.

---

## 13.2 Ownership enforcement

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

For item creation or reparenting, prove destination ownership in the authoritative operation or transaction.

Never accept `owner_id` from a client DTO.

For complex permissions, use transactions and appropriate locking. A transaction alone does not eliminate check-then-act races.

Examples:

- A quota may require locking a stable owner row.
- A balance may require an atomic conditional update.
- A state transition may require optimistic version checking.

---

## 13.3 Database roles

Use separate credentials for:

- Runtime application queries.
- Migrations.
- Administrative maintenance where additional privileges are necessary.

The runtime role:

- Is not the schema owner.
- Cannot perform DDL.
- Has no superuser or role-management privileges.
- Has only required table/sequence privileges.
- Cannot bypass RLS if the recipe is installed.

Use TLS and network restrictions where practical.

No production database credentials in preview deployments.

No product tables exposed through client-accessible database APIs.

### RLS decision

RLS is an optional defense-in-depth recipe, not the initial default.

It must include:

- Transaction-local verified identity context.
- Non-bypass roles.
- Pooling isolation tests.
- Explicit maintenance/admin behavior.
- Policy tests under the real runtime role.

The default’s limitation is explicit: an unscoped backend query can expose data. Scoped repositories and negative tests reduce that risk but are not equivalent to database-enforced ownership.

Install RLS before launch for products whose risk assessment requires the extra boundary.

---

## 13.4 Workspace recipe

For collaborative products, choose workspace ownership before the first feature migration:

```text
workspaces
memberships(workspace_id, user_id, role)
workspace-owned projects
```

Use composite foreign keys where needed to prevent cross-workspace relationships.

Read current membership for authorization. Do not rely on indefinitely stale role claims.

Do not scatter nullable `workspace_id` columns throughout a user-owned schema as speculative flexibility.

---

# 14. Account deletion

Deletion is a durable lifecycle workflow, not a single `DELETE` statement.

## 14.1 Fresh-authentication requirement

1. Authenticated user requests deletion authorization.
2. Server creates a short-lived, one-use challenge bound to that user and operation.
3. Client performs a provider-supported fresh-authentication flow.
4. Completion validates the intended identity, state, nonce, and authentication freshness.
5. Required MFA assurance must be preserved.
6. The challenge authorizes only account deletion and is consumed atomically.

A newly issued access token alone is not proof of fresh authentication.

The exact connection-specific Auth0 behavior must be tested, including federated login. If a configured connection cannot provide the required assurance, deletion must use a reviewed alternative—not silently skip step-up.

## 14.2 Durable processing

In one database transaction:

1. Mark user `deletion_pending`.
2. Insert a unique deletion request.
3. Record enough identity/cleanup information for retries.

Ordinary API access immediately stops.

A bounded maintenance invocation then:

1. Claims work with an expiring lease.
2. Performs installed external cleanup.
3. Deletes or disables the provider identity through the supported admin integration.
4. Removes product data according to retention policy.
5. Removes identity mappings.
6. Writes the minimal deletion tombstone.
7. Marks the workflow complete.

All steps are idempotent. An already-absent provider identity is a successful cleanup state.

### Prevent recreation by old tokens

Deleting a provider identity does not necessarily invalidate every existing signed access token immediately.

Bootstrap must reject an identity pending deletion or present in the deletion tombstone set. Retain that marker for at least the period required by the documented token, session, and revocation behavior.

Treat the marker as security data with a documented retention policy, not an excuse to retain an entire deleted profile.

### Execution

Use an authenticated Vercel Cron-triggered handler with:

- Small batches.
- Bounded outbound timeouts.
- Leases and retries.
- Alerts on stuck work.
- Execution duration below hosting limits.

Verify the selected plan supports the schedule and limits.

Uploads and billing recipes extend this workflow. Database cascades do not remove objects or cancel subscriptions.

---

# 15. API conventions

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

- Validate paths, queries, and bodies.
- Reject unexpected write fields.
- Map allowed fields explicitly.
- Cap body sizes and page sizes.
- Use cursor pagination with stable ordering.
- Return DTOs, not database rows.
- Use `404` for inaccessible private resources where appropriate.

Use a consistent Problem Details-style error:

```json
{
  "type": "https://api.example.com/problems/validation",
  "title": "Invalid request",
  "status": 422,
  "code": "VALIDATION_FAILED",
  "requestId": "req_123",
  "errors": [
    {
      "path": "name",
      "message": "Name is required"
    }
  ]
}
```

Central mappings:

- `401`: invalid/missing authentication.
- `403`: forbidden when disclosure is acceptable.
- `404`: absent or inaccessible private resource.
- `409`: conflict.
- `422`: invalid input.
- `429`: rate limit.
- `500`: generic unexpected failure.

Clients branch on stable codes, not prose.

Add idempotency for duplicate-sensitive workflows: actor/operation-scoped key, request hash, durable result, mismatched-reuse rejection.

Preserve `/api/v1` compatibility for supported native releases.

---

# 16. Testing strategy

## Unit tests: Vitest

Prioritize:

- Domain rules.
- Schemas.
- DTO/error mapping.
- API-client response parsing.
- Cancellation/retry behavior.
- Cache isolation.
- Deletion state transitions.

Avoid investing first in broad snapshot coverage.

## Database/service integration

Use disposable PostgreSQL and the real runtime role.

Mandatory tests:

- Cross-user read/update/delete.
- Forged ownership fields.
- Unauthorized reparenting.
- Concurrent provisioning.
- Failed transaction leaves no partial state.
- Suspended/deletion-pending users denied.
- Stable pagination.
- Database constraints.
- Runtime role cannot perform DDL.
- Deletion retry and lease recovery.
- Deleted identity cannot bootstrap using an old token.

Test both empty-database migration and upgrade from a representative previous schema.

## HTTP/authentication integration

Test actual HTTP boundaries, not just services receiving mocked actors.

Cover:

- Invalid, expired, wrong-issuer, wrong-audience tokens.
- Signing-key rotation.
- Invalid bearer plus valid cookie.
- Cookie mutation CSRF.
- Response-cookie propagation.
- Rate limits.
- Body limits.
- Error contract.
- Private caching behavior.

Use controlled JWT keys/JWKS for deterministic tests, plus a smaller hosted Auth0 suite.

## Browser: Playwright

Cover:

- Real-provider login smoke test.
- Core private CRUD.
- Session persistence.
- Expiry.
- Logout/account switch.
- Unauthorized resources.
- CSRF.
- No private public-cache leakage.

## Native: Maestro and device checks

Cover:

- Login and callback.
- CRUD.
- Restart.
- Renewal.
- Background/foreground.
- Interrupted login.
- Logout/account switch.

Run native smoke tests on release candidates and schedules, not every documentation change.

---

# 17. CI/CD and release safety

## PR pipeline

```text
Frozen-lockfile install
→ lint and dependency-boundary checks
→ typecheck
→ unit tests
→ PostgreSQL migrations
→ service/database integration tests
→ production web build
→ HTTP and web smoke tests
→ Expo dependency/configuration checks
→ secret scanning
```

Use Renovate or Dependabot with reviewed upgrades.

Periodically:

```text
Initialize clean product
→ doctor
→ migrations/tests
→ production web build
→ mobile JavaScript bundle build
```

Hosted identity and device credentials belong only in controlled pipelines.

## Environments

Per product:

- Local PostgreSQL and nonproduction identity.
- One isolated hosted staging environment.
- Production.
- EAS development, preview, and production profiles.

Do not send production secrets to preview deployments or allow arbitrary preview auth callbacks.

## Release sequence

1. Apply backward-compatible migrations once.
2. Deploy compatible web/API.
3. Run smoke tests.
4. Release native builds.
5. Remove old behavior only after the support window.

Use **expand-and-contract migrations**.

Do not run migrations from every server instance.

EAS updates can deliver compatible JavaScript/assets. Native dependency/runtime changes require new builds.

Web rollback, database restoration, and mobile recovery are separate procedures.

---

# 18. Security, operations, and scalability

## Secrets and logs

- Validate environment configuration at startup.
- Separate public and server environment modules.
- Nothing secret in `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`.
- Keep identity-admin credentials out of ordinary feature modules.
- Redact cookies, tokens, recovery links, and sensitive bodies.
- Rotate credentials using documented procedures.

Public configuration is not a secret; admin credentials are.

## Distributed rate limiting

Use Upstash-backed limits for writes and abuse-sensitive routes.

Apply:

- IP/edge protection before expensive unauthenticated work.
- Verified-user limits after authentication.
- Operation-specific limits.
- Spending limits for expensive external integrations.

Trust only the hosting platform’s documented client-IP path.

Failure behavior:

- Sensitive/costly operations fail closed with an availability error.
- Low-risk reads may use conservative local fallback, explicitly not a global limit.

## Resource bounds

Set limits for:

- Request bodies.
- Pagination.
- Statement duration.
- Transactions.
- Outbound HTTP calls.
- Connection pools.
- Execution time.
- External spending.

## Web security

- Tested CSP and security headers.
- Minimal third-party scripts on authenticated pages.
- No unsafe HTML without sanitization.
- Safe redirect allowlists.
- Explicit private-cache prevention.
- No unnecessary cross-origin browser API support.

Native HTTP does not require browser CORS permission.

## Upload recipe

Use private Cloudflare R2 storage when needed.

Include:

- Authorization before signed URL issuance.
- Server-generated keys.
- Short expirations.
- Size limits and post-upload checks.
- Content validation.
- Quarantine/scanning when redistributing untrusted files.
- Orphan cleanup.
- Deletion integration.
- Object recovery policy.

Signed URLs alone do not make uploads safe.

## Webhooks

Verify signatures using the required raw payload, enforce supported replay protection, and process duplicate deliveries idempotently.

## Observability

Include:

- Structured sanitized logs.
- Request IDs.
- Sentry for web/native/backend.
- Uptime checks.
- Error-rate and latency alerts.
- Database saturation monitoring.
- Deletion-workflow alerts.
- Spending alerts.

Avoid recording sensitive callback URLs or recovery links.

## Backup and restoration

Select Neon backup/PITR configuration based on explicit recovery objectives.

Perform a staging restore before launch.

Verify:

- Data and schema.
- Runtime privileges.
- Application startup.
- Identity mappings.
- Deletion reconciliation.
- External effects after the restored point.

A database restore does not rewind Auth0, billing, email, or object storage. Restoring a deleted profile must not accidentally reactivate a deleted account.

## Scaling

Start with:

- Stateless handlers.
- API/database region proximity.
- Bounded pooled connections.
- Indexed ownership queries.
- Cursor pagination.
- No N+1 queries.
- Short transactions.
- No critical work dependent on process memory.

Watch aggregate connections across serverless instances.

Add Trigger.dev when reliable asynchronous execution is needed. Use an outbox for reliable database-to-job delivery, and make handlers idempotent.

Extract Fastify when:

- Backend deployment independence becomes valuable.
- Workloads exceed the hosting model.
- Scaling requirements diverge.
- A separate team owns the backend.
- Next.js coupling creates demonstrated maintenance cost.

The extraction should move transport adapters and reuse services—not require discovering business rules hidden in route handlers.

---

# 19. Cost and trade-offs

Baseline services:

- Vercel.
- Neon.
- Auth0.
- EAS and app-store accounts.
- Transactional email.
- Monitoring.
- Small distributed rate-limiting usage.

No mandatory standalone API deployment, general-purpose worker, object storage, or build orchestration platform.

Check current pricing, environment requirements, backup availability, execution limits, and auth feature entitlements.

| Criterion | Assessment |
|---|---|
| Security | Hosted credentials, HttpOnly browser sessions, exclusive API, scoped SQL, constraints, lifecycle tests |
| Scalability | Stateless backend, PostgreSQL, bounded connections, path to durable jobs and standalone API |
| Maintainability | Feature modules, explicit identity model, transaction ownership, executable boundaries |
| Code reuse | Shared contracts, domain rules, typed client, query definitions |
| Velocity | One backend deployment and working vertical slices; no initial OpenAPI pipeline |
| Cost | Lower deployment baseline than my previous plan; Auth0 remains a deliberate commercial dependency |
| Testing | Concentrated on identity, ownership, concurrency, migrations, lifecycle, and real clients |

The principal accepted limitations are:

- Auth0 pricing and vendor dependence.
- No default database-enforced per-user isolation.
- Serverless execution and connection constraints.
- Browser session integration must pass real concurrency and hosting tests.
- Native clients require a deliberate backward-compatibility policy.

Those limitations belong in the starter’s documentation and tests, not in fine print.

---

# 20. Build order

1. Establish repository documents and executable dependency boundaries.
2. Write the identity/ownership ADR.
3. Create schema, constraints, migrations, and runtime role.
4. Implement browser and native authentication.
5. Implement explicit user provisioning.
6. Ship one private project workflow on both clients.
7. Prove cross-user isolation, CSRF protection, and refresh behavior.
8. Add recovery, deletion, cache clearing, and abuse controls.
9. Deploy to real hosting and real phones.
10. Test migrations, rollback, and restoration.
11. Build and test the initializer.
12. Tag the factory and ship the first actual product.

**The revised foundation is smaller operationally, not weaker architecturally.**

Standardize identity, ownership, contracts, transaction boundaries, migration safety, and release verification. Keep deployment separation, collaboration, background platforms, and code generation conditional on demonstrated need.

That is the reusable factory I would build: one that makes the expensive-to-fix foundations boring, without making every new product pay for a distributed system before it has users.