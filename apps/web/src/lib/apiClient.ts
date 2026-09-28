import type {
  ApiErrorResponse,
  QuizAttemptDto,
  QuizResultDto,
  StartQuizInput,
  SubmitQuizAttemptInput,
} from "@uptet/contracts";

/**
 * Small typed fetch wrappers for the browser -> our own Next.js API
 * (never the database directly — see docs/architecture.md). This is
 * NOT the `packages/api-client` mentioned in the architecture doc as a
 * future shared web/mobile package (see docs/work/current.md, "Next" #7)
 * — that's a bigger, deliberate extraction. This is just enough to stop
 * repeating the same fetch/parse/error-handling block that dashboard/
 * page.tsx already has, now that a second and third call site exist.
 *
 * Every function throws a plain Error with the server's own message on
 * failure (mirrors the pattern already used in dashboard/page.tsx), so
 * callers can catch once and show it.
 */

async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) {
    const errorBody = json as ApiErrorResponse;
    throw new Error(errorBody.error?.message ?? `Request failed (${response.status})`);
  }
  return json as TResponse;
}

export function startQuizAttempt(input: StartQuizInput): Promise<QuizAttemptDto> {
  return postJson<QuizAttemptDto>("/api/v1/quiz-attempts", input);
}

export function submitQuizAttempt(input: SubmitQuizAttemptInput): Promise<QuizResultDto> {
  return postJson<QuizResultDto>("/api/v1/quiz-attempts/submit", input);
}
