import type { PaginationOptions } from "convex/server";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { emailWorkpool } from "../lib/workpools";
import { spendEmail } from "./usage";
import { zInvite } from "../tables/invites";
import { addMember, findMember } from "./members";
import { getViewer } from "./users";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const GUEST_PASS_MS = 30 * 24 * 60 * 60 * 1000;

const toHex = (bytes: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

export const hashSecret = async (secret: string) =>
  toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)));

const newSecret = () => toHex(crypto.getRandomValues(new Uint8Array(32)));

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const issueToken = async (ctx: MutationCtx, ttlMs = INVITE_TTL_MS) => {
  const secret = newSecret();
  const tokenId = await ctx.db.insert("tokens", {
    value: await hashSecret(secret),
    expiresAt: Date.now() + ttlMs,
  });
  return { secret, tokenId };
};

export const renewToken = async (ctx: MutationCtx, tokenId: Id<"tokens">, ttlMs: number) => {
  const secret = newSecret();
  await ctx.db.patch("tokens", tokenId, {
    value: await hashSecret(secret),
    expiresAt: Date.now() + ttlMs,
  });
  return secret;
};

export const findLiveToken = async (ctx: QueryCtx, secret: string) => {
  const value = await hashSecret(secret);
  const token = await ctx.db
    .query("tokens")
    .withIndex("by_value", (q) => q.eq("value", value))
    .unique();
  return token && token.expiresAt > Date.now() ? token : null;
};

const enqueueSend = async (ctx: MutationCtx, inviteId: Id<"invites">, secret: string) => {
  await spendEmail(ctx);
  await emailWorkpool.enqueueAction(ctx, internal.internal.invites.send, { inviteId, secret });
};

const deleteInvite = async (ctx: MutationCtx, invite: Doc<"invites">) => {
  await ctx.db.delete("tokens", invite.tokenId);
  await ctx.db.delete("invites", invite._id);
};

const ownInvite = async (ctx: QueryCtx, orgId: Id<"organizations">, inviteId: Id<"invites">) => {
  const invite = await ctx.db.get("invites", inviteId);
  if (!invite || invite.orgId !== orgId) throw new ConvexError("Invite not found");
  return invite;
};

export const createInvite = async (
  ctx: MutationCtx,
  invite: {
    orgId: Id<"organizations">;
    roleId: Id<"roles">;
    invitedBy: Id<"users">;
    email: string;
  },
) => {
  const role = await ctx.db.get("roles", invite.roleId);
  if (!role || role.orgId !== invite.orgId) throw new ConvexError("Unknown role");
  const email = normalizeEmail(invite.email);
  const previous = await ctx.db
    .query("invites")
    .withIndex("by_org_and_email", (q) => q.eq("orgId", invite.orgId).eq("email", email))
    .unique();
  if (previous) await deleteInvite(ctx, previous);
  const { secret, tokenId } = await issueToken(ctx);
  const inviteId = await ctx.db.insert(
    "invites",
    parseOrThrow(zInvite, { ...invite, email, tokenId }),
  );
  await enqueueSend(ctx, inviteId, secret);
  return inviteId;
};

const isMemberByEmail = async (ctx: QueryCtx, orgId: Id<"organizations">, email: string) => {
  const users = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .take(10);
  const memberships = await Promise.all(users.map((user) => findMember(ctx, orgId, user._id)));
  return memberships.some((member) => member !== null);
};

export const inviteMany = async (
  ctx: MutationCtx,
  invite: {
    orgId: Id<"organizations">;
    roleId: Id<"roles">;
    invitedBy: Id<"users">;
    emails: string[];
  },
) => {
  const sent: string[] = [];
  const skipped: string[] = [];
  for (const email of new Set(invite.emails.map(normalizeEmail))) {
    if (await isMemberByEmail(ctx, invite.orgId, email)) {
      skipped.push(email);
      continue;
    }
    await createInvite(ctx, { ...invite, email });
    sent.push(email);
  }
  return { sent, skipped };
};

export const resendInvite = async (
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  inviteId: Id<"invites">,
) => {
  const invite = await ownInvite(ctx, orgId, inviteId);
  await ctx.db.delete("tokens", invite.tokenId);
  const { secret, tokenId } = await issueToken(ctx);
  await ctx.db.patch("invites", inviteId, { tokenId, emailError: undefined });
  await enqueueSend(ctx, inviteId, secret);
};

export const revokeInvite = async (
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  inviteId: Id<"invites">,
) => {
  const invite = await ownInvite(ctx, orgId, inviteId);
  await deleteInvite(ctx, invite);
  return invite;
};

const findLiveInvite = async (ctx: QueryCtx, secret: string) => {
  const live = await findLiveToken(ctx, secret);
  if (!live) return null;
  return ctx.db
    .query("invites")
    .withIndex("by_token", (q) => q.eq("tokenId", live._id))
    .unique();
};

export const previewInvite = async (ctx: QueryCtx, secret: string) => {
  const invite = await findLiveInvite(ctx, secret);
  if (!invite) return null;
  const [org, inviter] = await Promise.all([
    ctx.db.get("organizations", invite.orgId),
    getViewer(ctx, invite.invitedBy),
  ]);
  if (!org) return null;
  return { orgName: org.name, inviterName: inviter?.name ?? "Someone", email: invite.email };
};

export const acceptInvite = async (ctx: MutationCtx, userId: Id<"users">, secret: string) => {
  const invite = await findLiveInvite(ctx, secret);
  if (!invite) throw new ConvexError("This invite has expired or was already used");
  const user = await ctx.db.get("users", userId);
  if (!user) throw new ConvexError("Unauthenticated");
  await addMember(ctx, invite.orgId, userId, invite.roleId);
  if (!user.isVerified) {
    await ctx.db.patch("users", userId, { email: invite.email, isVerified: true });
  }
  await deleteInvite(ctx, invite);
  return invite.orgId;
};

export const listInvites = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  paginationOpts: PaginationOptions,
) => {
  const result = await ctx.db
    .query("invites")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .paginate(paginationOpts);
  const page = await Promise.all(
    result.page.map(async (invite) => {
      const [role, token] = await Promise.all([
        ctx.db.get("roles", invite.roleId),
        ctx.db.get("tokens", invite.tokenId),
      ]);
      return {
        _id: invite._id,
        email: invite.email,
        role: role?.name ?? null,
        expiresAt: token?.expiresAt ?? 0,
        emailError: invite.emailError ?? null,
      };
    }),
  );
  return { ...result, page };
};

export const inviteEmailDetails = async (ctx: QueryCtx, inviteId: Id<"invites">) => {
  const invite = await ctx.db.get("invites", inviteId);
  if (!invite) return null;
  const [org, inviter] = await Promise.all([
    ctx.db.get("organizations", invite.orgId),
    getViewer(ctx, invite.invitedBy),
  ]);
  if (!org) return null;
  return {
    orgId: invite.orgId,
    email: invite.email,
    orgName: org.name,
    inviterName: inviter?.name ?? "Someone",
  };
};

export const recordSendResult = async (
  ctx: MutationCtx,
  inviteId: Id<"invites">,
  emailError: string | undefined,
) => {
  if (await ctx.db.get("invites", inviteId)) {
    await ctx.db.patch("invites", inviteId, { emailError });
  }
};
