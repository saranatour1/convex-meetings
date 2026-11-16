import type { EventColor } from "@meetings/ui/kloq";
import type { Doc } from "@meetings/backend";

export type MeetingKind = Doc<"meetings">["kind"];

export const MEETING_KINDS: {
  value: MeetingKind;
  label: string;
  description: string;
  color: EventColor;
}[] = [
  {
    value: "groupCall",
    label: "Group call",
    description: "Everyone talks and shares",
    color: "blue",
  },
  {
    value: "webinar",
    label: "Webinar",
    description: "Hosts on stage, others ask to speak",
    color: "violet",
  },
  {
    value: "classroom",
    label: "Classroom",
    description: "Instructor, students and breakout rooms",
    color: "emerald",
  },
  { value: "audioRoom", label: "Audio room", description: "Voice only", color: "amber" },
];

export const kindOf = (kind: MeetingKind) =>
  MEETING_KINDS.find((k) => k.value === kind) ?? MEETING_KINDS[0]!;
