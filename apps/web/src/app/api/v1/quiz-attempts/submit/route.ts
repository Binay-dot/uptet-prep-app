import { SubmitQuizAttemptInput } from "@uptet/contracts";
import { apiRoute } from "@/server/http/apiHandler";
import { submitQuiz } from "@/server/modules/quiz/service";

/**
 * `attemptId` is a field in the body (SubmitQuizAttemptInput), not a
 * dynamic route segment — this keeps the ownership check (does this
 * attempt belong to actor.userId?) inside submitQuiz's normal
 * service-layer validation path rather than needing a second lookup just
 * to resolve a [attemptId] URL segment before we even know who's asking.
 */
export const POST = apiRoute({
  inputSchema: SubmitQuizAttemptInput,
  handler: async ({ actor, input }) => submitQuiz(actor, input),
});
