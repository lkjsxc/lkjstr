import { encodeNpub } from '$lib/protocol/nip19';

export function fullNpub(pubkey: string): string {
  try {
    return encodeNpub(pubkey);
  } catch {
    return pubkey;
  }
}
