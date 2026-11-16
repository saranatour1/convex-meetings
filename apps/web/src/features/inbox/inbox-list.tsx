import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { useMutation, usePaginatedQuery } from "convex/react";
import {
  CalendarCheckIcon,
  CalendarXIcon,
  CheckCheckIcon,
  FileTextIcon,
  InboxIcon,
  MailIcon,
} from "lucide-react";
import { api } from "@meetings/backend";
import { Avatar, AvatarFallback, AvatarImage } from "@meetings/ui/components/avatar";
import { Button } from "@meetings/ui/components/button";
import { toastManager } from "@meetings/ui/components/toast";
import { cn } from "@meetings/ui/lib/utils";
import { EmptyState } from "#/components/empty-state.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { describeError } from "#/lib/errors.ts";
import { getInitials } from "#/lib/initials.ts";
import { formatDate, formatTime } from "#/lib/schedule.ts";

type Notification = FunctionReturnType<typeof api.inbox.list>["page"][number];

const ICONS = {
  meetingInvite: MailIcon,
  meetingCancelled: CalendarXIcon,
  rsvp: CalendarCheckIcon,
  recapReady: FileTextIcon,
};

const sentence = (n: Notification) => {
  const actor = n.actorName ?? "Someone";
  switch (n.kind) {
    case "meetingInvite":
      return `${actor} invited you to ${n.title}`;
    case "meetingCancelled":
      return `${actor} cancelled ${n.title}`;
    case "rsvp":
      return `${actor} ${n.detail ?? "replied to"} ${n.title}`;
    case "recapReady":
      return `The recap for ${n.title} is ready`;
  }
};

const Row = ({ notification }: { notification: Notification }) => {
  const read = useMutation(api.inbox.read);
  const respond = useMutation(api.meetings.respondByCode);
  const Icon = ICONS[notification.kind];
  const zone = browserTimeZone();
  const markRead = () => {
    if (!notification.readAt) void read({ notificationId: notification._id });
  };
  const reply = (response: "accepted" | "declined") => {
    markRead();
    if (!notification.meetingCode) return;
    void respond({ code: notification.meetingCode, response }).catch((error: unknown) =>
      toastManager.add({ title: describeError(error), type: "error" }),
    );
  };
  const body = (
    <>
      <span className="relative shrink-0">
        {notification.actorName ? (
          <Avatar className="size-9">
            {notification.actorImageUrl && <AvatarImage src={notification.actorImageUrl} alt="" />}
            <AvatarFallback>{getInitials(notification.actorName)}</AvatarFallback>
          </Avatar>
        ) : (
          <span className="grid size-9 place-items-center rounded-full bg-muted">
            <Icon className="size-4" />
          </span>
        )}
        {!notification.readAt && (
          <span className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full border-2 border-background bg-primary" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-sm", !notification.readAt && "font-medium")}>
          {sentence(notification)}
        </span>
        <span className="text-muted-foreground text-xs">
          {formatDate(notification._creationTime, zone)} ·{" "}
          {formatTime(notification._creationTime, zone)}
        </span>
      </span>
    </>
  );
  const link =
    notification.kind === "recapReady" && notification.meetingCode && notification.sessionId ? (
      <Link
        to="/meetings/$code/recaps/$sessionId"
        params={{ code: notification.meetingCode, sessionId: notification.sessionId }}
        onClick={markRead}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        {body}
      </Link>
    ) : notification.meetingCode ? (
      <Link
        to="/meetings/$code"
        params={{ code: notification.meetingCode }}
        onClick={markRead}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        {body}
      </Link>
    ) : (
      <button
        type="button"
        onClick={markRead}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        {body}
      </button>
    );

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-accent/40">
      {link}
      {notification.kind === "meetingInvite" && notification.meetingCode && (
        <span className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => reply("accepted")}>
            Going
          </Button>
          <Button size="sm" variant="ghost" onClick={() => reply("declined")}>
            Not going
          </Button>
        </span>
      )}
    </li>
  );
};

export const InboxList = () => {
  const notifications = usePaginatedQuery(api.inbox.list, {}, { initialNumItems: 50 });
  const readAll = useMutation(api.inbox.readAll);
  const hasUnread = notifications.results.some((n) => !n.readAt);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-semibold text-xl">Inbox</h1>
        {hasUnread && (
          <Button size="sm" variant="ghost" onClick={() => void readAll({})}>
            <CheckCheckIcon />
            Mark all read
          </Button>
        )}
      </div>
      {notifications.status !== "LoadingFirstPage" && notifications.results.length === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed py-10"
          icon={<InboxIcon />}
          title="You're all caught up"
          description="Invites, replies, cancellations and recaps show up here."
        />
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border">
          {notifications.results.map((notification) => (
            <Row key={notification._id} notification={notification} />
          ))}
        </ul>
      )}
      {notifications.status === "CanLoadMore" && (
        <Button variant="ghost" size="sm" onClick={() => notifications.loadMore(50)}>
          Show older
        </Button>
      )}
    </div>
  );
};
