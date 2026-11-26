const INLINE_TAGS = new Set([
  "span",
  "strong",
  "em",
  "b",
  "i",
  "code",
  "small",
  "label",
  "time",
  "kbd",
  "mark",
  "abbr",
]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const decodeEntities = (text: string) =>
  text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (/^#x/i.test(code)) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number(code.slice(1)));
    return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
  });

const firstMatch = (pattern: RegExp, html: string) => decodeEntities(pattern.exec(html)?.[1] ?? "");

const stripTags = (html: string) => html.replace(/<[^>]*>/g, "").trim();

const quality = (accept: string, type: string) => {
  const range = accept
    .toLowerCase()
    .split(",")
    .map((part) => part.split(";").map((piece) => piece.trim()))
    .find(([name]) => name === type);
  if (!range) return 0;
  const weight = range.find((piece) => piece.startsWith("q="));
  return weight ? Number(weight.slice(2)) : 1;
};

export const prefersMarkdown = (accept: string | null) => {
  if (!accept) return false;
  const markdown = quality(accept, "text/markdown");
  return markdown > 0 && markdown >= quality(accept, "text/html");
};

export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export const htmlToMarkdown = (html: string, pageUrl: string) => {
  const title = firstMatch(/<title>([^<]*)<\/title>/, html);
  const description = firstMatch(/<meta name="description" content="([^"]*)"/, html);
  const body = decodeEntities(
    (/<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? html)
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(script|style|svg|template|noscript)\b[\s\S]*?<\/\1>/gi, "")
      .replace(
        /<a\b[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
        (_, href: string, label: string) => {
          const text = stripTags(label);
          return text ? `[${text}](${new URL(decodeEntities(href), pageUrl).href})` : "";
        },
      )
      .replace(/<h([1-6])\b[^>]*>/gi, (_, level: string) => `\n\n${"#".repeat(Number(level))} `)
      .replace(/<\/h[1-6]>|<p\b[^>]*>|<\/p>/gi, "\n\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<\/li>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi, (_, tag: string) =>
        INLINE_TAGS.has(tag.toLowerCase()) ? "" : "\n",
      ),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "-")
    .join("\n")
    .replace(/\)(?=\[)/g, ") ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const origin = new URL(pageUrl).origin;
  return [
    "---",
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    "---",
    "",
    body || `This page has no server-rendered content. ${origin}/llms.txt describes every page.`,
    "",
  ].join("\n");
};
