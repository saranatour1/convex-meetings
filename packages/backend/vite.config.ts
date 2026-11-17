import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    alias: {
      "password-hash-wasm/argon2id": new URL("./tools/password-hash.ts", import.meta.url).pathname,
    },
  },
});
