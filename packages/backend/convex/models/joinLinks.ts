import type { PaginationOptions } from "convex/server";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { parseOrThrow } from "../lib/validate";
import { zJoinLink } from "../tables/joinLinks";
import { findLiveToken, issueToken } from "./invites";
import { addMember, findMember } from "./members";
import { getViewer } from "./users";

const DAY_MS = 24 * 60 * 60 * 1000;

export const createJoinLink = async (
  ctx: MutationCtx,
  link: {
    orgId: Id<"organizations">;
    roleId: Id<"roles">;
    createdBy: Id<"users">;
    days: number;
    maxUses?: number;
  },
) => {
  const { secret, tokenId } = await issueToken(ctx, link.days * DAY_MS);
  await ctx.db.insert(
    "joinLinks",
    parseOrThrow(zJoinLink, {
      orgId: link.orgId,
      roleId: link.roleId,
      createdBy: link.createdBy,
      maxUses: link.maxUses,
      tokenId,
      uses: 0,
    }),
  );
  return secret;
};

const findLiveLink = async (ctx: QueryCtx, secret: string) => {
  const token = await findLiveToken(ctx, secret, Date.now());
  if (!token) return null;
  const link = await ctx.db
    .query("joinLinks")
    .withIndex("by_token", (q) => q.eq("tokenId", token._id))
    .unique();
  if (!link || link.revokedAt) return null;
  if (link.maxUses !== undefined && link.uses >= link.maxUses) return null;
  return link;
};

export const previewJoinLink = async (ctx: QueryCtx, secret: string) => {
  const link = await findLiveLink(ctx, secret);
  if (!link) return null;
  const [org, role] = await Promise.all([
    ctx.db.get("organizations", link.orgId),
    ctx.db.get("roles", link.roleId),
  ]);
  if (!org) return null;
  return { orgName: org.name, roleName: role?.name ?? null };
};

export const acceptJoinLink = async (ctx: MutationCtx, userId: Id<"users">, secret: string) => {
  const link = await findLiveLink(ctx, secret);
  if (!link) throw new ConvexError("This link has expired, was turned off or is used up");
  if (await findMember(ctx, link.orgId, userId)) return { orgId: link.orgId, joined: false };
  await addMember(ctx, link.orgId, userId, link.roleId);
  await ctx.db.patch("joinLinks", link._id, { uses: link.uses + 1 });
  return { orgId: link.orgId, joined: true };
};

export const revokeJoinLink = async (
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  linkId: Id<"joinLinks">,
) => {
  const link = await ctx.db.get("joinLinks", linkId);
  if (!link || link.orgId !== orgId) throw new ConvexError("Link not found");
  if (link.revokedAt) return;
  await ctx.db.patch("joinLinks", linkId, { revokedAt: Date.now() });
  await ctx.db.delete("tokens", link.tokenId);
};

export const listJoinLinks = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  paginationOpts: PaginationOptions,
) => {
  const result = await ctx.db
    .query("joinLinks")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .order("desc")
    .paginate(paginationOpts);
  const page = await Promise.all(
    result.page.map(async (link) => {
      const [role, token, creator] = await Promise.all([
        ctx.db.get("roles", link.roleId),
        ctx.db.get("tokens", link.tokenId),
        getViewer(ctx, link.createdBy),
      ]);
      const expiresAt = token?.expiresAt ?? 0;
      const usedUp = link.maxUses !== undefined && link.uses >= link.maxUses;
      return {
        _id: link._id,
        _creationTime: link._creationTime,
        role: role?.name ?? null,
        createdBy: creator?.name ?? "Someone",
        uses: link.uses,
        maxUses: link.maxUses ?? null,
        expiresAt,
        open: !link.revokedAt && !usedUp,
      };
    }),
  );
  return { ...result, page };
};
