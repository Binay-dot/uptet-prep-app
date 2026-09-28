This folder is intentionally empty of route files.

`/auth/callback` (and `/auth/login`, `/auth/logout`, `/auth/profile`,
`/auth/access-token`) are all mounted automatically by the Auth0 SDK's
middleware — see `src/middleware.ts` and `src/server/auth/auth0Client.ts`.
Adding a `route.ts` here would conflict with that.
