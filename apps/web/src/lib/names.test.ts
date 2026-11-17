import { expect, test } from "vite-plus/test";
import { nameList } from "./names.ts";

test("names read as a short list with the rest counted", () => {
  expect(nameList([])).toBe("");
  expect(nameList(["Ana Ruiz"])).toBe("Ana");
  expect(nameList(["Ana Ruiz", "Leo Park"])).toBe("Ana and Leo");
  expect(nameList(["Ana Ruiz", "Leo Park", "Noor Haddad"])).toBe("Ana, Leo and 1 other");
  expect(nameList(["Ana", "Leo", "Noor", "Sam"])).toBe("Ana, Leo and 2 others");
});
