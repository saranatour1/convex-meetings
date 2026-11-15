import { useEffect, useRef, useState } from 'react'
import { ArrowUpIcon, MessagesSquareIcon, XIcon } from 'lucide-react'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import {
  Composer,
  ComposerActionGroup,
  ComposerActions,
  ComposerInput,
  ComposerSubmit,
  type ComposerValue,
  getComposerText,
} from '#/components/ui/composer'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#/components/ui/empty'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '#/components/ui/sidebar'
import { cn } from '#/lib/utils'

/** Chat with the people invited to a meeting. Only shown during the invite flow. */
export function SidebarRight({ meeting, onClose }: { meeting: string; onClose: () => void }) {
  // ponytail: local-only messages, back with a Convex `messages` table when chat goes live.
  const [messages, setMessages] = useState<
    { id: number; author: string; initials: string; text: string; mine: boolean }[]
  >([])
  const [draft, setDraft] = useState<ComposerValue>([])
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  return (
    // Overlays the page below lg, sits beside it from lg up.
    <Sidebar
      side="right"
      collapsible="none"
      className="fixed inset-y-0 end-0 z-20 h-svh w-full max-w-88 shrink-0 border-s shadow-lg lg:sticky lg:top-0 lg:shadow-none"
    >
      <SidebarHeader className="flex-row items-center gap-2 border-b">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium text-sm">Invite people</span>
          <span className="truncate text-muted-foreground text-xs">{meeting || 'Untitled meeting'}</span>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close invite panel" onClick={onClose}>
          <XIcon />
        </Button>
      </SidebarHeader>

      <SidebarContent className="gap-3 p-3" aria-label="Invite chat">
        {messages.length === 0 && (
          <Empty className="gap-3">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="mb-3">
                <MessagesSquareIcon />
              </EmptyMedia>
              <EmptyTitle className="text-sm">No messages yet</EmptyTitle>
              <EmptyDescription className="text-xs">
                Invite people to this meeting, then chat with them here before it starts.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn('flex items-end gap-2', m.mine && 'flex-row-reverse')}>
            {!m.mine && (
              <Avatar className="size-7">
                <AvatarFallback>{m.initials}</AvatarFallback>
              </Avatar>
            )}
            <div className={cn('flex max-w-[80%] flex-col gap-1', m.mine && 'items-end')}>
              {!m.mine && <span className="text-muted-foreground text-xs">{m.author}</span>}
              <p
                className={cn(
                  'rounded-2xl px-3 py-2 text-sm',
                  m.mine ? 'bg-primary text-primary-foreground' : 'bg-background shadow-xs',
                )}
              >
                {m.text}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </SidebarContent>

      <SidebarFooter className="border-t">
        <Composer
          layout="adaptive"
          value={draft}
          onValueChange={setDraft}
          onSubmit={(value) => {
            const text = getComposerText(value).trim()
            if (!text) return
            setMessages((ms) => [...ms, { id: Date.now(), author: 'You', initials: 'ME', text, mine: true }])
            setDraft([])
          }}
        >
          <ComposerInput render={<textarea aria-label="Message" placeholder="Message invitees" />} />
          <ComposerActions>
            <ComposerActionGroup align="end">
              <ComposerSubmit
                render={
                  <Button aria-label="Send message" size="icon">
                    <ArrowUpIcon aria-hidden="true" />
                  </Button>
                }
              />
            </ComposerActionGroup>
          </ComposerActions>
        </Composer>
      </SidebarFooter>
    </Sidebar>
  )
}
