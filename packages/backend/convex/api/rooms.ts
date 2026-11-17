import { zid } from "convex-helpers/server/zod4";
import { z } from "zod";
import {
  authedMutation,
  authedQuery,
  orgMutation,
  orgQuery,
  publicQuery,
  zPaginationOpts,
} from "../lib/functions";
import { zTimeZone } from "../lib/time";
import {
  closeRoom,
  createRoom,
  listOpenRooms,
  listOrgRooms,
  listPublicRecaps,
  previewRoom,
  publicRecap,
  roomWaitingStats,
  updateRoom,
} from "../models/rooms";
import { zMeeting } from "../tables/meetings";
import { zRoom } from "../tables/rooms";

const zSlowMode = zMeeting.shape.slowModeSeconds.unwrap();
const zCode = z.string().max(20);

export const create = orgMutation({
  args: {
    title: zMeeting.shape.title,
    description: zRoom.shape.description,
    slowModeSeconds: zSlowMode,
    waitingRoom: z.boolean().optional(),
    timeZone: zTimeZone,
  },
  handler: (ctx, { orgId, ...room }) => {
    ctx.requirePermission("manageMeetings");
    return createRoom(ctx, { ...room, orgId, userId: ctx.userId });
  },
});

export const update = authedMutation({
  args: {
    meetingId: zid("meetings"),
    title: zMeeting.shape.title.optional(),
    description: zRoom.shape.description.optional(),
    slowModeSeconds: zSlowMode.optional(),
    waitingRoom: z.boolean().optional(),
  },
  handler: (ctx, { meetingId, ...changes }) => updateRoom(ctx, ctx.userId, meetingId, changes),
});

export const waitingRoom = authedQuery({
  args: { meetingId: zid("meetings") },
  handler: (ctx, { meetingId }) => roomWaitingStats(ctx, ctx.userId, meetingId),
});

export const close = authedMutation({
  args: { meetingId: zid("meetings") },
  handler: (ctx, { meetingId }) => closeRoom(ctx, ctx.userId, meetingId),
});

export const directory = publicQuery({
  args: { paginationOpts: zPaginationOpts },
  handler: (ctx, { paginationOpts }) => listOpenRooms(ctx, paginationOpts),
});

export const preview = publicQuery({
  args: { code: zCode },
  handler: (ctx, { code }) => previewRoom(ctx, code),
});

export const ours = orgQuery({
  args: { paginationOpts: zPaginationOpts },
  handler: (ctx, { orgId, paginationOpts }) => listOrgRooms(ctx, orgId, paginationOpts),
});

export const recaps = publicQuery({
  args: { code: zCode, paginationOpts: zPaginationOpts },
  handler: (ctx, { code, paginationOpts }) => listPublicRecaps(ctx, code, paginationOpts),
});

export const recap = publicQuery({
  args: { code: zCode, number: z.number().int().min(1) },
  handler: (ctx, { code, number }) => publicRecap(ctx, code, number),
});
