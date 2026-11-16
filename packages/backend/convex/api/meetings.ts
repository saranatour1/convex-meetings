import { zid } from "convex-helpers/server/zod4";
import { DateTime } from "luxon";
import { z } from "zod";
import { internal } from "../_generated/api";
import {
  authedAction,
  authedMutation,
  authedQuery,
  orgMutation,
  orgQuery,
  zPaginationOpts,
} from "../lib/functions";
import { presetName } from "../lib/presets";
import { r2Configured, signedRecordingUrl } from "../lib/r2";
import { realtimeKit } from "../lib/realtimekit";
import { zTimeZone } from "../lib/time";
import {
  busyForOrg,
  cancelMeeting,
  createMeeting,
  findMeetingByCode,
  getMeeting,
  getRecap,
  listMyMeetings,
  respond as respondToMeeting,
  type JoinDetails,
} from "../models/meetings";
import { getSettings } from "../models/settings";
import { zMeeting } from "../tables/meetings";
import { zMeetingMember } from "../tables/meetingMembers";

export const create = orgMutation({
  args: {
    title: zMeeting.shape.title,
    kind: zMeeting.shape.kind,
    recap: z.boolean(),
    startsAt: z.number(),
    minutes: z.number().int(),
    timeZone: zTimeZone,
    rrule: z.string().max(500).optional(),
    inviteeIds: z.array(zid("users")).max(100),
  },
  handler: (ctx, { orgId, ...meeting }) => {
    ctx.requirePermission("createMeetings");
    return createMeeting(ctx, {
      ...meeting,
      orgId,
      userId: ctx.userId,
      canManageMeetings: ctx.can("manageMeetings"),
    });
  },
});

export const mine = authedQuery({
  args: { paginationOpts: zPaginationOpts },
  handler: (ctx, { paginationOpts }) => listMyMeetings(ctx, ctx.userId, paginationOpts),
});

export const get = authedQuery({
  args: { code: z.string() },
  handler: async (ctx, { code }) => {
    const meeting = await findMeetingByCode(ctx, code);
    return meeting ? getMeeting(ctx, ctx.userId, meeting._id) : null;
  },
});

export const respond = authedMutation({
  args: { meetingId: zid("meetings"), response: zMeetingMember.shape.response },
  handler: (ctx, { meetingId, response }) => respondToMeeting(ctx, ctx.userId, meetingId, response),
});

export const cancel = authedMutation({
  args: { meetingId: zid("meetings") },
  handler: async (ctx, { meetingId }) => {
    const rtkMeetingId = await cancelMeeting(ctx, ctx.userId, meetingId);
    if (rtkMeetingId) {
      await ctx.scheduler.runAfter(0, internal.internal.realtime.deactivate, { rtkMeetingId });
    }
  },
});

export const busy = orgQuery({
  args: { from: z.number(), to: z.number() },
  handler: (ctx, { orgId, from, to }) => busyForOrg(ctx, orgId, from, to),
});

export const join = authedAction({
  args: { meetingId: zid("meetings") },
  handler: async (ctx, { meetingId }): Promise<{ token: string }> => {
    const details: JoinDetails = await ctx.runQuery(internal.internal.realtime.joinDetails, {
      userId: ctx.userId,
      meetingId,
    });
    const rtkMeetingId: string =
      details.rtkMeetingId ??
      (await ctx.runMutation(internal.internal.realtime.claimMeeting, {
        meetingId,
        rtkMeetingId: (await realtimeKit.createMeeting(details)).id,
      }));
    if (details.rtkParticipantId && details.rtkMeetingId === rtkMeetingId) {
      const refreshed = await realtimeKit
        .refreshToken(rtkMeetingId, details.rtkParticipantId)
        .catch(() => null);
      if (refreshed) return { token: refreshed.token };
    }
    const participant = await realtimeKit.addParticipant(rtkMeetingId, {
      customId: details.memberId,
      presetName: presetName(details.kind, details.role),
      name: details.name,
      picture: details.imageUrl,
    });
    await ctx.runMutation(internal.internal.realtime.setParticipant, {
      memberId: details.memberId,
      rtkParticipantId: participant.id,
    });
    return { token: participant.token };
  },
});

export const recap = authedQuery({
  args: { sessionId: zid("meetingSessions") },
  handler: (ctx, { sessionId }) => getRecap(ctx, ctx.userId, sessionId),
});

export const recordingUrl = authedAction({
  args: { sessionId: zid("meetingSessions") },
  handler: async (ctx, { sessionId }): Promise<string | null> => {
    const source: { key: string | null; fallbackUrl: string | null } = await ctx.runQuery(
      internal.internal.realtime.recordingSource,
      { userId: ctx.userId, sessionId },
    );
    if (source.key && r2Configured()) return signedRecordingUrl(source.key);
    return source.fallbackUrl;
  },
});

export const startNow = orgMutation({
  args: { timeZone: zTimeZone },
  handler: async (ctx, { orgId, timeZone }) => {
    ctx.requirePermission("createMeetings");
    const settings = await getSettings(ctx, ctx.userId);
    const startsAt = Math.floor(Date.now() / 60_000) * 60_000;
    const local = DateTime.fromMillis(startsAt, { zone: timeZone });
    const untilMidnight = Math.floor(local.endOf("day").diff(local, "minutes").minutes);
    return createMeeting(ctx, {
      orgId,
      userId: ctx.userId,
      title: "Instant meeting",
      kind: settings.defaultKind,
      recap: settings.defaultRecap,
      startsAt,
      minutes: Math.max(5, Math.min(60, untilMidnight)),
      timeZone: untilMidnight < 5 ? "UTC" : timeZone,
      inviteeIds: [],
      canManageMeetings: ctx.can("manageMeetings"),
    });
  },
});
