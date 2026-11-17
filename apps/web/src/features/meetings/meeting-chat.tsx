import { track } from "@databuddy/sdk";
import { Fragment, useRef } from "react";
import type { FunctionReturnType } from "convex/server";
import { useMutation, usePaginatedQuery } from "convex/react";
import { ArrowUpIcon, MessagesSquareIcon } from "lucide-react";
import { api, type Id } from "@meetings/backend";
import { ChatConversation } from "@meetings/ui/chat/chat-conversation";
import { ChatDatePill } from "@meetings/ui/chat/chat-date-pill";
import { ChatMessage } from "@meetings/ui/chat/chat-message";
import { ChatMessageActionToolbar } from "@meetings/ui/chat/chat-message-actions";
import { ChatReactionChip } from "@meetings/ui/chat/chat-reaction-chip";
import { ChatReactionPicker } from "@meetings/ui/chat/chat-reaction-picker";
import { ChatEmptyState, ChatLoadingState } from "@meetings/ui/chat/chat-states";
import { ChatUnreadDivider } from "@meetings/ui/chat/chat-unread-divider";
import { useChatScroll } from "@meetings/ui/chat/hooks/use-chat-scroll";
import { Avatar, AvatarFallback, AvatarImage } from "@meetings/ui/components/avatar";
import { Button } from "@meetings/ui/components/button";
import {
  Composer,
  ComposerActions,
  ComposerInput,
  ComposerSubmit,
} from "@meetings/ui/components/composer";
import { getComposerText } from "@meetings/ui/lib/composer-editor";
import { cn } from "@meetings/ui/lib/utils";
import { browserTimeZone } from "#/lib/browser.ts";
import { showError } from "#/lib/errors.ts";
import { getInitials } from "#/lib/initials.ts";
import { dayOf, formatLongDate, formatTime } from "#/lib/schedule.ts";
import { ChatStatus } from "./chat-status.tsx";
import { useGuestPass } from "./guest-pass.ts";

export type ChatLine = FunctionReturnType<typeof api.messages.list>["page"][number];

const GROUP_MS = 5 * 60_000;

const sameGroup = (a: ChatLine | undefined, b: ChatLine | undefined, zone: string) =>
  a !== undefined &&
  b !== undefined &&
  a.authorId === b.authorId &&
  Math.abs(b._creationTime - a._creationTime) < GROUP_MS &&
  dayOf(a._creationTime, zone) === dayOf(b._creationTime, zone);

const REACTIONS = [
  { emoji: "👍", label: "Thumbs up" },
  { emoji: "❤️", label: "Love" },
  { emoji: "😂", label: "Funny" },
  { emoji: "🎉", label: "Celebrate" },
  { emoji: "😮", label: "Surprised" },
  { emoji: "👀", label: "Looking" },
] as const;

type ReactionEmoji = (typeof REACTIONS)[number]["emoji"];

const reactionLabel = (emoji: string) =>
  REACTIONS.find((reaction) => reaction.emoji === emoji)?.label ?? emoji;

const useReact = () => {
  const react = useMutation(api.messages.react);
  const pass = useGuestPass();
  return (messageId: ChatLine["_id"], emoji: string) =>
    void react({ messageId, emoji: emoji as ReactionEmoji, ...pass }).catch(showError);
};

const Reactions = ({ message }: { message: ChatLine }) => {
  const react = useReact();
  return message.reactions.map((reaction) => {
    const others = reaction.count - reaction.names.length;
    return (
      <ChatReactionChip
        key={reaction.emoji}
        emoji={reaction.emoji}
        count={reaction.count}
        selected={reaction.mine}
        label={`${reactionLabel(reaction.emoji)}, ${reaction.count}. ${reaction.mine ? "Remove your reaction" : "Add your reaction"}`}
        onClick={() => react(message._id, reaction.emoji)}
        reactorLabel={`Reacted with ${reactionLabel(reaction.emoji)}`}
        reactorContent={
          <span className="text-xs">
            {reaction.names.join(", ")}
            {others > 0 && ` and ${others} more`}
          </span>
        }
      />
    );
  });
};

const ReactionActions = ({ message }: { message: ChatLine }) => {
  const react = useReact();
  return (
    <ChatMessageActionToolbar
      side={message.mine ? "outgoing" : "incoming"}
      toolbarLabel="Message actions"
      reactionPicker={(toolbar) => (
        <ChatReactionPicker
          inToolbar
          options={REACTIONS}
          selectedEmojis={message.reactions.filter((r) => r.mine).map((r) => r.emoji)}
          triggerLabel="Add a reaction"
          triggerTooltip="React"
          popupLabel="Reactions"
          popupAnchor={toolbar}
          onSelect={(emoji) => react(message._id, emoji)}
        />
      )}
    />
  );
};

