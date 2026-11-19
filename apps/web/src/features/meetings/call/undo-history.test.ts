import { expect, test } from "vite-plus/test";
import { forget, historyOf, putStep, record, takeStep } from "./undo-history.ts";

test("steps move between undo and redo, and a new mark drops the redo stack", () => {
  record("share", { kind: "add", ids: ["a"] });
  record("share", { kind: "remove", ids: ["a"] });
  const step = takeStep("share", "undo");
  expect(step).toEqual({ kind: "remove", ids: ["a"] });
  putStep("share", "redo", step!);
  expect(historyOf("share").redo).toEqual([step]);
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
