import { sendEmail } from "@sarant/cloudflare-email-component";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import { env, internalAction, internalMutation, internalQuery } from "../_generated/server";
import { inviteEmailDetails, recordSendResult } from "../models/invites";

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const oneLine = (text: string) => text.replace(/[\r\n]+/g, " ").trim();

export const inviteEmail = ({
  orgName,
  inviterName,
  link,
}: {
  orgName: string;
  inviterName: string;
  link: string;
}) => ({
  subject: oneLine(`${inviterName} invited you to ${orgName}`).slice(0, 200),
  text: `${inviterName} invited you to join ${orgName}.\n\nAccept the invite: ${link}\n\nThe link works for 7 days.`,
  html: `<p>${escapeHtml(inviterName)} invited you to join <strong>${escapeHtml(orgName)}</strong>.</p><p><a href="${escapeHtml(link)}">Accept the invite</a></p><p>The link works for 7 days.</p>`,
});

export const details = internalQuery({
  args: { inviteId: v.id("invites") },
  handler: (ctx, { inviteId }) => inviteEmailDetails(ctx, inviteId),
});

export const recordSend = internalMutation({
  args: { inviteId: v.id("invites"), emailError: v.optional(v.string()) },
  handler: (ctx, { inviteId, emailError }) => recordSendResult(ctx, inviteId, emailError),
});

export const send = internalAction({
  args: { inviteId: v.id("invites"), secret: v.string() },
  handler: async (ctx, { inviteId, secret }) => {
    const invite = await ctx.runQuery(internal.internal.invites.details, { inviteId });
    if (!invite) return;
    if (!env.EMAIL_FROM) {
      await ctx.runMutation(internal.internal.invites.recordSend, {
        inviteId,
        emailError: "EMAIL_FROM is not set on the Convex deployment",
      });
      return;
    }
    const content = inviteEmail({ ...invite, link: `${env.SITE_URL}/invite/${secret}` });
    const result = await sendEmail(ctx, components.cloudflareEmail, {
      owner: invite.orgId,
      email: {
        from: { address: env.EMAIL_FROM, name: invite.orgName },
        to: invite.email,
        ...content,
      },
      seal: (text) => text,
    });
    await ctx.runMutation(internal.internal.invites.recordSend, {
      inviteId,
      emailError: result.error,
    });
  },
});
