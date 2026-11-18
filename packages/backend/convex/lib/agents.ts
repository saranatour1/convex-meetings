import { z } from "zod";
import { env } from "../_generated/server";

export const zAgent = z.enum(["duet", "grokBot", "grok", "chatgpt", "claude", "bot"]);

export type Agent = z.infer<typeof zAgent>;

const SIGNS: { agent: Agent; userAgent: RegExp; name: RegExp }[] = [
  { agent: "duet", userAgent: /\bDuet\b/i, name: /\bduet\b/i },
  { agent: "grokBot", userAgent: /\bGrok ?Bot\b/i, name: /\bgrok[\s-]*bot\b/i },
  { agent: "grok", userAgent: /\b(Grok|xAI)\b/i, name: /\bgrok\b/i },
  { agent: "chatgpt", userAgent: /\b(ChatGPT|OpenAI)\b/i, name: /\b(chatgpt|openai|codex)\b/i },
  { agent: "claude", userAgent: /\bClaude\//, name: /\bclaude[\s-]+(code|bot|ai|agent)\b/i },
  { agent: "bot", userAgent: /\b(HeadlessChrome|bot)\b/i, name: /\b(bot|ai agent)\b/i },
];

export const detectAgent = (userAgent: string, name: string): Agent | null =>
  SIGNS.find((sign) => sign.userAgent.test(userAgent) || sign.name.test(name))?.agent ?? null;

const APP_STORE_ICONS: Record<Exclude<Agent, "bot">, string> = {
  duet: "Purple211/v4/00/51/b2/0051b26e-313f-1f1d-1338-2e2b1a04f8d7/AppIcon-0-0-1x_U007epad-0-1-85-220.png",
  grokBot:
    "Purple221/v4/d9/24/5e/d9245e90-112e-2774-bf66-a29363a9acdd/app-0-0-1x_U007epad-0-0-0-1-0-0-0-85-220.png",
  grok: "Purple221/v4/f7/3a/cd/f73acd43-b2dc-eb55-d794-8b87869ef160/AppIcon-0-0-1x_U007epad-0-0-0-1-0-0-0-85-220.png",
  chatgpt:
    "Purple211/v4/fb/80/03/fb80039a-f8c2-f1ca-4fbd-7f9d77909b03/AppIcon-0-0-1x_U007epad-0-0-0-1-0-85-220.png",
  claude:
    "Purple221/v4/54/b2/9e/54b29e8c-1a68-d582-6e0e-c83cf7d11ccc/AppIcon-0-0-1x_U007epad-0-1-85-220.png",
};

export const agentImageUrl = (agent: Agent) =>
  agent === "bot"
    ? `${env.SITE_URL}/agents/bot.svg`
    : `https://is1-ssl.mzstatic.com/image/thumb/${APP_STORE_ICONS[agent]}/256x256bb.png`;
