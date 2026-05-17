import * as upstream from 'nostr-tools/nip19';

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

export function encodeNote(id: string): string {
  return upstream.noteEncode(id);
}
