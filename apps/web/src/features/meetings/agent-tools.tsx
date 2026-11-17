import { track } from "@databuddy/sdk";
import { useCallback } from "react";
import { useConvex, type ConvexReactClient } from "convex/react";
import { DateTime } from "luxon";
import { api, type Id } from "@meetings/backend";
import { useActiveOrg } from "#/features/orgs/active-org.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { describeError } from "#/lib/errors.ts";
import { MEETING_KINDS, type MeetingKind } from "./meeting-kinds.ts";

type AgentTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
    consequentialHint?: boolean;
  };
  execute: (input: never) => Promise<unknown>;
};

type ModelContext = {
  registerTool: (tool: AgentTool, options: { signal: AbortSignal }) => Promise<void>;
};

type ToolDeps = {
  convex: ConvexReactClient;
  orgId: Id<"organizations">;
  onOpenCall: (code: string) => void;
};

const codeSchema = {
  type: "string",
  pattern: "^[a-z]{3}-[a-z]{4}-[a-z]{3}$",
  description: "Meeting code, like abc-defg-hij",
};

const timeZoneSchema = {
  type: "string",
  description: "IANA time zone, like Europe/Berlin. Defaults to the browser's time zone.",
};

const meetingUrl = (code: string) => `${window.location.origin}/meetings/${code}`;

const isoIn = (millis: number, timeZone: string) =>
  DateTime.fromMillis(millis, { zone: timeZone }).toISO();

const reportingErrors =
  <Input,>(name: string, run: (input: Input) => Promise<unknown>) =>
  (input: Input) => {
    track("agent_tool_called", { name, userAgent: navigator.userAgent });
    return run(input).catch((error: unknown) => ({ error: describeError(error) }));
  };

