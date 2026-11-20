import { v } from "convex/values";
import { internal } from "../_generated/api";
import { env, internalAction, internalMutation, internalQuery } from "../_generated/server";
import { zodToConvex } from "convex-helpers/server/zod4";
import { zAgent } from "../lib/agents";
import { allPresets } from "../lib/presets";
import { realtimeKit } from "../lib/realtimekit";
import { forgetDevices } from "../models/calls";
import { joinBudget, markLiveText as markLiveTextState } from "../models/usage";
import { endEmptyMeeting } from "../models/meetings";
import { clearTranscript as clearTranscriptLines } from "../models/transcripts";
import { setAgent as setUserAgent } from "../models/users";
import {
  claimRtkMeeting,
  joinDetails as readJoinDetails,
  recordRealtimeEvent,
  setRtkParticipant,
  type RealtimeEvent,
} from "../models/callSessions";

export const WEBHOOK_PATH = "/realtime/webhook";

const WEBHOOK_EVENTS = [
  "meeting.started",
  "meeting.ended",
  "meeting.participantJoined",
  "meeting.participantLeft",
  "meeting.summary",
  "meeting.transcript",
  "recording.statusUpdate",
];

export const joinDetails = internalQuery({
  args: { userId: v.id("users"), meetingId: v.id("meetings") },
  handler: (ctx, { userId, meetingId }) => readJoinDetails(ctx, userId, meetingId),
});

export const budget = internalQuery({
  args: {},
  handler: (ctx) => joinBudget(ctx),
});

export const claimMeeting = internalMutation({
  args: { meetingId: v.id("meetings"), rtkMeetingId: v.string() },
  handler: (ctx, { meetingId, rtkMeetingId }) => claimRtkMeeting(ctx, meetingId, rtkMeetingId),
});

export const setParticipant = internalMutation({
  args: { memberId: v.id("meetingMembers"), rtkParticipantId: v.string(), rtkPreset: v.string() },
  handler: (ctx, { memberId, rtkParticipantId, rtkPreset }) =>
    setRtkParticipant(ctx, memberId, rtkParticipantId, rtkPreset),
});

export const clearTranscript = internalMutation({
  args: { meetingId: v.id("meetings"), until: v.number() },
  handler: (ctx, { meetingId, until }) => clearTranscriptLines(ctx, meetingId, until),
});

export const setAgent = internalMutation({
  args: { userId: v.id("users"), agent: zodToConvex(zAgent) },
  handler: (ctx, { userId, agent }) => setUserAgent(ctx, userId, agent),
});

export const recordEvent = internalMutation({
  args: { event: v.any() },
  handler: (ctx, { event }) => recordRealtimeEvent(ctx, event as RealtimeEvent),
});

export const configure = internalAction({
  args: {
    rtkMeetingId: v.string(),
    record: v.boolean(),
    recap: v.boolean(),
    maxRecordingSeconds: v.number(),
  },
  handler: async (_ctx, { rtkMeetingId, ...config }) => {
    await realtimeKit.updateMeeting(rtkMeetingId, config);
  },
});

export const deactivate = internalAction({
  args: { rtkMeetingId: v.string() },
  handler: async (_ctx, { rtkMeetingId }) => {
    await realtimeKit.kickAll(rtkMeetingId).catch(() => null);
    await realtimeKit.deactivateMeeting(rtkMeetingId);
  },
});

export const endIfEmpty = internalMutation({
  args: { meetingId: v.id("meetings") },
  handler: async (ctx, { meetingId }) => {
    const rtkMeetingId = await endEmptyMeeting(ctx, meetingId);
    if (rtkMeetingId) {
      await ctx.scheduler.runAfter(0, internal.internal.realtime.deactivate, { rtkMeetingId });
    }
  },
});

export const forgetMyDevices = internalMutation({
  args: { meetingId: v.id("meetings"), memberId: v.id("meetingMembers") },
  handler: (ctx, { meetingId, memberId }) => forgetDevices(ctx, meetingId, memberId),
});

export const kick = internalAction({
  args: { rtkMeetingId: v.string(), participantIds: v.array(v.string()) },
  handler: async (_ctx, { rtkMeetingId, participantIds }) => {
    await realtimeKit.kick(rtkMeetingId, participantIds).catch((error: unknown) => {
      console.warn("kick skipped", String(error));
    });
  },
});

export const kickAll = internalAction({
  args: { rtkMeetingId: v.string() },
  handler: async (_ctx, { rtkMeetingId }) => {
    await realtimeKit.kickAll(rtkMeetingId).catch((error: unknown) => {
      console.warn("kick-all skipped", String(error));
    });
  },
});

export const stopRecordings = internalAction({
  args: { rtkMeetingId: v.string() },
  handler: async (_ctx, { rtkMeetingId }) => {
    await realtimeKit.stopRecordings(rtkMeetingId).catch((error: unknown) => {
      console.warn("stop recordings skipped", String(error));
    });
  },
});

export const setLiveText = internalAction({
  args: { on: v.boolean() },
  handler: async (ctx, { on }) => {
    await realtimeKit.setLiveText(
      allPresets()
        .filter((preset) => preset.permissions.transcription_enabled)
        .map((preset) => preset.name),
      on,
    );
    await ctx.runMutation(internal.internal.realtime.markLiveText, { on });
  },
});

export const markLiveText = internalMutation({
  args: { on: v.boolean() },
  handler: (ctx, { on }) => markLiveTextState(ctx, on),
});

export const syncPresets = internalAction({
  args: {},
  handler: async () => {
    const existing = new Set((await realtimeKit.listPresets()).map((preset) => preset.name));
    const missing = allPresets().filter((preset) => !existing.has(preset.name));
    for (const preset of missing) await realtimeKit.createPreset(preset);
    return missing.map((preset) => preset.name);
  },
});

export const setup = internalAction({
  args: {},
  handler: async () => {
    const existing = new Set((await realtimeKit.listPresets()).map((preset) => preset.name));
    const missing = allPresets().filter((preset) => !existing.has(preset.name));
    for (const preset of missing) await realtimeKit.createPreset(preset);
    const webhook = await realtimeKit.createWebhook({
      name: "convex-meetings",
      url: `${env.CONVEX_SITE_URL}${WEBHOOK_PATH}`,
      events: WEBHOOK_EVENTS,
    });
    return { createdPresets: missing.map((preset) => preset.name), webhookId: webhook.id };
  },
});
