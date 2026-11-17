import { trackAgents } from "@databuddy/sdk/agents";
import handler from "@tanstack/react-start/server-entry";
import { DATABUDDY_CLIENT_ID } from "#/lib/databuddy.ts";

type Env = { ASSETS: { fetch: (request: Request) => Promise<Response> } };
type Context = { waitUntil: (promise: Promise<unknown>) => void };

const AGENT_FILE = /\.(txt|md)$/;

export default {
  fetch: (request: Request, env: Env, context: Context) => {
    context.waitUntil(trackAgents(request, { websiteId: DATABUDDY_CLIENT_ID }));
    return AGENT_FILE.test(new URL(request.url).pathname)
      ? env.ASSETS.fetch(request)
      : handler.fetch(request);
  },
};
