import { NextResponse } from "next/server";
import { SectionId } from "@uptet/contracts";
import { resolveActor } from "@/server/auth/actor";
import { getSectionLeaderboard } from "@/server/modules/friends/service";

/**
 * A GET-with-query-params endpoint, so it doesn't fit apiRoute()'s body-
 * validation shape — it resolves the actor itself instead. Still goes
 * through the same resolveActor() choke point, so "complete mediation"
 * still holds; only the body-schema convenience is skipped here.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const resolution = await resolveActor(request);
  if (resolution.kind !== "ok") {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required.", requestId: crypto.randomUUID() } },
      { status: 401 },
    );
  }

  const sectionIdRaw = new URL(request.url).searchParams.get("sectionId");
  const parsed = SectionId.safeParse(sectionIdRaw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "sectionId query param is required and must be a valid section.",
          requestId: crypto.randomUUID(),
        },
      },
      { status: 400 },
    );
  }

  const leaderboard = await getSectionLeaderboard(resolution.actor, parsed.data);
  return NextResponse.json(leaderboard, { status: 200 });
}
