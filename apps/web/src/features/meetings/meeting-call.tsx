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
import { describeError } from "#/lib/errors.ts";
import { CallEnded } from "./call/call-ended.tsx";
import { CallLobby } from "./call/call-lobby.tsx";
import { CallRoom } from "./call/call-room.tsx";
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
  side?: CallSide;
  onSideChange: (side: CallSide | undefined) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  canControl: boolean;
  watermark: string | null;
};

type CallViewProps = Omit<MeetingCallProps, "inCall" | "onInCallChange"> & {
  onBack: () => void;
  onRejoin: () => void;
  rejoining: boolean;
};

const CallView = ({ title, kind, onBack, onRejoin, rejoining, ...room }: CallViewProps) => {
  const state = useRealtimeKitSelector((m) => m.self.roomState);
  if (state === "joined") return <CallRoom title={title} kind={kind} {...room} />;
  if (state === "init" || state === "waitlisted") {
    return <CallLobby title={title} kind={kind} onBack={onBack} />;
  }
  return <CallEnded title={title} onBack={onBack} onRejoin={onRejoin} rejoining={rejoining} />;
};

export const MeetingCall = ({ meetingId, inCall, onInCallChange, ...props }: MeetingCallProps) => {
  const join = useAction(api.meetings.join);
  const pass = useGuestPass();
  const settings = useQuery(api.settings.getMine, pass.guest ? "skip" : {});
  const [meeting, initMeeting] = useRealtimeKitClient();
  const form = useForm({
    defaultValues: {},
    validators: {
      onSubmitAsync: async () => {
        try {
          const { token } = await join({ meetingId, ...pass });
          await initMeeting({
            authToken: token,
            defaults: {
              audio: !settings?.joinMuted,
              video: !settings?.joinCameraOff,
              plugins: [whiteboardPlugin(token)],
            },
          });
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
        <RealtimeKitProvider value={meeting}>
          <RtkUiProvider meeting={meeting} showSetupScreen>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(rejoining) => (
                <CallView
                  meetingId={meetingId}
                  {...props}
                  onBack={() => {
                    if (meeting.self.roomState === "joined") void meeting.leave();
                    onInCallChange(false);
                  }}
                  onRejoin={() => void form.handleSubmit()}
                  rejoining={rejoining}
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
          Check your camera and mic before you go in.
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
