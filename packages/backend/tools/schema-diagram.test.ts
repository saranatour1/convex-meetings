import { expect, test } from "vite-plus/test";
import { renderSchemaDiagram } from "./schema-diagram";

test("SCHEMA.md matches convex/schema.ts", async () => {
  await expect(renderSchemaDiagram()).toMatchFileSnapshot("../SCHEMA.md");
});
