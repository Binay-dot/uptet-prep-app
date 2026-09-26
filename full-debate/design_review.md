## Overall assessment

Both plans are credible foundations. They now agree on the important structural decisions: one authoritative product API, managed authentication, explicit ownership checks, transaction-owning services, and genuinely shareable contracts and domain code.

**B has the stronger default browser credential boundary and a more flexible identity model. A has a simpler provider arrangement and a more concrete initial database schema.** Neither advantage makes the corresponding implementation automatically correct.

I would approve both **conditionally**, with the authentication and deletion issues below resolved before certifying either factory. These are reviews of the proposed designs—not recommendations to replace their stacks.

---

## Architect A: specific issues

### A1. Browser refresh credentials remain extractable through XSS

**Area:** Authentication/security  
**Priority:** High; explicitly accepted architectural risk

A correctly acknowledges that its standard Supabase browser integration exposes credentials to JavaScript. CSP, dependency hygiene, and safe rendering reduce the likelihood of XSS; they do not contain credential theft once arbitrary JavaScript executes.

For a reusable factory, “ordinary personal product” is not a sufficiently precise security classification. The decision needs to account for stored data, credential lifetime, and the consequences of off-device token reuse.

**Fixing pattern: Backend for Frontend with server-managed credentials.**

A already proposes this as a recipe. That recipe needs to be implemented and certified—not merely documented—before products requiring credential-exfiltration containment use the factory. Products retaining the default need an explicit threat-model acceptance.

---

### A2. Email OTP confirmation can reduce authentication assurance

**Area:** Authentication/security  
**Priority:** Release blocker for accounts with stronger authentication

Verifying an email OTP proves fresh access to the mailbox. It does not necessarily preserve the assurance of the original login, especially for MFA-protected accounts.

The proposed flow also creates a temporary Supabase authentication session. Saying it authorizes “only deletion” is an application intention, not inherently a property of that session.

**Fixing pattern: Assurance-preserving step-up authentication with a transaction-bound capability.**

The deletion authorization should be:

- Bound to the original application identity.
- Bound to the deletion operation.
- Short-lived and single-use.
- Consumed atomically.
- Subject to an explicit assurance policy.

If email OTP remains the mechanism, its supported account classes and temporary-session cleanup must be specified and tested. It must not silently replace stronger authentication.

---

### A3. Provider identity deletion bypasses the application deletion workflow

**Area:** Database/lifecycle correctness  
**Priority:** High

The chain:

```text
auth.users deletion
→ app.users cascade
→ projects/items cascade
```

allows an administrative provider deletion to destroy product records without first creating the durable cleanup request.

That can leave files, subscriptions, or other external resources orphaned. It can also remove the identifiers needed to clean them up.

**Fixing pattern: Explicit aggregate lifecycle with durable cleanup intent and reconciliation.**

Within A’s chosen schema, the design must either:

- Prevent ordinary administrative deletion outside the application workflow, while detecting exceptional deletions; or
- Persist cleanup intent and required identifiers before the cascade, including for out-of-band deletion.

An operational instruction alone is insufficient. Add a test for provider-admin deletion, not just deletion through the product UI.

---

### A4. Private-schema protection is not fully specified across Supabase interfaces

**Area:** Security/database boundary  
**Priority:** High

A tests PostgREST denial and revokes table access, which is good. However, the claimed boundary is broader: **no client-accessible Supabase mechanism may expose product data**.

The design should explicitly cover exposed RPC functions, function execution privileges, security-definer functions, views, and any Realtime configuration introduced by later recipes. A public function can accidentally reintroduce access to otherwise private tables.

**Fixing pattern: Deny-by-default database capability boundary with architectural fitness tests.**

Add automated catalog/configuration checks for exposed schemas, grants, callable functions, and enabled data-delivery paths. Repeat them after every migration and recipe installation.

---

### A5. Authentication has an external network dependency on every product request

**Area:** Scalability/availability  
**Priority:** Medium

A acknowledges `getUser()` latency, but the operational effect is larger: an identity-provider outage or throttling event can stop otherwise healthy product reads and writes.

This can be an acceptable starting trade-off, but the design lacks a defined authentication timeout and failure classification. An identity lookup outage should not be reported as invalid credentials or trigger client logout.

**Fixing pattern: Bulkhead isolation and failure classification; cached-key JWT verification when justified.**

Specify:

- Bounded identity lookup duration.
- Availability errors distinct from `401`.
- No session destruction on transient provider failure.
- Monitoring and an explicit threshold for adopting the proposed local-verification path.

Do not add a fail-open authentication fallback.

---

## Architect B: specific issues

### B1. Deletion step-up is still a protocol sketch, not a concrete implementation

