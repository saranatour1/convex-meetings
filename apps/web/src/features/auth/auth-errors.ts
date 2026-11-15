const messages: Partial<Record<string, string>> = {
  USER_NOT_FOUND: "No account with that username.",
  INVALID_CREDENTIALS: "Wrong password.",
  USERNAME_TAKEN: "That username is taken.",
  RATE_LIMITED: "Too many attempts. Try again shortly.",
  CEREMONY_ABORTED: "Passkey prompt was cancelled.",
  WEBAUTHN_UNSUPPORTED: "This browser does not support passkeys.",
};

export function describeAuthError(code: string) {
  return messages[code] ?? code.replaceAll("_", " ").toLowerCase();
}
