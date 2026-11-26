import { expect, test } from "vite-plus/test";
import { htmlToMarkdown, prefersMarkdown } from "./markdown.ts";

test("markdown is served only when the client prefers it over HTML", () => {
  expect(prefersMarkdown(null)).toBe(false);
  expect(prefersMarkdown("*/*")).toBe(false);
  expect(prefersMarkdown("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")).toBe(
    false,
  );
  expect(prefersMarkdown("text/html, text/markdown;q=0.5")).toBe(false);
  expect(prefersMarkdown("text/markdown")).toBe(true);
  expect(prefersMarkdown("Text/Markdown")).toBe(true);
  expect(prefersMarkdown("text/markdown, text/html;q=0.9")).toBe(true);
  expect(prefersMarkdown("text/markdown;q=0")).toBe(false);
});

test("server-rendered HTML becomes markdown with absolute links", () => {
  const html = [
    "<!DOCTYPE html><html><head><title>Meetings · Home</title>",
    '<meta name="description" content="Call &amp; keep the recap"/>',
    '<script>window.x = "<b>no</b>"</script></head><body><header>',
    '<a href="/"><svg><path d="M0"></path></svg>Meetings</a>',
    '<nav><a href="/rooms">Public rooms</a><a href="https://github.com/x">GitHub</a></nav></header>',
    '<main><h1 class="big">Schedule meetings</h1><p>Built with<!-- --> <a href="https://convex.dev">Convex</a>.</p>',
    "<ul><li><h3>Is it free?</h3><p>Yes, it&#x27;s free.</p></li><li><h3>Guests?</h3><p>No account <strong>needed</strong>.</p></li></ul>",
    "</main><script>hydrate()</script></body></html>",
  ].join("");

  expect(htmlToMarkdown(html, "https://example.com/page")).toBe(
    [
      "---",
      'title: "Meetings · Home"',
      'description: "Call & keep the recap"',
      "---",
      "",
      "[Meetings](https://example.com/)",
      "[Public rooms](https://example.com/rooms) [GitHub](https://github.com/x)",
      "",
      "# Schedule meetings",
      "",
      "Built with [Convex](https://convex.dev/).",
      "",
      "### Is it free?",
      "",
      "Yes, it's free.",
      "",
      "### Guests?",
      "",
      "No account needed.",
      "",
    ].join("\n"),
  );
});

test("a page with no server-rendered content points agents to llms.txt", () => {
  expect(
    htmlToMarkdown(
      "<html><head><title>Inbox</title></head><body><script>x()</script></body></html>",
      "https://example.com/inbox",
    ),
  ).toContain("https://example.com/llms.txt describes every page.");
});
