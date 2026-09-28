import { NextResponse } from "next/server";
import type { ZodTypeAny, z } from "zod";
import type { ApiErrorResponse } from "@uptet/contracts";
import { resolveActor, type Actor } from "../auth/actor";
import { ApiError } from "./apiError";

/**
 * The single entry point every route.ts file should use instead of
 * writing its own try/catch and auth check. This is what makes "complete
 * mediation" (docs/architecture.md) hold in practice rather than just in
 * a comment: a handler written with apiRoute() cannot forget the actor
 * resolution step, because there is no other way to get an Actor into
 * its callback.
 */

function requestId(): string {
  return crypto.randomUUID();
}

function errorResponse(
  code: ApiErrorResponse["error"]["code"],
  message: string,
  status: number,
  fieldErrors?: Record<string, string[]>,
): NextResponse {
  const id = requestId();
  const body: ApiErrorResponse = {
    error: { code, message, fieldErrors, requestId: id },
  };
  return NextResponse.json(body, { status });
}

const STATUS_BY_CODE: Record<ApiErrorResponse["error"]["code"], number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

interface RouteContext<TInputSchema extends ZodTypeAny | undefined> {
  actor: Actor;
  input: TInputSchema extends ZodTypeAny ? z.infer<TInputSchema> : undefined;
  request: Request;
}

interface ApiRouteOptions<TInputSchema extends ZodTypeAny | undefined> {
  /**
   * "required" (default): resolves the actor and returns UNAUTHENTICATED /
   * FORBIDDEN automatically if there isn't one. There is deliberately no
   * "optional" actor mode for a mutating endpoint — every write in this
   * app is owner-scoped, so an anonymous caller never has a legitimate
   * write to make. Read-only public endpoints (if any are ever added)
   * should be a plain Next.js route, not this wrapper, so that fact is
   * visible at a glance.
   */
  inputSchema?: TInputSchema;
  handler: (ctx: RouteContext<TInputSchema>) => Promise<unknown>;
}

export function apiRoute<TInputSchema extends ZodTypeAny | undefined = undefined>(
  options: ApiRouteOptions<TInputSchema>,
) {
  return async function route(request: Request): Promise<NextResponse> {
    try {
      const resolution = await resolveActor(request);
      if (resolution.kind === "unauthenticated") {
        return errorResponse("UNAUTHENTICATED", "Authentication required.", 401);
      }
      if (resolution.kind === "suspended") {
        return errorResponse(
          "FORBIDDEN",
          "This account is suspended pending deletion.",
          403,
        );
      }

      let input: unknown;
      if (options.inputSchema) {
        let rawBody: unknown = undefined;
        if (request.method !== "GET" && request.method !== "DELETE") {
          rawBody = await request.json().catch(() => undefined);
        }
        const parsed = options.inputSchema.safeParse(rawBody);
        if (!parsed.success) {
          const fieldErrors: Record<string, string[]> = {};
          for (const issue of parsed.error.issues) {
            const path = issue.path.join(".") || "_root";
            fieldErrors[path] = [...(fieldErrors[path] ?? []), issue.message];
          }
          return errorResponse(
            "VALIDATION_ERROR",
            "Request failed validation.",
            400,
            fieldErrors,
          );
        }
        input = parsed.data;
      }

      const result = await options.handler({
        actor: resolution.actor,
        input: input as never,
        request,
      });
      return NextResponse.json(result ?? {}, { status: 200 });
    } catch (error) {
      if (error instanceof ApiError) {
        return errorResponse(
          error.code,
          error.message,
          STATUS_BY_CODE[error.code],
          error.fieldErrors,
        );
      }
      console.error("Unhandled API error:", error);
      return errorResponse("INTERNAL_ERROR", "Something went wrong.", 500);
    }
  };
}
