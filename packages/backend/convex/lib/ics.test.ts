import { describe, expect, test } from "vite-plus/test";
import { meetingIcs, toBase64 } from "./ics";

const event = {
  method: "REQUEST" as const,
  code: "abc-defg-hij",
  title: "Design review; Q4, plans",
  url: "https://example.com/m/abc-defg-hij",
  startsAt: Date.UTC(2026, 2, 30, 14, 0),
  endsAt: Date.UTC(2026, 2, 30, 14, 30),
  timeZone: "Europe/London",
  rrule: "FREQ=WEEKLY;BYDAY=MO",
  sequence: 0,
  organizer: { name: "Ada", email: "meetings@example.com" },
  attendee: { name: "Grace", email: "grace@example.com" },
  now: Date.UTC(2026, 2, 1),
};

describe("meetingIcs", () => {
  test("writes wall time in the meeting's zone with its repeat rule", () => {
    const ics = meetingIcs(event);
    expect(ics).toContain("METHOD:REQUEST\r\n");
    expect(ics).toContain("UID:abc-defg-hij@convex-meetings\r\n");
    expect(ics).toContain("DTSTART;TZID=Europe/London:20260330T150000\r\n");
    expect(ics).toContain("DTEND;TZID=Europe/London:20260330T153000\r\n");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO\r\n");
    expect(ics).toContain("SUMMARY:Design review\\; Q4\\, plans\r\n");
  });

  test("cancels at the meeting's sequence and folds long lines", () => {
    const ics = meetingIcs({ ...event, method: "CANCEL", sequence: 3, title: "x".repeat(200) });
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("SEQUENCE:3\r\n");
    for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });

  test("base64 keeps non-ASCII titles intact", () => {
    const text = "Café ☕";
    expect(
      new TextDecoder().decode(Uint8Array.from(atob(toBase64(text)), (c) => c.charCodeAt(0))),
    ).toBe(text);
  });
});
