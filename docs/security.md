# Security

## Who owns what

**Auth0 owns:** passwords, password hashing, email verification, password
recovery, social login, sessions, refresh tokens.

**The application owns:** the product user record, account status, ownership
of every product record, entitlements, and account deletion.

Never create your own password or refresh-token tables — that duplicates
what Auth0 already does correctly.

## Session handling

- Web: HttpOnly, Secure session cookie via the official Auth0 Next.js SDK.
  Browser JavaScript never has access to tokens. Disable any optional
  browser-accessible token endpoint the SDK offers.
- Mobile: Authorization Code + PKCE, tokens stored via the platform's secure
  credentials manager (never AsyncStorage, never plain state, never logs).
- A request with an `Authorization` header must use it — never silently
  fall back to a cookie if the bearer token is invalid.

## Every protected operation must declare

- Its auth requirement (must be logged in — yes/no)
- Its ownership rule (who is allowed to touch this specific record)
- Which auth modes it accepts (cookie, bearer, or both)

And it must have a test for each of: anonymous caller, the owner, a
different logged-in user, a suspended/deleting user.

## Account deletion (the part most apps get wrong)

Deletion is a multi-step, durable workflow — never a single `DELETE`
statement triggered straight from a button:

1. Require a **fresh, single-use, short-lived authentication challenge**
   before deletion is authorized. A normal access token issued five minutes
   ago is not proof the human is present right now.
2. Mark the account `deletion_pending` immediately (this blocks ordinary API
   access right away).
3. A background job — with an expiring lease and a fencing/generation
   token, so a resumed stale worker can't overwrite newer progress —
   actually removes external resources and product data in bounded batches.
4. Keep a "tombstone" record so an old, still-valid token can't recreate the
   deleted account by accident.

## Secrets

- Nothing secret goes in `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` — those are
  bundled into client code and are effectively public.
- Runtime database credentials, Auth0 management keys, and cron secrets are
  server-only.
- Use a separate, more restricted database role for ordinary requests than
  for migrations.

## What this template does NOT default to (and why)

- **No Row Level Security (RLS) by default.** Ownership checks live in the
  application's SQL. This is a known, accepted limitation — a backend bug
  could in theory issue an unscoped query. If this app handles especially
  sensitive data, install the RLS recipe before launch (see the factory's
  `recipes/` folder) rather than assuming the default is enough.
