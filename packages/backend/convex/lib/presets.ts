import type { Doc } from "../_generated/dataModel";

type Kind = Doc<"meetings">["kind"];
type Role = Doc<"meetingMembers">["role"];
type Produce = "ALLOWED" | "NOT_ALLOWED" | "CAN_REQUEST";

const PRESET_NAMES: Record<Kind, Record<Role, string>> = {
  groupCall: { host: "call_host", participant: "call_participant" },
  webinar: { host: "webinar_host", participant: "webinar_attendee" },
  classroom: { host: "class_instructor", participant: "class_student" },
  audioRoom: { host: "audio_host", participant: "audio_listener" },
};

export const presetName = (kind: Kind, role: Role) => PRESET_NAMES[kind][role];

const DESIGN_TOKENS = {
  theme: "light",
  border_radius: "rounded",
  border_width: "thin",
  spacing_base: 4,
  google_font: "Inter",
  colors: {
    brand: {
      "300": "#52525b",
      "400": "#3f3f46",
      "500": "#27272a",
      "600": "#18181b",
      "700": "#09090b",
    },
    background: {
      "600": "#d4d4d8",
      "700": "#e4e4e7",
      "800": "#f4f4f5",
      "900": "#fafafa",
      "1000": "#ffffff",
    },
    text: "#09090b",
    text_on_brand: "#ffffff",
    video_bg: "#e4e4e7",
    danger: "#dc2626",
    success: "#16a34a",
    warning: "#d97706",
  },
};

const NO_CHAT = {
  public: { can_send: false, text: false, files: false },
  private: { can_send: false, can_receive: false, text: false, files: false },
};

const preset = (kind: Kind, role: Role) => {
  const host = role === "host";
  const staged = kind === "webinar" || kind === "classroom" || kind === "audioRoom";
  const speaks: Produce = host || !staged ? "ALLOWED" : "CAN_REQUEST";
  const video: Produce = kind === "audioRoom" ? "NOT_ALLOWED" : speaks;
  return {
    name: presetName(kind, role),
    config: {
      view_type:
        kind === "audioRoom" ? "AUDIO_ROOM" : kind === "groupCall" ? "GROUP_CALL" : "WEBINAR",
      max_video_streams: { desktop: 25, mobile: 6 },
      max_screenshare_count: 1,
      media: {
        video: { quality: "hd", frame_rate: 30 },
        screenshare: { quality: "hd", frame_rate: 5 },
      },
    },
    permissions: {
      accept_waiting_requests: host,
      can_accept_production_requests: host,
      can_change_participant_permissions: host,
      can_edit_display_name: false,
      can_livestream: false,
      can_record: host,
      can_spotlight: host,
      chat: NO_CHAT,
      connected_meetings: {
        can_alter_connected_meetings: host && kind === "classroom",
        can_switch_connected_meetings: kind === "classroom",
        can_switch_to_parent_meeting: kind === "classroom",
      },
      disable_participant_audio: host,
      disable_participant_screensharing: host,
      disable_participant_video: host,
      hidden_participant: false,
      kick_participant: host,
      media: {
        audio: { can_produce: speaks },
        video: { can_produce: video },
        screenshare: { can_produce: video },
      },
      pin_participant: host,
      plugins: { can_start: host, can_close: host, can_edit_config: host, config: {} },
      polls: { can_create: host, can_view: true, can_vote: true },
      recorder_type: "NONE",
      show_participant_list: true,
      waiting_room_type: "SKIP",
      stage_enabled: staged,
      stage_access: staged ? speaks : undefined,
      accept_stage_requests: staged && host,
      transcription_enabled: true,
    },
    ui: { design_tokens: DESIGN_TOKENS },
  };
};

export const allPresets = () =>
  (Object.keys(PRESET_NAMES) as Kind[]).flatMap((kind) =>
    (["host", "participant"] as const).map((role) => preset(kind, role)),
  );
