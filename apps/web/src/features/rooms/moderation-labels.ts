const REASONS: Record<string, string> = {
  insult: "an insult",
  hate: "hate speech",
  threat: "a threat",
  sexual: "sexual content",
  spam: "advertising",
  personalInfo: "sharing someone's private details",
  nudity: "nudity",
  sexualAct: "a sexual act",
  gore: "gore",
  hateSymbol: "a hate symbol",
  rude: "an offensive name",
  staff: "a name posing as staff",
  unchecked: "a check that could not run",
};

const ACTIONS: Record<string, string> = {
  removed: "Removed",
  strike: "Strike",
  ban: "Banned",
  kick: "Kicked",
  watch: "Waiting for a second check",
  review: "Needs review",
};

export const reasonLabel = (reason: string) => REASONS[reason] ?? reason;
export const actionLabel = (action: string) => ACTIONS[action] ?? action;
