import { expect, test } from "vite-plus/test";
import { detectAgent } from "./agents";

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36";
const CLAUDE_BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Claude/5.11492.5 Chrome/156.0.8078.75 Safari/537.36";

test("Claude's browser is Claude unless it names a more specific agent", () => {
  expect(detectAgent(CLAUDE_BROWSER, "Sara")).toBe("claude");
  expect(detectAgent(CLAUDE_BROWSER, "Claude Duet")).toBe("duet");
  expect(detectAgent(`${CHROME} HeadlessChrome`, "Sara")).toBe("bot");
});

test("a plain browser is named by what the agent typed", () => {
  expect(detectAgent(CHROME, "Grok Bot")).toBe("grokBot");
  expect(detectAgent(CHROME, "Grok")).toBe("grok");
  expect(detectAgent(CHROME, "ChatGPT agent")).toBe("chatgpt");
  expect(detectAgent(CHROME, "Duet")).toBe("duet");
  expect(detectAgent(CHROME, "Claude Code")).toBe("claude");
  expect(detectAgent(CHROME, "Meeting bot")).toBe("bot");
});

test("people who only share a name with an agent stay people", () => {
  expect(detectAgent(CHROME, "Claude")).toBeNull();
  expect(detectAgent(CHROME, "Claude Monet")).toBeNull();
  expect(detectAgent(CHROME, "Abbot Smith")).toBeNull();
  expect(detectAgent(CHROME, "Sara")).toBeNull();
});
