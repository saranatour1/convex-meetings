import { zid } from "convex-helpers/server/zod4";
import {
  meetingMutation,
  meetingQuery,
  orgMutation,
  orgQuery,
  zPaginationOpts,
} from "../lib/functions";
import {
  banFromFlag,
  frameUploadUrl as frameUploadUrlFor,
  liftBan as liftOrgBan,
  listBans,
  listFlags,
  myStatus as readMyStatus,
  resolveFlag as resolveOrgFlag,
  submitFrame as submitCallFrame,
  watchList,
} from "../models/moderation";
import { findMeetingAccess } from "../models/meetingAccess";

export const myStatus = meetingQuery({
  args: { meetingId: zid("meetings") },
  handler: async (ctx, { meetingId }) => {
    const access = await findMeetingAccess(ctx, meetingId, ctx.userId);
    return access ? readMyStatus(ctx, access.member.userId, meetingId) : null;
  },
});

export const watch = meetingQuery({
  args: { meetingId: zid("meetings") },
  handler: async (ctx, { meetingId }) => {
    const access = await findMeetingAccess(ctx, meetingId, ctx.userId);
    return access ? watchList(ctx, access.member.userId, meetingId) : [];
  },
});

export const frameUploadUrl = meetingMutation({
  args: { meetingId: zid("meetings"), targetMemberId: zid("meetingMembers") },
  handler: (ctx, { meetingId, targetMemberId }) =>
    frameUploadUrlFor(ctx, ctx.userId, meetingId, targetMemberId),
});

export const submitFrame = meetingMutation({
  args: {
    meetingId: zid("meetings"),
    targetMemberId: zid("meetingMembers"),
    storageId: zid("_storage"),
  },
  handler: (ctx, frame) => submitCallFrame(ctx, ctx.userId, frame),
});

export const flags = orgQuery({
  args: { paginationOpts: zPaginationOpts },
  handler: (ctx, { orgId, paginationOpts }) => {
    ctx.requirePermission("manageMeetings");
    return listFlags(ctx, orgId, paginationOpts);
  },
});

export const bans = orgQuery({
  args: { paginationOpts: zPaginationOpts },
  handler: (ctx, { orgId, paginationOpts }) => {
    ctx.requirePermission("manageMeetings");
    return listBans(ctx, orgId, paginationOpts);
  },
});

export const liftBan = orgMutation({
  args: { banId: zid("bans") },
  handler: (ctx, { orgId, banId }) => {
    ctx.requirePermission("manageMeetings");
    return liftOrgBan(ctx, orgId, ctx.userId, banId);
  },
});

export const ban = orgMutation({
  args: { flagId: zid("moderationFlags") },
  handler: (ctx, { orgId, flagId }) => {
    ctx.requirePermission("manageMeetings");
    return banFromFlag(ctx, orgId, ctx.userId, flagId);
  },
});

export const resolveFlag = orgMutation({
  args: { flagId: zid("moderationFlags") },
  handler: (ctx, { orgId, flagId }) => {
    ctx.requirePermission("manageMeetings");
    return resolveOrgFlag(ctx, orgId, ctx.userId, flagId);
  },
});
