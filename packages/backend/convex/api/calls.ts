import { zid } from "convex-helpers/server/zod4";
import { authedMutation, orgQuery } from "../lib/functions";
import { endForEveryone, letBackIn, listLiveCalls, removeFromCall } from "../models/calls";

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
