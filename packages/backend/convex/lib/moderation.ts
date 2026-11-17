import type { JevAnswer, JevQuestion, NoulQuestion } from "./jev";

const noul = (instructions: string, yes: string, no: string): NoulQuestion => ({
  type: "noul",
  instructions,
  criteria: { true: yes, false: no },
});

export const MESSAGE_QUESTIONS = {
  insult: noul(
    "Does `message.text` insult or demean someone?",
    "Name-calling, mockery of a person's looks, intelligence or identity, or telling someone they are unwelcome",
    "Friendly or neutral talk, or teasing that is clearly affectionate",
  ),
  hate: noul(
    "Does `message.text` attack people for their race, religion, nationality, gender, sexuality or disability?",
    "A slur or a hostile generalisation about a group of people",
    "No group is attacked, or a group is mentioned in a neutral or positive way",
  ),
  threat: noul(
    "Does `message.text` threaten someone or urge them to hurt themselves?",
    "A statement that someone will be or should be harmed",
    'No one is threatened, including figures of speech such as "this deadline is killing me"',
  ),
  sexual: noul(
    "Is `message.text` sexually explicit or a sexual advance towards someone?",
    "Explicit sexual language, or asking someone for sexual attention or pictures",
    "No sexual content, or a plain mention of dating or a relationship",
  ),
  spam: noul(
    "Is `message.text` advertising or self-promotion?",
    "Selling something, asking for follows, or inviting people to another site, app or group",
    "Ordinary conversation, including a link shared because it helps the room",
  ),
  personalInfo: noul(
    "Does `message.text` reveal another person's private contact details?",
    "A phone number, home address, email address or private account of someone other than the author",
    "No contact details, or details the author gives about themself",
  ),
  vibe: {
    type: "score",
    instructions: "How does `message.text` affect the mood of the room?",
    criteria: [
      "The author picks a fight or puts someone in the room down",
      "The author complains at people or dismisses what they said",
      "The author makes small talk or a plain statement",
      "The author is friendly, encouraging or kind to the room",
    ],
  },
} satisfies Record<string, JevQuestion>;

export const NAME_QUESTIONS = {
  rude: noul(
    "Is the display name `name` offensive to read in a public chat?",
    "A slur, an insult or sexually explicit words",
    "An ordinary name, nickname or handle",
  ),
  staff: noul(
    "Does the display name `name` claim to be staff of the site?",
    "Words such as admin, moderator, support or official",
    "A name that claims no role",
  ),
} satisfies Record<string, JevQuestion>;

export const FRAME_QUESTIONS = {
  nudity: noul(
    "Is someone in `frame` naked?",
    "Exposed genitals, buttocks or nipples",
    "Everyone visible is clothed, or nobody is visible",
  ),
  sexualAct: noul(
    "Does `frame` show a sexual act?",
    "People having sex, or someone touching themself sexually",
    "No sexual act is visible",
  ),
  gore: noul(
    "Does `frame` show gore or a serious injury?",
    "Open wounds, a lot of blood or a dead body",
    "No injury is visible",
  ),
  hateSymbol: noul(
    "Does `frame` show a hate symbol?",
    "A swastika, a Ku Klux Klan hood or a similar emblem of a hate group",
    "No such emblem is visible",
  ),
} satisfies Record<string, JevQuestion>;

export const FRAME_SOURCE = "A still from a webcam or a shared screen in a public video room";

export const YES = 0.7;
export const NO = 0.3;
export const SEVERE = 0.9;
export const HOSTILE = 0.5;
export const STRIKES_TO_BAN = 3;
export const STRIKE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const FIRST_BAN_MS = 24 * 60 * 60 * 1000;
export const REPEAT_BAN_MS = 30 * 24 * 60 * 60 * 1000;
export const CORROBORATION_MS = 5 * 60 * 1000;
export const EVIDENCE_MS = 7 * 24 * 60 * 60 * 1000;

const MESSAGE_REASONS = ["hate", "threat", "sexual", "insult", "spam", "personalInfo"] as const;
const SEVERE_REASONS = ["hate", "threat", "sexual"] as const;
const FRAME_REASONS = ["nudity", "sexualAct", "gore", "hateSymbol"] as const;

export type MessageReason = (typeof MESSAGE_REASONS)[number];
export type FrameReason = (typeof FRAME_REASONS)[number];
export type MessageScores = Record<MessageReason, number> & { hostile: number };
export type NameScores = { rude: number; staff: number };
export type FrameScores = Record<FrameReason, number>;
export type Penalty = "none" | "strike" | "ban";

const probability = (answer: JevAnswer | undefined) => {
  if (answer?.type !== "noul") throw new Error("Jev did not answer a yes or no question");
  return answer.noul;
};

const lowestLevel = (answer: JevAnswer | undefined) => {
  if (answer?.type !== "score") throw new Error("Jev did not answer a score question");
  return answer.probabilities["0"] ?? 0;
};

type Answers<Questions> = Partial<Record<keyof Questions, JevAnswer>>;

export const messageScores = (answers: Answers<typeof MESSAGE_QUESTIONS>): MessageScores => ({
  hate: probability(answers.hate),
  threat: probability(answers.threat),
  sexual: probability(answers.sexual),
  insult: probability(answers.insult),
  spam: probability(answers.spam),
  personalInfo: probability(answers.personalInfo),
  hostile: lowestLevel(answers.vibe),
});

export const nameScores = (answers: Answers<typeof NAME_QUESTIONS>): NameScores => ({
  rude: probability(answers.rude),
  staff: probability(answers.staff),
});

export const frameScores = (answers: Answers<typeof FRAME_QUESTIONS>): FrameScores => ({
  nudity: probability(answers.nudity),
  sexualAct: probability(answers.sexualAct),
  gore: probability(answers.gore),
  hateSymbol: probability(answers.hateSymbol),
});

const highest = <K extends string>(keys: readonly K[], scores: Record<K, number>) =>
  keys.reduce((best, key) => (scores[key] > scores[best] ? key : best), keys[0]!);

export const decideMessage = (scores: MessageScores) => {
  const severe = highest(SEVERE_REASONS, scores);
  if (scores[severe] >= SEVERE) {
    return { action: "remove" as const, reason: severe, penalty: "ban" as Penalty };
  }
  const reason = highest(MESSAGE_REASONS, scores);
  if (scores[reason] >= YES) {
    return { action: "remove" as const, reason, penalty: "strike" as Penalty };
  }
  if (scores[reason] > NO && scores.hostile >= HOSTILE) {
    return { action: "remove" as const, reason, penalty: "none" as Penalty };
  }
  return { action: "publish" as const };
};

export const decideName = (scores: NameScores) =>
  scores.rude >= YES ? "rude" : scores.staff >= YES ? "staff" : null;

export const decideFrame = (
  scores: FrameScores,
  seen: { trustedReporter: boolean; confirmed: boolean; canBeConfirmed: boolean },
) => {
  const reason = highest(FRAME_REASONS, scores);
  if (scores[reason] < YES) return { action: "clear" as const };
  if (seen.trustedReporter || seen.confirmed) return { action: "ban" as const, reason };
  return { action: seen.canBeConfirmed ? ("watch" as const) : ("review" as const), reason };
};

export const penaltyFor = (
  penalty: Penalty,
  subject: { exempt: boolean; strikesToday: number },
) => {
  if (subject.exempt || penalty === "none") return "none" as const;
  if (penalty === "ban" || subject.strikesToday + 1 >= STRIKES_TO_BAN) return "ban" as const;
  return "strike" as const;
};
