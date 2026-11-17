const MEETING_CODE = /[a-z]{3}-[a-z]{4}-[a-z]{3}/;

export const parseMeetingCode = (text: string) =>
  text.trim().toLowerCase().match(MEETING_CODE)?.[0];
