import type { ApiErrorResponse } from "@uptet/contracts";

/**
 * Thrown by service-layer code; caught centrally in apiHandler.ts and
 * turned into the stable ApiErrorResponse shape from @uptet/contracts.
 * Service code should throw this instead of returning ad-hoc error
 * objects, so every route's error shape is identical by construction.
 */
export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorResponse["error"]["code"],
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function notFound(message = "Not found"): ApiError {
  return new ApiError("NOT_FOUND", message);
}

export function forbidden(message = "Forbidden"): ApiError {
  return new ApiError("FORBIDDEN", message);
}

export function unauthenticated(message = "Authentication required"): ApiError {
  return new ApiError("UNAUTHENTICATED", message);
}

export function conflict(message: string): ApiError {
  return new ApiError("CONFLICT", message);
}
