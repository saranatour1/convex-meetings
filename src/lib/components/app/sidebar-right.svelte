<script lang="ts">
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import Hash from '@lucide/svelte/icons/hash';
	import { Avatar, AvatarFallback } from '#lib/components/ui/avatar/index.js';
	import { ChatConversation, ChatMessage, ChatScroll } from '#lib/components/ui/chat/index.js';
	import {
		Composer,
		ComposerActionGroup,
		ComposerActions,
		ComposerInput,
		ComposerSubmit,
		getComposerText,
		type ComposerValue
	} from '#lib/components/ui/composer/index.js';
	import {
		Sidebar,
		SidebarContent,
		SidebarFooter,
		SidebarHeader
	} from '#lib/components/ui/sidebar/index.js';
	import { cn } from '#lib/utils.js';

	const channels = ['general', 'design', 'standup'];
	let channel = $state('general');

	// shortcut: local-only messages, back with a Convex `messages` table when chat goes live.
	let messages = $state([
		{ id: 1, author: 'Maya S.', initials: 'MS', text: 'Morning! Design sync moved to 11.', mine: false },
		{ id: 2, author: 'Alex K.', initials: 'AK', text: 'Works for me 👍', mine: false },
		{ id: 3, author: 'You', initials: 'ME', text: 'Same, I’ll bring the new mocks.', mine: true },
		{ id: 4, author: 'Jordan D.', initials: 'JD', text: 'Can someone share the agenda?', mine: false }
	]);
	let draft = $state<ComposerValue>([]);

	const scroll = new ChatScroll(() => ({ itemCount: messages.length, layoutKey: channel }));

	function send(value: ComposerValue) {
		const text = getComposerText(value).trim();
		if (!text) return;
		messages.push({ id: Date.now(), author: 'You', initials: 'ME', text, mine: true });
		draft = [];
	}
</script>

<Sidebar side="right" collapsible="none" class="sticky top-0 hidden h-svh w-88 border-s lg:flex">
	<SidebarHeader class="border-b">
		<nav class="flex gap-1" aria-label="Channels">
			{#each channels as c (c)}
				<button
					type="button"
					class={cn(
						'flex items-center gap-1 rounded-lg px-2 py-1 text-sm',
						c === channel
							? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
							: 'hover:bg-sidebar-accent'
					)}
					aria-current={c === channel ? 'page' : undefined}
					onclick={() => (channel = c)}
				>
					<Hash class="size-3.5" />{c}
				</button>
			{/each}
		</nav>
	</SidebarHeader>

	<SidebarContent class="overflow-hidden">
		<ChatConversation {scroll} label={`#${channel} messages`} jumpLabel="Jump to latest" class="min-h-0 flex-1">
			{#each messages as m (m.id)}
				<ChatMessage side={m.mine ? 'outgoing' : 'incoming'} author={m.mine ? undefined : m.author}>
					{#snippet avatar()}
						<Avatar class="size-7"><AvatarFallback>{m.initials}</AvatarFallback></Avatar>
					{/snippet}
					{m.text}
				</ChatMessage>
			{/each}
		</ChatConversation>
	</SidebarContent>

	<SidebarFooter class="border-t">
		<Composer layout="adaptive" bind:value={draft} onSubmit={send}>
			<ComposerInput as="textarea" aria-label="Message" placeholder={`Message #${channel}`} />
			<ComposerActions>
				<ComposerActionGroup align="end">
					<ComposerSubmit aria-label="Send message" size="icon">
						<ArrowUp aria-hidden="true" />
					</ComposerSubmit>
				</ComposerActionGroup>
			</ComposerActions>
		</Composer>
	</SidebarFooter>
</Sidebar>
