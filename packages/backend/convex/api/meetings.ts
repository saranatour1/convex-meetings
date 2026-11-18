import { zid } from "convex-helpers/server/zod4";
import { ConvexError } from "convex/values";
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
import { realtimeKit, type MeetingConfig } from "../lib/realtimekit";
import { zTimeZone } from "../lib/time";
import { getRecap, type JoinDetails } from "../models/callSessions";
import { findSessionByNumber, requireSessionAccess } from "../models/meetingAccess";
import {
  busyForOrg,
  cancelMeeting,
  createMeeting,
  findMeetingByCode,
  getMeeting,
  listMyMeetings,
  editMeeting,
  repeatMeeting,
  rescheduleMeeting,
  uninvite as uninviteFromMeeting,
  respond as respondToMeeting,
  startInstantMeeting,
} from "../models/meetings";
import { listSessionMessages } from "../models/messages";
import { requireCallControl } from "../models/calls";
import { isPublicRoom } from "../models/roomAccess";
import { canEnter, enterAsMember, inviteToMeeting } from "../models/guests";
import { canAsk, deleteJoinRequests, findJoinRequest } from "../models/joinRequests";
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
    slowModeSeconds: zMeeting.shape.slowModeSeconds,
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
    const [enterable, request] = await Promise.all([
      canEnter(ctx, meeting, ctx.userId),
      findJoinRequest(ctx, meeting._id, ctx.userId),
    ]);
    return {
      title: meeting.title,
      kind: meeting.kind,
      isPublic: isPublicRoom(meeting),
      canEnter: enterable,
      canAsk: !enterable && (await canAsk(ctx, meeting)),
      request: request?.status ?? null,
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
    await deleteJoinRequests(ctx, meetingId);
    if (rtkMeetingId) {
      await ctx.scheduler.runAfter(0, internal.internal.realtime.deactivate, { rtkMeetingId });
    }
  },
});

export const edit = authedMutation({
  args: {
    meetingId: zid("meetings"),
    title: zMeeting.shape.title.optional(),
    description: z.string().max(2000).optional(),
    location: z.string().max(200).optional(),
  },
  handler: (ctx, { meetingId, ...changes }) => editMeeting(ctx, ctx.userId, meetingId, changes),
});

export const repeat = authedMutation({
  args: { meetingId: zid("meetings"), rrule: z.string().min(1).max(500) },
  handler: (ctx, { meetingId, rrule }) => repeatMeeting(ctx, ctx.userId, meetingId, rrule),
});

export const uninvite = authedMutation({
  args: { meetingId: zid("meetings"), memberId: zid("meetingMembers") },
  handler: (ctx, { meetingId, memberId }) =>
    uninviteFromMeeting(ctx, ctx.userId, meetingId, memberId),
});

export const reschedule = authedMutation({
  args: { meetingId: zid("meetings"), startsAt: z.number(), minutes: z.number().int() },
  handler: (ctx, { meetingId, startsAt, minutes }) =>
    rescheduleMeeting(ctx, ctx.userId, meetingId, startsAt, minutes),
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
    const budget = await ctx.runQuery(internal.internal.realtime.budget, {});
    if (budget.callsPausedUntil) {
      throw new ConvexError(
        `This month's free call minutes are used up. Calls open again on ${budget.callsPausedUntil}.`,
      );
    }
    const config: MeetingConfig = {
      record: details.record && budget.recordingSeconds >= 60,
      recap: details.recap && budget.transcribe,
      maxRecordingSeconds: budget.recordingSeconds,
    };
    if (details.rtkMeetingId) await realtimeKit.updateMeeting(details.rtkMeetingId, config);
    const rtkMeetingId: string =
      details.rtkMeetingId ??
      (await ctx.runMutation(internal.internal.realtime.claimMeeting, {
        meetingId,
        rtkMeetingId: (await realtimeKit.createMeeting({ title: details.title, ...config })).id,
      }));
    if (details.rtkParticipantId && details.rtkMeetingId === rtkMeetingId) {
      const refreshed = await realtimeKit
        .refreshToken(rtkMeetingId, details.rtkParticipantId)
        .catch(() => null);
      if (refreshed) return { token: refreshed.token };
    }
    const participant = await realtimeKit.addParticipant(rtkMeetingId, {
      customId: details.memberId,
      presetName: presetName(details.kind, details.role, details.viewer),
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
  handler: (ctx, { orgId, timeZone }) => {
    ctx.requirePermission("createMeetings");
    return startInstantMeeting(ctx, {
      orgId,
      userId: ctx.userId,
      title: "Instant meeting",
      timeZone,
      inviteeIds: [],
      canManageMeetings: ctx.can("manageMeetings"),
    });
  },
});

export const updateSettings = authedMutation({
  args: {
    meetingId: zid("meetings"),
    protected: z.boolean().optional(),
    access: zMeetingAccess.exclude(["public"]).optional(),
    inviters: zMeetingInviters.optional(),
    slowModeSeconds: zMeeting.shape.slowModeSeconds,
  },
  handler: async (ctx, { meetingId, ...changes }) => {
    const { meeting } = await requireCallControl(ctx, meetingId, ctx.userId);
    if (changes.access && isPublicRoom(meeting)) {
      throw new ConvexError("Close a public room instead of changing who can join");
    }
    await ctx.db.patch("meetings", meetingId, {
      ...(changes.protected !== undefined && { protected: changes.protected || undefined }),
      ...(changes.access && { access: changes.access }),
      ...(changes.inviters && { inviters: changes.inviters }),
      ...(changes.slowModeSeconds !== undefined && {
        slowModeSeconds: changes.slowModeSeconds || undefined,
      }),
    });
  },
});

export const recapChat = authedQuery({
  args: { sessionId: zid("meetingSessions"), paginationOpts: zPaginationOpts },
  handler: (ctx, { sessionId, paginationOpts }) =>
    listSessionMessages(ctx, ctx.userId, sessionId, paginationOpts),
});
