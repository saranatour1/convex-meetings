import { DateTime } from "luxon";

export type IcsMethod = "REQUEST" | "CANCEL";

export type IcsEvent = {
  method: IcsMethod;
  code: string;
  title: string;
  url: string;
  startsAt: number;
  endsAt: number;
  timeZone: string;
  rrule?: string;
  sequence: number;
  organizer: { name: string; email: string };
  attendee: { name: string; email: string };
  now: number;
};

const escapeText = (text: string) =>
  text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

const quoteParam = (text: string) => `"${text.replace(/["\r\n]/g, "")}"`;

const fold = (line: string) => {
  const chunks = [line.slice(0, 74)];
  for (let i = 74; i < line.length; i += 73) chunks.push(` ${line.slice(i, i + 73)}`);
  return chunks.join("\r\n");
};

const local = (millis: number, zone: string) =>
  DateTime.fromMillis(millis, { zone }).toFormat("yyyyMMdd'T'HHmmss");

const utc = (millis: number) =>
  DateTime.fromMillis(millis, { zone: "utc" }).toFormat("yyyyMMdd'T'HHmmss'Z'");

export const meetingIcs = (event: IcsEvent) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Convex Meetings//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${event.method}`,
    "BEGIN:VEVENT",
    `UID:${event.code}@convex-meetings`,
    `SEQUENCE:${event.sequence}`,
    `DTSTAMP:${utc(event.now)}`,
    `DTSTART;TZID=${event.timeZone}:${local(event.startsAt, event.timeZone)}`,
    `DTEND;TZID=${event.timeZone}:${local(event.endsAt, event.timeZone)}`,
    ...(event.rrule ? [`RRULE:${event.rrule.replace(/^RRULE:/, "")}`] : []),
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(`Join: ${event.url}`)}`,
    `LOCATION:${escapeText(event.url)}`,
    `URL:${event.url}`,
    `ORGANIZER;CN=${quoteParam(event.organizer.name)}:mailto:${event.organizer.email}`,
    `ATTENDEE;CN=${quoteParam(event.attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${event.attendee.email}`,
    `STATUS:${event.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n") + "\r\n";

export const toBase64 = (text: string) => {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export const icsAttachment = (event: IcsEvent) => ({
  content: toBase64(meetingIcs(event)),
  filename: event.method === "CANCEL" ? "cancel.ics" : "invite.ics",
  type: `text/calendar; charset=utf-8; method=${event.method}`,
  disposition: "attachment" as const,
});
