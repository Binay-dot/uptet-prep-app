import { StartQuizInput } from "@uptet/contracts";
import { apiRoute } from "@/server/http/apiHandler";
import { startQuiz } from "@/server/modules/quiz/service";

export const POST = apiRoute({
  inputSchema: StartQuizInput,
  handler: async ({ actor, input }) => startQuiz(actor, input),
});
