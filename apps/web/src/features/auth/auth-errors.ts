const messages: Partial<Record<string, string>> = {
  RATE_LIMITED: "Too many attempts. Try again shortly.",
  CEREMONY_ABORTED: "Passkey prompt was cancelled.",
  WEBAUTHN_UNSUPPORTED: "This browser does not support passkeys.",
  PASSKEY_ALREADY_REGISTERED: "This device already has a passkey for your account.",
  UNKNOWN_CREDENTIAL: "That passkey isn't registered here.",
  CHALLENGE_EXPIRED: "That took too long. Try again.",
  PROTOCOL_ERROR: "That passkey didn't work. Try again.",
};

export const describeAuthError = (code: string) => {
  return messages[code] ?? code.replaceAll("_", " ").toLowerCase();
};
