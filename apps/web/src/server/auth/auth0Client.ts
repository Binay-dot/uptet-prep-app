import { Auth0Client } from "@auth0/nextjs-auth0/server";

/**
 * The one Auth0Client instance for this deployment. Handles Universal
 * Login, session cookie issuance/verification (HttpOnly, Secure — see
 * docs/security.md), and token refresh. `middleware.ts` wires this up to
 * mount /auth/login, /auth/logout, /auth/callback, /auth/profile,
 * /auth/access-token automatically — there is deliberately no hand-written
 * route.ts under src/app/auth/callback for this reason.
 */
export const auth0 = new Auth0Client();
