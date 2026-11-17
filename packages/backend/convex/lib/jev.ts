import { getServiceToken, getServiceUrl } from "convex/server";

export const JEV_MODEL = "typesafe/jev-1.14";

export type NoulQuestion = {
  type: "noul";
  instructions: string;
  criteria?: { true: string; false: string };
};
export type ScoreQuestion = { type: "score"; instructions: string; criteria: string[] };
export type JevQuestion = NoulQuestion | ScoreQuestion;
export type JevAnswer =
  | { type: "noul"; noul: number }
  | { type: "score"; score: number; probabilities: Record<string, number> };
export type JevAssets = Record<string, { type: "image"; format: "jpg"; data_base64: string }>;

export const askJev = async <K extends string>(
  state: unknown,
  questions: Record<K, JevQuestion>,
  assets?: JevAssets,
) => {
  const response = await fetch(`${await getServiceUrl("ai-gateway")}/alpha/decisions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getServiceToken("ai-gateway")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: JEV_MODEL, state, questions, assets, provider: { zdr: true } }),
  });
  if (!response.ok) throw new Error(`Jev ${response.status}: ${await response.text()}`);
  const body = (await response.json()) as {
    answers: Record<K, JevAnswer>;
    usage?: { cost?: number };
  };
  return { answers: body.answers, cost: body.usage?.cost ?? 0 };
};
