import { Suspense, use } from "react";
import { Link } from "@tanstack/react-router";
import { usePaginatedQuery, useQuery } from "convex/react";
import {
  ArrowLeftIcon,
  DownloadIcon,
  FileTextIcon,
  PencilIcon,
  SearchIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { api, type Id } from "@meetings/backend";
import { Badge } from "@meetings/ui/components/badge";
import { Button } from "@meetings/ui/components/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@meetings/ui/components/card";
import { Input } from "@meetings/ui/components/input";
import { EmptyState } from "#/components/empty-state.tsx";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { browserTimeZone } from "#/lib/browser.ts";
import { formatDate, formatDuration, formatTime } from "#/lib/schedule.ts";
import { ChatLines } from "./meeting-chat.tsx";
import { kindOf } from "./meeting-kinds.ts";

type TranscriptLine = {
  startTime: number;
  sentence: string;
  peerData?: { displayName?: string };
};

const transcripts = new Map<string, Promise<TranscriptLine[]>>();

const loadTranscript = (url: string) => {
  const cached = transcripts.get(url);
  if (cached) return cached;
  const promise = fetch(url)
    .then((response) => response.json() as Promise<TranscriptLine[]>)
    .catch(() => [] as TranscriptLine[]);
  transcripts.set(url, promise);
  return promise;
};

const clock = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const Transcript = ({ url, search }: { url: string; search: string }) => {
  const lines = use(loadTranscript(url));
  const query = search.trim().toLowerCase();
  const shown = lines.filter(
    (line) =>
      !query ||
      line.sentence.toLowerCase().includes(query) ||
      (line.peerData?.displayName ?? "").toLowerCase().includes(query),
  );
  if (!lines.length)
    return <p className="text-muted-foreground text-sm">The transcript is empty.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {shown.map((line, index) => (
        <li
          key={`${line.startTime}-${index}`}
          className="grid grid-cols-[3.5rem_1fr] gap-3 text-sm"
        >
          <span className="text-muted-foreground text-xs tabular-nums">
            {clock(line.startTime)}
          </span>
          <span>
            <span className="font-medium">{line.peerData?.displayName ?? "Someone"}</span>{" "}
            {line.sentence}
          </span>
        </li>
      ))}
      {shown.length === 0 && (
        <li className="text-muted-foreground text-sm">Nothing matches “{search}”.</li>
      )}
    </ol>
  );
};

const RecapChat = ({ sessionId }: { sessionId: Id<"meetingSessions"> }) => {
  const messages = usePaginatedQuery(
    api.meetings.recapChat,
    { sessionId },
    { initialNumItems: 100 },
  );
  if (messages.status === "LoadingFirstPage") return null;
  if (!messages.results.length) {
    return (
      <p className="text-muted-foreground text-sm">No one wrote in the chat during this call.</p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ChatLines messages={messages.results} />
      {messages.status === "CanLoadMore" && (
        <Button
          size="sm"
          variant="ghost"
          className="self-center"
          onClick={() => messages.loadMore(100)}
        >
          Show more
        </Button>
      )}
    </div>
  );
};

const Snapshots = ({ sessionId }: { sessionId: Id<"meetingSessions"> }) => {
  const snapshots = useQuery(api.annotations.snapshots, { sessionId });
  if (!snapshots?.length) return null;
  const zone = browserTimeZone();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PencilIcon className="size-4" />
          Annotations
        </CardTitle>
        <CardDescription>Screen shares with drawings saved during the call.</CardDescription>
      </CardHeader>
      <CardPanel className="grid gap-4 sm:grid-cols-2">
        {snapshots.map(
          (snapshot) =>
            snapshot.url && (
              <figure key={snapshot._id} className="flex flex-col gap-1.5">
                <a href={snapshot.url} target="_blank" rel="noreferrer">
                  <img
                    src={snapshot.url}
                    alt={`Annotation saved by ${snapshot.authorName}`}
                    className="w-full rounded-lg border"
                  />
                </a>
                <figcaption className="text-muted-foreground text-xs">
                  {snapshot.authorName} · {formatTime(snapshot._creationTime, zone)}
                </figcaption>
              </figure>
            ),
        )}
      </CardPanel>
    </Card>
  );
};

