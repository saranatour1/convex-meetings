import { api, type Id } from "@meetings/backend";
import { reasonLabel } from "#/features/rooms/moderation-labels.ts";
import { slowModeText } from "#/features/rooms/slow-mode.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { formatDate, formatTime } from "#/lib/schedule.ts";
import { useGuestPass } from "./guest-pass.ts";
import { useConvexValue } from "#/features/data/live-query.ts";

const REMOVALS = {
  message: "A message of yours was removed for",
  name: "Your name was replaced because it read as",
  frame: "Your video was flagged for",
  summary: "A summary was hidden for",
};

export const ChatStatus = ({ meetingId }: { meetingId: Id<"meetings"> }) => {
  const pass = useGuestPass();
  const status = useConvexValue(api.moderation.myStatus, { meetingId, ...pass });
  if (!status || (!status.moderated && status.slowModeSeconds === 0)) return null;
  const zone = browserTimeZone();
  const { ban, lastRemoval } = status;

  return (
    <div className="flex flex-col gap-0.5 text-muted-foreground text-xs" aria-live="polite">
      {ban ? (
        <p className="text-destructive-foreground">
          You're banned from this organization's public rooms for {reasonLabel(ban.reason)}
          {ban.expiresAt === null
            ? "."
            : `, until ${formatDate(ban.expiresAt, zone)} at ${formatTime(ban.expiresAt, zone)}.`}
        </p>
      ) : (
        lastRemoval && (
          <p className="text-destructive-foreground">
            {lastRemoval.reason === "unchecked"
              ? "Your last message couldn't be checked, so it wasn't sent. Try again in a moment."
              : `${REMOVALS[lastRemoval.kind]} ${reasonLabel(lastRemoval.reason)}.`}
            {status.strikes > 0 && ` Strike ${status.strikes} of ${status.strikeLimit} today.`}
          </p>
        )
      )}
      <p>
        {status.moderated && "Messages are checked automatically before others see them. "}
        {status.slowModeSeconds > 0 &&
          `Slow mode: one message ${slowModeText(status.slowModeSeconds)}.`}
      </p>
    </div>
  );
};
