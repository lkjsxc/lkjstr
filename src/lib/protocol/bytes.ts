const hexPattern = /^[0-9a-f]+$/;

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = tryHexToBytes(hex);
  if (!bytes) throw new Error('invalid lowercase hex');
  return bytes;
}

export function tryHexToBytes(hex: string): Uint8Array | undefined {
  if (hex.length % 2 !== 0) return undefined;
  if (hex.length > 0 && !hexPattern.test(hex)) return undefined;
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function asciiToBytes(text: string): Uint8Array | undefined {
  if ([...text].some((char) => char.charCodeAt(0) > 0x7f)) return undefined;
  return Uint8Array.from([...text].map((char) => char.charCodeAt(0)));
}

export function bytesToAscii(bytes: Uint8Array): string | undefined {
  if ([...bytes].some((byte) => byte > 0x7f)) return undefined;
  return String.fromCharCode(...bytes);
}
