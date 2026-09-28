import { RespondToFriendRequestInput } from "@uptet/contracts";
import { apiRoute } from "@/server/http/apiHandler";
import { respondToFriendRequest } from "@/server/modules/friends/service";

export const POST = apiRoute({
  inputSchema: RespondToFriendRequestInput,
  handler: async ({ actor, input }) => respondToFriendRequest(actor, input),
});
