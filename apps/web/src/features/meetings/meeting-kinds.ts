import type { EventColor } from "@meetings/ui/kloq";
import type { Doc } from "@meetings/backend";

export type MeetingKind = Doc<"meetings">["kind"];

export const MEETING_KINDS: {
  value: MeetingKind;
  label: string;
  description: string;
  color: EventColor;
  dot: string;
}[] = [
  {
    value: "groupCall",
    label: "Group call",
    description: "Everyone talks and shares",
    color: "blue",
    dot: "bg-blue-500",
  },
  {
    value: "webinar",
    label: "Webinar",
    description: "Hosts on stage, others ask to speak",
    color: "violet",
    dot: "bg-violet-500",
  },
  {
    value: "classroom",
    label: "Classroom",
    description: "Instructor, students and breakout rooms",
    color: "emerald",
    dot: "bg-emerald-500",
  },
  {
    value: "audioRoom",
    label: "Audio room",
    description: "Voice only",
    color: "amber",
    dot: "bg-amber-500",
  },
];

export const kindOf = (kind: MeetingKind) =>
  MEETING_KINDS.find((k) => k.value === kind) ?? MEETING_KINDS[0]!;
