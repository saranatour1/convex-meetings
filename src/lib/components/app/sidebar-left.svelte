<script lang="ts">
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import House from '@lucide/svelte/icons/house';
	import Inbox from '@lucide/svelte/icons/inbox';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Video from '@lucide/svelte/icons/video';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../../convex/_generated/api';
	import { useConvexAuth } from '#lib/auth.svelte.js';
	import { Avatar, AvatarFallback, AvatarImage } from '#lib/components/ui/avatar/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import {
		Sidebar,
		SidebarContent,
		SidebarFooter,
		SidebarGroup,
		SidebarGroupContent,
		SidebarGroupLabel,
		SidebarHeader,
		SidebarMenu,
		SidebarMenuAction,
		SidebarMenuBadge,
		SidebarMenuButton,
		SidebarMenuItem,
		SidebarRail
	} from '#lib/components/ui/sidebar/index.js';
	import { cn } from '#lib/utils.js';

	const auth = useConvexAuth();
	const viewer = useQuery(api.users.viewer, {});
	const initials = $derived(
		(viewer.data?.name ?? '?')
			.split(/\s+/)
			.map((w) => w[0])
			.join('')
			.slice(0, 2)
			.toUpperCase()
	);

	const nav = [
		{ title: 'Home', icon: House, active: true },
		{ title: 'Meetings', icon: Video },
		{ title: 'Calendar', icon: CalendarDays },
		{ title: 'Inbox', icon: Inbox, badge: '3' }
	];

	// shortcut: sample tasks, move to a Convex `tasks` table when this goes live.
	let tasks = $state([
		{ id: 1, title: 'Review Q4 roadmap deck', done: false },
		{ id: 2, title: 'Send notes from design sync', done: false },
		{ id: 3, title: 'Book room for offsite', done: false },
		{ id: 4, title: 'Approve hiring plan', done: true }
	]);
</script>

<Sidebar collapsible="icon">
	<SidebarHeader>
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton size="lg">
					<span class="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
						<Video class="size-4" />
					</span>
					<span class="font-semibold">Meetings</span>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	</SidebarHeader>

	<SidebarContent>
		<SidebarGroup>
			<SidebarMenu>
				{#each nav as item (item.title)}
					<SidebarMenuItem>
						<SidebarMenuButton isActive={item.active} tooltipContent={item.title}>
							<item.icon />
							<span>{item.title}</span>
						</SidebarMenuButton>
						{#if item.badge}<SidebarMenuBadge>{item.badge}</SidebarMenuBadge>{/if}
					</SidebarMenuItem>
				{/each}
			</SidebarMenu>
		</SidebarGroup>

		<SidebarGroup class="group-data-[collapsible=icon]:hidden">
			<SidebarGroupLabel>To do</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{#each tasks as task (task.id)}
						<SidebarMenuItem>
							<label
								class="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-sidebar-accent"
							>
								<Checkbox bind:checked={task.done} />
								<span class={cn('truncate', task.done && 'text-muted-foreground line-through')}>
									{task.title}
								</span>
							</label>
						</SidebarMenuItem>
					{/each}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	</SidebarContent>

	<SidebarFooter>
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton size="lg">
					<Avatar class="size-8 rounded-lg">
						{#if viewer.data?.imageUrl}<AvatarImage src={viewer.data.imageUrl} alt="" />{/if}
						<AvatarFallback class="rounded-lg">{initials}</AvatarFallback>
					</Avatar>
					<span class="flex min-w-0 flex-col leading-tight">
						<span class="truncate font-medium">{viewer.data?.name ?? '…'}</span>
						<span class="truncate text-muted-foreground text-xs">
							{viewer.data?.method}{viewer.data?.isVerified ? ' · verified' : ''}
						</span>
					</span>
				</SidebarMenuButton>
				<SidebarMenuAction aria-label="Sign out" class="top-3" onclick={() => auth.signOut()}>
					<LogOut />
				</SidebarMenuAction>
			</SidebarMenuItem>
		</SidebarMenu>
	</SidebarFooter>
	<SidebarRail />
</Sidebar>
