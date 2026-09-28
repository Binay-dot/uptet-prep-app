import { getDb, schema } from "@uptet/database";
import { eq } from "drizzle-orm";
import type {
  UserDto,
  BootstrapUserInput,
  UpdateProfileInput,
} from "@uptet/contracts";
import type { Actor } from "../../auth/actor";
import { notFound } from "../../http/apiError";

/**
 * Every function here takes `actor` and only ever touches
 * `actor.userId`'s own row — never a caller-supplied id. This is the
 * "ownership checks live in application SQL" half of the no-RLS decision
 * (docs/security.md): the guarantee has to actually be enforced here,
 * since the database itself won't stop a query that forgot the
 * `eq(users.id, ...)` filter.
 */

function toUserDto(row: typeof schema.users.$inferSelect): UserDto {
  return {
    id: row.id,
    displayName: row.displayName,
    preparingFor: row.preparingFor as UserDto["preparingFor"],
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getMe(actor: Actor): Promise<UserDto> {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, actor.userId),
  });
  if (!user) throw notFound("User not found.");
  return toUserDto(user);
}

/**
 * Called once, right after a brand-new Auth0 identity's first request —
 * this is what actually creates the product's `users` row (the identity
 * aggregate). Idempotent: if the auth_identities row already resolved to
 * a user (i.e. resolveActor would have already returned "ok"), the route
 * calling this should not be reachable — see the route handler, which
 * only exposes bootstrap for the "unauthenticated because no identity row
 * yet" case, not for an already-bootstrapped user.
 */
export async function bootstrapUser(
  providerSubject: string,
  input: BootstrapUserInput,
): Promise<UserDto> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const existing = await tx.query.authIdentities.findFirst({
      where: eq(schema.authIdentities.providerSubject, providerSubject),
    });
    if (existing) {
      const user = await tx.query.users.findFirst({
        where: eq(schema.users.id, existing.userId),
      });
      if (user) return toUserDto(user);
    }

    const [user] = await tx
      .insert(schema.users)
      .values({
        displayName: input.displayName,
        preparingFor: input.preparingFor,
      })
      .returning();

    await tx.insert(schema.authIdentities).values({
      userId: user.id,
      provider: "auth0",
      providerSubject,
    });

    return toUserDto(user);
  });
}

export async function updateProfile(
  actor: Actor,
  input: UpdateProfileInput,
): Promise<UserDto> {
  const db = getDb();
  const [updated] = await db
    .update(schema.users)
    .set({
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.preparingFor !== undefined ? { preparingFor: input.preparingFor } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, actor.userId))
    .returning();

  if (!updated) throw notFound("User not found.");
  return toUserDto(updated);
}
