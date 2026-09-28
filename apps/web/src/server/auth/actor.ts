import { getDb, schema } from "@uptet/database";
import { and, eq } from "drizzle-orm";
import { auth0 } from "./auth0Client";
import { verifyBearerToken } from "./verifyBearerToken";

/**
 * "Complete mediation" (docs/architecture.md): this is the ONE function
 * that turns an incoming request into a resolved caller identity. Every
 * route handler calls this — directly or via server/http/apiHandler.ts —
 * and nothing else in the codebase is allowed to read auth_identities or
 * trust a caller-supplied user id. A new route cannot accidentally skip
 * authorization by construction, because it has no other way to reach the
 * database's ownership-scoped queries without an Actor in hand.
 */
export interface Actor {
  userId: string;
  role: (typeof schema.userRoleEnum.enumValues)[number];
}

export type ActorResolution =
  | { kind: "unauthenticated" }
  | { kind: "suspended" }
  | { kind: "ok"; actor: Actor };

async function loadActorForProviderSubject(
  providerSubject: string,
): Promise<ActorResolution> {
  const db = getDb();

  const identity = await db.query.authIdentities.findFirst({
    where: eq(schema.authIdentities.providerSubject, providerSubject),
  });
  if (!identity) {
    return { kind: "unauthenticated" };
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, identity.userId),
  });
  if (!user) {
    return { kind: "unauthenticated" };
  }

  if (user.lifecycleStatus !== "active") {
    // Covers both `pending_deletion` and `deleted` — a deletion in flight
    // blocks ordinary API access immediately (docs/security.md, step 2 of
    // account deletion), it doesn't wait for the background job to finish.
    return { kind: "suspended" };
  }

  return { kind: "ok", actor: { userId: user.id, role: user.role } };
}

/**
 * Resolves the caller of the current request.
 *
 * - If an Authorization header is present, it MUST be a valid bearer
 *   token — this is the mobile app's path. An invalid bearer token is
 *   `unauthenticated`, full stop; it never falls back to checking for a
 *   session cookie (docs/security.md).
 * - Otherwise, falls back to the HttpOnly session cookie — the web app's
 *   path.
 */
export async function resolveActor(request: Request): Promise<ActorResolution> {
  const authorizationHeader = request.headers.get("authorization");

  if (authorizationHeader) {
    const [scheme, token] = authorizationHeader.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      return { kind: "unauthenticated" };
    }
    try {
      const claims = await verifyBearerToken(token);
      return loadActorForProviderSubject(claims.sub);
    } catch {
      return { kind: "unauthenticated" };
    }
  }

  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { kind: "unauthenticated" };
  }
  return loadActorForProviderSubject(session.user.sub);
}
