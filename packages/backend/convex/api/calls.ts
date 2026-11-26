import { zid } from "convex-helpers/server/zod4";
import { internal } from "../_generated/api";
import { z } from "zod";
import { authedMutation, meetingAction, meetingMutation, orgQuery } from "../lib/functions";
import { realtimeKit } from "../lib/realtimekit";
import type { JoinDetails } from "../models/callSessions";
import {
  endForEveryone,
  forgetDevices,
  letBackIn,
  listLiveCalls,
  removeFromCall,
} from "../models/calls";
import { requireMeetingMember } from "../models/meetingAccess";

export const remove = authedMutation({
  args: { meetingMemberId: zid("meetingMembers") },
  handler: (ctx, { meetingMemberId }) => removeFromCall(ctx, ctx.userId, meetingMemberId),
});

export const letIn = authedMutation({
  args: { meetingMemberId: zid("meetingMembers") },
  handler: (ctx, { meetingMemberId }) => letBackIn(ctx, ctx.userId, meetingMemberId),
});

export const end = authedMutation({
  args: { meetingId: zid("meetings") },
  handler: (ctx, { meetingId }) => endForEveryone(ctx, ctx.userId, meetingId),
});

export const live = orgQuery({
  args: {},
  handler: (ctx, { orgId }) => {
    ctx.requirePermission("manageOrganization");
    return listLiveCalls(ctx, orgId);
  },
});

export const switchHere = meetingAction({
  args: { meetingId: zid("meetings") },
  handler: async (ctx, { meetingId }) => {
    const details: JoinDetails = await ctx.runQuery(internal.internal.realtime.joinDetails, {
      userId: ctx.userId,
      meetingId,
      now: Date.now(),
    });
    if (!details.rtkMeetingId || !details.rtkParticipantId) return;
    await realtimeKit.kick(details.rtkMeetingId, [details.rtkParticipantId]).catch(() => null);
    await ctx.runMutation(internal.internal.realtime.forgetMyDevices, {
      meetingId,
      memberId: details.memberId,
    });
  },
});

export const leftOnDevice = meetingMutation({
  args: { meetingId: zid("meetings"), peerId: z.string().max(100) },
  handler: async (ctx, { meetingId, peerId }) => {
    const { member } = await requireMeetingMember(ctx, meetingId, ctx.userId);
    await forgetDevices(ctx, meetingId, member._id, peerId);
  },
});
