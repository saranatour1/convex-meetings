const ORIGIN = "http://localhost:3000";
const RP_ID = "localhost";

const encoder = new TextEncoder();

const concat = (...parts: (Uint8Array | number[])[]) =>
  Uint8Array.from(parts.flatMap((part) => [...part]));

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

const sha256 = async (bytes: BufferSource) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));

const cborHead = (major: number, length: number) =>
  length < 24
    ? [(major << 5) | length]
    : length < 256
      ? [(major << 5) | 24, length]
      : [(major << 5) | 25, length >> 8, length & 255];

type Cbor = Uint8Array | string | number | Map<Cbor, Cbor>;

const cbor = (value: Cbor): Uint8Array => {
  if (value instanceof Uint8Array) return concat(cborHead(2, value.length), value);
  if (typeof value === "string") {
    const bytes = encoder.encode(value);
    return concat(cborHead(3, bytes.length), bytes);
  }
  if (typeof value === "number") {
    return Uint8Array.from(value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value));
  }
  return concat(
    cborHead(5, value.size),
    ...[...value].flatMap(([key, item]) => [cbor(key), cbor(item)]),
  );
};

const derInteger = (bytes: Uint8Array) => {
  const start = bytes.findIndex((byte) => byte !== 0);
  const trimmed = bytes.slice(Math.max(0, Math.min(start, bytes.length - 1)));
  const value = (trimmed[0] ?? 0) & 0x80 ? concat([0], trimmed) : trimmed;
  return concat([0x02, value.length], value);
};

const derSignature = (raw: Uint8Array) => {
  const r = derInteger(raw.slice(0, 32));
  const s = derInteger(raw.slice(32));
  return concat([0x30, r.length + s.length], r, s);
};

const clientData = (type: string, challenge: string) =>
  encoder.encode(JSON.stringify({ type, challenge, origin: ORIGIN, crossOrigin: false }));

export const createAuthenticator = async () => {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const credentialId = crypto.getRandomValues(new Uint8Array(16));
  const rpIdHash = await sha256(encoder.encode(RP_ID));
  const userHandle = { value: undefined as string | undefined };

  const register = async (options: { challenge: string; user: { id: string } }) => {
    userHandle.value = options.user.id;
    const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
    const coseKey = cbor(
      new Map<Cbor, Cbor>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, publicKey.slice(1, 33)],
        [-3, publicKey.slice(33)],
      ]),
    );
    const authData = concat(
      rpIdHash,
      [0x45, 0, 0, 0, 0],
      new Uint8Array(16),
      [0, credentialId.length],
      credentialId,
      coseKey,
    );
    const attestationObject = cbor(
      new Map<Cbor, Cbor>([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", authData],
      ]),
    );
    return {
      id: base64Url(credentialId),
      rawId: base64Url(credentialId),
      response: {
        clientDataJSON: base64Url(clientData("webauthn.create", options.challenge)),
        attestationObject: base64Url(attestationObject),
        transports: ["internal"],
      },
      clientExtensionResults: {},
      type: "public-key" as const,
    };
  };

  const assert = async (options: { challenge: string }) => {
    const clientDataJSON = clientData("webauthn.get", options.challenge);
    const authenticatorData = concat(rpIdHash, [0x05, 0, 0, 0, 0]);
    const signed = concat(authenticatorData, await sha256(clientDataJSON));
    const signature = new Uint8Array(
      await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, signed),
    );
    return {
      id: base64Url(credentialId),
      rawId: base64Url(credentialId),
      response: {
        clientDataJSON: base64Url(clientDataJSON),
        authenticatorData: base64Url(authenticatorData),
        signature: base64Url(derSignature(signature)),
        ...(userHandle.value ? { userHandle: userHandle.value } : {}),
      },
      clientExtensionResults: {},
      type: "public-key" as const,
    };
  };

  return { register, assert };
};
