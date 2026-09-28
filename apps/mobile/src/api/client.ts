import type { z } from "zod";
import { ApiErrorResponse } from "@uptet/contracts";
import { getValidAccessToken } from "../auth/authClient";

/**
 * The one place that calls the backend. Every call attaches the bearer
 * token from the secure store — this is the mobile half of the "one
 * product-data path" in docs/architecture.md (browser uses the HttpOnly
 * cookie automatically; mobile must attach this header explicitly on
 * every request, there's no cookie jar to rely on).
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

export class ApiRequestError extends Error {
  constructor(public readonly response: ApiErrorResponse) {
    super(response.error.message);
    this.name = "ApiRequestError";
  }
}

async function request<TResponseSchema extends z.ZodTypeAny>(
  path: string,
  options: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    responseSchema: TResponseSchema;
  },
): Promise<z.infer<TResponseSchema>> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw new Error("Not signed in.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await response.json();

  if (!response.ok) {
    const parsedError = ApiErrorResponse.safeParse(json);
    if (parsedError.success) {
      throw new ApiRequestError(parsedError.data);
    }
    throw new Error(`Request to ${path} failed with status ${response.status}.`);
  }

  return options.responseSchema.parse(json);
}

export const apiClient = { request };