**Area:** Authentication/security  
**Priority:** Release blocker

B’s assurance policy is stronger than A’s, but “provider-supported fresh authentication” leaves the most difficult implementation unspecified.

Missing details include:

- Challenge persistence and schema.
- The web and native initiation/callback paths.
- Which trusted artifact proves authentication freshness.
- How `auth_time`, nonce, identity, and required assurance are validated.
- How challenge consumption and the deletion transition are atomic.

A new access token, a login screen, or a recent callback is not independently proof of fresh authentication.

**Fixing pattern: Transaction authorization using a server-side, single-use challenge state machine.**

The factory must ship one working flow for each supported connection class. Unsupported connections need an explicit failure or reviewed alternative—not a runtime assumption.

---

### B2. The identity model permits multiple identities, but deletion does not define their lifecycle

**Area:** Authentication/database correctness  
**Priority:** High

`auth_identities` permits multiple external identities per application user. The deletion procedure then refers to deleting “the provider identity.”

That is ambiguous for:

- Multiple mappings to the same product user.
- Provider-linked accounts.
- Provider subject changes after linking or unlinking.
- Tokens issued before an identity mapping changed.

Deleting or tombstoning only the currently authenticated identity can leave another path back into the account.

**Fixing pattern: Identity aggregate with explicit link/unlink and deletion invariants.**

Either constrain the starter to one mapping per user until linking is implemented, or define lifecycle handling for every mapping. Deletion must snapshot and process the complete relevant identity set, with tests for surviving and stale identities.

---

### B3. Bootstrap and deletion tombstones have a potential concurrency gap

**Area:** Database/security correctness  
**Priority:** Release blocker

B correctly identifies old-token recreation and introduces tombstones. But the stated sequence removes identity mappings before writing the tombstone, without explicitly making those local changes atomic.

A concurrent bootstrap could observe:

```text
No identity mapping
No tombstone
→ provision a new user
```

Even an atomic final deletion transaction is not enough if bootstrap checks tombstones and inserts mappings without coordinating against deletion.

**Fixing pattern: Serialized identity lifecycle transitions.**

Provisioning and deletion must coordinate on a stable identity key, using an appropriate lock or equivalent database-enforced lifecycle record. Mapping removal and tombstone creation must commit atomically.

Add a concurrent bootstrap-versus-deletion test—not only a sequential “old token is rejected” test.

---

### B4. The bearer verifier needs a product-user principal contract

**Area:** Authentication/security  
**Priority:** High if non-user grants are enabled

Issuer, audience, signature, and expiry validation establish that Auth0 issued a token for the API. They do not necessarily establish that it represents an interactive human user eligible for product provisioning.

If the API later accepts client-credentials grants or additional authorized applications, bootstrap must not interpret every valid `sub` as a product user.

**Fixing pattern: Typed principals with an explicit authentication policy.**

Define a `UserActor` separately from service principals. Disable unused grant types and validate the provider-supported claims or configuration needed to distinguish allowed user tokens. Apply authorized-client restrictions where the product boundary requires them.

Test that a valid token representing an unsupported principal cannot bootstrap a user.

---

### B5. The schema is less concrete than the lifecycle complexity requires

**Area:** Database soundness  
**Priority:** High before implementation

B names the right entities, but the most security-sensitive tables remain field lists. The plan does not specify:

- Exact foreign-key deletion actions.
- Identity field nullability and uniqueness details.
- Whether identity reassignment is allowed.
- Tombstone key and retention representation.
- Deletion-state constraints.
- Lease ownership and claim-generation fields.
- One-active-deletion-request uniqueness.

These are not incidental ORM details; they determine whether the lifecycle survives concurrency and retries.

**Fixing pattern: Constraint-first schema design with explicit state-machine persistence.**

Provide reviewed SQL/Drizzle definitions for these tables, including constraints and transitions, plus tests that invalid states cannot be stored.

A also needs this treatment for its deletion table, although its core CRUD schema is substantially more concrete.

---

## Issues shared by both plans

### C1. Correctness-critical authorization is still too dependent on caller discipline

**Area:** Security/maintainability  
**Priority:** High

Scoped query names are useful, but nothing specified prevents a new route from importing Drizzle directly or an SSR path from skipping account-status resolution.

The plans enforce client/server boundaries more concretely than they enforce authorization boundaries.

**Fixing pattern: Complete mediation through a policy-enforcing application boundary.**

Add executable dependency rules:

- Routes and rendering code cannot access database clients directly.
- Product services receive a verified actor through a centralized entry path.
- Administrative repositories are inaccessible to ordinary product modules.
- Raw database access is limited to approved persistence modules.

Keep negative authorization tests. These restrictions complement them; they do not replace RLS where stronger database isolation is required.

