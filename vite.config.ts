import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: [
      "**/_generated/**",
      "**/routeTree.gen.ts",
      "**/SCHEMA.md",
      "**/components/kloq/**",
    ],
  },
  lint: {
    ignorePatterns: ["**/components/kloq/**"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "func-style": ["error", "expression"],
      "typescript/no-floating-promises": "error",
    },
    overrides: [
      {
        files: ["packages/ui/src/**"],
        rules: { "func-style": "off", "typescript/no-floating-promises": "off" },
      },
    ],
    options: { typeAware: true, typeCheck: true },
  },
});
