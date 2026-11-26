import { sendEmail } from "@sarant/cloudflare-email-component";
import { v } from "convex/values";
import { DateTime } from "luxon";
import { components, internal } from "../_generated/api";
import { env, internalAction, internalMutation, internalQuery } from "../_generated/server";
import { escapeHtml, oneLine } from "../lib/html";
import { icsAttachment } from "../lib/ics";
import { guestInviteDetails, guestUserId, recordGuestInviteSend } from "../models/guests";

export const guestInviteEmail = ({
  title,
  inviterName,
  when,
  link,
}: {
  title: string;
  inviterName: string;
  when: string | null;
  link: string;
}) => ({
  subject: oneLine(`${inviterName} invited you to ${title}`).slice(0, 200),
  text: `${inviterName} invited you to ${title}${when ? ` on ${when}` : ""}.\n\nJoin from your browser, no account needed: ${link}\n\nThis link is just for you.`,
  html: `<p>${escapeHtml(inviterName)} invited you to <strong>${escapeHtml(title)}</strong>${when ? ` on ${escapeHtml(when)}` : ""}.</p><p><a href="${escapeHtml(link)}">Join from your browser</a>. No account needed.</p><p>This link is just for you.</p>`,
});

export const userId = internalQuery({
  args: { secret: v.string(), now: v.number() },
  handler: (ctx, { secret, now }) => guestUserId(ctx, secret, now),
});

export const details = internalQuery({
  args: { guestId: v.id("meetingGuests") },
  handler: (ctx, { guestId }) => guestInviteDetails(ctx, guestId),
});

export const recordSend = internalMutation({
  args: { guestId: v.id("meetingGuests"), emailError: v.optional(v.string()) },
  handler: (ctx, { guestId, emailError }) => recordGuestInviteSend(ctx, guestId, emailError),
});

export const sendInvite = internalAction({
  args: { guestId: v.id("meetingGuests"), secret: v.string() },
  handler: async (ctx, { guestId, secret }) => {
    const invite = await ctx.runQuery(internal.internal.guests.details, { guestId });
    if (!invite) return;
    if (!env.EMAIL_FROM) {
      await ctx.runMutation(internal.internal.guests.recordSend, {
        guestId,
        emailError: "EMAIL_FROM is not set on the Convex deployment",
      });
      return;
    }
    const { time } = invite;
    const link = `${env.SITE_URL}/guest/${secret}`;
    const content = guestInviteEmail({
      title: invite.title,
      inviterName: invite.inviterName,
      when: time
        ? DateTime.fromMillis(time.startsAt, { zone: time.timeZone }).toFormat(
            "ccc, LLL d 'at' HH:mm ZZZZ",
          )
        : null,
      link,
    });
    const result = await sendEmail(ctx, components.cloudflareEmail, {
      owner: invite.orgId,
      email: {
        from: { address: env.EMAIL_FROM, name: invite.inviterName },
        to: invite.email,
        ...content,
        ...(time && {
          attachments: [
            icsAttachment({
              ...time,
              method: "REQUEST",
              code: invite.code,
              title: invite.title,
              url: link,
              organizer: { name: invite.inviterName, email: env.EMAIL_FROM },
              attendee: { name: invite.name, email: invite.email },
              now: Date.now(),
            }),
          ],
        }),
      },
      seal: (text) => text,
    });
    await ctx.runMutation(internal.internal.guests.recordSend, {
      guestId,
      emailError: result.error,
    });
  },
});
