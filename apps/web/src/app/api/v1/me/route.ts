import { NextResponse } from "next/server";
import { BootstrapUserInput, UpdateProfileInput } from "@uptet/contracts";
import { apiRoute } from "@/server/http/apiHandler";
import { bootstrapUser, getMe, updateProfile } from "@/server/modules/users/service";
import { auth0 } from "@/server/auth/auth0Client";

export const GET = apiRoute({
  handler: async ({ actor }) => getMe(actor),
});

export const PATCH = apiRoute({
  inputSchema: UpdateProfileInput,
  handler: async ({ actor, input }) => updateProfile(actor, input),
});

/**
 * NOT wrapped in apiRoute(), deliberately: apiRoute() requires an already
 * -resolved Actor, and there is no Actor yet for a brand-new sign-up (no
 * auth_identities row -> no users row). This route instead reads the
 * Auth0 session directly and creates that first row. It still refuses to
 * run if a users row already exists for this identity (bootstrapUser() is
 * idempotent, but this route makes the "one-time" intent explicit rather
 * than quietly allowing POST /api/v1/me to double as an update endpoint —
 * PATCH is what updates an existing user).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in first.", requestId: crypto.randomUUID() } },
      { status: 401 },
    );
  }

  const rawBody = await request.json().catch(() => undefined);
  const parsed = BootstrapUserInput.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request failed validation.",
          requestId: crypto.randomUUID(),
        },
      },
      { status: 400 },
    );
  }

  const user = await bootstrapUser(session.user.sub, parsed.data);
  return NextResponse.json(user, { status: 201 });
}
