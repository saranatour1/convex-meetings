import { getAuthUserId } from '@convex-dev/auth/server';
import { vGoogleProfile } from '@convex-dev/auth/methods/google/server';
import { vGithubProfile } from '@convex-dev/auth/methods/github/server';
import { Workpool } from '@convex-dev/workpool';
import { v } from 'convex/values';
import { internalAction, internalMutation, query, type MutationCtx } from './_generated/server';
import { components, internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import schema from './schema';

// Copying provider avatars into storage is a network call, so it runs in a retried workpool.
const avatarPool = new Workpool(components.avatarWorkpool, {
	maxParallelism: 5,
	retryActionsByDefault: true
});

async function insertUser(
	ctx: MutationCtx,
	user: Omit<Doc<'users'>, '_id' | '_creationTime'>,
	avatarUrl?: string
) {
	const userId = await ctx.db.insert('users', user);
	if (avatarUrl) await avatarPool.enqueueAction(ctx, internal.users.storeAvatar, { userId, url: avatarUrl });
	return userId;
}

const usernameMethod = <Name extends 'usernamePasskey' | 'usernamePassword'>(name: Name) =>
	internalMutation({
		args: { method: v.object({ name: v.literal(name), profile: v.object({}) }) },
		returns: v.id('users'),
		handler: (ctx) => insertUser(ctx, { method: name, isVerified: false })
	});

export const createPasskeyUser = usernameMethod('usernamePasskey');
export const createPasswordUser = usernameMethod('usernamePassword');

export const createGoogleUser = internalMutation({
	args: { method: v.object({ name: v.literal('google'), profile: vGoogleProfile }) },
	returns: v.id('users'),
	handler: (ctx, { method: { profile } }) =>
		insertUser(
			ctx,
			{ method: 'google', name: profile.name, email: profile.email, isVerified: profile.emailVerified },
			profile.picture
		)
});

export const createGithubUser = internalMutation({
	args: { method: v.object({ name: v.literal('github'), profile: vGithubProfile }) },
	returns: v.id('users'),
	handler: (ctx, { method: { profile } }) =>
		insertUser(
			ctx,
			{
				method: 'github',
				name: profile.name ?? profile.login,
				email: profile.email,
				isVerified: profile.emailVerified
			},
			profile.avatarUrl
		)
});

export const storeAvatar = internalAction({
	args: { userId: v.id('users'), url: v.string() },
	returns: v.null(),
	handler: async (ctx, { userId, url }) => {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`Avatar fetch failed: ${res.status}`); // workpool retries
		const imageId = await ctx.storage.store(await res.blob());
		await ctx.runMutation(internal.users.setImage, { userId, imageId });
		return null;
	}
});

export const setImage = internalMutation({
	args: { userId: v.id('users'), imageId: v.id('_storage') },
	returns: v.null(),
	handler: async (ctx, { userId, imageId }) => {
		const user = await ctx.db.get('users', userId);
		if (!user) {
			await ctx.storage.delete(imageId);
			return null;
		}
		if (user.imageId) await ctx.storage.delete(user.imageId);
		await ctx.db.patch('users', userId, { imageId });
		return null;
	}
});

export const viewer = query({
	args: {},
	returns: v.union(
		v.null(),
		v.object({
			...schema.tables.users.validator.fields,
			_id: v.id('users'),
			_creationTime: v.number(),
			name: v.string(),
			imageUrl: v.union(v.string(), v.null())
		})
	),
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (userId === null) return null;
		const user = await ctx.db.get('users', userId);
		if (!user) return null;
		const username = user.name
			? null
			: await ctx.runQuery(components.authUsername.public.getUsername, { userId });
		return {
			...user,
			name: user.name ?? username ?? 'Anonymous',
			imageUrl: user.imageId ? await ctx.storage.getUrl(user.imageId) : null
		};
	}
});
