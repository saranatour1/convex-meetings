<script lang="ts">
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import Users from '@lucide/svelte/icons/users';
	import { DateFormatter, type DateValue, getLocalTimeZone, today } from '@internationalized/date';
	import { Avatar, AvatarFallback, AvatarGroup } from '#lib/components/ui/avatar/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Calendar } from '#lib/components/ui/calendar/index.js';
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
	import { ToggleGroup, ToggleGroupItem } from '#lib/components/ui/toggle-group/index.js';
	import { cn } from '#lib/utils.js';

	let { class: className }: { class?: string } = $props();

	const todayValue = today(getLocalTimeZone());
	let date = $state<DateValue>(todayValue);
	let time = $state<string[]>([]);
	let duration = $state<string[]>(['30']);
	let title = $state('');

	// shortcut: fixed slots and sample meetings, replace with Convex queries when scheduling is real.
	const slots = ['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '15:30', '16:00'];
	const busy = new Set(['09:30', '13:00']);
	const upcoming = [
		{ title: 'Design sync', when: 'Today · 11:00', people: ['AK', 'MS', 'JD'], live: true },
		{ title: 'Weekly planning', when: 'Today · 14:00', people: ['LT', 'AK'], live: false },
		{ title: 'Customer interview', when: 'Tomorrow · 10:30', people: ['MS'], live: false }
	];

	const dayFormatter = new DateFormatter('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
</script>

<main class={cn('flex flex-1 flex-col', className)}>
	<div>
		<div class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6">
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2"><CalendarClock class="size-4" />Schedule a meeting</CardTitle>
					<CardDescription>Pick a day and a time, then invite people.</CardDescription>
				</CardHeader>
				<CardPanel class="@container flex flex-col gap-5">
					<div class="flex flex-col gap-2">
						<Label for="meeting-title">Title</Label>
						<Input id="meeting-title" bind:value={title} placeholder="e.g. Sprint review" />
					</div>
					<div class="flex flex-col gap-5 @xl:flex-row">
						<Calendar
							bind:value={date}
							mode="single"
							isDateDisabled={(d: DateValue) => d.compare(todayValue) < 0}
							onValueChange={() => (time = [])}
						/>
						<div class="flex min-w-0 flex-1 flex-col gap-3">
							<p class="font-medium text-sm">{dayFormatter.format(date.toDate(getLocalTimeZone()))}</p>
							<ToggleGroup bind:value={time} class="grid grid-cols-3 gap-1.5 @xl:grid-cols-2">
								{#each slots as slot (slot)}
									<ToggleGroupItem value={slot} size="sm" variant="outline" disabled={busy.has(slot)}>
										{slot}
									</ToggleGroupItem>
								{/each}
							</ToggleGroup>
							<div class="flex flex-col gap-2">
								<Label>Duration</Label>
								<ToggleGroup bind:value={duration} class="w-fit">
									{#each ['15', '30', '45', '60'] as minutes (minutes)}
										<ToggleGroupItem value={minutes} size="sm" variant="outline">{minutes}m</ToggleGroupItem>
									{/each}
								</ToggleGroup>
							</div>
						</div>
					</div>
				</CardPanel>
				<CardFooter class="flex justify-between gap-2">
					<Button variant="outline"><Users />Invite people</Button>
					<Button disabled={!title || time.length === 0}>Schedule</Button>
				</CardFooter>
			</Card>

			<section class="flex flex-col gap-3">
				<h2 class="font-semibold text-sm">Upcoming</h2>
				{#each upcoming as meeting (meeting.title)}
					<div class="flex items-center gap-3 rounded-xl border bg-card p-3">
						<div class="flex min-w-0 flex-1 flex-col">
							<span class="truncate font-medium text-sm">{meeting.title}</span>
							<span class="text-muted-foreground text-xs">{meeting.when}</span>
						</div>
						<AvatarGroup>
							{#each meeting.people as p (p)}
								<Avatar class="ring-2 ring-card"><AvatarFallback>{p}</AvatarFallback></Avatar>
							{/each}
						</AvatarGroup>
						{#if meeting.live}
							<Badge variant="error">Live</Badge>
							<Button size="sm">Join</Button>
						{:else}
							<Button size="sm" variant="outline">Details</Button>
						{/if}
					</div>
				{/each}
			</section>
		</div>
	</div>
</main>
