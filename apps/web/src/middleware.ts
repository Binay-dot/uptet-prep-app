import type { NextRequest } from "next/server";
import { auth0 } from "./server/auth/auth0Client";

/**
 * Mounts the Auth0 SDK's own routes (/auth/login, /auth/logout,
 * /auth/callback, /auth/profile, /auth/access-token,
 * /auth/backchannel-logout) and refreshes the session cookie on every
 * request. This is intentionally the ONLY thing this middleware does —
 * it must not also perform authorization, because authorization is done
 * once, centrally, per request in server/auth/actor.ts (the "complete
 * mediation" pattern from docs/architecture.md: one path, not two places
 * that can drift apart).
 */
export async function middleware(request: NextRequest) {
  return auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
