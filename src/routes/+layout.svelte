<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { PUBLIC_CONVEX_URL } from '$app/env/public';
	import { setupConvex } from 'convex-svelte';
	import { setupConvexAuth } from '#lib/auth.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	setupConvex(PUBLIC_CONVEX_URL);
	setupConvexAuth(PUBLIC_CONVEX_URL);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Meetings</title>
</svelte:head>

{@render children()}
