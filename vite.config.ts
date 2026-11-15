import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: { ignorePatterns: ["**/_generated/**", "**/routeTree.gen.ts", "**/SCHEMA.md"] },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "func-style": ["error", "expression"],
    },
    overrides: [{ files: ["packages/ui/src/**"], rules: { "func-style": "off" } }],
    options: { typeAware: true, typeCheck: true },
  },
});
