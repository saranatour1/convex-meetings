import { sendEmail } from "@sarant/cloudflare-email-component";
import { v } from "convex/values";
import { DateTime } from "luxon";
import { components } from "../_generated/api";
import { env, internalAction } from "../_generated/server";
import { escapeHtml, oneLine } from "../lib/html";
import { meetingIcs, toBase64, type IcsMethod } from "../lib/ics";

type MeetingEmail = {
  method: IcsMethod;
  title: string;
  hostName: string;
  when: string;
  link: string;
  repeats: boolean;
};

export const meetingEmail = ({ method, title, hostName, when, link, repeats }: MeetingEmail) => {
  const often = repeats ? ", repeating" : "";
  if (method === "CANCEL") {
    return {
      subject: oneLine(`Cancelled: ${title}`).slice(0, 200),
      text: `${hostName} cancelled ${title} (${when}${often}).`,
      html: `<p>${escapeHtml(hostName)} cancelled <strong>${escapeHtml(title)}</strong> (${escapeHtml(when)}${often}).</p>`,
    };
  }
  return {
    subject: oneLine(`${hostName} invited you to ${title}`).slice(0, 200),
    text: `${hostName} invited you to ${title} on ${when}${often}.\n\nSay whether you're going and join from here: ${link}`,
    html: `<p>${escapeHtml(hostName)} invited you to <strong>${escapeHtml(title)}</strong> on ${escapeHtml(when)}${often}.</p><p><a href="${escapeHtml(link)}">Reply and join</a></p>`,
  };
};

export const send = internalAction({
  args: {
    method: v.union(v.literal("REQUEST"), v.literal("CANCEL")),
    orgId: v.id("organizations"),
    code: v.string(),
    title: v.string(),
    hostName: v.string(),
    to: v.object({ name: v.string(), email: v.string() }),
    startsAt: v.number(),
    endsAt: v.number(),
    timeZone: v.string(),
    rrule: v.optional(v.string()),
  },
  handler: async (ctx, event) => {
    if (!env.EMAIL_FROM) return;
    const link = `${env.SITE_URL}/m/${event.code}`;
    const content = meetingEmail({
      method: event.method,
      title: event.title,
      hostName: event.hostName,
      when: DateTime.fromMillis(event.startsAt, { zone: event.timeZone }).toFormat(
        "ccc, LLL d 'at' HH:mm ZZZZ",
      ),
      link,
      repeats: Boolean(event.rrule),
    });
    const ics = meetingIcs({
      ...event,
      url: link,
      organizer: { name: event.hostName, email: env.EMAIL_FROM },
      attendee: event.to,
      now: Date.now(),
    });
    await sendEmail(ctx, components.cloudflareEmail, {
      owner: event.orgId,
      email: {
        from: { address: env.EMAIL_FROM, name: event.hostName },
        to: { address: event.to.email, name: event.to.name },
        ...content,
        attachments: [
          {
            content: toBase64(ics),
            filename: event.method === "CANCEL" ? "cancel.ics" : "invite.ics",
            type: `text/calendar; charset=utf-8; method=${event.method}`,
            disposition: "attachment",
          },
        ],
      },
      seal: (text) => text,
    });
  },
});