const agentTools = ({ convex, orgId, onOpenCall }: ToolDeps): AgentTool[] => [
  {
    name: "list_upcoming_meetings",
    title: "List upcoming meetings",
    description:
      "Lists the person's meetings that haven't ended yet, soonest first: code, title, start and end in the meeting's time zone, whether it repeats, and the person's reply to the invite. Pass the returned cursor to read the next page.",
    inputSchema: {
      type: "object",
      properties: {
        cursor: { type: "string", description: "The cursor from the previous page" },
      },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: reportingErrors("list_upcoming_meetings", async ({ cursor }: { cursor?: string }) => {
      const result = await convex.query(api.meetings.mine, {
        paginationOpts: { numItems: 50, cursor: cursor ?? null },
      });
      const now = Date.now();
      return {
        meetings: result.page
          .filter((m) => m.endedAt === null && m.endsAt > now)
          .sort((a, b) => a.startsAt - b.startsAt)
          .map((m) => ({
            code: m.code,
            title: m.title,
            kind: m.kind,
            startsAt: isoIn(m.startsAt, m.timeZone),
            endsAt: isoIn(m.endsAt, m.timeZone),
            timeZone: m.timeZone,
            repeats: m.rrule,
            reply: m.response,
            role: m.role,
            url: meetingUrl(m.code),
          })),
        cursor: result.isDone ? null : result.continueCursor,
      };
    }),
  },
  {
    name: "schedule_meeting",
    title: "Schedule a meeting",
    description:
      "Schedules a meeting in the person's active organization and emails a calendar invite to each invitee. Invitees must already be members of the organization. Kind, length and recap default to the person's meeting settings.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 200 },
        startsAt: {
          type: "string",
          description:
            "Local start time in timeZone, ISO 8601 without an offset, like 2026-11-20T15:00",
        },
        timeZone: timeZoneSchema,
        minutes: { type: "integer", minimum: 5, maximum: 720 },
        kind: {
          type: "string",
          oneOf: MEETING_KINDS.map((kind) => ({
            const: kind.value,
            title: kind.label,
            description: kind.description,
          })),
        },
        recap: { type: "boolean", description: "Transcribe the call and write a summary" },
        rrule: {
          type: "string",
          maxLength: 500,
          description: "RFC 5545 repeat rule, like FREQ=WEEKLY;BYDAY=MO",
        },
        inviteeEmails: {
          type: "array",
          items: { type: "string", format: "email" },
          maxItems: 100,
        },
        protected: {
          type: "boolean",
          description: "No recording, and only hosts save snapshots or download the recording",
        },
      },
      required: ["title", "startsAt"],
    },
    annotations: { consequentialHint: true },
    execute: reportingErrors(
      "schedule_meeting",
      async (input: {
        title: string;
        startsAt: string;
        timeZone?: string;
        minutes?: number;
        kind?: MeetingKind;
        recap?: boolean;
        rrule?: string;
        inviteeEmails?: string[];
        protected?: boolean;
      }) => {
        const timeZone = input.timeZone ?? browserTimeZone();
        const start = DateTime.fromISO(input.startsAt, { zone: timeZone });
        if (!start.isValid) return { error: `startsAt: ${start.invalidExplanation}` };
        const [settings, members] = await Promise.all([
          convex.query(api.settings.getMine, {}),
          convex.query(api.members.list, {
            orgId,
            paginationOpts: { numItems: 100, cursor: null },
          }),
        ]);
        const emails = (input.inviteeEmails ?? []).map((email) => email.trim().toLowerCase());
        const byEmail = new Map(members.page.map((m) => [m.email?.toLowerCase(), m.userId]));
        const unknown = emails.filter((email) => !byEmail.has(email));
        if (unknown.length) {
          return { error: `Not members of this organization: ${unknown.join(", ")}` };
        }
        const { code } = await convex.mutation(api.meetings.create, {
          orgId,
          title: input.title,
          kind: input.kind ?? settings.defaultKind,
          recap: input.recap ?? settings.defaultRecap,
          startsAt: start.toMillis(),
          minutes: input.minutes ?? settings.defaultMinutes,
          timeZone,
          rrule: input.rrule,
          inviteeIds: emails.flatMap((email) => byEmail.get(email) ?? []),
          protected: input.protected,
        });
        return { code, url: meetingUrl(code) };
      },
    ),
  },
  {
    name: "start_meeting_now",
    title: "Start a meeting now",
    description:
      "Starts an instant meeting in the person's active organization and opens its call lobby, where the person picks a camera and microphone and joins.",
    inputSchema: { type: "object", properties: { timeZone: timeZoneSchema } },
    annotations: {},
    execute: reportingErrors("start_meeting_now", async ({ timeZone }: { timeZone?: string }) => {
      const { code } = await convex.mutation(api.meetings.startNow, {
        orgId,
        timeZone: timeZone ?? browserTimeZone(),
      });
      onOpenCall(code);
      return { code, url: meetingUrl(code) };
    }),
  },
  {
    name: "join_meeting",
    title: "Join a meeting",
    description:
      "Opens a meeting's call lobby by its code, where the person picks a camera and microphone and joins.",
    inputSchema: { type: "object", properties: { code: codeSchema }, required: ["code"] },
    annotations: {},
    execute: reportingErrors("join_meeting", async ({ code }: { code: string }) => {
      const door = await convex.query(api.meetings.door, { code });
      if (!door) return { error: "No meeting has this code" };
      onOpenCall(code);
      return { title: door.title, url: meetingUrl(code) };
    }),
  },
  {
    name: "reply_to_invite",
    title: "Reply to a meeting invite",
    description: "Accepts or declines a meeting invite. The organizer is notified.",
    inputSchema: {
      type: "object",
      properties: {
        code: codeSchema,
        response: { type: "string", enum: ["accepted", "declined"] },
      },
      required: ["code", "response"],
    },
    annotations: { consequentialHint: true },
    execute: reportingErrors(
      "reply_to_invite",
      async ({ code, response }: { code: string; response: "accepted" | "declined" }) => {
        await convex.mutation(api.meetings.respondByCode, { code, response });
        return { code, reply: response };
      },
    ),
  },
];

export const AgentTools = ({ onOpenCall }: { onOpenCall: (code: string) => void }) => {
  const convex = useConvex();
  const { orgId } = useActiveOrg();
  const register = useCallback(
    (node: HTMLElement | null) => {
      const { modelContext } = document as Document & { modelContext?: ModelContext };
      if (!node || !modelContext) return;
      const controller = new AbortController();
      for (const tool of agentTools({ convex, orgId, onOpenCall })) {
        modelContext.registerTool(tool, { signal: controller.signal }).catch(() => undefined);
      }
      return () => controller.abort();
    },
    [convex, orgId, onOpenCall],
  );

  return <span hidden ref={register} />;
};
