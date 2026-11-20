import { type CallSearch, validateCallSearch } from "./call/call-search.ts";

const MEETING_TABS = ["chat", "transcript", "recaps"] as const;

export type MeetingTab = (typeof MEETING_TABS)[number];

export type MeetingSearch = CallSearch & { tab?: MeetingTab; edit?: true };

export const validateMeetingSearch = (search: Record<string, unknown>): MeetingSearch => ({
  ...validateCallSearch(search),
  tab: MEETING_TABS.find((tab) => tab === search.tab),
  edit: search.edit === true || search.edit === "true" ? true : undefined,
});
