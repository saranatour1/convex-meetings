import { trackAgents } from "@databuddy/sdk/agents";
import handler from "@tanstack/react-start/server-entry";
import { DATABUDDY_CLIENT_ID } from "#/lib/databuddy.ts";
import { estimateTokens, htmlToMarkdown, prefersMarkdown } from "#/lib/markdown.ts";

type Env = { ASSETS: { fetch: (request: Request) => Promise<Response> } };
type Context = { waitUntil: (promise: Promise<unknown>) => void };

const AGENT_FILE = /\.(txt|md)$/;

const markdownPage = async (request: Request) => {
  const htmlRequest = new Request(request, { headers: new Headers(request.headers) });
  htmlRequest.headers.set("Accept", "text/html");
  const page = await handler.fetch(htmlRequest);
  if (!page.headers.get("Content-Type")?.startsWith("text/html")) return page;
  const markdown = htmlToMarkdown(await page.text(), request.url);
  const headers = new Headers(page.headers);
  headers.delete("Content-Length");
  headers.set("Content-Type", "text/markdown; charset=utf-8");
  headers.set("Vary", "Accept");
  headers.set("x-markdown-tokens", String(estimateTokens(markdown)));
  return new Response(markdown, { status: page.status, headers });
};

export default {
  fetch: (request: Request, env: Env, context: Context) => {
    context.waitUntil(trackAgents(request, { websiteId: DATABUDDY_CLIENT_ID }));
    if (AGENT_FILE.test(new URL(request.url).pathname)) return env.ASSETS.fetch(request);
    return prefersMarkdown(request.headers.get("Accept"))
      ? markdownPage(request)
      : handler.fetch(request);
  },
};
