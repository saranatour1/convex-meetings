import { z } from "zod";
import { env } from "../_generated/server";

export const zAgent = z.enum(["claude", "grok", "chatgpt", "bot"]);

export type Agent = z.infer<typeof zAgent>;

const SIGNS: { agent: Agent; userAgent: RegExp; name: RegExp }[] = [
  { agent: "claude", userAgent: /\bClaude\//, name: /\bclaude[\s-]+(code|bot|ai|agent)\b/i },
  { agent: "grok", userAgent: /\b(Grok|xAI)\b/i, name: /\bgrok\b/i },
  { agent: "chatgpt", userAgent: /\b(ChatGPT|OpenAI)\b/i, name: /\b(chatgpt|openai|codex)\b/i },
  { agent: "bot", userAgent: /\b(HeadlessChrome|bot)\b/i, name: /\b(bot|ai agent)\b/i },
];

export const detectAgent = (userAgent: string, name: string): Agent | null =>
  SIGNS.find((sign) => sign.userAgent.test(userAgent))?.agent ??
  SIGNS.find((sign) => sign.name.test(name))?.agent ??
  null;

export const agentImageUrl = (agent: Agent) => `${env.SITE_URL}/agents/${agent}.svg`;
