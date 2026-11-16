import { zid } from "convex-helpers/server/zod4";
import { ConvexError } from "convex/values";
import { DateTime } from "luxon";
import { z } from "zod";
import { internal } from "../_generated/api";
import {
  authedMutation,
  authedQuery,
  meetingAction,
  meetingQuery,
  orgMutation,
  orgQuery,
  zPaginationOpts,
} from "../lib/functions";
import { presetName } from "../lib/presets";
import { enforceRateLimit } from "../lib/rateLimits";
import { r2Configured, signedRecordingUrl } from "../lib/r2";
import { realtimeKit } from "../lib/realtimekit";
import { zTimeZone } from "../lib/time";
import {
  busyForOrg,
  cancelMeeting,
  createMeeting,
  findMeetingByCode,
  getMeeting,
  findSessionByNumber,
  getRecap,
  listSessionMessages,
  requireSessionAccess,
  listMyMeetings,
  respond as respondToMeeting,
  type JoinDetails,
} from "../models/meetings";
import { requireCallControl } from "../models/calls";
import { canEnter, enterAsMember, inviteToMeeting } from "../models/guests";
import { getSettings } from "../models/settings";
import { zMeeting, zMeetingAccess, zMeetingInviters } from "../tables/meetings";
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
    protected: z.boolean().optional(),
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

export const get = meetingQuery({
  args: { code: z.string() },
  handler: async (ctx, { code }) => {
    const meeting = await findMeetingByCode(ctx, code);
    return meeting ? getMeeting(ctx, ctx.userId, meeting._id) : null;
  },
});

export const door = authedQuery({
  args: { code: z.string() },
  handler: async (ctx, { code }) => {
    const meeting = await findMeetingByCode(ctx, code);
    if (!meeting) return null;
    return {
      title: meeting.title,
      kind: meeting.kind,
      canEnter: await canEnter(ctx, meeting, ctx.userId),
    };
  },
});

export const enter = authedMutation({
  args: { code: z.string() },
  handler: (ctx, { code }) => enterAsMember(ctx, ctx.userId, code),
});

export const invite = authedMutation({
  args: {
    meetingId: zid("meetings"),
    emails: z.array(z.string().trim().toLowerCase().pipe(z.email())).min(1).max(30),
  },
  handler: async (ctx, { meetingId, emails }) => {
    await enforceRateLimit(ctx, "meetingInvite", meetingId, emails.length);
    return inviteToMeeting(ctx, ctx.userId, meetingId, emails);
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

export const join = meetingAction({
  args: { meetingId: zid("meetings") },
  handler: async (ctx, { meetingId }): Promise<{ token: string }> => {
    await enforceRateLimit(ctx, "join", ctx.userId);
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
  args: { code: z.string(), number: z.number().int().min(1) },
  handler: async (ctx, { code, number }) => {
    const meeting = await findMeetingByCode(ctx, code);
    const session = meeting && (await findSessionByNumber(ctx, meeting._id, number));
    return session ? getRecap(ctx, ctx.userId, session._id) : null;
  },
});

export const recordingUrl = authedQuery({
  args: { sessionId: zid("meetingSessions") },
  handler: async (ctx, { sessionId }) => {
    const { session } = await requireSessionAccess(ctx, ctx.userId, sessionId);
    if (session.recordingKey && r2Configured()) return signedRecordingUrl(session.recordingKey);
    return session.recordingUrl ?? null;
  },
});

export const respondByCode = authedMutation({
  args: { code: z.string(), response: zMeetingMember.shape.response },
  handler: async (ctx, { code, response }) => {
    const meeting = await findMeetingByCode(ctx, code);
    if (!meeting) throw new ConvexError("This meeting was cancelled");
    await respondToMeeting(ctx, ctx.userId, meeting._id, response);
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

export const updateSettings = authedMutation({
  args: {
    meetingId: zid("meetings"),
    protected: z.boolean().optional(),
    access: zMeetingAccess.optional(),
    inviters: zMeetingInviters.optional(),
  },
  handler: async (ctx, { meetingId, ...changes }) => {
    await requireCallControl(ctx, meetingId, ctx.userId);
    await ctx.db.patch("meetings", meetingId, {
      ...(changes.protected !== undefined && { protected: changes.protected || undefined }),
      ...(changes.access && { access: changes.access }),
      ...(changes.inviters && { inviters: changes.inviters }),
    });
  },
});

export const recapChat = authedQuery({
  args: { sessionId: zid("meetingSessions"), paginationOpts: zPaginationOpts },
  handler: (ctx, { sessionId, paginationOpts }) =>
    listSessionMessages(ctx, ctx.userId, sessionId, paginationOpts),
});
