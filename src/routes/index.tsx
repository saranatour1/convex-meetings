import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { LinkIcon, PlusIcon, VideoIcon } from 'lucide-react'
import { SchedulePanel } from '#/components/app/schedule-panel'
import { SidebarLeft } from '#/components/app/sidebar-left'
import { SidebarRight } from '#/components/app/sidebar-right'
import { SignIn } from '#/components/app/sign-in'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Separator } from '#/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '#/components/ui/sidebar'

// Auth tokens live in localStorage (Convex Auth SPA mode), so render on the client only.
export const Route = createFileRoute('/')({ ssr: false, component: Home })

function Home() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  // The meeting being invited to; the right sidebar only exists while this is set.
  const [inviteFor, setInviteFor] = useState<string | null>(null)
  const [scheduling, setScheduling] = useState(false)
  const setSchedulingAndInvite = (open: boolean) => {
    setScheduling(open)
    if (!open) setInviteFor(null) // invites belong to the meeting being scheduled
  }

  if (isLoading) {
    return <div className="grid h-dvh place-items-center text-muted-foreground text-sm">Loading…</div>
  }
  if (!isAuthenticated) return <SignIn />

  return (
    <SidebarProvider>
      <SidebarLeft />
      <SidebarInset>
        {/* Placeholder meeting controls; wire to real meetings later. */}
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="me-1 h-4" />
          <Button size="sm">
            <VideoIcon />
            Start meeting
          </Button>
          <Button size="sm" variant="outline" onClick={() => setScheduling(true)}>
            <PlusIcon />
            Schedule
          </Button>
          <div className="ms-auto hidden items-center gap-2 sm:flex">
            <Input className="w-44" placeholder="Code or link" aria-label="Meeting code" />
            <Button size="sm" variant="ghost">
              <LinkIcon />
              Join
            </Button>
          </div>
        </header>
        <SchedulePanel scheduling={scheduling} onScheduling={setSchedulingAndInvite} onInvite={setInviteFor} />
      </SidebarInset>
      {inviteFor !== null && <SidebarRight meeting={inviteFor} onClose={() => setInviteFor(null)} />}
    </SidebarProvider>
  )
}
