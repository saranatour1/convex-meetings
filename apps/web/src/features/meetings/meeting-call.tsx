import type { ReactNode } from "react";
import { useForm } from "@tanstack/react-form";
import { useAction } from "convex/react";
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
import { CallLobby } from "./call/call-lobby.tsx";
import { CallRoom, type CallPanel } from "./call/call-room.tsx";
import { applyCallTheme } from "./call/call-theme.ts";
import { kindOf, type MeetingKind } from "./meeting-kinds.ts";

type MeetingCallProps = {
  meetingId: Id<"meetings">;
  title: string;
  kind: MeetingKind;
  panel?: CallPanel;
  onPanelChange: (panel: CallPanel | undefined) => void;
  chat: ReactNode;
};

const CallView = ({
  title,
  kind,
  panel,
  onPanelChange,
  chat,
}: Omit<MeetingCallProps, "meetingId">) => {
  const joined = useRealtimeKitSelector((m) => m.self.roomState === "joined");
  return joined ? (
    <CallRoom title={title} kind={kind} panel={panel} onPanelChange={onPanelChange} chat={chat} />
  ) : (
    <CallLobby title={title} kind={kind} />
  );
};

export const MeetingCall = (props: MeetingCallProps) => {
  const join = useAction(api.meetings.join);
  const [meeting, initMeeting] = useRealtimeKitClient({ resetOnLeave: true });
  const form = useForm({
    defaultValues: {},
    validators: {
      onSubmitAsync: async () => {
        try {
          const { token } = await join({ meetingId: props.meetingId });
          await initMeeting({ authToken: token });
          return undefined;
        } catch (error) {
          return describeError(error);
        }
      },
    },
  });

  if (meeting) {
    return (
      <div ref={applyCallTheme}>
        <RealtimeKitProvider value={meeting}>
          <RtkUiProvider meeting={meeting} showSetupScreen>
            <CallView {...props} />
          </RtkUiProvider>
        </RealtimeKitProvider>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed p-4">
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
