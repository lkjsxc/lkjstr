import { encodeNpub } from '../protocol';

export function shortNpub(pubkey: string): string {
  try {
    const npub = encodeNpub(pubkey);
    return `${npub.slice(0, 10)}:${npub.slice(-6)}`;
  } catch {
    return `${pubkey.slice(0, 8)}:${pubkey.slice(-6)}`;
  }
}

export function bestDisplayName(args: {
  readonly displayName?: string | null;
  readonly name?: string | null;
  readonly nip05?: string | null;
  readonly pubkey: string;
}): string {
  return args.displayName || args.name || args.nip05 || shortNpub(args.pubkey);
}
