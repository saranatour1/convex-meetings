import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

const securityHeaders = createMiddleware().server(({ next }) => {
  setResponseHeaders(
    new Headers({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
    }),
  );
  return next();
});

const csrf = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });

export const startInstance = createStart(() => ({
  defaultSsr: false,
  requestMiddleware: [securityHeaders, csrf],
}));
