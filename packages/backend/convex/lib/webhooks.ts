const REALTIME_KEY_URL = "https://api.realtime.cloudflare.com/.well-known/webhooks.json";

const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export const importPublicKey = (pem: string) =>
  crypto.subtle.importKey(
    "spki",
    fromBase64(pem.replace(/-----[^-]+-----|\s/g, "")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

let realtimeKey: Promise<CryptoKey> | undefined;

export const realtimePublicKey = () =>
  (realtimeKey ??= fetch(REALTIME_KEY_URL)
    .then((response) => response.json() as Promise<{ data: { publicKey: string } }>)
    .then(({ data }) => importPublicKey(data.publicKey))
    .catch((error: unknown) => {
      realtimeKey = undefined;
      throw error;
    }));

export const isSignedBy = async (key: CryptoKey, body: string, signature: string) => {
  try {
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      fromBase64(signature),
      new TextEncoder().encode(body),
    );
  } catch {
    return false;
  }
};
