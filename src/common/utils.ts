import { CONFIG_KEY, DEFAULTS, SETTINGS_KEY } from "./constants";

const { crypto } = window;

export const pemToSpkiBytes = (pem: string): Uint8Array => {
  const base64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '');

  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const verifySignature = async (
  data: string,
  payloadType: 'jwt' | 'raw' | '',
  signature?: string | null,
): Promise<boolean> => {
  const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  const PUBLIC_KEY_URL = settings.publicKeyUrl || DEFAULTS.PUBLIC_KEY_URL;

  const publicKeyPem = await fetch(PUBLIC_KEY_URL).then(res => res.text());
  const publicKeyBytes = pemToSpkiBytes(publicKeyPem);

  let dataBytes;
  let signatureBytes;

  if (payloadType !== 'jwt') {
    dataBytes = new TextEncoder().encode(data);
    signature = signature?.replace(/ /g, '+') || '';
    signatureBytes = new Uint8Array(atob(signature).split('').map(c => c.charCodeAt(0)));
  } else {
    const [headerB64, payloadB64, signatureB64] = data.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return false;
    const signingInput = `${headerB64}.${payloadB64}`;

    const sigReplaced = signatureB64
      .replace(/-/g, '+')
      .replace(/_/g, '/') + '==='.slice((signatureB64.length + 3) % 4);

    signatureBytes = new Uint8Array(Array.from(atob(sigReplaced), c => c.charCodeAt(0)));
    dataBytes = new TextEncoder().encode(signingInput);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'spki',
    publicKeyBytes.buffer as ArrayBuffer,
    { name: 'Ed25519' },
    false,
    ['verify']
  );

  const isValid = await crypto.subtle.verify(
    { name: 'Ed25519' },
    cryptoKey,
    signatureBytes,
    dataBytes
  );

  return isValid;
};


export const cleanup = (): void => {
  const type = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}').type || DEFAULTS.TYPE;
  localStorage.removeItem(CONFIG_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  if (type !== 'redirect') {
    window.close();
  }
};

export const getDataFromPayload = (payload: string, format: string): Record<string, unknown> => {
  if (format === 'jwt') {
    const [headerB64, payloadB64, signatureB64] = payload.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return {};
    return JSON.parse(atob(payloadB64));
  }
  return JSON.parse(atob(payload));
};
