import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from './bytes';

export type TlvRecord = Readonly<Record<number, readonly Uint8Array[]>>;

export function encodeTlv(records: TlvRecord): Uint8Array {
  const chunks: number[] = [];
  for (const [rawType, values] of Object.entries(records)) {
    const type = Number(rawType);
    if (!Number.isInteger(type) || type < 0 || type > 255) continue;
    for (const value of values) {
      if (value.length > 255) throw new Error('TLV value too long');
      chunks.push(type, value.length, ...value);
    }
  }
  return Uint8Array.from(chunks);
}

export function decodeTlv(bytes: Uint8Array): TlvRecord | undefined {
  const records: Record<number, Uint8Array[]> = {};
  for (let index = 0; index < bytes.length; ) {
    const type = bytes[index++];
    const length = bytes[index++];
    if (type === undefined || length === undefined) return undefined;
    const end = index + length;
    if (end > bytes.length) return undefined;
    records[type] = [...(records[type] ?? []), bytes.slice(index, end)];
    index = end;
  }
  return records;
}

export function tlvHex(value: Uint8Array | undefined): string | undefined {
  return value?.length === 32 ? bytesToHex(value) : undefined;
}

export function tlvText(value: Uint8Array | undefined): string | undefined {
  return value ? bytesToUtf8(value) : undefined;
}

export function tlvRelays(records: TlvRecord): string[] | undefined {
  const relays = records[1]?.map(bytesToUtf8).filter(Boolean) ?? [];
  return relays.length > 0 ? relays : undefined;
}

export function tlvKind(value: Uint8Array | undefined): number | undefined {
  if (!value || value.length !== 4) return undefined;
  return new DataView(
    value.buffer,
    value.byteOffset,
    value.byteLength,
  ).getUint32(0, false);
}

export function uint32Bytes(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff)
    throw new Error('invalid kind');
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

export const hexTlv = (hex: string): Uint8Array => hexToBytes(hex);
export const textTlv = (text: string): Uint8Array => utf8ToBytes(text);
