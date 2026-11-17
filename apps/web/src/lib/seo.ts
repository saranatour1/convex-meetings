export const SITE_URL = "https://convex-meetings.stream";
export const SITE_NAME = "Meetings";
export const REPO_URL = "https://github.com/saranatour1/convex-meetings";
export const SITE_DESCRIPTION =
  "Schedule meetings across time zones, call in the browser and keep a recap of every call. A working, open-source app built with Convex.";

type PageHead = { title: string; description: string; canonicalPath?: string };

export const SITE_META = [
  { charSet: "utf-8" },
  { name: "viewport", content: "width=device-width, initial-scale=1" },
  { title: SITE_NAME },
  { name: "description", content: SITE_DESCRIPTION },
  { name: "robots", content: "noindex, nofollow" },
  { name: "application-name", content: SITE_NAME },
  { name: "apple-mobile-web-app-title", content: SITE_NAME },
  { name: "theme-color", content: "#ffffff" },
  { property: "og:site_name", content: SITE_NAME },
  { property: "og:type", content: "website" },
  { property: "og:locale", content: "en_US" },
  { property: "og:title", content: SITE_NAME },
  { property: "og:description", content: SITE_DESCRIPTION },
  { property: "og:image", content: `${SITE_URL}/og.png` },
  { property: "og:image:type", content: "image/png" },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "630" },
  { property: "og:image:alt", content: "The Meetings logo next to the words Meetings" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: SITE_NAME },
  { name: "twitter:description", content: SITE_DESCRIPTION },
  { name: "twitter:image", content: `${SITE_URL}/og.png` },
  { name: "twitter:image:alt", content: "The Meetings logo next to the words Meetings" },
];

export const SITE_LINKS = [
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
];

export const pageHead = ({ title, description, canonicalPath }: PageHead) => ({
  meta: [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    ...(canonicalPath === undefined
      ? []
      : [
          { name: "robots", content: "index, follow" },
          { property: "og:url", content: `${SITE_URL}${canonicalPath}` },
        ]),
  ],
  links:
    canonicalPath === undefined ? [] : [{ rel: "canonical", href: `${SITE_URL}${canonicalPath}` }],
});
