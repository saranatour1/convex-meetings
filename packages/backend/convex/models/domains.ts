import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { addMember, findMember } from "./members";
import { MEMBER_ROLE, findRole } from "./orgs";

const PUBLIC_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "mail.com",
  "yandex.com",
  "zoho.com",
  "fastmail.com",
  "hey.com",
]);

export const verifiedDomainOf = (user: Pick<Doc<"users">, "email" | "isVerified"> | null) => {
  if (!user?.isVerified || !user.email) return null;
  return user.email.trim().toLowerCase().split("@")[1] ?? null;
};

export const setJoinDomain = async (
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">,
  domain: string | null,
  roleId: Id<"roles">,
) => {
  if (domain === null) {
    await ctx.db.patch("organizations", orgId, { joinDomain: undefined, joinRoleId: undefined });
    return;
  }
  if (PUBLIC_MAIL_DOMAINS.has(domain)) {
    throw new ConvexError(`${domain} is a public email provider, so anyone could join`);
  }
  if (verifiedDomainOf(await ctx.db.get("users", userId)) !== domain) {
    throw new ConvexError(`Your verified email must be at ${domain} to turn this on`);
  }
  await ctx.db.patch("organizations", orgId, { joinDomain: domain, joinRoleId: roleId });
};

export const joinableOrgs = async (ctx: QueryCtx, userId: Id<"users">) => {
  const domain = verifiedDomainOf(await ctx.db.get("users", userId));
  if (!domain) return [];
  const orgs = await ctx.db
    .query("organizations")
    .withIndex("by_join_domain", (q) => q.eq("joinDomain", domain))
    .take(20);
  const memberships = await Promise.all(orgs.map((org) => findMember(ctx, org._id, userId)));
  return orgs
    .filter((_, index) => memberships[index] === null)
    .map((org) => ({ _id: org._id, name: org.name, domain }));
};

export const joinByDomain = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  orgId: Id<"organizations">,
) => {
  const org = await ctx.db.get("organizations", orgId);
  const domain = verifiedDomainOf(await ctx.db.get("users", userId));
  if (!org?.joinDomain || org.joinDomain !== domain) {
    throw new ConvexError("You can't join this organization with your email");
  }
  if (await findMember(ctx, orgId, userId)) return false;
  const role =
    (org.joinRoleId && (await ctx.db.get("roles", org.joinRoleId))) ||
    (await findRole(ctx, orgId, MEMBER_ROLE));
  if (!role) throw new ConvexError("This organization has no Member role");
  await addMember(ctx, orgId, userId, role._id);
  return true;
};