const Recording = ({
  sessionId,
  canDownload,
}: {
  sessionId: Id<"meetingSessions">;
  canDownload: boolean;
}) => {
  const url = useQuery(api.meetings.recordingUrl, { sessionId });
  if (url === undefined) return null;
  if (!url) {
    return (
      <p className="text-muted-foreground text-sm">
        The recording link has expired. New recordings are kept once R2 storage is set up.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <video
        controls
        preload="metadata"
        className="w-full rounded-lg bg-black"
        src={url}
        controlsList={canDownload ? undefined : "nodownload"}
        onContextMenu={canDownload ? undefined : (event) => event.preventDefault()}
      >
        <track kind="captions" />
      </video>
      {canDownload && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          render={<a href={url} download />}
        >
          <DownloadIcon />
          Download
        </Button>
      )}
    </div>
  );
};

type RecapPageProps = {
  code: string;
  number: number;
  search: string;
  onSearchChange: (search: string) => void;
};

export const RecapPage = ({ code, number, search, onSearchChange }: RecapPageProps) => {
  const recap = useQuery(api.meetings.recap, { code, number });
  if (recap === undefined) return <LoadingScreen />;
  if (recap === null) {
    return (
      <EmptyState
        icon={<FileTextIcon />}
        title="No recap here"
        description="This call doesn't exist, or you weren't invited to the meeting."
      />
    );
  }
  const { sessionId } = recap;
  const zone = browserTimeZone();
  const length = recap.endedAt ? recap.endedAt - recap.startedAt : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          render={<Link to="/meetings/$code" params={{ code }} />}
        >
          <ArrowLeftIcon />
          {recap.meeting.title}
        </Button>
        <h1 className="flex flex-wrap items-center gap-2 font-semibold text-xl">
          Recap
          <Badge variant="outline">{kindOf(recap.meeting.kind).label}</Badge>
        </h1>
        <p className="text-muted-foreground text-sm tabular-nums">
          {formatDate(recap.startedAt, zone)} · {formatTime(recap.startedAt, zone)}
          {recap.endedAt && `–${formatTime(recap.endedAt, zone)}`}
          {length !== null && ` · ${formatDuration(length)}`}
        </p>
        {recap.attendance.length ? (
          <ul className="flex flex-col gap-1 text-sm">
            {recap.attendance.map((person) => (
              <li key={person.memberId} className="flex items-center gap-1.5 tabular-nums">
                <UsersIcon className="size-4 opacity-70" />
                <span className="font-medium">{person.name}</span>
                <span className="text-muted-foreground">
                  joined {formatTime(person.joinedAt, zone)}
                  {person.leftAt === null
                    ? " · still in the call"
                    : ` · left ${formatTime(person.leftAt, zone)} · ${formatDuration(person.seconds * 1000) || "under a minute"}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-1.5 text-sm">
            <UsersIcon className="size-4 opacity-70" />
            {recap.attendees.length
              ? recap.attendees.join(", ")
              : "No one's attendance was recorded"}
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardPanel>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {recap.summary ??
              "No summary yet. It arrives a few minutes after a call where people spoke, if transcript and summary were on for this meeting."}
          </p>
        </CardPanel>
      </Card>

      {recap.hasRecording && (
        <Card>
          <CardHeader>
            <CardTitle>Recording</CardTitle>
            {recap.recordingSeconds && (
              <CardDescription>{formatDuration(recap.recordingSeconds * 1000)}</CardDescription>
            )}
          </CardHeader>
          <CardPanel>
            <Recording sessionId={sessionId} canDownload={recap.canDownload} />
          </CardPanel>
        </Card>
      )}

      <Snapshots sessionId={sessionId} />

      <Card>
        <CardHeader>
          <CardTitle>Chat</CardTitle>
        </CardHeader>
        <CardPanel>
          <RecapChat sessionId={sessionId} />
        </CardPanel>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Transcript</CardTitle>
          {recap.transcriptUrl && (
            <div className="relative w-full sm:w-64">
              <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 opacity-60" />
              <Input
                aria-label="Search the transcript"
                className="ps-8"
                placeholder="Search the transcript"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>
          )}
        </CardHeader>
        <CardPanel>
          {recap.transcriptUrl ? (
            <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
              <Transcript url={recap.transcriptUrl} search={search} />
            </Suspense>
          ) : (
            <p className="text-muted-foreground text-sm">No transcript was saved for this call.</p>
          )}
        </CardPanel>
      </Card>
    </div>
  );
};
