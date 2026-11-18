import { track } from "@databuddy/sdk";
import { useCallback } from "react";
import { useForm } from "@tanstack/react-form";
import { useAction, useQuery } from "convex/react";
import {
  RealtimeKitProvider,
  useRealtimeKitClient,
  useRealtimeKitSelector,
} from "@cloudflare/realtimekit-react";
import { RtkUiProvider } from "@cloudflare/realtimekit-react-ui";
import { VideoIcon } from "lucide-react";
import { api, type Id } from "@meetings/backend";
import { Button } from "@meetings/ui/components/button";
import { FormError } from "#/components/form-error.tsx";
import { LoadingScreen } from "#/components/loading-screen.tsx";
import { describeError } from "#/lib/errors.ts";
import { CallEnded } from "./call/call-ended.tsx";
import { CallLobby } from "./call/call-lobby.tsx";
import { CallRoom } from "./call/call-room.tsx";
import { OutgoingRing } from "./call/outgoing-ring.tsx";
import { applyCallTheme } from "./call/call-theme.ts";
import { type CallSide, whiteboardPlugin } from "./call/call-ui.ts";
import { useGuestPass } from "./guest-pass.ts";
import { kindOf, type MeetingKind } from "./meeting-kinds.ts";

type MeetingCallProps = {
  meetingId: Id<"meetings">;
  title: string;
  kind: MeetingKind;
  inCall: boolean;
  onInCallChange: (inCall: boolean) => void;
  watch?: boolean;
  side?: CallSide;
  onSideChange: (side: CallSide | undefined) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  canControl: boolean;
  isProtected: boolean;
  moderated: boolean;
  devicesInCall: number;
  peopleInCall: string[];
  recap: boolean;
};

type CallViewProps = Omit<MeetingCallProps, "inCall" | "onInCallChange" | "watch"> & {
  onBack: () => void;
  onRejoin: () => void;
  rejoining: boolean;
  joinError?: string;
};

const NO_MEDIA =
  "Your browser couldn't connect to the call's audio and video. Some AI agents' browsers block WebRTC. The chat on the meeting page still works.";

const joinsWithin = (join: () => Promise<unknown>, ms: number) =>
  Promise.race([
    join().then(
      () => true,
      () => false,
    ),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms)),
  ]);

const CallView = ({
  title,
  kind,
  onBack,
  onRejoin,
  rejoining,
  joinError,
  devicesInCall,
  peopleInCall,
  recap,
  ...room
}: CallViewProps) => {
  const switchHere = useAction(api.calls.switchHere);
  const pass = useGuestPass();
  const state = useRealtimeKitSelector((m) => m.self.roomState);
  const waiting = state === "init" || state === "waitlisted";
  if (state === "joined") return <CallRoom title={title} kind={kind} {...room} />;
  if (waiting && rejoining) return <LoadingScreen />;
  if (waiting && !joinError) {
    return (
      <CallLobby
        title={title}
        kind={kind}
        onBack={onBack}
        devicesInCall={devicesInCall}
        peopleInCall={peopleInCall}
        onSwitchHere={() => switchHere({ meetingId: room.meetingId, ...pass })}
      />
    );
  }
  return (
    <CallEnded
      title={title}
      recap={recap}
      onBack={onBack}
      onRejoin={onRejoin}
      rejoining={rejoining}
      error={joinError}
    />
  );
};

export const MeetingCall = ({
  meetingId,
  inCall,
  onInCallChange,
  watch = false,
  ...props
}: MeetingCallProps) => {
  const join = useAction(api.meetings.join);
  const switchHere = useAction(api.calls.switchHere);
  const pass = useGuestPass();
  const settings = useQuery(api.settings.getMine, pass.guest ? "skip" : {});
  const [meeting, initMeeting] = useRealtimeKitClient();
  const watching = watch || (props.moderated && Boolean(pass.guest));
  const form = useForm({
    defaultValues: {},
    validators: {
      onSubmitAsync: async () => {
        try {
          const { token, viewer } = await join({
            meetingId,
            watch,
            userAgent: pass.guest ? navigator.userAgent : undefined,
            ...pass,
          });
          const client = await initMeeting({
            authToken: token,
            defaults: {
              audio: !viewer && !settings?.joinMuted,
              video: !viewer && !settings?.joinCameraOff,
              plugins: props.moderated ? [] : [whiteboardPlugin(token)],
            },
          });
          if (viewer && client) {
            if (props.devicesInCall > 0) await switchHere({ meetingId, ...pass });
            if (!(await joinsWithin(() => client.join(), 15_000))) {
              await client.leave().catch(() => undefined);
              return NO_MEDIA;
            }
          }
          track("call_joined", { kind: props.kind, guest: Boolean(pass.guest) });
          onInCallChange(true);
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });

  const openLobby = useCallback(
    (element: HTMLDivElement | null) => {
      const { isSubmitting, submissionAttempts } = form.state;
      if (element && !isSubmitting && submissionAttempts === 0) void form.handleSubmit();
    },
    [form],
  );

  if (meeting && inCall) {
    return (
      <div ref={applyCallTheme} className="fixed inset-0 z-50 bg-background">
        {!pass.guest && <OutgoingRing meetingId={meetingId} />}
        <RealtimeKitProvider value={meeting}>
          <RtkUiProvider meeting={meeting} showSetupScreen>
            <form.Subscribe
              selector={(state) => ({
                rejoining: state.isSubmitting,
                joinError: state.errorMap.onSubmit,
              })}
            >
              {({ rejoining, joinError }) => (
                <CallView
                  meetingId={meetingId}
                  {...props}
                  onBack={() => {
                    if (meeting.self.roomState === "joined") void meeting.leave();
                    onInCallChange(false);
                  }}
                  onRejoin={() => void form.handleSubmit()}
                  rejoining={rejoining}
                  joinError={joinError}
                />
              )}
            </form.Subscribe>
          </RtkUiProvider>
        </RealtimeKitProvider>
      </div>
    );
  }

  const settled = settings !== undefined || pass.guest !== undefined;

  return (
    <div
      ref={inCall && settled ? openLobby : undefined}
      className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed p-4"
    >
      <span className="grid size-10 place-items-center rounded-full bg-muted">
        <VideoIcon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium text-sm">{kindOf(props.kind).label}</span>
        <span className="text-muted-foreground text-sm">
          {watching
            ? "You'll watch and listen without a camera or mic."
            : "Check your camera and mic before you go in."}
        </span>
        <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
          {(error) => <FormError error={error} />}
        </form.Subscribe>
      </div>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button disabled={isSubmitting} onClick={() => void form.handleSubmit()}>
            <VideoIcon />
            {isSubmitting ? "Connecting…" : "Join the call"}
          </Button>
        )}
      </form.Subscribe>
    </div>
  );
};
