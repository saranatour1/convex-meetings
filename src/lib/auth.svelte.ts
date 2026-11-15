// Svelte bindings for Convex Auth v2, mirroring @convex-dev/auth/react until an official package exists.
// shortcut: SPA mode only (tokens in localStorage), upgrade to `mode: "ssr"` + cookie handlers if you need SSR auth.
import { getContext, onMount, setContext } from 'svelte';
import { ConvexHttpClient } from 'convex/browser';
import { AuthClient, defaultStorage, type AuthState } from '@convex-dev/auth/browser';
import { setupAuth, useAuth, useConvexClient, useQuery } from 'convex-svelte';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { api } from '../../convex/_generated/api';

const KEY = Symbol('convex-auth');

type Ctx = { client: AuthClient; state: AuthState; oauthError: string | null };

const oauthProviders = {
	google: { start: api.auth.startSignInWithGoogle, complete: api.auth.completeSignInWithGoogle },
	github: { start: api.auth.startSignInWithGithub, complete: api.auth.completeSignInWithGithub }
};
export type OAuthProvider = keyof typeof oauthProviders;

// Query params Convex Auth appends when redirecting back from an OAuth provider.
const CODE_PARAM = 'convexAuthCode';
const ERROR_PARAM = 'convexAuthError';
const PENDING_KEY = 'convexAuth:oauthPending';

/** Call once in the root layout, after `setupConvex(url)`. */
export function setupConvexAuth(url: string) {
	const convex = useConvexClient();
	const http = new ConvexHttpClient(url); // refresh must not go over the paused websocket client
	const client = new AuthClient({
		mode: 'spa',
		authApi: {
			refreshSession: (refreshToken) => http.mutation(api.auth.refreshSession, { refreshToken }),
			signOut: async (refreshToken) => {
				await http.mutation(api.auth.signOut, { refreshToken });
			}
		},
		storage: defaultStorage(),
		storageNamespace: url
	});

	const ctx: Ctx = $state({ client, state: client.getSnapshot(), oauthError: null });

	onMount(() => {
		const unsubscribe = client.subscribe(() => {
			ctx.state = client.getSnapshot();
		});
		void completeOAuth(ctx, (fn, args) => convex.mutation(fn, args));
		void client.init();
		return () => {
			unsubscribe();
			client.dispose();
		};
	});

	setupAuth(() => ({
		isLoading: ctx.state.isLoading,
		isAuthenticated: ctx.state.isAuthenticated,
		fetchAccessToken: client.fetchAccessToken
	}));

	// Sign out locally as soon as the session is revoked server-side.
	const convexAuth = useAuth();
	const live = useQuery(api.auth.isAuthenticated, () => (convexAuth.isAuthenticated ? {} : 'skip'));
	$effect(() => {
		if (live.data === false) void client.signOut();
	});

	setContext(KEY, { ctx, convex });
}

/** Finish an OAuth redirect: trade `?convexAuthCode=` for a session. */
async function completeOAuth(
	ctx: Ctx,
	mutation: ReturnType<typeof useConvexClient>['mutation']
) {
	const url = new URL(location.href);
	const code = url.searchParams.get(CODE_PARAM);
	const error = url.searchParams.get(ERROR_PARAM);
	if (code === null && error === null) return;
	url.searchParams.delete(CODE_PARAM);
	url.searchParams.delete(ERROR_PARAM);
	history.replaceState(history.state, '', url);

	const raw = localStorage.getItem(PENDING_KEY);
	localStorage.removeItem(PENDING_KEY);
	if (error !== null) {
		ctx.oauthError = error.replaceAll('_', ' ');
		return;
	}
	const pending = raw ? (JSON.parse(raw) as { provider: OAuthProvider; state: string }) : null;
	if (!pending || !(pending.provider in oauthProviders)) {
		ctx.oauthError = 'sign-in expired';
		return;
	}

	await ctx.client.withSignInPending(async () => {
		const result = await mutation(oauthProviders[pending.provider].complete, {
			code: code!,
			state: pending.state
		});
		if (result.status === 'complete') await ctx.client.setSession(result.tokens);
		else ctx.oauthError = 'sign-in expired';
	});
}

/** Auth state + actions. Use anywhere under the root layout. */
export function useConvexAuth() {
	const { ctx, convex } = getContext<{ ctx: Ctx; convex: ReturnType<typeof useConvexClient> }>(KEY);

	async function run(
		fn: typeof api.auth.signInWithUsernamePassword | typeof api.auth.signUpWithUsernamePassword,
		args: { username: string; password: string }
	) {
		const result = await convex.mutation(fn, args);
		if (result.status === 'complete') await ctx.client.setSession(result.tokens);
		return result;
	}

	return {
		get isLoading() {
			return ctx.state.isLoading;
		},
		get isAuthenticated() {
			return ctx.state.isAuthenticated;
		},
		get token() {
			return ctx.state.token;
		},
		signInWithPassword: (args: { username: string; password: string }) =>
			run(api.auth.signInWithUsernamePassword, args),
		signUpWithPassword: (args: { username: string; password: string }) =>
			run(api.auth.signUpWithUsernamePassword, args),
		get oauthError() {
			return ctx.oauthError;
		},
		/** Redirects to the provider; the session is finished on return by `setupConvexAuth`. */
		async signInWithOAuth(provider: OAuthProvider) {
			const { redirect, state } = await convex.mutation(oauthProviders[provider].start, {
				redirectTo: location.href
			});
			localStorage.setItem(PENDING_KEY, JSON.stringify({ provider, state }));
			location.href = redirect;
		},
		/** Identifier-first: authenticates if the username exists, otherwise registers a passkey for it. */
		async signInWithPasskey({ username }: { username: string }) {
			const start = await convex.mutation(api.auth.startSignInWithUsernamePasskey, { username });
			if (!start.success) return { status: 'error' as const, error: start.userError.error };
			try {
				if (start.step === 'register') {
					// Keep only fields the server's validator accepts (mirrors Convex Auth's own client).
					const r = await startRegistration({ optionsJSON: start.options as never });
					const result = await convex.mutation(api.auth.finishSignUpWithUsernamePasskey, {
						username,
						response: {
							id: r.id,
							rawId: r.rawId,
							type: r.type,
							clientExtensionResults: {},
							response: {
								clientDataJSON: r.response.clientDataJSON,
								attestationObject: r.response.attestationObject,
								...(r.response.transports ? { transports: r.response.transports } : {})
							}
						}
					});
					if (result.status !== 'complete') return { status: 'error' as const, error: result.userError.error };
					await ctx.client.setSession(result.tokens);
				} else {
					const a = await startAuthentication({ optionsJSON: start.options as never });
					const result = await convex.mutation(api.auth.finishSignInWithUsernamePasskey, {
						response: {
							id: a.id,
							rawId: a.rawId,
							type: a.type,
							clientExtensionResults: {},
							response: {
								clientDataJSON: a.response.clientDataJSON,
								authenticatorData: a.response.authenticatorData,
								signature: a.response.signature,
								...(a.response.userHandle ? { userHandle: a.response.userHandle } : {})
							}
						}
					});
					if (result.status !== 'complete') return { status: 'error' as const, error: result.userError.error };
					await ctx.client.setSession(result.tokens);
				}
				return { status: 'complete' as const };
			} catch (e) {
				const name = e instanceof Error ? e.name : '';
				return {
					status: 'error' as const,
					error: name === 'NotAllowedError' || name === 'AbortError' ? 'CEREMONY_ABORTED' : 'OTHER_ERROR'
				};
			}
		},
		signOut: () => ctx.client.signOut()
	};
}
