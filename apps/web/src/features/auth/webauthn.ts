import {
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

type Failure = { error: string };

const failure = (error: unknown): Failure => {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "AbortError") return { error: "CEREMONY_ABORTED" };
  if (name === "InvalidStateError") return { error: "PASSKEY_ALREADY_REGISTERED" };
  return { error: "WEBAUTHN_UNSUPPORTED" };
};

export const createPasskey = async (optionsJSON: PublicKeyCredentialCreationOptionsJSON) => {
  try {
    const { id, rawId, type, response } = await startRegistration({ optionsJSON });
    return {
      response: {
        id,
        rawId,
        type,
        clientExtensionResults: {},
        response: {
          clientDataJSON: response.clientDataJSON,
          attestationObject: response.attestationObject,
          ...(response.transports ? { transports: response.transports } : {}),
        },
      },
    };
  } catch (error) {
    return failure(error);
  }
};

export const authenticateWithPasskey = async (
  optionsJSON: PublicKeyCredentialRequestOptionsJSON,
) => {
  try {
    const { id, rawId, type, response } = await startAuthentication({ optionsJSON });
    return {
      response: {
        id,
        rawId,
        type,
        clientExtensionResults: {},
        response: {
          clientDataJSON: response.clientDataJSON,
          authenticatorData: response.authenticatorData,
          signature: response.signature,
          ...(response.userHandle ? { userHandle: response.userHandle } : {}),
        },
      },
    };
  } catch (error) {
    return failure(error);
  }
};
