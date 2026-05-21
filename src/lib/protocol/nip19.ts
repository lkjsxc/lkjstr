import * as upstream from 'nostr-tools/nip19';
import { hexToBytes } from 'nostr-tools/utils';

export type NostrEntity = ReturnType<typeof upstream.decode>;

export function decodeEntity(value: string): NostrEntity | undefined {
  try {
    return upstream.decode(value);
  } catch {
    return undefined;
  }
}

export function encodeNpub(pubkey: string): string {
  return upstream.npubEncode(pubkey);
}

export function encodeNprofile(input: {
  readonly pubkey: string;
  readonly relays?: readonly string[];
}): string {
  return upstream.nprofileEncode({
    pubkey: input.pubkey,
    relays: [...(input.relays ?? [])],
  });
}

export function encodeNote(id: string): string {
  return upstream.noteEncode(id);
}

export function encodeNsec(secretKeyHex: string): string {
  return upstream.nsecEncode(hexToBytes(secretKeyHex));
}
