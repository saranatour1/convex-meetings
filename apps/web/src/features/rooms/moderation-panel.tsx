import { useMutation, usePaginatedQuery } from "convex/react";
import { ShieldCheckIcon } from "lucide-react";
import { api } from "@meetings/backend";
import { Badge } from "@meetings/ui/components/badge";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import { EmptyState } from "#/components/empty-state.tsx";
import { useActiveOrg } from "#/features/orgs/active-org.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { showError } from "#/lib/errors.ts";
import { formatDate, formatTime } from "#/lib/schedule.ts";
import { actionLabel, reasonLabel } from "./moderation-labels.ts";

const KINDS = { message: "Message", name: "Name", frame: "Video frame", summary: "Summary" };

const when = (ms: number, zone: string) => `${formatDate(ms, zone)} · ${formatTime(ms, zone)}`;

export const ModerationPanel = () => {
  const { orgId } = useActiveOrg();
  const flags = usePaginatedQuery(api.moderation.flags, { orgId }, { initialNumItems: 25 });
  const bans = usePaginatedQuery(api.moderation.bans, { orgId }, { initialNumItems: 25 });
  const resolve = useMutation(api.moderation.resolveFlag);
  const ban = useMutation(api.moderation.ban);
  const lift = useMutation(api.moderation.liftBan);
  const zone = browserTimeZone();
  const now = Date.now();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Flags</CardTitle>
          <CardDescription>
            What the automatic checks removed or want a person to look at, newest first. Kept video
            frames are deleted after 7 days.
          </CardDescription>
        </CardHeader>
        <CardPanel>
          {flags.status !== "LoadingFirstPage" && flags.results.length === 0 ? (
            <EmptyState
              compact
              icon={<ShieldCheckIcon />}
              title="Nothing flagged"
              description="Removed messages and flagged frames from your public rooms show up here."
            />
          ) : (
            <ul className="flex flex-col divide-y">
              {flags.results.map((flag) => {
                const score = flag.scores[flag.reason];
                return (
                  <li key={flag._id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{flag.userName}</span>
                      {flag.isGuest && (
                        <Badge variant="outline" size="sm">
                          Guest
                        </Badge>
                      )}
                      <Badge variant={flag.action === "ban" ? "error" : "warning"} size="sm">
                        {actionLabel(flag.action)}
                      </Badge>
                      {flag.resolved && (
                        <Badge variant="outline" size="sm">
                          Settled
                        </Badge>
                      )}
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {flag.roomTitle ?? "A deleted room"} · {when(flag._creationTime, zone)}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {KINDS[flag.kind]} flagged for {reasonLabel(flag.reason)}
                      {score !== undefined && ` (${Math.round(score * 100)}% sure)`}
                      {flag.reporterName &&
                        `, reported by ${flag.reporterName}${flag.reporterIsGuest ? " (guest)" : ""}`}
                    </p>
                    {flag.body && (
                      <blockquote className="border-s-2 ps-3 text-sm">{flag.body}</blockquote>
                    )}
                    {flag.kind === "frame" &&
                      (flag.imageUrl ? (
                        <a
                          href={flag.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="self-start text-sm underline underline-offset-4"
                        >
                          Open the kept frame
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          The frame has been deleted.
                        </span>
                      ))}
                    {!flag.resolved && (
                      <div className="flex gap-2">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => void resolve({ orgId, flagId: flag._id }).catch(showError)}
                        >
                          Dismiss
                        </Button>
                        {flag.action !== "ban" && flag.reason !== "unchecked" && (
                          <Button
                            size="xs"
                            variant="destructive-outline"
                            onClick={() => void ban({ orgId, flagId: flag._id }).catch(showError)}
                          >
                            Ban until lifted
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {flags.status === "CanLoadMore" && (
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => flags.loadMore(25)}>
              Earlier flags
            </Button>
          )}
        </CardPanel>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bans</CardTitle>
          <CardDescription>
            A ban covers every public room of this organization. Automatic bans last a day, then 30
            days for a repeat.
          </CardDescription>
        </CardHeader>
        <CardPanel>
          {bans.status !== "LoadingFirstPage" && bans.results.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nobody is banned.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {bans.results.map((entry) => {
                const ended = entry.expiresAt !== null && entry.expiresAt <= now;
                return (
                  <li
                    key={entry._id}
                    className="flex flex-wrap items-center gap-2 py-3 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="font-medium">{entry.userName}</span>
                    {entry.isGuest && (
                      <Badge variant="outline" size="sm">
                        Guest
                      </Badge>
                    )}
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {entry.automatic ? "Automatic" : "By a manager"}, for{" "}
                      {reasonLabel(entry.reason)} · {when(entry._creationTime, zone)} ·{" "}
                      {entry.expiresAt === null
                        ? "until lifted"
                        : `ends ${when(entry.expiresAt, zone)}`}
                    </span>
                    {entry.liftedAt !== null ? (
                      <Badge variant="outline" size="sm" className="ms-auto">
                        Lifted
                      </Badge>
                    ) : ended ? (
                      <Badge variant="outline" size="sm" className="ms-auto">
                        Ended
                      </Badge>
                    ) : (
                      <Button
                        size="xs"
                        variant="outline"
                        className="ms-auto"
                        onClick={() => void lift({ orgId, banId: entry._id }).catch(showError)}
                      >
                        Lift ban
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {bans.status === "CanLoadMore" && (
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => bans.loadMore(25)}>
              Earlier bans
            </Button>
          )}
        </CardPanel>
      </Card>
    </>
  );
};
