<script lang="ts">
	import KeyRound from '@lucide/svelte/icons/key-round';
	import { useConvexAuth, type OAuthProvider } from '#lib/auth.svelte.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		Card,
		CardDescription,
		CardFooter,
		CardHeader,
		CardPanel,
		CardTitle
	} from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';

	const auth = useConvexAuth();

	let usePassword = $state(false);
	let passwordMode = $state<'signIn' | 'signUp'>('signIn');
	let username = $state('');
	let password = $state('');
	let error = $state('');
	let pending = $state(false);

	const messages: Record<string, string> = {
		USER_NOT_FOUND: 'No account with that username.',
		INVALID_CREDENTIALS: 'Wrong password.',
		USERNAME_TAKEN: 'That username is taken.',
		RATE_LIMITED: 'Too many attempts. Try again shortly.',
		CEREMONY_ABORTED: 'Passkey prompt was cancelled.',
		WEBAUTHN_UNSUPPORTED: 'This browser does not support passkeys.'
	};
	const describe = (code: string) => messages[code] ?? code.replaceAll('_', ' ').toLowerCase();

	async function run(fn: () => Promise<{ status: string; error?: string; userError?: unknown }>) {
		pending = true;
		error = '';
		try {
			const result = await fn();
			if (result.status === 'error') {
				error = describe(result.error ?? (result.userError as { error?: string })?.error ?? 'OTHER_ERROR');
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong.';
		} finally {
			pending = false;
		}
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!usePassword) return run(() => auth.signInWithPasskey({ username }));
		const fn = passwordMode === 'signIn' ? auth.signInWithPassword : auth.signUpWithPassword;
		return run(() => fn({ username, password }));
	}

	function oauth(provider: OAuthProvider) {
		return run(async () => {
			await auth.signInWithOAuth(provider);
			return { status: 'redirect' };
		});
	}
</script>

{#snippet google()}
	<svg viewBox="0 0 24 24" aria-hidden="true">
		<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
		<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
		<path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
		<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
	</svg>
{/snippet}

{#snippet github()}
	<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
		<path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
	</svg>
{/snippet}

<div class="grid min-h-dvh place-items-center bg-sidebar p-4">
	<Card class="w-full max-w-sm">
		<CardHeader>
			<CardTitle>Sign in to Meetings</CardTitle>
			<CardDescription>
				{usePassword
					? 'Use your username and password.'
					: 'Enter a username. New usernames create an account with a passkey.'}
			</CardDescription>
		</CardHeader>
		<form onsubmit={submit} class="contents">
			<CardPanel class="flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<Label for="username">Username</Label>
					<Input
						id="username"
						bind:value={username}
						autocomplete={usePassword ? 'username' : 'username webauthn'}
						required
					/>
				</div>
				{#if usePassword}
					<div class="flex flex-col gap-2">
						<Label for="password">Password</Label>
						<Input
							id="password"
							type="password"
							bind:value={password}
							autocomplete={passwordMode === 'signIn' ? 'current-password' : 'new-password'}
							required
						/>
					</div>
				{/if}
				{#if error || auth.oauthError}
					<p class="text-destructive-foreground text-sm" role="alert">{error || auth.oauthError}</p>
				{/if}
				<Button type="submit" class="w-full" disabled={pending}>
					{#if usePassword}
						{passwordMode === 'signIn' ? 'Sign in' : 'Sign up'}
					{:else}
						<KeyRound />Continue with passkey
					{/if}
				</Button>
				{#if usePassword}
					<Button
						type="button"
						variant="link"
						onclick={() => (passwordMode = passwordMode === 'signIn' ? 'signUp' : 'signIn')}
					>
						{passwordMode === 'signIn' ? 'No account? Sign up' : 'Have an account? Sign in'}
					</Button>
				{/if}
			</CardPanel>
		</form>
		<CardFooter class="flex flex-col gap-3">
			<div class="flex w-full items-center gap-3 text-muted-foreground text-xs">
				<Separator class="flex-1" />or<Separator class="flex-1" />
			</div>
			<Button variant="outline" class="w-full" disabled={pending} onclick={() => oauth('google')}>
				{@render google()}Continue with Google
			</Button>
			<Button variant="outline" class="w-full" disabled={pending} onclick={() => oauth('github')}>
				{@render github()}Continue with GitHub
			</Button>
			<Button
				variant="link"
				size="sm"
				onclick={() => {
					usePassword = !usePassword;
					error = '';
				}}
			>
				{usePassword ? 'Use a passkey instead' : 'Use a password instead'}
			</Button>
		</CardFooter>
	</Card>
</div>
