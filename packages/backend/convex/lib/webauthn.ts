import { z } from "zod";

const zCredential = {
  id: z.string(),
  rawId: z.string(),
  clientExtensionResults: z.object({}),
  type: z.literal("public-key"),
};

export const zAuthenticationResponse = z.object({
  ...zCredential,
  response: z.object({
    clientDataJSON: z.string(),
    authenticatorData: z.string(),
    signature: z.string(),
    userHandle: z.string().optional(),
  }),
});

export const zRegistrationResponse = z.object({
  ...zCredential,
  response: z.object({
    clientDataJSON: z.string(),
    attestationObject: z.string(),
    transports: z.array(z.string()).optional(),
  }),
});

export type AuthenticationResponse = z.infer<typeof zAuthenticationResponse>;
export type RegistrationResponse = z.infer<typeof zRegistrationResponse>;

export const toBase64Url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
