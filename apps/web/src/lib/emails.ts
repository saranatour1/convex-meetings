export const splitEmails = (text: string) =>
  [...new Set(text.split(/[\s,;]+/).map((email) => email.trim().toLowerCase()))].filter(Boolean);
