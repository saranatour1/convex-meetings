import { defineConfig, lazyPlugins } from "vite-plus";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

const config = defineConfig({
  fmt: { ignorePatterns: ["convex/_generated/**", "src/routeTree.gen.ts"] },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  resolve: { tsconfigPaths: true },
  plugins: lazyPlugins(() => [
    // The Workers runtime and Start's server build don't apply to unit tests.
    ...(process.env.VITEST
      ? []
      : [cloudflare({ viteEnvironment: { name: "ssr" } }), tanstackStart()]),
    tailwindcss(),
    viteReact(),
  ]),
});

export default config;
