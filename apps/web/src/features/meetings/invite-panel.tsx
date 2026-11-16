import { useState } from "react";
import { ArrowUpIcon, MessagesSquareIcon, XIcon } from "lucide-react";
import { Button } from "@meetings/ui/components/button";
import {
  Composer,
  ComposerActionGroup,
  ComposerActions,
  ComposerInput,
  ComposerSubmit,
  type ComposerValue,
  getComposerText,
} from "@meetings/ui/components/composer";
import { Sidebar, SidebarFooter, SidebarHeader } from "@meetings/ui/components/sidebar";
import { EmptyState } from "#/components/empty-state.tsx";

type ChatMessage = { id: string; text: string };

type InvitePanelProps = { meetingTitle: string; onClose: () => void };

export const InvitePanel = ({ meetingTitle, onClose }: InvitePanelProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<ComposerValue>([]);

  const send = (value: ComposerValue) => {
    const text = getComposerText(value).trim();
    if (!text) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), text }]);
    setDraft([]);
  };

  return (
    <Sidebar
      side="right"
      collapsible="none"
      className="fixed inset-y-0 end-0 z-20 h-svh w-full max-w-88 shrink-0 border-s shadow-lg lg:sticky lg:top-0 lg:shadow-none"
    >
      <SidebarHeader className="flex-row items-center gap-2 border-b">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium text-sm">Invite people</span>
          <span className="truncate text-muted-foreground text-xs">
            {meetingTitle || "Untitled meeting"}
          </span>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close invite panel" onClick={onClose}>
          <XIcon />
        </Button>
      </SidebarHeader>

      <div
        aria-label="Invite chat"
        className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto p-3"
      >
        <div className="flex flex-col gap-3">
          {messages.length === 0 && (
            <EmptyState
              compact
              icon={<MessagesSquareIcon />}
              title="No messages yet"
              description="Invite people to this meeting, then chat with them here before it starts."
            />
          )}
          {messages.map((message) => (
            <p
              key={message.id}
              className="ms-auto max-w-[80%] rounded-2xl bg-primary px-3 py-2 text-primary-foreground text-sm"
            >
              {message.text}
            </p>
          ))}
        </div>
      </div>

      <SidebarFooter className="border-t">
        <Composer layout="adaptive" value={draft} onValueChange={setDraft} onSubmit={send}>
          <ComposerInput
            render={<textarea aria-label="Message" placeholder="Message invitees" />}
          />
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
  );
};
