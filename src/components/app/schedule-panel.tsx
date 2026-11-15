import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarClockIcon, CalendarPlusIcon, UsersIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarGroup } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from '#/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#/components/ui/empty'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Toggle } from '#/components/ui/toggle'
import { ToggleGroup } from '#/components/ui/toggle-group'

// ponytail: fixed slots and no meetings table yet, swap for Convex queries when scheduling is real.
const slots = ['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '15:30', '16:00']
const upcoming: { title: string; when: string; people: string[]; live: boolean }[] = []

export function SchedulePanel({
  scheduling,
  onScheduling,
  onInvite,
}: {
  scheduling: boolean
  onScheduling: (open: boolean) => void
  onInvite: (meetingTitle: string) => void
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6">
      {scheduling && <ScheduleCard onCancel={() => onScheduling(false)} onInvite={onInvite} />}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-sm">Upcoming</h2>
        {upcoming.length === 0 && (
          <Empty className="rounded-xl border border-dashed py-10 md:py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarPlusIcon />
              </EmptyMedia>
              <EmptyTitle className="text-base">No upcoming meetings</EmptyTitle>
              <EmptyDescription>Meetings you schedule or get invited to will show up here.</EmptyDescription>
            </EmptyHeader>
            {!scheduling && (
              <EmptyContent>
                <Button size="sm" variant="outline" onClick={() => onScheduling(true)}>
                  Schedule a meeting
                </Button>
              </EmptyContent>
            )}
          </Empty>
        )}
        {upcoming.map((m) => (
          <div key={m.title} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium text-sm">{m.title}</span>
              <span className="text-muted-foreground text-xs">{m.when}</span>
            </div>
            <AvatarGroup>
              {m.people.map((p) => (
                <Avatar key={p} className="ring-2 ring-card">
                  <AvatarFallback>{p}</AvatarFallback>
                </Avatar>
              ))}
            </AvatarGroup>
            {m.live ? (
              <>
                <Badge variant="error">Live</Badge>
                <Button size="sm">Join</Button>
              </>
            ) : (
              <Button size="sm" variant="outline">
                Details
              </Button>
            )}
          </div>
        ))}
      </section>
    </main>
  )
}

/** The scheduling form; mounted only while scheduling, so each open starts blank. */
function ScheduleCard({ onCancel, onInvite }: { onCancel: () => void; onInvite: (meetingTitle: string) => void }) {
  const today = new Date()
  const [date, setDate] = useState<Date>(today)
  const [time, setTime] = useState<string | null>(null)
  const [duration, setDuration] = useState('30')
  const [title, setTitle] = useState('')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClockIcon className="size-4" />
          Schedule a meeting
        </CardTitle>
        <CardDescription>Pick a day and a time, then invite people.</CardDescription>
      </CardHeader>
      <CardPanel className="@container flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="meeting-title">Title</Label>
          <Input
            id="meeting-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sprint review"
          />
        </div>
        <div className="flex flex-col gap-5 @xl:flex-row">
          <Calendar
            mode="single"
            selected={date}
            disabled={[{ before: today }]}
            onSelect={(d) => {
              if (d) {
                setDate(d)
                setTime(null)
              }
            }}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <p className="font-medium text-sm">{format(date, 'EEEE, MMM d')}</p>
            <ToggleGroup
              className="grid w-full grid-cols-3 gap-1.5 @xl:grid-cols-2"
              value={time ? [time] : []}
              onValueChange={(v) => setTime(v[0] ?? null)}
            >
              {slots.map((slot) => (
                <Toggle key={slot} value={slot} size="sm" variant="outline">
                  {slot}
                </Toggle>
              ))}
            </ToggleGroup>
            <div className="flex flex-col gap-2">
              <Label>Duration</Label>
              <ToggleGroup value={[duration]} onValueChange={(v) => v[0] && setDuration(v[0])}>
                {['15', '30', '45', '60'].map((m) => (
                  <Toggle key={m} value={m} size="sm" variant="outline">
                    {m}m
                  </Toggle>
                ))}
              </ToggleGroup>
            </div>
          </div>
        </div>
      </CardPanel>
      <CardFooter className="flex flex-wrap justify-between gap-2">
        <Button variant="outline" onClick={() => onInvite(title)}>
          <UsersIcon />
          Invite people
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!title || !time}>Schedule</Button>
        </div>
      </CardFooter>
    </Card>
  )
}
