import { SendFriendRequestInput } from "@uptet/contracts";
import { apiRoute } from "@/server/http/apiHandler";
import { listFriends, sendFriendRequest } from "@/server/modules/friends/service";

export const GET = apiRoute({
  handler: async ({ actor }) => listFriends(actor),
});

export const POST = apiRoute({
  inputSchema: SendFriendRequestInput,
  handler: async ({ actor, input }) => sendFriendRequest(actor, input),
});
