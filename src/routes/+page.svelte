<script lang="ts">
	import Link from '@lucide/svelte/icons/link';
	import Plus from '@lucide/svelte/icons/plus';
	import Video from '@lucide/svelte/icons/video';
	import { useConvexAuth } from '#lib/auth.svelte.js';
	import SchedulePanel from '#lib/components/app/schedule-panel.svelte';
	import SidebarLeft from '#lib/components/app/sidebar-left.svelte';
	import SidebarRight from '#lib/components/app/sidebar-right.svelte';
	import SignIn from '#lib/components/app/sign-in.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { SidebarInset, SidebarProvider, SidebarTrigger } from '#lib/components/ui/sidebar/index.js';

	const auth = useConvexAuth();
</script>

{#if auth.isLoading}
	<div class="grid h-dvh place-items-center text-muted-foreground text-sm">Loading…</div>
{:else if !auth.isAuthenticated}
	<SignIn />
{:else}
	<SidebarProvider>
		<SidebarLeft />
		<SidebarInset>
			<!-- Placeholder meeting controls; wire to real meetings later. -->
			<header class="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
				<SidebarTrigger />
				<Separator orientation="vertical" class="me-1 h-4" />
				<Button size="sm"><Video />Start meeting</Button>
				<Button size="sm" variant="outline"><Plus />Schedule</Button>
				<div class="ms-auto hidden items-center gap-2 sm:flex">
					<Input class="w-44" placeholder="Code or link" aria-label="Meeting code" />
					<Button size="sm" variant="ghost"><Link />Join</Button>
				</div>
			</header>
			<SchedulePanel />
		</SidebarInset>
		<SidebarRight />
	</SidebarProvider>
{/if}
