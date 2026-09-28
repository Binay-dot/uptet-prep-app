# Lessons for the factory

Running notes on anything built here that's generic enough to backport into
the `app-factory` template. Check this before closing out a feature — see
`docs/runbooks/backporting.md` (also present in the factory repo) for the
full process. One line is enough here; do the actual backporting later,
in a batch, not mid-task.

## Format
- `[ ]` not yet backported — `[x]` done

## Log

- [ ] **Domain-package pattern for statistical/business logic.** Splitting
  pure calculation logic (IRT ability estimation, predicted score mapping)
  into its own `packages/domain` with no framework dependencies, unit
  tested with vitest against monotonicity/range properties rather than
  exact values, worked well and generalizes to any product with
  non-trivial scoring/business rules. Worth making `packages/domain` a
  standard factory package (currently product-specific by name/content,
  but the *shape* — pure functions, framework-free, property-based tests
  — is generic).

- [ ] **`apiRoute()` wrapper for complete mediation.** The
  `apps/web/src/server/http/apiHandler.ts` wrapper (resolves the actor,
  validates the body against a Zod schema, catches errors into a stable
  `ApiErrorResponse` shape) made "a new route can't accidentally skip
  authorization" true by construction, not just by convention. This is
  generic enough to lift into the factory template as-is (it doesn't
  reference anything UPTET-specific) — same for `server/auth/actor.ts`'s
  `resolveActor()` shape (cookie session OR bearer token, never a silent
  fallback from an invalid bearer to the cookie).

- [ ] **`getDb()` type-annotation trap.** Spent real debugging time on:
  `let cachedClient: ReturnType<typeof drizzle> | undefined` silently
  collapses Drizzle's relational query builder (`db.query.*`) to an empty
  type, because `typeof drizzle` captures the *unapplied* generic
  signature and `ReturnType<>` falls back to the default type parameter.
  Fix: annotate explicitly as `PostgresJsDatabase<typeof schema>`. Worth a
  one-line warning comment in the factory's database package template so
  the next product doesn't lose the same hour.

- [ ] **Mixed React versions (Next.js web + Expo mobile) in one pnpm
  workspace breaks TS's ambient JSX types.** Next's own `.d.ts` files
  import `"react"` as a *type-only* import; when that resolution climbs
  past next's own dependency folder into pnpm's shared virtual-store hoist
  folder, it can pick up the WRONG @types/react version (mobile's, e.g.
  React 18) if mobile happens to "win" that shared slot — causing spurious
  `TS2742`/type-mismatch errors on every page/layout component, even
  though each app's own explicit imports resolve correctly. Fixed via a
  `pnpm.packageExtensions` entry in the root package.json declaring `next`
  peer-depends on `@types/react`, which forces pnpm to resolve it
  contextually (against web's own devDependency) instead of falling
  through to the ambiguous shared hoist. This will bite every future
  product that has both a Next.js web app and an Expo mobile app in the
  same workspace — this fix (or the root cause explanation) belongs in
  the factory template's `docs/architecture.md` or a dedicated runbook,
  not just here.

- [ ] **Explicit return-type annotations on Next.js Server Components.**
  As a secondary mitigation for the above (and generally cheap
  insurance), annotating page/layout components with `: ReactElement` /
  `: Promise<ReactElement>` instead of leaving the return type inferred
  avoids TS having to "print a portable name" for an inferred JSX type at
  all. Cheap enough to just be the default pattern in the factory's
  Next.js page templates.
