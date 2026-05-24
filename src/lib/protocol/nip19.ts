import { bech32 } from '@scure/base';
import { bytesToHex, hexToBytes } from './bytes';
import {
  decodeTlv,
  encodeTlv,
  hexTlv,
  textTlv,
  tlvHex,
  tlvKind,
  tlvRelays,
  tlvText,
  uint32Bytes,
} from './nip19-tlv';
import type { AddressPointer, EventPointer, NostrEntity } from './nip19-types';

const bech32Limit = 5000;

export type {
  AddressPointer,
  EventPointer,
  NostrEntity,
  ProfilePointer,
} from './nip19-types';

export function decodeEntity(value: string): NostrEntity | undefined {
  if (value.length > bech32Limit) return undefined;
  try {
    const { prefix, words } = bech32.decode(value, bech32Limit);
    const bytes = bech32.fromWords(words);
    if (prefix === 'npub' && bytes.length === 32)
      return { type: 'npub', data: bytesToHex(bytes) };
    if (prefix === 'nsec' && bytes.length === 32)
      return { type: 'nsec', data: bytes };
    if (prefix === 'note' && bytes.length === 32)
      return { type: 'note', data: bytesToHex(bytes) };
    if (prefix === 'nprofile') return decodeNprofile(bytes);
    if (prefix === 'nevent') return decodeNevent(bytes);
    if (prefix === 'naddr') return decodeNaddr(bytes);
    return undefined;
  } catch {
    return undefined;
  }
}

export function encodeNpub(pubkey: string): string {
  return encodeBytes('npub', hexToBytes(pubkey));
}

export function encodeNote(id: string): string {
  return encodeBytes('note', hexToBytes(id));
}

export function encodeNsec(secretKey: Uint8Array | string): string {
  return encodeBytes(
    'nsec',
    typeof secretKey === 'string' ? hexToBytes(secretKey) : secretKey,
  );
}

export function encodeNprofile(input: {
  readonly pubkey: string;
  readonly relays?: readonly string[];
}): string {
  return encodeBytes('nprofile', pointerTlv(0, input.pubkey, input.relays));
}

export function encodeNevent(input: EventPointer): string {
  const records = recordsWithRelays(input.relays);
  records[0] = [hexTlv(input.id)];
  if (input.author) records[2] = [hexTlv(input.author)];
  if (input.kind !== undefined) records[3] = [uint32Bytes(input.kind)];
  return encodeBytes('nevent', encodeTlv(records));
}

export function encodeNaddr(input: AddressPointer): string {
  const records = recordsWithRelays(input.relays);
  records[0] = [textTlv(input.identifier)];
  records[2] = [hexTlv(input.pubkey)];
  records[3] = [uint32Bytes(input.kind)];
  return encodeBytes('naddr', encodeTlv(records));
}

function decodeNprofile(bytes: Uint8Array): NostrEntity | undefined {
  const records = decodeTlv(bytes);
  if (!records) return undefined;
  const pubkey = tlvHex(records[0]?.[0]);
  return pubkey
    ? { type: 'nprofile', data: { pubkey, relays: tlvRelays(records) } }
    : undefined;
}

function decodeNevent(bytes: Uint8Array): NostrEntity | undefined {
  const records = decodeTlv(bytes);
  const id = records ? tlvHex(records[0]?.[0]) : undefined;
  if (!records || !id) return undefined;
  const author = records[2]?.[0] ? tlvHex(records[2][0]) : undefined;
  if (records[2]?.[0] && !author) return undefined;
  const kind = records[3]?.[0] ? tlvKind(records[3][0]) : undefined;
  if (records[3]?.[0] && kind === undefined) return undefined;
  return {
    type: 'nevent',
    data: { id, relays: tlvRelays(records), author, kind },
  };
}

function decodeNaddr(bytes: Uint8Array): NostrEntity | undefined {
  const records = decodeTlv(bytes);
  const identifier = records ? tlvText(records[0]?.[0]) : undefined;
  const pubkey = records ? tlvHex(records[2]?.[0]) : undefined;
  const kind = records ? tlvKind(records[3]?.[0]) : undefined;
  if (!records || identifier === undefined || !pubkey || kind === undefined)
    return undefined;
  return {
    type: 'naddr',
    data: { identifier, pubkey, kind, relays: tlvRelays(records) },
  };
}

function pointerTlv(
  type: number,
  hex: string,
  relays: readonly string[] = [],
): Uint8Array {
  const records = recordsWithRelays(relays);
  records[type] = [hexTlv(hex)];
  return encodeTlv(records);
}

function recordsWithRelays(relays: readonly string[] = []) {
  const records: Record<number, Uint8Array[]> = {};
  if (relays.length > 0) records[1] = relays.map(textTlv);
  return records;
}

function encodeBytes(prefix: string, bytes: Uint8Array): string {
  return bech32.encode(prefix, bech32.toWords(bytes), bech32Limit);
}