type ChatLinesProps = { messages: ChatLine[]; since?: number };

export const ChatLines = ({ messages, since }: ChatLinesProps) => {
  const zone = browserTimeZone();
  return (
    <div className="flex flex-col gap-1">
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const next = messages[index + 1];
        const newDay =
          !previous || dayOf(previous._creationTime, zone) !== dayOf(message._creationTime, zone);
        const startsCall = (before: ChatLine | undefined, after: ChatLine | undefined) =>
          since !== undefined &&
          before !== undefined &&
          after !== undefined &&
          before._creationTime < since &&
          after._creationTime >= since;
        const callStart = startsCall(previous, message);
        const grouped = !callStart && sameGroup(previous, message, zone);
        const lastInGroup = startsCall(message, next) || !sameGroup(message, next, zone);
        return (
          <Fragment key={message._id}>
            {newDay && (
              <ChatDatePill className="my-2">
                {formatLongDate(message._creationTime, zone)}
              </ChatDatePill>
            )}
            {callStart && <ChatUnreadDivider>This call</ChatUnreadDivider>}
            <ChatMessage
              className={cn(!grouped && "mt-2", message.pending && "opacity-60")}
              side={message.mine ? "outgoing" : "incoming"}
              author={message.authorName}
              grouped={grouped}
              avatar={
                <Avatar className="size-7">
                  {message.authorImageUrl && <AvatarImage src={message.authorImageUrl} alt="" />}
                  <AvatarFallback className="text-[.625rem]">
                    {getInitials(message.authorName)}
                  </AvatarFallback>
                </Avatar>
              }
              footer={lastInGroup ? formatTime(message._creationTime, zone) : undefined}
              actions={<ReactionActions message={message} />}
              reactions={message.reactions.length ? <Reactions message={message} /> : undefined}
            >
              {message.body}
            </ChatMessage>
          </Fragment>
        );
      })}
    </div>
  );
};

type MeetingChatProps = {
  meetingId: Id<"meetings">;
  since?: number;
  className?: string;
};

export const MeetingChat = ({ meetingId, since, className }: MeetingChatProps) => {
  const pass = useGuestPass();
  const messages = usePaginatedQuery(
    api.messages.list,
    { meetingId, ...pass },
    { initialNumItems: 50 },
  );
  const send = useMutation(api.messages.send);
  const composer = useRef<HTMLFormElement>(null);
  const ordered = [...messages.results].reverse();
  const scroll = useChatScroll({ itemCount: ordered.length });

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <ChatConversation
        scroll={scroll}
        label="Meeting chat"
        jumpLabel="New messages"
        contentClassName="px-1 pt-1"
      >
        {messages.status === "CanLoadMore" && (
          <div className="flex justify-center pb-2">
            <Button size="xs" variant="ghost" onClick={() => messages.loadMore(50)}>
              <ArrowUpIcon />
              Earlier messages
            </Button>
          </div>
        )}
        {messages.status === "LoadingFirstPage" ? (
          <ChatLoadingState label="Loading messages" />
        ) : ordered.length === 0 ? (
          <ChatEmptyState
            icon={<MessagesSquareIcon />}
            title="No messages yet"
            description="Messages stay with this meeting, so people can read them after the call."
          />
        ) : (
          <ChatLines messages={ordered} since={since} />
        )}
      </ChatConversation>
      <Composer
        ref={composer}
        submitOnEnter="desktop"
        onSubmit={(value) => {
          const body = getComposerText(value).trim();
          if (!body) return;
          void send({ meetingId, body, ...pass })
            .then(() => {
              track("chat_message_sent", { guest: Boolean(pass.guest) });
              composer.current?.reset();
            })
            .catch(showError);
        }}
      >
        <ComposerInput aria-label="Message" placeholder="Message everyone in this meeting" />
        <ComposerActions>
          <ComposerSubmit
            aria-label="Send"
            render={<Button size="icon-sm" className="ms-auto rounded-full" />}
          >
            <ArrowUpIcon />
          </ComposerSubmit>
        </ComposerActions>
      </Composer>
      <ChatStatus meetingId={meetingId} />
    </div>
  );
};
