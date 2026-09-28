import { UserDto } from "@uptet/contracts";
import { apiClient } from "./client";

/**
 * One example of the pattern every other endpoint should follow: a thin
 * function per API call, validating the response against the shared Zod
 * schema from @uptet/contracts (the same schema the web app's TanStack
 * Query hooks would validate against too — see packages/query, not yet
 * built).
 */
export function getMe() {
  return apiClient.request("/api/v1/me", { method: "GET", responseSchema: UserDto });
}
