import { expect, test } from "vite-plus/test";
import { decideFrame, decideMessage, decideName, messageScores, penaltyFor } from "./moderation";

const calm = { hate: 0, threat: 0, sexual: 0, insult: 0, spam: 0, personalInfo: 0, hostile: 0 };
const clean = { nudity: 0, sexualAct: 0, gore: 0, hateSymbol: 0 };
const alone = { trustedReporter: false, confirmed: false, canBeConfirmed: false };
const no = { type: "noul" as const, noul: 0.1 };

test("a calm message is published", () => {
  expect(decideMessage(calm)).toEqual({ action: "publish" });
});

test("a severe reason at 0.9 bans", () => {
  expect(decideMessage({ ...calm, threat: 0.95 })).toEqual({
    action: "remove",
    reason: "threat",
    penalty: "ban",
  });
});

test("an insult at 0.9 is a strike, not a ban", () => {
  expect(decideMessage({ ...calm, insult: 0.95 })).toMatchObject({ penalty: "strike" });
});

test("a reason at 0.7 is a strike", () => {
  expect(decideMessage({ ...calm, spam: 0.7 })).toEqual({
    action: "remove",
    reason: "spam",
    penalty: "strike",
  });
});

test("an unsettled reason is removed only when the vibe is hostile", () => {
  expect(decideMessage({ ...calm, insult: 0.5 })).toEqual({ action: "publish" });
  expect(decideMessage({ ...calm, insult: 0.5, hostile: 0.6 })).toEqual({
    action: "remove",
    reason: "insult",
    penalty: "none",
  });
});

test("a hostile vibe alone does not remove a message", () => {
  expect(decideMessage({ ...calm, hostile: 0.9 })).toEqual({ action: "publish" });
});

test("names", () => {
  expect(decideName({ rude: 0.8, staff: 0 })).toBe("rude");
  expect(decideName({ rude: 0, staff: 0.8 })).toBe("staff");
  expect(decideName({ rude: 0.5, staff: 0.5 })).toBeNull();
});

test("a clean frame is cleared", () => {
  expect(decideFrame(clean, alone)).toEqual({ action: "clear" });
});

test("one ordinary reporter never bans", () => {
  expect(decideFrame({ ...clean, nudity: 0.99 }, alone).action).toBe("review");
  expect(decideFrame({ ...clean, nudity: 0.99 }, { ...alone, canBeConfirmed: true }).action).toBe(
    "watch",
  );
});

test("a confirmed or trusted frame bans from 0.7 on", () => {
  expect(decideFrame({ ...clean, nudity: 0.75 }, { ...alone, confirmed: true })).toEqual({
    action: "ban",
    reason: "nudity",
  });
  expect(decideFrame({ ...clean, gore: 0.8 }, { ...alone, trustedReporter: true })).toEqual({
    action: "ban",
    reason: "gore",
  });
  expect(decideFrame({ ...clean, hateSymbol: 0.69 }, { ...alone, confirmed: true })).toEqual({
    action: "clear",
  });
});

test("penalties", () => {
  expect(penaltyFor("strike", { exempt: false, strikesToday: 0 })).toBe("strike");
  expect(penaltyFor("strike", { exempt: false, strikesToday: 2 })).toBe("ban");
  expect(penaltyFor("ban", { exempt: true, strikesToday: 0 })).toBe("none");
  expect(penaltyFor("none", { exempt: false, strikesToday: 5 })).toBe("none");
});

test("Jev answers become scores, and a missing answer is an error", () => {
  const answers = {
    hate: no,
    threat: no,
    sexual: no,
    insult: { type: "noul" as const, noul: 0.8 },
    spam: no,
    personalInfo: no,
    vibe: { type: "score" as const, score: 0.4, probabilities: { "0": 0.7, "1": 0.3 } },
  };
  expect(messageScores(answers)).toMatchObject({ insult: 0.8, hostile: 0.7 });
  expect(() => messageScores({ ...answers, vibe: undefined })).toThrow();
  expect(() => messageScores({ ...answers, spam: undefined })).toThrow();
});
