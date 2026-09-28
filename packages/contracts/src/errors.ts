import { z } from "zod";

/**
 * Every API error response uses this shape. Clients branch on `code`
 * (a stable machine string), never on `message` (human text that can
 * change wording without warning).
 */
export const ApiErrorResponse = z
  .object({
    error: z.object({
      code: z.enum([
        "VALIDATION_ERROR",
        "UNAUTHENTICATED",
        "FORBIDDEN",
        "NOT_FOUND",
        "CONFLICT",
        "RATE_LIMITED",
        "INTERNAL_ERROR",
      ]),
      message: z.string(),
      fieldErrors: z.record(z.array(z.string())).optional(),
      requestId: z.string(),
    }),
  })
  .strict();
export type ApiErrorResponse = z.infer<typeof ApiErrorResponse>;
