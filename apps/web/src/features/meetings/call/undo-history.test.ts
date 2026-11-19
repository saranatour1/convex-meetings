import { expect, test } from "vite-plus/test";
import { forget, historyOf, record, takeStep } from "./undo-history.ts";

test("undo and redo walk back and forth, and a new mark drops the redo stack", () => {
  record("share", { kind: "add", ids: ["a"] });
  record("share", { kind: "remove", ids: ["a"] });
  expect(takeStep("share", "undo")).toEqual({ kind: "remove", ids: ["a"] });
  expect(historyOf("share").redo).toHaveLength(1);
  expect(takeStep("share", "redo")).toEqual({ kind: "remove", ids: ["a"] });
  takeStep("share", "undo");
  record("share", { kind: "add", ids: ["b"] });
  expect(historyOf("share")).toEqual({
    undo: [
      { kind: "add", ids: ["a"] },
      { kind: "add", ids: ["b"] },
    ],
    redo: [],
  });
  expect(historyOf("other")).toEqual({ undo: [], redo: [] });
  forget("share");
  expect(takeStep("share", "undo")).toBeUndefined();
});
