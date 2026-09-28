import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Verifies a mobile app's Auth0 access token (Authorization: Bearer ...).
 * Web requests never take this path — they use the HttpOnly session
 * cookie instead (see actor.ts). Throws on any invalid, expired, or
 * mis-audienced token; callers must not catch this and silently fall back
 * to treating the request as unauthenticated-but-maybe-cookie-based — see
 * docs/security.md: "A request with an Authorization header must use it —
 * never silently fall back to a cookie if the bearer token is invalid."
 */

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks() {
  if (!jwks) {
    const domain = process.env.AUTH0_DOMAIN;
    if (!domain) {
      throw new Error("AUTH0_DOMAIN is not set.");
    }
    jwks = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));
  }
  return jwks;
}

export interface BearerTokenClaims {
  /** Auth0's stable subject identifier — matches auth_identities.provider_subject. */
  sub: string;
}

export async function verifyBearerToken(
  token: string,
): Promise<BearerTokenClaims> {
  const domain = process.env.AUTH0_DOMAIN;
  const audience = process.env.AUTH0_AUDIENCE;
  if (!domain || !audience) {
    throw new Error("AUTH0_DOMAIN / AUTH0_AUDIENCE is not set.");
  }

  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: `https://${domain}/`,
    audience,
  });

  if (typeof payload.sub !== "string") {
    throw new Error("Bearer token has no subject claim.");
  }

  return { sub: payload.sub };
}
