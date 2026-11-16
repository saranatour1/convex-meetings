export const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const oneLine = (text: string) => text.replace(/[\r\n]+/g, " ").trim();