---

### C2. Deletion leases do not yet prevent stale workers from committing progress

**Area:** Database/scalability  
**Priority:** High

Both plans use expiring leases and retries. Neither explicitly describes what happens when worker A pauses, its lease expires, worker B claims the request, and A resumes.

Idempotency helps with repeated effects, but does not prevent stale workers from overwriting workflow state.

**Fixing pattern: Leased work with fencing tokens and compare-and-swap transitions.**

Claims need an owner or generation token. Every progress update must verify it still owns the current claim. External operations need idempotency or “already absent” semantics independently.

Test lease expiry while the original invocation is still running.

---

### C3. Large account deletion can exceed the serverless execution model

**Area:** Scalability/database operations  
**Priority:** Medium

“Small batches” limits deletion requests, not the size of one account. A single account can own enough rows to make a cascade or large transaction generate substantial locks, WAL, and execution time.

A’s provider-triggered cascade makes this particularly important.

**Fixing pattern: Resumable, chunked purge with an immediate logical access barrier.**

Keep `deletion_pending` as the immediate denial mechanism. Define a bounded physical purge strategy and the conditions under which the existing durable-job recipe becomes necessary. Test with a large representative account.

---

### C4. Shared code is logically separated but not yet proven portable

**Area:** Web/native code reuse  
**Priority:** High for factory certification

Both plans identify the correct things to share. Neither fully specifies package resolution and build behavior across Next.js, Metro, Node, and test runners.

Common failures include duplicate React installations, DOM types leaking into shared packages, Node-only transitive dependencies, incompatible exports, and workspace sources that one bundler transpiles differently.

**Fixing pattern: Platform-neutral core with explicit package export and build contracts.**

Specify and test:

- Runtime dependency and peer-dependency rules.
- Shared-package TypeScript environments.
- Source-versus-built package consumption.
- Package exports and platform-specific adapters.
- Resolution through both Next.js and Metro.

For changes to shared runtime packages, build both the web app and the native bundle in PR CI—not only periodically.

---

### C5. Native backward compatibility is promised, but not concretely tested

**Area:** Contracts/testing  
**Priority:** High

Both plans require compatibility with released mobile clients. Neither gives a concrete mechanism.

Testing the current client against the current backend does not prove that an installed older app still works. Shared Zod schemas can actually hide breaking changes when server and client tests update together.

**Fixing pattern: Consumer-driven contract testing with versioned released-client fixtures.**

Retain representative requests, responses, and client parsing behavior from supported mobile releases. Exercise the current API against them.

Define a support window and rules for enum expansion, response changes, pagination, and error-code evolution.

---

### C6. Security invariants are not yet systematic enough for a growing factory

**Area:** Testing/CI  
**Priority:** High

The proposed test lists are strong, but handwritten lists can become incomplete as routes multiply. New exports, search endpoints, bulk operations, and SSR reads are especially easy to miss.

**Fixing pattern: Authorization matrix testing backed by an endpoint inventory.**

Every protected operation should declare its authentication and ownership policy. CI should require applicable tests for:

- Anonymous caller.
- Owner.
- Different user.
- Suspended/deleting user.
- Supported authentication modes.

This makes test coverage an architectural obligation rather than a convention remembered by the author.

---

### C7. CI is a deployment checklist, not yet a secured production boundary

**Area:** Security/CI/CD  
**Priority:** High

Both plans include secret scanning and controlled pipelines. Neither concretely specifies workflow permissions, deployment approval, action pinning, migration serialization, or artifact provenance.

A compromised workflow or racing deployment can bypass otherwise careful application and schema controls.

**Fixing pattern: Least-privilege CI/CD with protected environments and serialized promotion.**

Require:

- Minimal job permissions.
- Pinned third-party actions and reviewed dependency changes.
- Short-lived cloud credentials where supported.
- Protected production environments.
- Serialized migration/deployment jobs.
- Promotion of tested artifacts rather than an unrelated rebuild.
- A staging-versus-production configuration checklist.

---

## Approval conditions

Before either template is tagged as reusable, I would require:

1. **A working, tested deletion step-up and lifecycle implementation**, including concurrency and out-of-band identity changes.
2. **Executable authorization boundaries**, not just scoped repository naming.
3. **Both-client build verification and released-mobile contract tests.**
4. **Protected, serialized production deployment and migration workflows.**
5. **Evidence from deployed authentication tests**, especially cookie propagation, refresh concurrency, real native callbacks, and account switching.

B is ahead on browser credential containment. A is ahead on initial schema specificity and provider consolidation. The remaining decision should not be settled by architecture prose: **certification results for these concrete failure modes are the evidence that matters.**